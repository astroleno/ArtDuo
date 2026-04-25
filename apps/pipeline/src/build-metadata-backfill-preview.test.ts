import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { parseReleaseManifest } from "@artduo/contracts";

import { buildMetadataBackfillPreview } from "./metadata-backfill-preview";

test("metadata preview builder uses latest metadata-backfill input per theme and preserves blocker context", () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-metadata-preview-root-"));
  const metadataBackfillRoot = path.join(rootDir, "data", "curation", "metadata-backfill");
  const outputRoot = path.join(rootDir, "data", "curation", "preview");
  const reportRoot = path.join(rootDir, "data", "curation", "reports");
  const scenesDir = path.join(rootDir, "public", "artduo-gallery", "scenes");
  const artworksFixturePath = path.resolve(__dirname, "../../../packages/contracts/fixtures/artworks.json");
  const scenesFixturePath = path.resolve(__dirname, "../../../packages/contracts/fixtures/background-scenes.json");
  const artworksFixture = JSON.parse(readFileSync(artworksFixturePath, "utf8")) as Array<Record<string, unknown>>;
  const scenesFixture = JSON.parse(readFileSync(scenesFixturePath, "utf8")) as Array<Record<string, unknown>>;

  mkdirSync(metadataBackfillRoot, { recursive: true });
  mkdirSync(outputRoot, { recursive: true });
  mkdirSync(reportRoot, { recursive: true });
  mkdirSync(scenesDir, { recursive: true });

  writeFileSync(path.join(scenesDir, "scene-01.json"), `${JSON.stringify(scenesFixture[0], null, 2)}\n`);

  writeFileSync(
    path.join(metadataBackfillRoot, "hope--2026-04-24T09-00-00-000Z--hope--review-wave0.json"),
    JSON.stringify(artworksFixture.slice(0, 2), null, 2),
  );
  writeFileSync(
    path.join(metadataBackfillRoot, "hope--2026-04-24T10-18-44-860Z--hope--review-wave1.json"),
    JSON.stringify(artworksFixture.slice(0, 1), null, 2),
  );
  writeFileSync(
    path.join(metadataBackfillRoot, "wonder--2026-04-24T10-18-44-860Z--wonder--review-wave1.json"),
    JSON.stringify(artworksFixture.slice(1, 3), null, 2),
  );

  writeFileSync(path.join(reportRoot, "metadata-backfill-hope--2026-04-24T10-18-44-860Z--hope--review-wave1.json"), JSON.stringify({
    coverageContexts: [
      {
        theme: "hope",
        matchedPercent: 38.2,
        themeGateBlockers: ["confirmed-below-thirty", "scene-match-below-sixty"],
        portfolioGateBlockers: ["source-concentration-above-seventy"],
      },
    ],
  }, null, 2));
  writeFileSync(path.join(reportRoot, "metadata-backfill-wonder--2026-04-24T10-18-44-860Z--wonder--review-wave1.json"), JSON.stringify({
    coverageContexts: [
      {
        theme: "wonder",
        matchedPercent: 45.1,
        themeGateBlockers: ["confirmed-below-thirty", "scene-match-below-sixty"],
        portfolioGateBlockers: ["source-concentration-above-seventy"],
      },
    ],
  }, null, 2));

  const result = buildMetadataBackfillPreview({
    rootDir,
    previewVersion: "2026-04-24-metadata-preview-a",
  });

  const manifest = parseReleaseManifest(JSON.parse(readFileSync(path.join(result.outputDir, "manifest.json"), "utf8")));
  const report = JSON.parse(readFileSync(result.reportPath, "utf8"));

  assert.equal(manifest.release.corpusVersion, "2026-04-24-metadata-preview-a");
  assert.equal(report.scope, "preview-only");
  assert.equal(report.counts.inputThemeCount, 2);
  assert.equal(report.counts.inputRecordCount, 3);
  assert.equal(report.counts.previewRecordCount, 3);
  assert.equal(report.themes[0]?.theme, "hope");
  assert.equal(report.themes[0]?.recordCount, 1);
  assert.equal(report.themes[0]?.matchedPercent, 38.2);
  assert.deepEqual(report.themes[1]?.themeGateBlockers, ["confirmed-below-thirty", "scene-match-below-sixty"]);
});
