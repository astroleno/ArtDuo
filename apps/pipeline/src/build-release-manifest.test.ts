import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
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

test("local artwork images are bundled and missing or escaping image paths fail the build", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "artduo-image-release-"));
  const corpus = JSON.parse(readFileSync(path.resolve(__dirname, "../../../packages/contracts/fixtures/artworks.json"), "utf8"));
  const corpusPath = path.join(tempDir, "artworks.json");
  mkdirSync(path.join(tempDir, "images"));
  writeFileSync(path.join(tempDir, "images/painting.jpg"), "image-bytes");
  corpus[0].media.baseImageUrl = "images/painting.jpg";
  corpus[0].media.imageUrlPreview = "images/painting.jpg";
  try {
    writeFileSync(corpusPath, JSON.stringify(corpus));
    const result = buildReleaseArtifactToTempDir({ corpusPath, corpusVersion: "2026-10-06-test-images" });
    assert.equal(readFileSync(path.join(result.outputDir, "images/painting.jpg"), "utf8"), "image-bytes");
    for (const url of ["../outside.jpg", "images/missing.jpg", "images/painting.jpg?x=1"]) {
      corpus[0].media.imageUrlPreview = url;
      writeFileSync(corpusPath, JSON.stringify(corpus));
      assert.throws(() => buildReleaseArtifactToTempDir({ corpusPath }), /release image/);
    }
    symlinkSync(path.resolve(__dirname, "../../../packages/contracts/fixtures/artworks.json"), path.join(tempDir, "images/outside.jpg"));
    corpus[0].media.imageUrlPreview = "images/outside.jpg";
    writeFileSync(corpusPath, JSON.stringify(corpus));
    assert.throws(() => buildReleaseArtifactToTempDir({ corpusPath }), /release image/);
  } finally { rmSync(tempDir, { recursive: true, force: true }); }
});

test("release manifest preserves depth-map metadata and binds it to the new release", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "artduo-depth-map-release-"));
  const fixturePath = path.resolve(__dirname, "../../../packages/contracts/fixtures/artworks.json");
  const corpus = JSON.parse(readFileSync(fixturePath, "utf8")) as Array<{
    id: string;
    version: string;
    media: { sourceAssetFingerprint?: string; depthMap?: Record<string, unknown> };
  }>;
  const firstArtwork = corpus[0];
  assert.ok(firstArtwork?.media.sourceAssetFingerprint);
  if (!firstArtwork?.media.sourceAssetFingerprint) {
    return;
  }

  firstArtwork.media.depthMap = {
    url: `depth-maps/${firstArtwork.id}.png`,
    version: firstArtwork.version,
    sourceAssetFingerprint: firstArtwork.media.sourceAssetFingerprint,
    method: "estimated",
  };
  mkdirSync(path.join(tempDir, "depth-maps"), { recursive: true });
  writeFileSync(path.join(tempDir, "depth-maps", `${firstArtwork.id}.png`), "test-depth-map");
  const corpusPath = path.join(tempDir, "artworks.json");
  writeFileSync(corpusPath, `${JSON.stringify(corpus, null, 2)}\n`);

  const result = buildReleaseArtifactToTempDir({
    corpusPath,
    corpusVersion: "2026-04-24-depth-map-test",
  });

  assert.deepEqual(result.records.mediaIndex[0]?.media.depthMap, {
    url: `depth-maps/${firstArtwork.id}.png`,
    version: "2026-04-24-depth-map-test",
    sourceAssetFingerprint: firstArtwork.media.sourceAssetFingerprint,
    method: "estimated",
  });
  assert.equal(
    readFileSync(path.join(result.outputDir, "depth-maps", `${firstArtwork.id}.png`), "utf8"),
    "test-depth-map",
  );
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
