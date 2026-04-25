#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const BATCH_ROOT = path.join(ROOT, 'data/sources/met/batch');
const REPORT_ROOT = path.join(ROOT, 'data/curation/reports');
const APPROVED_MATRIX_PATH = path.join(REPORT_ROOT, 'probe-approved-query-matrix.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function arraysEqual(left, right) {
  return JSON.stringify([...(left || [])].sort()) === JSON.stringify([...(right || [])].sort());
}

function matchesApprovedInput(query, approvedBatchInput) {
  return query.query === approvedBatchInput.query
    && arraysEqual(query.synonyms || [], approvedBatchInput.synonyms || [])
    && arraysEqual(query.excludes || [], approvedBatchInput.excludes || []);
}

function listThemeRunIds(theme) {
  const themeDir = path.join(BATCH_ROOT, theme);
  if (!fileExists(themeDir)) {
    return [];
  }

  return fs.readdirSync(themeDir)
    .filter(runId => fileExists(path.join(themeDir, runId, 'query.json')))
    .sort((left, right) => left.localeCompare(right));
}

function updateFileIfNeeded(filePath, probeApproval) {
  if (!fileExists(filePath)) {
    return false;
  }

  const payload = readJson(filePath);
  if (JSON.stringify(payload.probeApproval || null) === JSON.stringify(probeApproval)) {
    return false;
  }

  payload.probeApproval = probeApproval;
  writeJson(filePath, payload);
  return true;
}

function main() {
  const approvedMatrix = readJson(APPROVED_MATRIX_PATH);
  const changedFiles = [];
  const touchedRuns = [];

  for (const entry of approvedMatrix.themes || []) {
    const probeApproval = {
      matrixPath: relative(APPROVED_MATRIX_PATH),
      probeRunId: entry.probeRunId,
      note: entry.note || '',
    };

    for (const runId of listThemeRunIds(entry.theme)) {
      const runDir = path.join(BATCH_ROOT, entry.theme, runId);
      const queryPath = path.join(runDir, 'query.json');
      const query = readJson(queryPath);

      if (!matchesApprovedInput(query, entry.approvedBatchInput || {})) {
        continue;
      }

      const runChangedFiles = [];
      const gapReportPath = path.join(REPORT_ROOT, `gap-report-${runId}.json`);
      const batchReportJsonPath = path.join(runDir, 'batch-report.json');

      if (updateFileIfNeeded(queryPath, probeApproval)) {
        runChangedFiles.push(relative(queryPath));
      }
      if (updateFileIfNeeded(gapReportPath, probeApproval)) {
        runChangedFiles.push(relative(gapReportPath));
      }
      if (updateFileIfNeeded(batchReportJsonPath, probeApproval)) {
        runChangedFiles.push(relative(batchReportJsonPath));
      }

      if (runChangedFiles.length > 0) {
        touchedRuns.push({ theme: entry.theme, runId, files: runChangedFiles });
        changedFiles.push(...runChangedFiles);
      }
    }
  }

  if (touchedRuns.length === 0) {
    console.log('No batch artifacts required probeApproval backfill.');
    return;
  }

  console.log('Backfilled batch probeApproval into:');
  for (const run of touchedRuns) {
    console.log(`- ${run.theme} / ${run.runId}`);
    for (const file of run.files) {
      console.log(`  - ${file}`);
    }
  }
  console.log(`Updated files: ${changedFiles.length}`);
}

main();
