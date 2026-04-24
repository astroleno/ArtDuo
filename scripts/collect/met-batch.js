#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Command } = require('commander');

const MET_API_BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';
const SEARCH_MAX_RETRIES = 3;
const DETAIL_MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 1500;
const DEFAULT_LIMIT = 100;
const DEFAULT_OUTPUT_ROOT = path.resolve(__dirname, '../../data/sources/met/batch');
const DEFAULT_CANDIDATE_ROOT = path.resolve(__dirname, '../../data/curation/candidate-pool');
const DEFAULT_REVIEW_ROOT = path.resolve(__dirname, '../../data/curation/review-queue');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sanitizeSegment(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'unnamed';
}

function timestampForId(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function fetchJson(url, retries) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.status === 403 || response.status === 429) {
        if (attempt === retries) {
          throw new Error(`HTTP ${response.status}`);
        }
        await sleep(RETRY_BASE_DELAY * attempt);
        continue;
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      await sleep(RETRY_BASE_DELAY * attempt);
    }
  }

  throw new Error('unreachable');
}

async function searchMetMuseum(term, { titleOnly = false } = {}) {
  const params = new URLSearchParams({
    hasImages: 'true',
    q: term,
  });

  if (titleOnly) {
    params.append('title', 'true');
  }

  const url = `${MET_API_BASE}/search?${params.toString()}`;
  const data = await fetchJson(url, SEARCH_MAX_RETRIES);

  return {
    term,
    titleOnly,
    total: data.total || 0,
    objectIDs: Array.isArray(data.objectIDs) ? data.objectIDs : [],
  };
}

function summarizeDescription(objectData) {
  return objectData.galleryLabelText || objectData.additionalText || '';
}

async function getArtworkDetail(objectID) {
  const url = `${MET_API_BASE}/objects/${objectID}`;
  const data = await fetchJson(url, DETAIL_MAX_RETRIES);

  return {
    id: `met-${data.objectID}`,
    source: 'met',
    sourceArtworkId: String(data.objectID),
    title: data.title || 'Untitled',
    artistDisplayName: data.artistDisplayName || 'Unknown Artist',
    yearLabel: data.objectDate || '',
    objectUrl: data.objectURL || '',
    department: data.department || '',
    classification: data.classification || '',
    culture: data.culture || '',
    medium: data.medium || '',
    descriptionRaw: summarizeDescription(data),
    imageUrlPreview: data.primaryImageSmall || '',
    imageUrlFull: data.primaryImage || '',
    hasImage: Boolean(data.primaryImage || data.primaryImageSmall),
    metadataDate: data.metadataDate || '',
    sourceAssetFingerprint: data.objectID ? `met:${data.objectID}:${data.metadataDate || 'unknown'}` : '',
    mediaVersion: data.metadataDate || '',
  };
}

function normalizeRecord(record) {
  const excludeReasons = [];

  if (!record.title) {
    excludeReasons.push('missing-title');
  }
  if (!record.artistDisplayName) {
    excludeReasons.push('missing-artist');
  }
  if (!record.hasImage) {
    excludeReasons.push('missing-image');
  }
  if (!record.descriptionRaw) {
    excludeReasons.push('missing-description');
  }
  if (!record.objectUrl) {
    excludeReasons.push('missing-object-url');
  }

  return {
    sourceArtworkId: record.sourceArtworkId,
    id: record.id,
    source: record.source,
    metadata: {
      title: record.title,
      artistDisplayName: record.artistDisplayName,
      yearLabel: record.yearLabel,
      department: record.department,
      classification: record.classification,
      culture: record.culture,
      medium: record.medium,
      objectUrl: record.objectUrl,
      descriptionRaw: record.descriptionRaw,
    },
    media: {
      baseImageUrl: record.imageUrlPreview || record.imageUrlFull,
      imageUrlPreview: record.imageUrlPreview,
      imageUrlFull: record.imageUrlFull,
      mediaVersion: record.mediaVersion,
      sourceAssetFingerprint: record.sourceAssetFingerprint,
    },
    pipeline: {
      status: excludeReasons.length ? 'exclude' : 'candidate',
      excludeReasons,
    },
  };
}

function buildBatchReport({ runId, theme, query, synonyms, normalizedRecords, excludeCounts, searchResults }) {
  const kept = normalizedRecords.filter(item => item.pipeline.status === 'candidate').length;
  const excluded = normalizedRecords.length - kept;

  return {
    runId,
    source: 'met',
    theme,
    query,
    synonyms,
    createdAt: new Date().toISOString(),
    searchResults: {
      uniqueHitCount: searchResults.uniqueHitCount,
      searchDigest: searchResults.searchDigest,
    },
    counts: {
      rawDetailCount: normalizedRecords.length,
      candidateCount: kept,
      excludedCount: excluded,
    },
    excludeCounts,
    nextAction: kept > 0 ? 'move kept records to review queue' : 'refine query and rerun probe/batch',
  };
}

function buildBatchMarkdown(report) {
  return [
    `# Batch Report: ${report.theme}`,
    '',
    `- runId: \`${report.runId}\``,
    `- query: \`${report.query}\``,
    `- synonyms: ${report.synonyms.length ? report.synonyms.map(item => `\`${item}\``).join(', ') : 'none'}`,
    '',
    '## Counts',
    '',
    `- unique hits: ${report.searchResults.uniqueHitCount}`,
    `- raw detail count: ${report.counts.rawDetailCount}`,
    `- candidate count: ${report.counts.candidateCount}`,
    `- excluded count: ${report.counts.excludedCount}`,
    '',
    '## Exclude Reasons',
    '',
    ...Object.entries(report.excludeCounts).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Next Action',
    '',
    `- ${report.nextAction}`,
    '',
  ].join('\n');
}

async function runBatch(options) {
  const runId = options.runId || `${timestampForId(new Date())}--${sanitizeSegment(options.theme)}--${sanitizeSegment(options.query)}`;
  const batchDir = path.join(path.resolve(options.outputRoot), sanitizeSegment(options.theme), runId);
  ensureDir(batchDir);
  ensureDir(path.resolve(options.candidateRoot));
  ensureDir(path.resolve(options.reviewRoot));

  const searchTerms = unique([options.query, ...options.synonyms]);
  const searches = [];
  const uniqueIds = new Set();

  for (const term of searchTerms) {
    const result = await searchMetMuseum(term, { titleOnly: options.titleOnly });
    const limitedIds = result.objectIDs.slice(0, options.limit);
    searches.push({
      term,
      titleOnly: options.titleOnly,
      total: result.total,
      objectIDs: limitedIds,
    });
    limitedIds.forEach(id => uniqueIds.add(id));
    await sleep(200);
  }

  const candidateIds = [...uniqueIds].slice(0, options.limit);
  const rawDetails = [];

  for (const objectID of candidateIds) {
    try {
      rawDetails.push(await getArtworkDetail(objectID));
    } catch (error) {
      rawDetails.push({
        id: `met-${objectID}`,
        source: 'met',
        sourceArtworkId: String(objectID),
        title: '',
        artistDisplayName: '',
        objectUrl: '',
        descriptionRaw: '',
        imageUrlPreview: '',
        imageUrlFull: '',
        hasImage: false,
        error: error.message,
      });
    }
    await sleep(100);
  }

  const normalizedRecords = rawDetails.map(normalizeRecord);
  const excludeCounts = normalizedRecords.reduce((acc, record) => {
    for (const reason of record.pipeline.excludeReasons) {
      acc[reason] = (acc[reason] || 0) + 1;
    }
    return acc;
  }, {});

  const searchResultsPayload = {
    runId,
    source: 'met',
    theme: options.theme,
    uniqueHitCount: uniqueIds.size,
    candidateObjectIDs: candidateIds,
    searches,
    searchDigest: crypto.createHash('sha256').update(JSON.stringify(searches)).digest('hex'),
  };

  const report = buildBatchReport({
    runId,
    theme: options.theme,
    query: options.query,
    synonyms: options.synonyms,
    normalizedRecords,
    excludeCounts,
    searchResults: searchResultsPayload,
  });

  const candidateRecords = normalizedRecords.filter(item => item.pipeline.status === 'candidate');
  const candidateFile = path.join(path.resolve(options.candidateRoot), `${sanitizeSegment(options.theme)}--${runId}.json`);
  const reviewFile = path.join(path.resolve(options.reviewRoot), `${sanitizeSegment(options.theme)}--${runId}.json`);

  fs.writeFileSync(path.join(batchDir, 'query.json'), JSON.stringify({
    runId,
    source: 'met',
    theme: options.theme,
    query: options.query,
    synonyms: options.synonyms,
    excludes: options.excludes,
    titleOnly: options.titleOnly,
    limit: options.limit,
  }, null, 2));
  fs.writeFileSync(path.join(batchDir, 'search-results.json'), JSON.stringify(searchResultsPayload, null, 2));
  fs.writeFileSync(path.join(batchDir, 'raw-details.json'), JSON.stringify(rawDetails, null, 2));
  fs.writeFileSync(path.join(batchDir, 'normalized.json'), JSON.stringify(normalizedRecords, null, 2));
  fs.writeFileSync(path.join(batchDir, 'batch-report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(batchDir, 'batch-report.md'), buildBatchMarkdown(report));
  fs.writeFileSync(candidateFile, JSON.stringify(candidateRecords, null, 2));
  fs.writeFileSync(reviewFile, JSON.stringify(candidateRecords, null, 2));

  console.log(`Batch complete: ${batchDir}`);
  console.log(`Candidates written: ${candidateFile}`);
  console.log(`Review queue written: ${reviewFile}`);
}

const collectOption = (value, previous) => {
  previous.push(value);
  return previous;
};

const program = new Command();
program
  .name('met-batch')
  .description('Run a V2 Met Museum batch collection and write batch/candidate/review artifacts.')
  .requiredOption('--theme <theme>', 'theme label, for example melancholy')
  .requiredOption('--query <query>', 'primary search query')
  .option('--synonym <term>', 'additional synonym term, repeatable', collectOption, [])
  .option('--exclude <term>', 'exclude or failed term note, repeatable', collectOption, [])
  .option('--limit <number>', 'max candidate ids to keep', value => Number.parseInt(value, 10), DEFAULT_LIMIT)
  .option('--title-only', 'search title only')
  .option('--run-id <runId>', 'optional explicit run id')
  .option('--output-root <dir>', 'output root directory', DEFAULT_OUTPUT_ROOT)
  .option('--candidate-root <dir>', 'candidate pool directory', DEFAULT_CANDIDATE_ROOT)
  .option('--review-root <dir>', 'review queue directory', DEFAULT_REVIEW_ROOT)
  .showHelpAfterError();

program.parse();

const options = program.opts();

runBatch({
  theme: options.theme,
  query: options.query,
  synonyms: options.synonym || [],
  excludes: options.exclude || [],
  limit: Number.isFinite(options.limit) ? options.limit : DEFAULT_LIMIT,
  titleOnly: Boolean(options.titleOnly),
  runId: options.runId,
  outputRoot: options.outputRoot,
  candidateRoot: options.candidateRoot,
  reviewRoot: options.reviewRoot,
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
