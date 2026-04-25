import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { parseReleaseManifest } from "@artduo/contracts";

import { buildCandidatePreview } from "./candidate-preview";

test("candidate preview builder merges latest candidate pool inputs and removes cross-theme duplicates", () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-candidate-preview-root-"));
  const candidateRoot = path.join(rootDir, "data", "curation", "candidate-pool");
  const outputRoot = path.join(rootDir, "data", "curation", "preview");
  const reportRoot = path.join(rootDir, "data", "curation", "reports");
  const scenesDir = path.join(rootDir, "public", "artduo-gallery", "scenes");
  const scenesFixturePath = path.resolve(__dirname, "../../../packages/contracts/fixtures/background-scenes.json");
  const scenesFixture = JSON.parse(readFileSync(scenesFixturePath, "utf8")) as Array<Record<string, unknown>>;

  mkdirSync(candidateRoot, { recursive: true });
  mkdirSync(outputRoot, { recursive: true });
  mkdirSync(reportRoot, { recursive: true });
  mkdirSync(scenesDir, { recursive: true });

  writeFileSync(path.join(scenesDir, "scene-01.json"), `${JSON.stringify(scenesFixture[0], null, 2)}\n`);

  const shared = {
    sourceArtworkId: "310279",
    id: "met-310279",
    source: "met",
    metadata: {
      title: "Shared Work",
      artistDisplayName: "Shared Artist",
      descriptionRaw: "",
      medium: "Oil on canvas",
      objectUrl: "https://example.com/shared",
    },
    media: {
      imageUrlPreview: "https://example.com/shared-preview.jpg",
      imageUrlFull: "https://example.com/shared-full.jpg",
      mediaVersion: "2026-04-24T00:00:00.000Z",
    },
    pipeline: {
      status: "candidate",
      excludeReasons: [],
      metadataGaps: ["missing-description"],
    },
  };

  writeFileSync(path.join(candidateRoot, "hope--2026-04-24T09-00-00-000Z--hope--hope.json"), JSON.stringify([shared], null, 2));
  writeFileSync(path.join(candidateRoot, "hope--2026-04-24T10-00-00-000Z--hope--hope.json"), JSON.stringify([
    shared,
    {
      sourceArtworkId: "500001",
      id: "met-500001",
      source: "met",
      metadata: {
        title: "Hope Work",
        artistDisplayName: "Hope Artist",
        descriptionRaw: "",
        medium: "Oil on panel",
        objectUrl: "https://example.com/hope",
      },
      media: {
        imageUrlPreview: "https://example.com/hope-preview.jpg",
        imageUrlFull: "https://example.com/hope-full.jpg",
        mediaVersion: "2026-04-24T00:00:00.000Z",
      },
      pipeline: {
        status: "candidate",
        excludeReasons: [],
        metadataGaps: ["missing-description"],
      },
    },
  ], null, 2));
  writeFileSync(path.join(candidateRoot, "wonder--2026-04-24T10-00-00-000Z--wonder--astonishment.json"), JSON.stringify([
    shared,
    {
      sourceArtworkId: "500002",
      id: "met-500002",
      source: "met",
      metadata: {
        title: "Wonder Work",
        artistDisplayName: "Wonder Artist",
        descriptionRaw: "",
        medium: "Watercolor",
        objectUrl: "https://example.com/wonder",
      },
      media: {
        imageUrlPreview: "https://example.com/wonder-preview.jpg",
        imageUrlFull: "https://example.com/wonder-full.jpg",
        mediaVersion: "2026-04-24T00:00:00.000Z",
      },
      pipeline: {
        status: "candidate",
        excludeReasons: [],
        metadataGaps: ["missing-description"],
      },
    },
  ], null, 2));

  const result = buildCandidatePreview({
    rootDir,
    previewVersion: "2026-04-24-candidate-preview-a",
  });

  const manifest = parseReleaseManifest(JSON.parse(readFileSync(path.join(result.outputDir, "manifest.json"), "utf8")));
  const report = JSON.parse(readFileSync(result.reportPath, "utf8"));
  const metadata = JSON.parse(readFileSync(path.join(result.outputDir, "metadata-01.json"), "utf8")) as Array<Record<string, unknown>>;

  assert.equal(manifest.release.corpusVersion, "2026-04-24-candidate-preview-a");
  assert.equal(report.scope, "candidate-preview-only");
  assert.equal(report.counts.inputThemeCount, 2);
  assert.equal(report.counts.inputRecordCount, 5);
  assert.equal(report.counts.duplicateCount, 2);
  assert.equal(report.counts.previewRecordCount, 3);
  assert.equal(report.themes[0]?.theme, "hope");
  assert.equal(report.themes[0]?.inputRunCount, 2);
  assert.equal(report.themes[0]?.inputCount, 3);
  assert.equal(report.themes[0]?.duplicateCount, 1);
  assert.equal(report.themes[1]?.duplicateCount, 1);
  assert.ok(
    metadata.every((record) => {
      const tags = (((record.metadata as Record<string, unknown> | undefined)?.compositionTags) ?? []) as string[];
      return !tags.includes("curated-promote");
    }),
  );
});
