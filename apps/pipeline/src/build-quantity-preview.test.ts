import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { parseReleaseManifest } from "@artduo/contracts";

import { buildQuantityPreview } from "./quantity-preview";

test("quantity preview builder tops up candidate pool with legacy boost records to reach target count", () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-quantity-preview-root-"));
  const candidateRoot = path.join(rootDir, "data", "curation", "candidate-pool");
  const outputRoot = path.join(rootDir, "data", "curation", "preview");
  const reportRoot = path.join(rootDir, "data", "curation", "reports");
  const scenesDir = path.join(rootDir, "public", "artduo-gallery", "scenes");
  const processedDir = path.join(rootDir, "data", "met", "processed");
  const scenesFixturePath = path.resolve(__dirname, "../../../packages/contracts/fixtures/background-scenes.json");
  const scenesFixture = JSON.parse(readFileSync(scenesFixturePath, "utf8")) as Array<Record<string, unknown>>;

  mkdirSync(candidateRoot, { recursive: true });
  mkdirSync(outputRoot, { recursive: true });
  mkdirSync(reportRoot, { recursive: true });
  mkdirSync(scenesDir, { recursive: true });
  mkdirSync(processedDir, { recursive: true });

  writeFileSync(path.join(scenesDir, "scene-01.json"), `${JSON.stringify(scenesFixture[0], null, 2)}\n`);

  writeFileSync(path.join(candidateRoot, "wonder--2026-04-24T10-00-00-000Z--wonder--astonishment.json"), JSON.stringify([
    {
      sourceArtworkId: "100001",
      id: "met-100001",
      source: "met",
      metadata: {
        title: "Wonder Candidate",
        artistDisplayName: "Candidate Artist",
        descriptionRaw: "",
        medium: "Oil on canvas",
        objectUrl: "https://example.com/candidate",
      },
      media: {
        imageUrlPreview: "https://example.com/candidate-preview.jpg",
        imageUrlFull: "https://example.com/candidate-full.jpg",
        mediaVersion: "2026-04-24T00:00:00.000Z",
      },
      pipeline: {
        status: "candidate",
        excludeReasons: [],
        metadataGaps: ["missing-description"],
      },
    },
  ], null, 2));

  writeFileSync(path.join(processedDir, "artworks-metadata.json"), JSON.stringify([
    {
      id: "met-200001",
      title: "Legacy Wonder",
      artist: "Legacy Artist 1",
      medium: "Oil on panel",
      description: "Legacy wonder scene",
      qualityScore: 0.8,
      emotion: { id: "wonder", en: "Wonder", keywords: ["wonder"] },
    },
    {
      id: "met-200002",
      title: "Legacy Serenity",
      artist: "Legacy Artist 2",
      medium: "Watercolor",
      description: "Legacy serenity scene",
      qualityScore: 0.7,
      emotion: { id: "serenity", en: "Serenity", keywords: ["serenity"] },
    },
  ], null, 2));
  writeFileSync(path.join(processedDir, "artworks-search.json"), JSON.stringify([
    {
      id: "met-200001",
      title: "Legacy Wonder",
      artist: "Legacy Artist 1",
      description: "Legacy wonder scene",
      searchText: "Legacy Wonder wonder",
      qualityWeight: 0.8,
      emotion: { id: "wonder", en: "Wonder", keywords: ["wonder"] },
    },
    {
      id: "met-200002",
      title: "Legacy Serenity",
      artist: "Legacy Artist 2",
      description: "Legacy serenity scene",
      searchText: "Legacy Serenity serenity",
      qualityWeight: 0.7,
      emotion: { id: "serenity", en: "Serenity", keywords: ["serenity"] },
    },
  ], null, 2));
  writeFileSync(path.join(processedDir, "artworks-images.json"), JSON.stringify([
    {
      id: "met-200001",
      primary: "https://example.com/legacy-1-full.jpg",
      thumbnail: "https://example.com/legacy-1-thumb.jpg",
    },
    {
      id: "met-200002",
      primary: "https://example.com/legacy-2-full.jpg",
      thumbnail: "https://example.com/legacy-2-thumb.jpg",
    },
  ], null, 2));

  const result = buildQuantityPreview({
    rootDir,
    previewVersion: "2026-04-24-quantity-preview-a",
    targetCount: 3,
  });

  const manifest = parseReleaseManifest(JSON.parse(readFileSync(path.join(result.outputDir, "manifest.json"), "utf8")));
  const report = JSON.parse(readFileSync(result.reportPath, "utf8"));
  const metadata = JSON.parse(readFileSync(path.join(result.outputDir, "metadata-01.json"), "utf8")) as Array<Record<string, unknown>>;
  const provenance = JSON.parse(readFileSync(path.join(result.outputDir, "provenance-01.json"), "utf8")) as Array<Record<string, unknown>>;

  assert.equal(manifest.release.corpusVersion, "2026-04-24-quantity-preview-a");
  assert.equal(report.scope, "quantity-preview-only");
  assert.equal(report.counts.candidateUniqueCount, 1);
  assert.equal(report.counts.legacyBoostCount, 2);
  assert.equal(report.counts.legacyFallbackCount, 0);
  assert.equal(report.counts.finalPreviewCount, 3);
  assert.ok(report.provenancePath.endsWith("provenance-01.json"));
  assert.equal(provenance.length, 3);
  assert.equal(provenance[0]?.previewSource, "candidate-pool");
  assert.equal(provenance[1]?.previewSource, "legacy-boost");
  assert.ok(
    metadata.every((record) => {
      const tags = (((record.metadata as Record<string, unknown> | undefined)?.compositionTags) ?? []) as string[];
      return !tags.includes("curated-promote");
    }),
  );
});
