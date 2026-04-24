import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { parseReleaseManifest } from "@artduo/contracts";

import { buildReleaseArtifact, buildReleaseArtifactToTempDir } from "./release-artifact";

test("release manifest build emits a valid Phase 1 artifact", () => {
  const result = buildReleaseArtifactToTempDir({ limit: 5, corpusVersion: "2026-04-24-test" });
  const manifest = parseReleaseManifest(result.manifest);

  assert.equal(manifest.release.contractsVersion, "0.1.0");
  assert.equal(manifest.shards.metadata[0]?.recordCount, result.records.metadata.length);
  assert.equal(manifest.shards.search[0]?.recordCount, result.records.search.length);
  assert.equal(manifest.shards.mediaIndex[0]?.recordCount, result.records.mediaIndex.length);
  assert.equal(manifest.shards.backgroundScenes[0]?.recordCount, result.records.backgroundScenes.length);
  assert.equal(manifest.shards.embeddings, undefined);
});

test("release manifest build can consume curated release-ready corpus", () => {
  const curatedCorpusPath = path.resolve(__dirname, "../../../packages/contracts/fixtures/artworks.json");
  const result = buildReleaseArtifactToTempDir({
    corpusPath: curatedCorpusPath,
    corpusVersion: "2026-04-24-curated-test",
  });
  const manifest = parseReleaseManifest(result.manifest);

  assert.equal(result.records.artworks.length, 3);
  assert.equal(result.records.artworks[0]?.version, "2026-04-24-curated-test");
  assert.equal(manifest.shards.metadata[0]?.recordCount, 3);
  assert.equal(manifest.shards.search[0]?.recordCount, 3);
  assert.equal(manifest.shards.mediaIndex[0]?.recordCount, 3);
});

test("release manifest build prefers latest curated corpus by default when available", () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-curated-default-"));
  const curatedRoot = path.join(rootDir, "data", "curation", "release-ready");
  const scenesDir = path.join(rootDir, "public", "artduo-gallery", "scenes");
  const outputRoot = path.join(rootDir, "data", "releases");
  const artworksFixturePath = path.resolve(__dirname, "../../../packages/contracts/fixtures/artworks.json");
  const scenesFixturePath = path.resolve(__dirname, "../../../packages/contracts/fixtures/background-scenes.json");
  const scenesFixture = JSON.parse(readFileSync(scenesFixturePath, "utf8")) as Array<Record<string, unknown>>;

  mkdirSync(curatedRoot, { recursive: true });
  mkdirSync(scenesDir, { recursive: true });
  writeFileSync(path.join(curatedRoot, "2026-04-24-curation-a.json"), readFileSync(artworksFixturePath, "utf8"));
  writeFileSync(path.join(scenesDir, "scene-01.json"), `${JSON.stringify(scenesFixture[0], null, 2)}\n`);

  const result = buildReleaseArtifact({
    rootDir,
    outputRoot,
    corpusVersion: "2026-04-24-default-curated",
  });

  assert.equal(result.corpusSource, "curated");
  assert.ok(result.resolvedCorpusPath?.endsWith("2026-04-24-curation-a.json"));
  assert.equal(result.records.artworks.length, 3);
  assert.equal(result.records.backgroundScenes.length, 1);
});
