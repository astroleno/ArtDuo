#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');

const DEFAULT_REPORT_ROOT = path.resolve(__dirname, '../../data/curation/reports');
const DEFAULT_CONFIRMED_ROOT = path.resolve(__dirname, '../../data/curation/confirmed');
const DEFAULT_CONFIG_ROOT = path.resolve(__dirname, './review-config');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function timestampForId(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function setOf(values) {
  return new Set(values.map(value => String(value)));
}

function resolveConfigPath(theme, configFile) {
  if (configFile) {
    return path.resolve(configFile);
  }

  const defaultPath = path.join(DEFAULT_CONFIG_ROOT, `${theme}.json`);
  return fs.existsSync(defaultPath) ? defaultPath : null;
}

function normalizeConfig(rawConfig) {
  return {
    theme: rawConfig.theme,
    template: Boolean(rawConfig.template),
    promoteIds: setOf(rawConfig.promoteIds || []),
    holdIds: setOf(rawConfig.holdIds || []),
    rejectDuplicateIds: setOf(rawConfig.rejectDuplicateIds || []),
    rejectWeakDisplayIds: setOf(rawConfig.rejectWeakDisplayIds || []),
    rejectOutOfScopeIds: setOf(rawConfig.rejectOutOfScopeIds || []),
    rejectWeakEmotionIds: setOf(rawConfig.rejectWeakEmotionIds || []),
  };
}

function loadThemeConfig(theme, configFile) {
  const configPath = resolveConfigPath(theme, configFile);
  if (!configPath) {
    throw new Error(
      `No review config found for theme "${theme}". Pass --config-file or create ${path.join(DEFAULT_CONFIG_ROOT, `${theme}.json`)}`,
    );
  }

  const config = normalizeConfig(readJsonFile(configPath));
  if (config.theme && config.theme !== theme) {
    throw new Error(`Config theme mismatch: expected "${theme}" but found "${config.theme}" in ${configPath}`);
  }

  return {
    path: configPath,
    config,
  };
}

function buildConfigTemplate(queue, theme, sourceFile) {
  return {
    theme,
    template: true,
    sourceFile,
    promoteIds: [],
    holdIds: [],
    rejectDuplicateIds: [],
    rejectWeakDisplayIds: [],
    rejectOutOfScopeIds: [],
    rejectWeakEmotionIds: [],
    candidateSummaries: queue.map(record => ({
      sourceArtworkId: String(record.sourceArtworkId),
      title: record.metadata?.title || 'Untitled',
      classification: record.metadata?.classification || 'UNKNOWN',
      artistDisplayName: record.metadata?.artistDisplayName || 'Unknown Artist',
    })),
  };
}

function writeConfigTemplate(templatePath, queue, theme, sourceFile) {
  const resolvedPath = path.resolve(templatePath);
  ensureDir(path.dirname(resolvedPath));
  fs.writeFileSync(resolvedPath, `${JSON.stringify(buildConfigTemplate(queue, theme, sourceFile), null, 2)}\n`);
  return resolvedPath;
}

function collectUnassignedRecords(queue, config) {
  const assignedIds = new Set([
    ...config.promoteIds,
    ...config.holdIds,
    ...config.rejectDuplicateIds,
    ...config.rejectWeakDisplayIds,
    ...config.rejectOutOfScopeIds,
    ...config.rejectWeakEmotionIds,
  ]);

  return queue.filter(record => !assignedIds.has(String(record.sourceArtworkId)));
}

function assertConfigReady(queue, config, configPath, theme) {
  const unassignedRecords = collectUnassignedRecords(queue, config);
  if (!config.template && unassignedRecords.length === 0) {
    return;
  }

  const sample = unassignedRecords
    .slice(0, 5)
    .map(record => `${record.sourceArtworkId}:${record.metadata?.title || 'Untitled'}`)
    .join(', ');
  const templateHint = config.template
    ? `Config ${configPath} is still marked as a template. Fill its decision buckets before running the review pass.`
    : `Config ${configPath} is missing decisions for ${unassignedRecords.length} records.`;
  const sampleHint = sample ? ` Missing sample ids: ${sample}.` : '';

  throw new Error(`${templateHint}${sampleHint} Theme: ${theme}.`);
}

function buildDecision(config, theme, record, decisionOwner, decisionAt) {
  const sourceArtworkId = String(record.sourceArtworkId);
  const title = record.metadata?.title || 'Untitled';
  const classification = record.metadata?.classification || 'UNKNOWN';

  if (config.promoteIds.has(sourceArtworkId)) {
    return {
      runId: null,
      sourceArtworkId,
      decision: 'promote',
      decisionOwner,
      decisionAt,
      reasonCodes: [],
      notes: `Strong ${theme} fit with usable image and title signal (${classification}: ${title}).`,
      nextAction: 'move-to-confirmed-and-backfill-description',
    };
  }

  if (config.holdIds.has(sourceArtworkId)) {
    return {
      runId: null,
      sourceArtworkId,
      decision: 'hold',
      decisionOwner,
      decisionAt,
      reasonCodes: ['weak-emotion-fit'],
      notes: `Keep for second-pass image review; ${theme} fit or display value is promising but not settled from metadata alone (${classification}: ${title}).`,
      nextAction: 'manual-image-review',
    };
  }

  if (config.rejectDuplicateIds.has(sourceArtworkId)) {
    return {
      runId: null,
      sourceArtworkId,
      decision: 'reject',
      decisionOwner,
      decisionAt,
      reasonCodes: ['duplicate'],
      notes: `Duplicate lane already retained elsewhere in this review pass (${title}).`,
      nextAction: 'remove-from-review-queue',
    };
  }

  if (config.rejectWeakDisplayIds.has(sourceArtworkId)) {
    return {
      runId: null,
      sourceArtworkId,
      decision: 'reject',
      decisionOwner,
      decisionAt,
      reasonCodes: ['weak-display-fit', 'out-of-scope'],
      notes: `Object type is too artifact-like or too small-format for the current background-scene target (${classification}: ${title}).`,
      nextAction: 'remove-from-review-queue',
    };
  }

  if (config.rejectOutOfScopeIds.has(sourceArtworkId)) {
    return {
      runId: null,
      sourceArtworkId,
      decision: 'reject',
      decisionOwner,
      decisionAt,
      reasonCodes: ['out-of-scope'],
      notes: `The work does not sustain the ${theme} lane strongly enough from title, subject, or display context (${title}).`,
      nextAction: 'remove-from-review-queue',
    };
  }

  if (config.rejectWeakEmotionIds.has(sourceArtworkId)) {
    return {
      runId: null,
      sourceArtworkId,
      decision: 'reject',
      decisionOwner,
      decisionAt,
      reasonCodes: ['weak-emotion-fit'],
      notes: `The work is visually usable but the ${theme} signal is too weak for this wave (${title}).`,
      nextAction: 'remove-from-review-queue',
    };
  }

  throw new Error(`No decision configured for ${sourceArtworkId} (${title})`);
}

function buildReviewMarkdown({ reviewRunId, theme, sourceFile, configPath, decisions, coveragePath, confirmedPath }) {
  const counts = decisions.reduce((acc, item) => {
    acc[item.decision] = (acc[item.decision] || 0) + 1;
    return acc;
  }, {});
  const promoteRows = decisions.filter(item => item.decision === 'promote').slice(0, 10);
  const holdRows = decisions.filter(item => item.decision === 'hold').slice(0, 10);
  const rejectRows = decisions.filter(item => item.decision === 'reject').slice(0, 10);

  const renderRows = rows => rows.length
    ? rows.map(item => `- ${item.sourceArtworkId}: ${item.notes}`)
    : ['- none'];

  return [
    `# Review Report: ${theme}`,
    '',
    `- runId: \`${reviewRunId}\``,
    `- source file: \`${sourceFile}\``,
    `- config file: \`${configPath}\``,
    `- promote: ${counts.promote || 0}`,
    `- hold: ${counts.hold || 0}`,
    `- reject: ${counts.reject || 0}`,
    `- confirmed output: \`${confirmedPath}\``,
    `- coverage report: \`${coveragePath}\``,
    '',
    '## Promote',
    '',
    ...renderRows(promoteRows),
    '',
    '## Hold',
    '',
    ...renderRows(holdRows),
    '',
    '## Reject',
    '',
    ...renderRows(rejectRows),
    '',
  ].join('\n');
}

const program = new Command();
program
  .name('bootstrap-review-pass')
  .description('Create a first-pass review report, coverage report, and confirmed set from a review queue file.')
  .requiredOption('--theme <theme>', 'theme to review, for example mystery')
  .requiredOption('--input <path>', 'review queue JSON file')
  .option('--config-file <path>', 'review config JSON file for the selected theme')
  .option('--write-config-template <path>', 'write a starter config template for the queue and exit')
  .option('--review-run-id <runId>', 'explicit review run id')
  .option('--decision-owner <owner>', 'decision owner label', 'curatorial+design-proxy')
  .option('--report-root <dir>', 'report output root', DEFAULT_REPORT_ROOT)
  .option('--confirmed-root <dir>', 'confirmed output root', DEFAULT_CONFIRMED_ROOT)
  .showHelpAfterError();

const argv = process.argv.filter((value, index) => !(index >= 2 && value === '--'));
program.parse(argv);

const options = program.opts();
const reviewRunId = options.reviewRunId || `${timestampForId(new Date())}--${options.theme}--review-wave1`;
const decisionAt = new Date().toISOString();
const queuePath = path.resolve(options.input);
const queue = readJsonFile(queuePath);

if (options.writeConfigTemplate) {
  const templatePath = writeConfigTemplate(options.writeConfigTemplate, queue, options.theme, queuePath);
  console.log(`Review config template written: ${templatePath}`);
  process.exit(0);
}

const { path: configPath, config: themeConfig } = loadThemeConfig(options.theme, options.configFile);
assertConfigReady(queue, themeConfig, configPath, options.theme);
const decisions = queue.map(record => {
  const decision = buildDecision(themeConfig, options.theme, record, options.decisionOwner, decisionAt);
  decision.runId = reviewRunId;
  return decision;
});

ensureDir(path.resolve(options.reportRoot));
ensureDir(path.resolve(options.confirmedRoot));

const reviewJsonlPath = path.join(path.resolve(options.reportRoot), `review-${reviewRunId}.jsonl`);
const reviewMarkdownPath = path.join(path.resolve(options.reportRoot), `review-${reviewRunId}.md`);
const coveragePath = path.join(path.resolve(options.reportRoot), `coverage-${reviewRunId}.json`);
const confirmedPath = path.join(path.resolve(options.confirmedRoot), `${options.theme}--${reviewRunId}.json`);

const promotedIds = new Set(decisions.filter(item => item.decision === 'promote').map(item => item.sourceArtworkId));
const confirmedRecords = queue.filter(record => promotedIds.has(String(record.sourceArtworkId))).map(record => ({
  ...record,
  review: decisions.find(item => item.sourceArtworkId === String(record.sourceArtworkId)),
}));

const coverage = {
  runId: reviewRunId,
  theme: options.theme,
  sourceCoverage: {
    met: {
      reviewed: queue.length,
      promote: decisions.filter(item => item.decision === 'promote').length,
      hold: decisions.filter(item => item.decision === 'hold').length,
      reject: decisions.filter(item => item.decision === 'reject').length,
    },
  },
  emotionCoverage: {
    [options.theme]: {
      reviewed: queue.length,
      promote: decisions.filter(item => item.decision === 'promote').length,
      hold: decisions.filter(item => item.decision === 'hold').length,
      reject: decisions.filter(item => item.decision === 'reject').length,
    },
  },
  orientationCoverage: {
    portrait: 0,
    landscape: 0,
    square: 0,
    unknown: queue.length,
    note: 'Image dimensions are not stored in the current batch payload, so orientation remains unknown in this bootstrap review.',
  },
  estimatedGradeDistribution: {
    A: decisions.filter(item => item.decision === 'promote').length,
    B: decisions.filter(item => item.decision === 'hold').length,
    C: decisions.filter(item => item.decision === 'reject').length,
  },
  estimatedSceneMatch: {
    matchedCount: decisions.filter(item => item.decision !== 'reject').length,
    matchedPercent: Number(((decisions.filter(item => item.decision !== 'reject').length / queue.length) * 100).toFixed(1)),
    note: 'Bootstrap estimate based on metadata-only review; second-pass image review may lower this number.',
  },
  triggers: {
    confirmedBelowThirty: decisions.filter(item => item.decision === 'promote').length < 30,
  },
};

fs.writeFileSync(reviewJsonlPath, `${decisions.map(item => JSON.stringify(item)).join('\n')}\n`);
fs.writeFileSync(reviewMarkdownPath, buildReviewMarkdown({
  reviewRunId,
  theme: options.theme,
  sourceFile: queuePath,
  configPath,
  decisions,
  coveragePath,
  confirmedPath,
}));
fs.writeFileSync(coveragePath, JSON.stringify(coverage, null, 2));
fs.writeFileSync(confirmedPath, JSON.stringify(confirmedRecords, null, 2));

console.log(`Review decisions written: ${reviewJsonlPath}`);
console.log(`Review summary written: ${reviewMarkdownPath}`);
console.log(`Coverage report written: ${coveragePath}`);
console.log(`Confirmed records written: ${confirmedPath}`);
