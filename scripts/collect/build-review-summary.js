#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const REPORT_ROOT = path.join(ROOT, 'data/curation/reports');
const CONFIRMED_ROOT = path.join(ROOT, 'data/curation/confirmed');

const THEME_TRIGGER_LABELS = {
  confirmedBelowThirty: 'confirmed-below-thirty',
  sceneMatchBelowSixty: 'scene-match-below-sixty',
  orientationCoverageBelowTarget: 'orientation-coverage-below-target',
};

const PORTFOLIO_TRIGGER_LABELS = {
  sourceConcentrationAboveSeventy: 'source-concentration-above-seventy',
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

function discoverLatestRuns() {
  const latestByTheme = new Map();
  const confirmedFiles = fs.existsSync(CONFIRMED_ROOT)
    ? fs.readdirSync(CONFIRMED_ROOT).filter(fileName => fileName.endsWith('.json'))
    : [];

  for (const fileName of confirmedFiles) {
    const dividerIndex = fileName.indexOf('--');
    if (dividerIndex === -1) {
      continue;
    }

    const theme = fileName.slice(0, dividerIndex);
    const reviewRunId = fileName.slice(dividerIndex + 2, -'.json'.length);
    const current = latestByTheme.get(theme);
    if (!current || reviewRunId.localeCompare(current.reviewRunId) > 0) {
      latestByTheme.set(theme, {
        theme,
        reviewRunId,
        confirmedPath: path.join(CONFIRMED_ROOT, fileName),
      });
    }
  }

  return [...latestByTheme.values()].sort((left, right) => left.theme.localeCompare(right.theme));
}

function pickTriggerLabels(triggers, labelMap) {
  return Object.entries(labelMap)
    .filter(([key]) => Boolean(triggers[key]))
    .map(([, label]) => label);
}

function determineGateWork(themeGateBlockers) {
  if (themeGateBlockers.includes('confirmed-below-thirty')) {
    return 'second-pass-image-review-or-batch-backfill';
  }

  if (
    themeGateBlockers.includes('scene-match-below-sixty')
    || themeGateBlockers.includes('orientation-coverage-below-target')
  ) {
    return 'probe-or-batch-backfill';
  }

  return 'release-ready-prep';
}

function discoverLatestReleaseReadyReportPath() {
  const reportFiles = fs.existsSync(REPORT_ROOT)
    ? fs.readdirSync(REPORT_ROOT)
      .filter(fileName => /^release-ready-.*\.json$/.test(fileName) && !fileName.endsWith('.excluded.json'))
      .sort()
    : [];

  const latest = reportFiles.at(-1);
  return latest ? path.join(REPORT_ROOT, latest) : undefined;
}

function determineParallelWork(confirmedCount, releaseReadyCount) {
  if (releaseReadyCount >= confirmedCount && confirmedCount > 0) {
    return 'release-ready-complete';
  }

  if (releaseReadyCount > 0) {
    return 'release-ready-partial';
  }

  if (confirmedCount > 0) {
    return 'metadata-backfill';
  }

  return 'none';
}

function buildSummary() {
  const releaseReadyReportPath = discoverLatestReleaseReadyReportPath();
  const releaseReadyReport = releaseReadyReportPath ? readJson(releaseReadyReportPath) : undefined;
  const themes = discoverLatestRuns().map(entry => {
    const coveragePath = path.join(REPORT_ROOT, `coverage-${entry.reviewRunId}.json`);
    const reviewPath = path.join(REPORT_ROOT, `review-${entry.reviewRunId}.md`);
    const coverage = readJson(coveragePath);
    const confirmed = readJson(entry.confirmedPath);
    const themeGateBlockers = pickTriggerLabels(coverage.triggers || {}, THEME_TRIGGER_LABELS);
    const portfolioGateBlockers = pickTriggerLabels(coverage.triggers || {}, PORTFOLIO_TRIGGER_LABELS);
    const releaseReadyCount = releaseReadyReport?.themes?.[entry.theme]?.releaseReady || 0;

    return {
      theme: entry.theme,
      reviewRunId: entry.reviewRunId,
      reviewPath: relative(reviewPath),
      coveragePath: relative(coveragePath),
      confirmedPath: relative(entry.confirmedPath),
      promote: coverage.emotionCoverage?.[entry.theme]?.promote || 0,
      hold: coverage.emotionCoverage?.[entry.theme]?.hold || 0,
      reject: coverage.emotionCoverage?.[entry.theme]?.reject || 0,
      confirmedCount: confirmed.length,
      releaseReadyCount,
      matchedPercent: coverage.estimatedSceneMatch?.matchedPercent || 0,
      parallelWork: determineParallelWork(confirmed.length, releaseReadyCount),
      themeGateStatus: themeGateBlockers.length === 0 ? 'gate-cleared' : 'still-needs-curation-backfill',
      themeGateBlockers,
      recommendedThemeGateWork: determineGateWork(themeGateBlockers),
      portfolioGateStatus: portfolioGateBlockers.length === 0 ? 'gate-cleared' : 'still-needs-program-backfill',
      portfolioGateBlockers,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    source: 'met',
    releaseReadyReportPath: releaseReadyReportPath ? relative(releaseReadyReportPath) : undefined,
    notes: [
      'Parallel work reflects the farthest completed curation step for each theme, without implying the theme has cleared the review-loop gate.',
      'Theme gate status is derived from coverage triggers for confirmed count, scene-match coverage, and orientation coverage.',
      'Portfolio gate status currently tracks source concentration separately because the current bootstrap wave is still single-source.',
    ],
    themes,
  };
}

function renderMarkdown(summary) {
  const lines = [
    '# Review Summary',
    '',
  ];

  if (summary.releaseReadyReportPath) {
    lines.push(`- release-ready report: \`${summary.releaseReadyReportPath}\``, '');
  }

  lines.push(
    '| Theme | Run ID | Promote | Hold | Reject | Confirmed | Release-ready | Scene match | Parallel work | Theme gate |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  );

  for (const item of summary.themes) {
    lines.push(
      `| ${item.theme} | \`${item.reviewRunId}\` | ${item.promote} | ${item.hold} | ${item.reject} | ${item.confirmedCount} | ${item.releaseReadyCount} | ${item.matchedPercent}% | \`${item.parallelWork}\` | \`${item.themeGateStatus}\` |`,
    );
  }

  lines.push('', '## Theme Gate Blockers', '');
  for (const item of summary.themes) {
    lines.push(
      `- ${item.theme}: ${item.themeGateBlockers.length > 0 ? item.themeGateBlockers.map(blocker => `\`${blocker}\``).join(', ') : '`none`'}`,
    );
  }

  lines.push('', '## Next Step', '');
  for (const item of summary.themes) {
    lines.push(
      `- ${item.theme}: parallelWork=\`${item.parallelWork}\`; releaseReady=${item.releaseReadyCount}/${item.confirmedCount}; themeGate=\`${item.recommendedThemeGateWork}\`; portfolioGate=${item.portfolioGateBlockers.length > 0 ? item.portfolioGateBlockers.map(blocker => `\`${blocker}\``).join(', ') : '`none`'}`,
    );
  }

  return lines.join('\n');
}

function main() {
  const summary = buildSummary();
  const jsonPath = path.join(REPORT_ROOT, 'review-summary.json');
  const markdownPath = path.join(REPORT_ROOT, 'review-summary.md');

  ensureDir(REPORT_ROOT);
  fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(markdownPath, `${renderMarkdown(summary)}\n`);

  console.log(relative(jsonPath));
  console.log(relative(markdownPath));
}

main();
