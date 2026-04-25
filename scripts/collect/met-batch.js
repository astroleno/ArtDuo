#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Command } = require('commander');

const MET_API_BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';
const SEARCH_MAX_RETRIES = 3;
const DETAIL_MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 1500;
const REQUEST_TIMEOUT_MS = 15000;
const DEFAULT_LIMIT = 100;
const DEFAULT_DETAIL_CONCURRENCY = 1;
const DEFAULT_OUTPUT_ROOT = path.resolve(__dirname, '../../data/sources/met/batch');
const DEFAULT_CANDIDATE_ROOT = path.resolve(__dirname, '../../data/curation/candidate-pool');
const DEFAULT_REVIEW_ROOT = path.resolve(__dirname, '../../data/curation/review-queue');
const DEFAULT_REPORT_ROOT = path.resolve(__dirname, '../../data/curation/reports');
const DEFAULT_APPROVED_MATRIX = path.resolve(
  __dirname,
  '../../data/curation/reports/probe-approved-query-matrix.json',
);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

function arraysEqual(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function relativeToCwd(filePath) {
  return path.relative(process.cwd(), filePath).replace(/\\/g, '/');
}

function mergeSearchObjectIds(searches, limit) {
  const merged = [];
  const seen = new Set();
  const longestSearch = searches.reduce((max, search) => Math.max(max, search.objectIDs.length), 0);

  for (let index = 0; index < longestSearch && merged.length < limit; index += 1) {
    for (const search of searches) {
      const objectID = search.objectIDs[index];
      if (!objectID || seen.has(objectID)) {
        continue;
      }
      seen.add(objectID);
      merged.push(objectID);
      if (merged.length >= limit) {
        break;
      }
    }
  }

  return merged;
}

async function mapWithConcurrency(items, concurrency, iterator) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await iterator(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

async function fetchJson(url, retries) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, { signal: controller.signal });
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
      const normalizedError = error?.name === 'AbortError'
        ? new Error(`Request timeout after ${REQUEST_TIMEOUT_MS}ms`)
        : error;
      if (attempt === retries) {
        throw normalizedError;
      }
      await sleep(RETRY_BASE_DELAY * attempt);
    } finally {
      clearTimeout(timeoutId);
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
  const metadataGaps = [];

  if (!record.title) {
    excludeReasons.push('missing-title');
  }
  if (!record.hasImage) {
    excludeReasons.push('missing-image');
  }
  if (!record.objectUrl) {
    excludeReasons.push('missing-object-url');
  }
  if (!record.artistDisplayName) {
    metadataGaps.push('missing-artist');
  }
  if (!record.descriptionRaw) {
    metadataGaps.push('missing-description');
  }
  if (!record.artistDisplayName && !record.descriptionRaw) {
    excludeReasons.push('missing-artist-and-description');
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
      metadataGaps,
    },
  };
}

function buildBatchReport({ runId, theme, query, synonyms, normalizedRecords, excludeCounts, metadataGapCounts, searchResults }) {
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
    metadataGapCounts,
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
    '## Metadata Gaps',
    '',
    ...Object.entries(report.metadataGapCounts).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Next Action',
    '',
    `- ${report.nextAction}`,
    '',
  ].join('\n');
}

function resolveBatchInput(options) {
  const manualQuery = options.query || '';
  const manualSynonyms = unique(options.synonyms || []);
  const manualExcludes = unique(options.excludes || []);

  if (!options.useApprovedMatrix) {
    if (!manualQuery) {
      throw new Error('Either provide --query or enable --use-approved-matrix.');
    }

    return {
      theme: options.theme,
      query: manualQuery,
      synonyms: manualSynonyms,
      excludes: manualExcludes,
      approval: null,
    };
  }

  const approvedMatrixPath = path.resolve(options.approvedMatrixPath || DEFAULT_APPROVED_MATRIX);
  const approvedMatrix = readJson(approvedMatrixPath);
  const approvedEntry = Array.isArray(approvedMatrix.themes)
    ? approvedMatrix.themes.find(item => item.theme === options.theme)
    : null;

  if (!approvedEntry) {
    throw new Error(
      `Theme "${options.theme}" is not approved in ${relativeToCwd(approvedMatrixPath)}.`,
    );
  }

  const approvedInput = approvedEntry.approvedBatchInput || {};
  const approvedSynonyms = unique(approvedInput.synonyms || []);
  const approvedExcludes = unique(approvedInput.excludes || []);
  const overrideDiffs = [];

  if (manualQuery && manualQuery !== approvedInput.query) {
    overrideDiffs.push(`query=${manualQuery}`);
  }
  if (manualSynonyms.length > 0 && !arraysEqual(manualSynonyms, approvedSynonyms)) {
    overrideDiffs.push(`synonyms=${manualSynonyms.join(', ')}`);
  }
  if (manualExcludes.length > 0 && !arraysEqual(manualExcludes, approvedExcludes)) {
    overrideDiffs.push(`excludes=${manualExcludes.join(', ')}`);
  }

  if (overrideDiffs.length > 0) {
    throw new Error(
      `Approved matrix conflict for theme "${options.theme}". Remove manual overrides or rerun without --use-approved-matrix. Overrides seen: ${overrideDiffs.join('; ')}`,
    );
  }

  return {
    theme: options.theme,
    query: approvedInput.query,
    synonyms: approvedSynonyms,
    excludes: approvedExcludes,
    approval: {
      matrixPath: relativeToCwd(approvedMatrixPath),
      probeRunId: approvedEntry.probeRunId,
      note: approvedEntry.note || '',
    },
  };
}

async function runBatch(options) {
  const resolvedInput = resolveBatchInput(options);
  const runId = options.runId
    || `${timestampForId(new Date())}--${sanitizeSegment(resolvedInput.theme)}--${sanitizeSegment(resolvedInput.query)}`;
  const batchDir = path.join(path.resolve(options.outputRoot), sanitizeSegment(resolvedInput.theme), runId);
  ensureDir(batchDir);
  ensureDir(path.resolve(options.candidateRoot));
  ensureDir(path.resolve(options.reviewRoot));
  ensureDir(path.resolve(options.reportRoot));

  const searchTerms = unique([resolvedInput.query, ...resolvedInput.synonyms]);
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

  const candidateIds = mergeSearchObjectIds(searches, options.limit);
  let completedDetails = 0;
  const rawDetails = await mapWithConcurrency(candidateIds, options.detailConcurrency, async objectID => {
    try {
      return await getArtworkDetail(objectID);
    } catch (error) {
      return {
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
      };
    } finally {
      completedDetails += 1;
      if (completedDetails % 25 === 0 || completedDetails === candidateIds.length) {
        console.log(
          `[${resolvedInput.theme}] detail progress ${completedDetails}/${candidateIds.length} (concurrency=${options.detailConcurrency})`,
        );
      }
      await sleep(100);
    }
  });

  const normalizedRecords = rawDetails.map(normalizeRecord);
  const excludeCounts = normalizedRecords.reduce((acc, record) => {
    for (const reason of record.pipeline.excludeReasons) {
      acc[reason] = (acc[reason] || 0) + 1;
    }
    return acc;
  }, {});
  const metadataGapCounts = normalizedRecords.reduce((acc, record) => {
    for (const gap of record.pipeline.metadataGaps) {
      acc[gap] = (acc[gap] || 0) + 1;
    }
    return acc;
  }, {});

  const searchResultsPayload = {
    runId,
    source: 'met',
    theme: resolvedInput.theme,
    uniqueHitCount: uniqueIds.size,
    candidateObjectIDs: candidateIds,
    searches,
    searchDigest: crypto.createHash('sha256').update(JSON.stringify(searches)).digest('hex'),
  };

  const report = buildBatchReport({
    runId,
    theme: resolvedInput.theme,
    query: resolvedInput.query,
    synonyms: resolvedInput.synonyms,
    normalizedRecords,
    excludeCounts,
    metadataGapCounts,
    searchResults: searchResultsPayload,
  });

  const candidateRecords = normalizedRecords.filter(item => item.pipeline.status === 'candidate');
  const candidateFile = path.join(path.resolve(options.candidateRoot), `${sanitizeSegment(resolvedInput.theme)}--${runId}.json`);
  const reviewFile = path.join(path.resolve(options.reviewRoot), `${sanitizeSegment(resolvedInput.theme)}--${runId}.json`);
  const gapReportFile = path.join(path.resolve(options.reportRoot), `gap-report-${runId}.json`);

  fs.writeFileSync(path.join(batchDir, 'query.json'), JSON.stringify({
    runId,
    source: 'met',
    theme: resolvedInput.theme,
    query: resolvedInput.query,
    synonyms: resolvedInput.synonyms,
    excludes: resolvedInput.excludes,
    titleOnly: options.titleOnly,
    limit: options.limit,
    probeApproval: resolvedInput.approval,
  }, null, 2));
  fs.writeFileSync(path.join(batchDir, 'search-results.json'), JSON.stringify(searchResultsPayload, null, 2));
  fs.writeFileSync(path.join(batchDir, 'raw-details.json'), JSON.stringify(rawDetails, null, 2));
  fs.writeFileSync(path.join(batchDir, 'normalized.json'), JSON.stringify(normalizedRecords, null, 2));
  fs.writeFileSync(path.join(batchDir, 'batch-report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(batchDir, 'batch-report.md'), buildBatchMarkdown(report));
  fs.writeFileSync(candidateFile, JSON.stringify(candidateRecords, null, 2));
  fs.writeFileSync(reviewFile, JSON.stringify(candidateRecords, null, 2));
  fs.writeFileSync(gapReportFile, JSON.stringify({
    runId,
    source: 'met',
    theme: resolvedInput.theme,
    query: resolvedInput.query,
    synonyms: resolvedInput.synonyms,
    counts: report.counts,
    excludeCounts,
    metadataGapCounts,
    probeApproval: resolvedInput.approval,
  }, null, 2));

  console.log(`Batch complete: ${batchDir}`);
  if (resolvedInput.approval) {
    console.log(
      `Approved matrix: ${resolvedInput.approval.matrixPath} (probe ${resolvedInput.approval.probeRunId})`,
    );
  }
  console.log(`Candidates written: ${candidateFile}`);
  console.log(`Review queue written: ${reviewFile}`);
  console.log(`Gap report written: ${gapReportFile}`);
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
  .option('--query <query>', 'primary search query')
  .option('--synonym <term>', 'additional synonym term, repeatable', collectOption, [])
  .option('--exclude <term>', 'exclude or failed term note, repeatable', collectOption, [])
  .option('--use-approved-matrix', 'load query/synonym/exclude from the canonical probe-approved matrix')
  .option(
    '--approved-matrix-path <path>',
    'override the approved probe matrix path',
    DEFAULT_APPROVED_MATRIX,
  )
  .option('--limit <number>', 'max candidate ids to keep', value => Number.parseInt(value, 10), DEFAULT_LIMIT)
  .option(
    '--detail-concurrency <number>',
    'number of parallel Met detail fetches to run',
    value => Number.parseInt(value, 10),
    DEFAULT_DETAIL_CONCURRENCY,
  )
  .option('--title-only', 'search title only')
  .option('--run-id <runId>', 'optional explicit run id')
  .option('--output-root <dir>', 'output root directory', DEFAULT_OUTPUT_ROOT)
  .option('--candidate-root <dir>', 'candidate pool directory', DEFAULT_CANDIDATE_ROOT)
  .option('--review-root <dir>', 'review queue directory', DEFAULT_REVIEW_ROOT)
  .option('--report-root <dir>', 'curation reports directory', DEFAULT_REPORT_ROOT)
  .showHelpAfterError();

program.parse();

const options = program.opts();

runBatch({
  theme: options.theme,
  query: options.query || '',
  synonyms: options.synonym || [],
  excludes: options.exclude || [],
  useApprovedMatrix: Boolean(options.useApprovedMatrix),
  approvedMatrixPath: options.approvedMatrixPath,
  limit: Number.isFinite(options.limit) ? options.limit : DEFAULT_LIMIT,
  detailConcurrency: Number.isFinite(options.detailConcurrency) ? options.detailConcurrency : DEFAULT_DETAIL_CONCURRENCY,
  titleOnly: Boolean(options.titleOnly),
  runId: options.runId,
  outputRoot: options.outputRoot,
  candidateRoot: options.candidateRoot,
  reviewRoot: options.reviewRoot,
  reportRoot: options.reportRoot,
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
