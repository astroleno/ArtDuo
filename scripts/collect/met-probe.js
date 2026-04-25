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
const DEFAULT_LIMIT = 20;
const DEFAULT_SAMPLE_SIZE = 10;
const DEFAULT_OUTPUT_ROOT = path.resolve(__dirname, '../../data/sources/met/probe');

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
    objectID: data.objectID,
    title: data.title || 'Untitled',
    artistDisplayName: data.artistDisplayName || 'Unknown Artist',
    yearLabel: data.objectDate || '',
    department: data.department || '',
    classification: data.classification || '',
    culture: data.culture || '',
    medium: data.medium || '',
    objectUrl: data.objectURL || '',
    imageUrlPreview: data.primaryImageSmall || '',
    imageUrlFull: data.primaryImage || '',
    descriptionRaw: summarizeDescription(data),
    tags: Array.isArray(data.tags) ? data.tags.map(tag => tag.term).filter(Boolean) : [],
    hasImage: Boolean(data.primaryImage || data.primaryImageSmall),
    hasDescription: Boolean(summarizeDescription(data)),
    hasArtist: Boolean(data.artistDisplayName),
    metadataDate: data.metadataDate || '',
    repository: data.repository || '',
  };
}

function buildProbeReport({ runId, theme, query, synonyms, excludes, queryResults, detailSample, recommendedVerdict }) {
  const sampled = detailSample.objects.length;
  const imageCount = detailSample.objects.filter(item => item.hasImage).length;
  const descriptionCount = detailSample.objects.filter(item => item.hasDescription).length;
  const artistCount = detailSample.objects.filter(item => item.hasArtist).length;
  const usableHits = detailSample.objects.filter(item => item.hasImage && (item.hasDescription || item.hasArtist)).length;

  const rows = detailSample.objects.slice(0, 10).map((item, index) => {
    const imageMark = item.hasImage ? 'yes' : 'no';
    const descMark = item.hasDescription ? 'yes' : 'no';
    return `| ${index + 1} | ${item.sourceArtworkId} | ${item.title.replace(/\|/g, '/')} | ${item.artistDisplayName.replace(/\|/g, '/')} | ${imageMark} | ${descMark} |`;
  });

  return [
    `# Probe Report: ${theme}`,
    '',
    `- runId: \`${runId}\``,
    '- source: `met`',
    `- query: \`${query}\``,
    `- synonyms: ${synonyms.length ? synonyms.map(item => `\`${item}\``).join(', ') : 'none'}`,
    `- excludes: ${excludes.length ? excludes.map(item => `\`${item}\``).join(', ') : 'none'}`,
    `- recommended verdict: \`${recommendedVerdict}\``,
    '',
    '## Totals',
    '',
    `- unique hits: ${queryResults.uniqueHitCount}`,
    `- sampled details: ${sampled}`,
    `- usable hits in sample: ${usableHits}`,
    `- image coverage: ${sampled ? `${imageCount}/${sampled}` : '0/0'}`,
    `- description coverage: ${sampled ? `${descriptionCount}/${sampled}` : '0/0'}`,
    `- artist coverage: ${sampled ? `${artistCount}/${sampled}` : '0/0'}`,
    '',
    '## Query Matrix',
    '',
    ...queryResults.searches.map(result => `- \`${result.term}\`: total=${result.total}, collected=${result.objectIDs.length}`),
    '',
    '## Sample Review Table',
    '',
    '| # | sourceArtworkId | title | artist | image | description |',
    '| --- | --- | --- | --- | --- | --- |',
    ...(rows.length ? rows : ['| - | - | - | - | - | - |']),
    '',
    '## Manual Review Questions',
    '',
    '- 命中数量够不够？',
    '- 画面质量够不够？',
    '- metadata 完整度怎么样？',
    '- 查询词是否偏题？',
    '- 哪些词值得保留，哪些词要禁用？',
    '',
    '## Next Action',
    '',
    `- suggested next step: ${recommendedVerdict === 'pass' ? 'move to batch' : recommendedVerdict === 'mixed' ? 'refine query and rerun probe' : 'stop and revisit theme/query design'}`,
    '',
  ].join('\n');
}

function recommendVerdict(detailObjects) {
  const sampleCount = detailObjects.length;
  const usableHits = detailObjects.filter(item => item.hasImage && (item.hasDescription || item.hasArtist)).length;
  const coverage = sampleCount ? usableHits / sampleCount : 0;

  if (usableHits >= 5 && coverage >= 0.5) {
    return 'pass';
  }
  if (usableHits >= 2) {
    return 'mixed';
  }
  return 'fail';
}

async function runProbe(options) {
  const createdAt = new Date().toISOString();
  const runId = options.runId || `${timestampForId(new Date())}--${sanitizeSegment(options.theme)}--${sanitizeSegment(options.query)}`;
  const runDir = path.join(path.resolve(options.outputRoot), sanitizeSegment(options.theme), runId);
  ensureDir(runDir);

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
      objectIDsPreview: limitedIds.slice(0, 20),
    });
    limitedIds.forEach(id => uniqueIds.add(id));
    await sleep(200);
  }

  const candidateIds = mergeSearchObjectIds(searches, options.limit);
  const sampleIds = candidateIds.slice(0, options.sample);
  const detailObjects = [];

  for (const objectID of sampleIds) {
    try {
      const detail = await getArtworkDetail(objectID);
      detailObjects.push(detail);
    } catch (error) {
      detailObjects.push({
        id: `met-${objectID}`,
        source: 'met',
        sourceArtworkId: String(objectID),
        title: 'FETCH_FAILED',
        artistDisplayName: 'FETCH_FAILED',
        hasImage: false,
        hasDescription: false,
        hasArtist: false,
        error: error.message,
      });
    }
    await sleep(100);
  }

  const recommendedVerdict = recommendVerdict(detailObjects);
  const queryPayload = {
    runId,
    createdAt,
    source: 'met',
    theme: options.theme,
    query: options.query,
    synonyms: options.synonyms,
    excludes: options.excludes,
    titleOnly: options.titleOnly,
    limit: options.limit,
    sample: options.sample,
    legacyCollectorReference: 'scripts/collect/met-collect.js',
  };

  const searchResultsPayload = {
    runId,
    createdAt,
    source: 'met',
    theme: options.theme,
    uniqueHitCount: uniqueIds.size,
    candidateObjectIDs: candidateIds,
    searches,
    searchDigest: crypto.createHash('sha256').update(JSON.stringify(searches)).digest('hex'),
  };

  const detailSamplePayload = {
    runId,
    createdAt,
    source: 'met',
    theme: options.theme,
    sampleObjectIDs: sampleIds,
    objects: detailObjects,
    reviewSignals: {
      usableHits: detailObjects.filter(item => item.hasImage && (item.hasDescription || item.hasArtist)).length,
      imageCoverage: detailObjects.length ? Number((detailObjects.filter(item => item.hasImage).length / detailObjects.length).toFixed(3)) : 0,
      descriptionCoverage: detailObjects.length ? Number((detailObjects.filter(item => item.hasDescription).length / detailObjects.length).toFixed(3)) : 0,
      artistCoverage: detailObjects.length ? Number((detailObjects.filter(item => item.hasArtist).length / detailObjects.length).toFixed(3)) : 0,
      recommendedVerdict,
    },
  };

  const reportMarkdown = buildProbeReport({
    runId,
    theme: options.theme,
    query: options.query,
    synonyms: options.synonyms,
    excludes: options.excludes,
    queryResults: searchResultsPayload,
    detailSample: detailSamplePayload,
    recommendedVerdict,
  });

  fs.writeFileSync(path.join(runDir, 'query.json'), JSON.stringify(queryPayload, null, 2));
  fs.writeFileSync(path.join(runDir, 'search-results.json'), JSON.stringify(searchResultsPayload, null, 2));
  fs.writeFileSync(path.join(runDir, 'detail-sample.json'), JSON.stringify(detailSamplePayload, null, 2));
  fs.writeFileSync(path.join(runDir, 'probe-report.md'), reportMarkdown);

  console.log(`Probe complete: ${runDir}`);
  console.log(`Recommended verdict: ${recommendedVerdict}`);
}

const collectOption = (value, previous) => {
  previous.push(value);
  return previous;
};

const program = new Command();
program
  .name('met-probe')
  .description('Run a V2 Met Museum theme probe and write query/search/detail/report artifacts.')
  .requiredOption('--theme <theme>', 'theme label, for example serenity')
  .requiredOption('--query <query>', 'primary search query, for example serenity')
  .option('--synonym <term>', 'additional synonym term, repeatable', collectOption, [])
  .option('--exclude <term>', 'exclude or failed term note, repeatable', collectOption, [])
  .option('--limit <number>', 'max candidate ids to keep per run', value => Number.parseInt(value, 10), DEFAULT_LIMIT)
  .option('--sample <number>', 'number of detail objects to fetch', value => Number.parseInt(value, 10), DEFAULT_SAMPLE_SIZE)
  .option('--title-only', 'search title only')
  .option('--run-id <runId>', 'optional explicit run id')
  .option('--output-root <dir>', 'output root directory', DEFAULT_OUTPUT_ROOT)
  .showHelpAfterError();

program.parse();

const options = program.opts();

runProbe({
  theme: options.theme,
  query: options.query,
  synonyms: options.synonym || [],
  excludes: options.exclude || [],
  limit: Number.isFinite(options.limit) ? options.limit : DEFAULT_LIMIT,
  sample: Number.isFinite(options.sample) ? options.sample : DEFAULT_SAMPLE_SIZE,
  titleOnly: Boolean(options.titleOnly),
  runId: options.runId,
  outputRoot: options.outputRoot,
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
