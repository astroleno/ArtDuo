#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const REPORT_ROOT = path.join(ROOT, 'data/curation/reports');
const PROBE_ROOT = path.join(ROOT, 'data/sources/met/probe');
const BATCH_ROOT = path.join(ROOT, 'data/sources/met/batch');
const GENERATED_AT = new Date().toISOString();

const PROBE_GATE_THRESHOLDS = {
  uniqueHitCountMin: 10,
  sampleSizeMin: 10,
  usableHitsMin: 5,
  imageCoverageMin: 0.7,
  artistCoverageMin: 0.7,
  descriptionCoverageMin: 0.3,
};

const PROBE_CONFIG = {
  serenity: {
    selectedRunId: '2026-04-25T02-16-37-014Z--serenity--repose',
    manualVerdict: 'pass',
    gateDecision: 'approved-for-batch',
    recommendedBans: ['serenity', 'tranquil'],
    approvedBatchInput: {
      query: 'repose',
      synonyms: ['meditation'],
      excludes: ['stillness', 'calm', 'serenity', 'tranquil'],
    },
    overrideReason:
      'Switching to the narrower `repose` + `meditation` lane finally removed the worst title-match noise and produced a coherent enough scene set to batch.',
    sampleRecommendations: [
      { sourceArtworkId: '10065', title: 'Repose' },
      { sourceArtworkId: '42547', title: 'Bodhidharma in meditation' },
      { sourceArtworkId: '72301', title: 'Buddha Seated in Meditation' },
      { sourceArtworkId: '369738', title: 'Repose (Ruhende vom Rücken)' },
      { sourceArtworkId: '10239', title: 'Meditation' },
    ],
  },
  melancholy: {
    selectedRunId: '2026-04-24T02-45-55-823Z--melancholy--melancholy',
    manualVerdict: 'pass',
    gateDecision: 'approved-for-batch',
    recommendedBans: [],
    approvedBatchInput: {
      query: 'melancholy',
      synonyms: ['pensive', 'solitude', 'wistful'],
      excludes: ['sadness', 'blue'],
    },
    overrideReason:
      'Configured input already matched the approved batch input; this lane is clean enough to move forward.',
    sampleRecommendations: [
      { sourceArtworkId: '391598', title: 'Melancholy' },
      { sourceArtworkId: '38012', title: 'Melancholy Courtesan' },
      { sourceArtworkId: '382737', title: "Autumn's Grey and Melancholy" },
      { sourceArtworkId: '285610', title: 'Pensive' },
      { sourceArtworkId: '65397', title: 'Pensive bodhisattva' },
    ],
  },
  longing: {
    selectedRunId: '2026-04-25T02-18-47-977Z--longing--wistful',
    manualVerdict: 'fail',
    gateDecision: 'redesign-query',
    recommendedBans: ['yearning', 'melancholy', 'pensive'],
    recommendedInput: null,
    overrideReason:
      'After isolating the lane down to `wistful`, Met still collapses toward portrait, fashion, and satire material; this theme needs a fresh query concept or another source, not another incremental rerun.',
    sampleRecommendations: [
      {
        sourceArtworkId: '437900',
        title: 'Comtesse de la Châtre (Marie Charlotte Louise Perrette Aglaé Bontemps, 1762–1848)',
      },
      { sourceArtworkId: '737764', title: 'Woman lost in thought beneath a wutong tree' },
      { sourceArtworkId: '436603', title: 'Samson Captured by the Philistines' },
      {
        sourceArtworkId: '51996',
        title:
          'The Courtesan Nishikigi of the Yotsumeya Brothel, from the series “A Pattern Book of the Year’s First Designs, Fresh as Spring Herbs” (“Hinagata wakana hatsu moyō”)',
      },
    ],
  },
  wonder: {
    selectedRunId: '2026-04-24T02-46-28-237Z--wonder--astonishment',
    manualVerdict: 'pass',
    gateDecision: 'approved-for-batch',
    recommendedBans: ['marvel'],
    approvedBatchInput: {
      query: 'astonishment',
      synonyms: ['amazement', 'awe'],
      excludes: ['wonder', 'miracle', 'marvel'],
    },
    overrideReason:
      'Dropped `marvel` from the approved batch input after manual review showed surname/card noise in the probe sample.',
    sampleRecommendations: [
      {
        sourceArtworkId: '395293',
        title: 'Admiration with Astonishment (Le Brun Travested, or Caricatures of the Passions)',
      },
      { sourceArtworkId: '623059', title: 'Figure 57: Astonishment, stupefaction, amazement' },
      {
        sourceArtworkId: '817550',
        title:
          'Moses striking the rock with a stick to bring forth water, while the Israelites look on in amazement',
      },
      { sourceArtworkId: '438816', title: 'The Forest in Winter at Sunset' },
      { sourceArtworkId: '459100', title: 'Tahitian Women Bathing' },
    ],
  },
  contemplation: {
    selectedRunId: '2026-04-24T16-52-22-853Z--contemplation--contemplation',
    manualVerdict: 'pass',
    gateDecision: 'approved-for-batch',
    recommendedBans: ['solitude'],
    approvedBatchInput: {
      query: 'contemplation',
      synonyms: ['meditation', 'pensive'],
      excludes: ['reflection', 'solitude'],
    },
    overrideReason:
      'Dropping `solitude` cleaned the lane enough; the remaining sample is thematically coherent, and the auto miss is mainly an artifact of image-rich `Unknown Artist` works depressing artist coverage.',
    sampleRecommendations: [
      { sourceArtworkId: '438417', title: 'Two Men Contemplating the Moon' },
      { sourceArtworkId: '42547', title: 'Bodhidharma in meditation' },
      { sourceArtworkId: '72301', title: 'Buddha Seated in Meditation' },
      { sourceArtworkId: '439344', title: 'Two Men before a Waterfall at Sunset' },
      { sourceArtworkId: '437394', title: 'Aristotle with a Bust of Homer' },
    ],
  },
  hope: {
    selectedRunId: '2026-04-24T02-49-43-514Z--hope--hope',
    manualVerdict: 'pass',
    gateDecision: 'approved-for-batch',
    recommendedBans: ['promise'],
    approvedBatchInput: {
      query: 'hope',
      synonyms: ['renewal', 'aspiration'],
      excludes: ['looking forward', 'promise'],
    },
    overrideReason:
      'Dropped `promise` from the approved batch input after probe review showed it widened the lane faster than it improved fit.',
    sampleRecommendations: [
      { sourceArtworkId: '460524', title: 'Hope' },
      { sourceArtworkId: '11145', title: 'The Veteran in a New Field' },
      { sourceArtworkId: '270851', title: 'The Time of Promise' },
      {
        sourceArtworkId: '255973',
        title: 'Statue of Dionysos leaning on a female figure ("Hope Dionysos")',
      },
    ],
  },
  loneliness: {
    selectedRunId: '2026-04-25T02-18-56-673Z--loneliness--solitary-figure',
    manualVerdict: 'fail',
    gateDecision: 'redesign-query',
    recommendedBans: ['pensive', 'desolation', 'widower', 'office in a small city'],
    recommendedInput: null,
    overrideReason:
      'Even after stripping back to the more scene-led `solitary figure` lane, image coverage stalls far below gate and the remaining sample is too sparse to justify more Met reruns.',
    sampleRecommendations: [
      { sourceArtworkId: '49171', title: 'Landscape with solitary figure' },
      { sourceArtworkId: '825541', title: 'The Widower' },
      { sourceArtworkId: '729602', title: 'Our Lady of Solitude' },
    ],
  },
  joy: {
    selectedRunId: '2026-04-24T16-53-04-786Z--joy--merry-company',
    manualVerdict: 'pass',
    gateDecision: 'approved-for-batch',
    recommendedBans: ['festival', 'celebration', 'rejoicing', 'cheerful'],
    approvedBatchInput: {
      query: 'merry company',
      synonyms: ['laughing', 'dancing'],
      excludes: ['festival', 'celebration', 'rejoicing', 'joy', 'delight', 'cheerful'],
    },
    overrideReason:
      'Switching to the scene-led `merry company` lane removed the old event-ephemera collapse; `cheerful` still reintroduces interior/card noise, so it stays banned in the approved batch input.',
    sampleRecommendations: [
      { sourceArtworkId: '437749', title: 'Merry Company on a Terrace' },
      { sourceArtworkId: '282190', title: 'Pierrot Laughing' },
      { sourceArtworkId: '437812', title: 'A Dance in the Country' },
      { sourceArtworkId: '436622', title: 'Merrymakers at Shrovetide' },
      { sourceArtworkId: '394395', title: 'The Cheerful Cupids' },
    ],
  },
  mystery: {
    selectedRunId: '2026-04-24T02-47-52-479Z--mystery--apparition',
    manualVerdict: 'pass',
    gateDecision: 'approved-for-batch',
    recommendedBans: ['enigmatic'],
    approvedBatchInput: {
      query: 'apparition',
      synonyms: ['oracle', 'prophecy'],
      excludes: ['mystery', 'vision', 'enigmatic'],
    },
    overrideReason:
      'Dropped `enigmatic` from the approved batch input after manual review showed it diluted the narrative-supernatural lane.',
    sampleRecommendations: [
      { sourceArtworkId: '635400', title: 'The Apparition of the Virgin of El Pilar to St. James' },
      { sourceArtworkId: '849803', title: 'The Oracle' },
      {
        sourceArtworkId: '451418',
        title:
          "\"Muhammad's Call to Prophecy and the First Revelation\", Folio from a Majma' al-Tavarikh (Compendium of Histories)",
      },
      { sourceArtworkId: '340635', title: 'An Apparition' },
      { sourceArtworkId: '744086', title: 'Prophecy Explained' },
    ],
  },
  desire: {
    selectedRunId: '2026-04-25T02-17-09-125Z--desire--sensuality',
    manualVerdict: 'pass',
    gateDecision: 'approved-for-batch',
    recommendedBans: ['yearning', 'passion', 'romance'],
    approvedBatchInput: {
      query: 'sensuality',
      synonyms: ['lovers', 'bathing'],
      excludes: ['desire', 'longing', 'passion', 'romance', 'yearning'],
    },
    overrideReason:
      'Flipping the lane to `sensuality` with `lovers` / `bathing` removed the sorrow-object spillover and produced a strong enough image-led desire set to batch.',
    sampleRecommendations: [
      { sourceArtworkId: '451023', title: 'The Lovers' },
      { sourceArtworkId: '193438', title: 'Eternal Spring' },
      { sourceArtworkId: '459100', title: 'Tahitian Women Bathing' },
      { sourceArtworkId: '436131', title: 'Bather Stepping into a Tub' },
      { sourceArtworkId: '55233', title: 'Lovers' },
    ],
  },
};

const BATCH_CONFIG = {
  melancholy: {
    canonicalRunId: '2026-04-24T03-00-57-855Z--melancholy--melancholy',
    supersededRuns: [
      {
        runId: '2026-04-24T02-57-50-204Z--melancholy--melancholy',
        batchReportPath:
          'data/sources/met/batch/melancholy/2026-04-24T02-57-50-204Z--melancholy--melancholy/batch-report.json',
        reason:
          'Superseded after batch gating was corrected to track `missing-description` as a metadata gap instead of auto-excluding every record.',
      },
    ],
    reviewPriority: 'high',
    sampleRecords: [
      { sourceArtworkId: '391598', title: 'Melancholy' },
      { sourceArtworkId: '65397', title: 'Pensive bodhisattva' },
      { sourceArtworkId: '38012', title: 'Melancholy Courtesan' },
      { sourceArtworkId: '285610', title: 'Pensive' },
    ],
  },
  wonder: {
    canonicalRunId: '2026-04-24T03-04-20-455Z--wonder--astonishment',
    supersededRuns: [],
    reviewPriority: 'high',
    sampleRecords: [
      {
        sourceArtworkId: '395293',
        title: 'Admiration with Astonishment (Le Brun Travested, or Caricatures of the Passions)',
      },
      { sourceArtworkId: '623059', title: 'Figure 57: Astonishment, stupefaction, amazement' },
      {
        sourceArtworkId: '817550',
        title:
          'Moses striking the rock with a stick to bring forth water, while the Israelites look on in amazement',
      },
      { sourceArtworkId: '438816', title: 'The Forest in Winter at Sunset' },
    ],
  },
  hope: {
    canonicalRunId: '2026-04-24T03-11-48-117Z--hope--hope',
    supersededRuns: [],
    reviewPriority: 'medium',
    sampleRecords: [
      { sourceArtworkId: '460524', title: 'Hope' },
      { sourceArtworkId: '11145', title: 'The Veteran in a New Field' },
      {
        sourceArtworkId: '255973',
        title: 'Statue of Dionysos leaning on a female figure ("Hope Dionysos")',
      },
      { sourceArtworkId: '270851', title: 'The Time of Promise' },
    ],
  },
  mystery: {
    canonicalRunId: '2026-04-24T03-14-05-444Z--mystery--apparition',
    supersededRuns: [],
    reviewPriority: 'highest',
    sampleRecords: [
      { sourceArtworkId: '635400', title: 'The Apparition of the Virgin of El Pilar to St. James' },
      { sourceArtworkId: '849803', title: 'The Oracle' },
      {
        sourceArtworkId: '451418',
        title:
          "\"Muhammad's Call to Prophecy and the First Revelation\", Folio from a Majma' al-Tavarikh (Compendium of Histories)",
      },
      { sourceArtworkId: '340635', title: 'An Apparition' },
    ],
  },
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function unique(values) {
  return [...new Set(values)];
}

function arraysEqual(left, right) {
  return JSON.stringify(unique(left || []).sort()) === JSON.stringify(unique(right || []).sort());
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function safeReadJson(filePath) {
  return fileExists(filePath) ? readJson(filePath) : null;
}

function batchRunPaths(theme, runId) {
  return {
    runDir: path.join(BATCH_ROOT, theme, runId),
    queryPath: path.join(BATCH_ROOT, theme, runId, 'query.json'),
    batchReportPath: path.join(BATCH_ROOT, theme, runId, 'batch-report.md'),
    batchReportJsonPath: path.join(BATCH_ROOT, theme, runId, 'batch-report.json'),
    gapReportPath: path.join(REPORT_ROOT, `gap-report-${runId}.json`),
    reviewQueuePath: path.join(ROOT, 'data/curation/review-queue', `${theme}--${runId}.json`),
    candidatePoolMirrorPath: path.join(ROOT, 'data/curation/candidate-pool', `${theme}--${runId}.json`),
  };
}

function listThemeBatchRunIds(theme) {
  const themeDir = path.join(BATCH_ROOT, theme);
  if (!fileExists(themeDir)) {
    return [];
  }

  return fs.readdirSync(themeDir)
    .filter(runId => fileExists(batchRunPaths(theme, runId).queryPath))
    .sort((left, right) => left.localeCompare(right));
}

function loadBatchRun(theme, runId) {
  const paths = batchRunPaths(theme, runId);
  if (!fileExists(paths.queryPath) || !fileExists(paths.batchReportJsonPath)) {
    return null;
  }

  return {
    theme,
    runId,
    paths,
    query: readJson(paths.queryPath),
    report: readJson(paths.batchReportJsonPath),
    gapReport: safeReadJson(paths.gapReportPath),
    reviewQueue: safeReadJson(paths.reviewQueuePath),
  };
}

function findMatchingBatchRuns(theme, approvedEntry) {
  return listThemeBatchRunIds(theme)
    .map(runId => loadBatchRun(theme, runId))
    .filter(Boolean)
    .filter(run => (
      run.query.query === approvedEntry.approvedBatchInput.query
      && arraysEqual(run.query.synonyms || [], approvedEntry.approvedBatchInput.synonyms || [])
      && arraysEqual(run.query.excludes || [], approvedEntry.approvedBatchInput.excludes || [])
    ));
}

function selectCanonicalBatchRun(theme, approvedEntry, matchingRuns) {
  const configuredRunId = BATCH_CONFIG[theme]?.canonicalRunId || null;
  if (configuredRunId) {
    const configuredRun = matchingRuns.find(run => run.runId === configuredRunId);
    if (configuredRun) {
      return configuredRun;
    }
  }

  const probeMatchedRuns = matchingRuns.filter(
    run => run.query.probeApproval?.probeRunId === approvedEntry.probeRunId,
  );
  const candidates = probeMatchedRuns.length > 0 ? probeMatchedRuns : matchingRuns;

  return candidates.length > 0
    ? [...candidates].sort((left, right) => left.runId.localeCompare(right.runId)).at(-1)
    : null;
}

function buildBatchStatusByTheme(approvedEntries) {
  const statusByTheme = new Map();

  for (const entry of approvedEntries) {
    const matchingRuns = findMatchingBatchRuns(entry.theme, entry);
    const canonicalRun = selectCanonicalBatchRun(entry.theme, entry, matchingRuns);
    statusByTheme.set(entry.theme, { matchingRuns, canonicalRun });
  }

  return statusByTheme;
}

function resolveBatchStatus(theme, approvedEntry, batchStatusByTheme = null) {
  const cached = batchStatusByTheme?.get(theme);
  if (cached?.canonicalRun) {
    return cached;
  }

  const matchingRuns = findMatchingBatchRuns(theme, approvedEntry);
  const canonicalRun = selectCanonicalBatchRun(theme, approvedEntry, matchingRuns);
  return { matchingRuns, canonicalRun };
}

function mergeSupersededRuns(configuredRuns, discoveredRuns) {
  const merged = new Map();

  for (const run of configuredRuns || []) {
    merged.set(run.runId, run);
  }

  for (const run of discoveredRuns || []) {
    if (!merged.has(run.runId)) {
      merged.set(run.runId, run);
    }
  }

  return [...merged.values()];
}

function deriveSampleRecords(reviewQueue, fallbackRecords) {
  if (Array.isArray(fallbackRecords) && fallbackRecords.length > 0) {
    return fallbackRecords;
  }

  if (Array.isArray(reviewQueue) && reviewQueue.length > 0) {
    return reviewQueue.slice(0, 4).map(record => ({
      sourceArtworkId: record.sourceArtworkId,
      title: record.metadata?.title || 'Untitled',
    }));
  }

  return fallbackRecords || [];
}

function inputDiff(configured, recommended) {
  if (!recommended) {
    return [];
  }

  const diffs = [];
  if (configured.query !== recommended.query) {
    diffs.push(`query: \`${configured.query}\` -> \`${recommended.query}\``);
  }
  if (!arraysEqual(configured.synonyms, recommended.synonyms)) {
    diffs.push(`synonyms: ${configured.synonyms.join(', ') || 'none'} -> ${recommended.synonyms.join(', ') || 'none'}`);
  }
  if (!arraysEqual(configured.excludes, recommended.excludes)) {
    diffs.push(`excludes: ${configured.excludes.join(', ') || 'none'} -> ${recommended.excludes.join(', ') || 'none'}`);
  }
  return diffs;
}

function probeMetrics(searchResults, detailSample) {
  return {
    uniqueHitCount: searchResults.uniqueHitCount,
    sampleSize: detailSample.objects.length,
    usableHits: detailSample.reviewSignals.usableHits,
    imageCoverage: detailSample.reviewSignals.imageCoverage,
    descriptionCoverage: detailSample.reviewSignals.descriptionCoverage,
    artistCoverage: detailSample.reviewSignals.artistCoverage,
  };
}

function evaluateGate(metrics, manualVerdict) {
  return {
    uniqueHitCount: metrics.uniqueHitCount >= PROBE_GATE_THRESHOLDS.uniqueHitCountMin,
    sampleSize: metrics.sampleSize >= PROBE_GATE_THRESHOLDS.sampleSizeMin,
    usableHits: metrics.usableHits >= PROBE_GATE_THRESHOLDS.usableHitsMin,
    imageCoverage: metrics.imageCoverage >= PROBE_GATE_THRESHOLDS.imageCoverageMin,
    metadataCoverage:
      metrics.artistCoverage >= PROBE_GATE_THRESHOLDS.artistCoverageMin ||
      metrics.descriptionCoverage >= PROBE_GATE_THRESHOLDS.descriptionCoverageMin,
    manualVerdictPass: manualVerdict === 'pass',
  };
}

function buildProbeSummary() {
  const summary = {
    generatedAt: GENERATED_AT,
    source: 'met',
    decisionVocabulary: {
      probeVerdict: ['pass', 'mixed', 'fail'],
      reviewDecision: ['promote', 'hold', 'reject'],
    },
    gateThresholds: PROBE_GATE_THRESHOLDS,
    handoffArtifacts: {
      approvedQueryMatrixJson: 'data/curation/reports/probe-approved-query-matrix.json',
      approvedQueryMatrixMd: 'data/curation/reports/probe-approved-query-matrix.md',
    },
    notes: [
      'Probe verdicts use `pass / mixed / fail`; `promote / hold / reject` is reserved for review-loop decisions.',
      'Each summary entry now separates configured input, summary-level recommendations, and approved batch input to keep manual overrides auditable.',
      'Batch handoff is canonical only when a theme has `gateDecision = approved-for-batch` and a populated `approvedBatchInput` block.',
    ],
    themes: [],
  };

  const approvedEntries = [];

  for (const [theme, config] of Object.entries(PROBE_CONFIG)) {
    const runDir = path.join(PROBE_ROOT, theme, config.selectedRunId);
    const query = readJson(path.join(runDir, 'query.json'));
    const searchResults = readJson(path.join(runDir, 'search-results.json'));
    const detailSample = readJson(path.join(runDir, 'detail-sample.json'));
    const configuredInput = {
      query: query.query,
      synonyms: query.synonyms,
      excludes: query.excludes,
    };
    const metrics = probeMetrics(searchResults, detailSample);
    const gateEvaluation = evaluateGate(metrics, config.manualVerdict);
    const approvedBatchInput = config.approvedBatchInput || null;
    const recommendedNextProbeInput = approvedBatchInput ? null : (config.recommendedInput || null);
    const recommendedBans = config.recommendedBans || [];
    const overrideLog = [];

    if (detailSample.reviewSignals.recommendedVerdict !== config.manualVerdict) {
      overrideLog.push({
        kind: 'manual-verdict-override',
        from: detailSample.reviewSignals.recommendedVerdict,
        to: config.manualVerdict,
        reason: config.overrideReason,
      });
    }

    const diffs = inputDiff(configuredInput, approvedBatchInput || recommendedNextProbeInput);
    if (diffs.length > 0) {
      overrideLog.push({
        kind: 'recommended-input-adjustment',
        diffs,
        reason: config.overrideReason,
      });
    }

    if (recommendedBans.length > 0) {
      overrideLog.push({
        kind: 'summary-level-ban-recommendation',
        recommendedBans,
        reason: config.overrideReason,
      });
    }

    const entry = {
      theme,
      selectedRunId: config.selectedRunId,
      selectedRunDir: relative(runDir),
      artifacts: {
        queryPath: relative(path.join(runDir, 'query.json')),
        searchResultsPath: relative(path.join(runDir, 'search-results.json')),
        detailSamplePath: relative(path.join(runDir, 'detail-sample.json')),
        probeReportPath: relative(path.join(runDir, 'probe-report.md')),
      },
      configuredInput,
      metrics,
      gateEvaluation,
      autoVerdict: detailSample.reviewSignals.recommendedVerdict,
      manualVerdict: config.manualVerdict,
      gateDecision: config.gateDecision,
      configuredExcludes: configuredInput.excludes,
      recommendedBans,
      approvedBatchInput,
      recommendedNextProbeInput,
      overrideLog,
      manualNotes: config.overrideReason,
      sampleRecommendations: config.sampleRecommendations,
    };

    summary.themes.push(entry);

    if (config.approvedBatchInput) {
      approvedEntries.push({
        theme,
        probeRunId: config.selectedRunId,
        probeSummaryPath: 'data/curation/reports/probe-summary.json',
        approvedBatchInput: config.approvedBatchInput,
        note: config.overrideReason,
      });
    }
  }

  return { summary, approvedEntries };
}

function renderProbeSummaryMarkdown(summary) {
  const lines = [
    '# Met Probe Summary',
    '',
    '## Contract',
    '',
    '- Probe verdicts use `pass / mixed / fail` only.',
    '- Review-loop decisions use `promote / hold / reject` only.',
    '- Canonical batch handoff lives in `data/curation/reports/probe-approved-query-matrix.json`.',
    '',
    '## Overview',
    '',
    '| Theme | Run ID | Hits | Usable | Image | Artist | Desc | Auto | Manual | Gate |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (const theme of summary.themes) {
    lines.push(
      `| ${theme.theme} | \`${theme.selectedRunId}\` | ${theme.metrics.uniqueHitCount} | ${theme.metrics.usableHits}/${theme.metrics.sampleSize} | ${theme.metrics.imageCoverage.toFixed(1)} | ${theme.metrics.artistCoverage.toFixed(1)} | ${theme.metrics.descriptionCoverage.toFixed(1)} | \`${theme.autoVerdict}\` | \`${theme.manualVerdict}\` | \`${theme.gateDecision}\` |`,
    );
  }

  lines.push('', '## Audit Notes', '');

  for (const theme of summary.themes) {
    lines.push(`### ${theme.theme}`, '');
    lines.push(`- Probe report: \`${theme.artifacts.probeReportPath}\``);
    lines.push(
      `- Configured input: query \`${theme.configuredInput.query}\`; synonyms ${theme.configuredInput.synonyms.length ? theme.configuredInput.synonyms.map(item => `\`${item}\``).join(', ') : 'none'}; excludes ${theme.configuredInput.excludes.length ? theme.configuredInput.excludes.map(item => `\`${item}\``).join(', ') : 'none'}`,
    );
    lines.push(
      `- Summary-level bans: ${theme.recommendedBans.length ? theme.recommendedBans.map(item => `\`${item}\``).join(', ') : 'none'}`,
    );
    if (theme.approvedBatchInput) {
      lines.push(
        `- Approved batch input: query \`${theme.approvedBatchInput.query}\`; synonyms ${theme.approvedBatchInput.synonyms.map(item => `\`${item}\``).join(', ')}; excludes ${theme.approvedBatchInput.excludes.map(item => `\`${item}\``).join(', ')}`,
      );
    } else if (theme.recommendedNextProbeInput) {
      lines.push(
        `- Recommended next probe input: query \`${theme.recommendedNextProbeInput.query}\`; synonyms ${theme.recommendedNextProbeInput.synonyms.length ? theme.recommendedNextProbeInput.synonyms.map(item => `\`${item}\``).join(', ') : 'none'}; excludes ${theme.recommendedNextProbeInput.excludes.length ? theme.recommendedNextProbeInput.excludes.map(item => `\`${item}\``).join(', ') : 'none'}`,
      );
    }
    lines.push(`- Decision note: ${theme.manualNotes}`);
    if (theme.sampleRecommendations.length > 0) {
      lines.push(
        `- Sample titles: ${theme.sampleRecommendations.map(item => `\`${item.sourceArtworkId} ${item.title}\``).join(', ')}`,
      );
    } else {
      lines.push('- Sample titles: none');
    }
    lines.push('');
  }

  return lines.join('\n');
}

function buildApprovedMatrix(summary, approvedEntries, batchStatusByTheme) {
  const json = {
    generatedAt: GENERATED_AT,
    source: 'met',
    semantics:
      'Canonical batch handoff artifact. Batch runs must copy query/synonym/exclude from this file only.',
    themes: approvedEntries.map(entry => {
      const batchStatus = resolveBatchStatus(entry.theme, entry, batchStatusByTheme);
      return {
        theme: entry.theme,
        probeRunId: entry.probeRunId,
        manualVerdict: 'pass',
        approvedBatchInput: entry.approvedBatchInput,
        batchStatus: batchStatus?.canonicalRun ? 'batched' : 'approved-awaiting-batch',
        consumedByBatchRunId: batchStatus?.canonicalRun?.runId || null,
        note: entry.note,
      };
    }),
    notApprovedThemes: summary.themes
      .filter(entry => !entry.approvedBatchInput)
      .map(entry => ({
        theme: entry.theme,
        probeRunId: entry.selectedRunId,
        manualVerdict: entry.manualVerdict,
        gateDecision: entry.gateDecision,
      })),
  };

  const markdown = [
    '# Probe Approved Query Matrix',
    '',
    'Batch runs must use this artifact as the canonical handoff from probe.',
    '',
    '| Theme | Probe Run ID | Query | Synonyms | Excludes | Batch Run ID |',
    '| --- | --- | --- | --- | --- | --- |',
  ];

  for (const entry of json.themes) {
    markdown.push(
      `| ${entry.theme} | \`${entry.probeRunId}\` | \`${entry.approvedBatchInput.query}\` | ${entry.approvedBatchInput.synonyms.map(item => `\`${item}\``).join(', ')} | ${entry.approvedBatchInput.excludes.map(item => `\`${item}\``).join(', ')} | ${entry.consumedByBatchRunId ? `\`${entry.consumedByBatchRunId}\`` : '`pending`'} |`,
    );
  }

  markdown.push('', '## Not Approved', '');
  for (const entry of json.notApprovedThemes) {
    markdown.push(`- ${entry.theme}: \`${entry.manualVerdict}\` -> \`${entry.gateDecision}\``);
  }

  return { json, markdown: markdown.join('\n') };
}

function buildBatchSummary(approvedMatrix) {
  const summary = {
    generatedAt: GENERATED_AT,
    source: 'met',
    probeApprovedQueryMatrixPath: 'data/curation/reports/probe-approved-query-matrix.json',
    queueContract: {
      canonicalReviewQueue: true,
      candidatePoolIsMirrorDuringBootstrap: true,
      note:
        'The current bootstrap batch writer mirrors the same candidate payload into both `candidate-pool/` and `review-queue/`; review loop must read `review-queue/` only.',
    },
    notes: [
      'Batch candidate gating now excludes only records that are missing images, titles, object URLs, or both artist and description.',
      'Missing Met descriptions are tracked as metadata gaps instead of forcing zero-candidate runs.',
      'Superseded batch runs must remain visible in this summary so downstream consumers know which artifact is canonical.',
    ],
    themes: [],
    pendingApprovedThemes: [],
  };

  for (const approvedTheme of approvedMatrix.themes) {
    const theme = approvedTheme.theme;
    const batchStatus = resolveBatchStatus(theme, approvedTheme);
    const canonicalRunId = approvedTheme.consumedByBatchRunId || batchStatus.canonicalRun?.runId || null;

    if (!canonicalRunId) {
      summary.pendingApprovedThemes.push({
        theme,
        probeRunId: approvedTheme.probeRunId,
        approvedBatchInput: approvedTheme.approvedBatchInput,
        note: 'Probe is approved, but no canonical batch run has been discovered yet.',
      });
      continue;
    }

    const config = BATCH_CONFIG[theme] || {};
    const canonicalRun = loadBatchRun(theme, canonicalRunId);
    if (!canonicalRun) {
      summary.pendingApprovedThemes.push({
        theme,
        probeRunId: approvedTheme.probeRunId,
        approvedBatchInput: approvedTheme.approvedBatchInput,
        note: `Batch run \`${canonicalRunId}\` is referenced by the approved matrix but its artifacts are missing.`,
      });
      continue;
    }

    const discoveredSupersededRuns = batchStatus.matchingRuns
      .filter(run => run.runId !== canonicalRun.runId)
      .map(run => ({
        runId: run.runId,
        batchReportPath: relative(run.paths.batchReportJsonPath),
        reason: 'Discovered non-canonical batch run sharing the same approved batch input.',
      }));

    const probeApproval =
      canonicalRun.query.probeApproval
      || canonicalRun.gapReport?.probeApproval
      || canonicalRun.report?.probeApproval
      || null;

    const themeSummary = {
      theme,
      canonicalRunId: canonicalRun.runId,
      batchReportPath: relative(canonicalRun.paths.batchReportPath),
      batchReportJsonPath: relative(canonicalRun.paths.batchReportJsonPath),
      probeApprovalPath: probeApproval?.matrixPath || 'data/curation/reports/probe-approved-query-matrix.json',
      probeApproval,
      query: canonicalRun.query.query,
      synonyms: canonicalRun.query.synonyms || [],
      excludes: canonicalRun.query.excludes || [],
      canonicalReviewQueuePath: relative(canonicalRun.paths.reviewQueuePath),
      candidatePoolMirrorPath: relative(canonicalRun.paths.candidatePoolMirrorPath),
      gapReportPath: relative(canonicalRun.paths.gapReportPath),
      candidatePoolMirrorsReviewQueue: true,
      auditContractSatisfied: Boolean(
        probeApproval && (canonicalRun.gapReport?.probeApproval || canonicalRun.report?.probeApproval),
      ),
      counts: canonicalRun.report.counts,
      excludeCounts: canonicalRun.report.excludeCounts,
      metadataGapCounts: canonicalRun.report.metadataGapCounts || canonicalRun.gapReport?.metadataGapCounts || {},
      reviewPriority: config.reviewPriority || 'queued',
      supersededRuns: mergeSupersededRuns(config.supersededRuns, discoveredSupersededRuns),
      sampleRecords: deriveSampleRecords(canonicalRun.reviewQueue, config.sampleRecords),
    };

    summary.themes.push(themeSummary);
  }

  return summary;
}

function renderBatchSummaryMarkdown(summary) {
  const totalCandidates = summary.themes.reduce((sum, entry) => sum + entry.counts.candidateCount, 0);
  const lines = [
    '# Met Batch Summary',
    '',
    '## Contract',
    '',
    `- Canonical probe handoff: \`${summary.probeApprovedQueryMatrixPath}\``,
    '- Review loop must consume `review-queue/` only.',
    '- `candidate-pool/` is currently a mirror snapshot of the same candidate set during bootstrap.',
    '',
    '## Result',
    '',
    '| Theme | Canonical Run ID | Query | Candidates | Excluded | Review queue | Candidate mirror |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (const theme of summary.themes) {
    lines.push(
      `| ${theme.theme} | \`${theme.canonicalRunId}\` | \`${theme.query}\` | ${theme.counts.candidateCount} | ${theme.counts.excludedCount} | \`${theme.canonicalReviewQueuePath}\` | \`${theme.candidatePoolMirrorPath}\` |`,
    );
  }

  lines.push('', `Total candidate pool added this wave: \`${totalCandidates}\``, '', '## Notes', '');

  for (const theme of summary.themes) {
    lines.push(`### ${theme.theme}`, '');
    lines.push(`- Batch report: \`${theme.batchReportPath}\``);
    lines.push(
      `- Probe approval: ${theme.probeApproval ? `\`${theme.probeApprovalPath}\` via probe \`${theme.probeApproval.probeRunId}\`` : '`missing`'}`,
    );
    lines.push(`- Canonical review queue: \`${theme.canonicalReviewQueuePath}\``);
    lines.push(`- Candidate-pool mirror: \`${theme.candidatePoolMirrorPath}\``);
    lines.push(`- Gap report: \`${theme.gapReportPath}\``);
    lines.push(`- Audit contract on canonical artifacts: \`${theme.auditContractSatisfied ? 'satisfied' : 'missing-probe-approval'}\``);
    lines.push(
      `- Exclude counts: ${Object.entries(theme.excludeCounts)
        .map(([key, value]) => `\`${key}=${value}\``)
        .join(', ') || 'none'}`,
    );
    lines.push(
      `- Metadata gaps: ${Object.entries(theme.metadataGapCounts)
        .map(([key, value]) => `\`${key}=${value}\``)
        .join(', ') || 'none'}`,
    );
    if (theme.supersededRuns.length > 0) {
      for (const run of theme.supersededRuns) {
        lines.push(`- Superseded run: \`${run.runId}\` via \`${run.batchReportPath}\` because ${run.reason}`);
      }
    }
    lines.push(
      `- Starter records: ${theme.sampleRecords.map(item => `\`${item.sourceArtworkId} ${item.title}\``).join(', ')}`,
    );
    lines.push('');
  }

  if (summary.pendingApprovedThemes.length > 0) {
    lines.push('## Approved But Not Batched', '');
    for (const theme of summary.pendingApprovedThemes) {
      lines.push(
        `- ${theme.theme}: approved from probe \`${theme.probeRunId}\`, but canonical batch has not been discovered yet`,
      );
    }
    lines.push('');
  }

  lines.push('## Suggested Next Step', '');
  lines.push(
    'Move into review loop with `mystery` first, then `wonder`, then `melancholy`, then `hope`. `mystery` has the biggest usable queue and the cleanest exclusion profile.',
  );
  lines.push('');

  return lines.join('\n');
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
}

function main() {
  const { summary: probeSummary, approvedEntries } = buildProbeSummary();
  const batchStatusByTheme = buildBatchStatusByTheme(approvedEntries);
  const approvedMatrix = buildApprovedMatrix(probeSummary, approvedEntries, batchStatusByTheme);
  const batchSummary = buildBatchSummary(approvedMatrix.json);

  writeFile(
    path.join(REPORT_ROOT, 'probe-summary.json'),
    `${JSON.stringify(probeSummary, null, 2)}\n`,
  );
  writeFile(
    path.join(REPORT_ROOT, 'probe-summary.md'),
    `${renderProbeSummaryMarkdown(probeSummary)}\n`,
  );
  writeFile(
    path.join(REPORT_ROOT, 'probe-approved-query-matrix.json'),
    `${JSON.stringify(approvedMatrix.json, null, 2)}\n`,
  );
  writeFile(
    path.join(REPORT_ROOT, 'probe-approved-query-matrix.md'),
    `${approvedMatrix.markdown}\n`,
  );
  writeFile(
    path.join(REPORT_ROOT, 'batch-summary.json'),
    `${JSON.stringify(batchSummary, null, 2)}\n`,
  );
  writeFile(
    path.join(REPORT_ROOT, 'batch-summary.md'),
    `${renderBatchSummaryMarkdown(batchSummary)}\n`,
  );

  console.log('Curation summaries rebuilt:');
  console.log(`- ${relative(path.join(REPORT_ROOT, 'probe-summary.json'))}`);
  console.log(`- ${relative(path.join(REPORT_ROOT, 'probe-summary.md'))}`);
  console.log(`- ${relative(path.join(REPORT_ROOT, 'probe-approved-query-matrix.json'))}`);
  console.log(`- ${relative(path.join(REPORT_ROOT, 'probe-approved-query-matrix.md'))}`);
  console.log(`- ${relative(path.join(REPORT_ROOT, 'batch-summary.json'))}`);
  console.log(`- ${relative(path.join(REPORT_ROOT, 'batch-summary.md'))}`);
}

main();
