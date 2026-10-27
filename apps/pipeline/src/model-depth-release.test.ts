import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { parseArtworkRecords } from "@artduo/contracts";
import { LOCAL_SEMANTIC_MODEL, semanticFingerprint } from "@artduo/corpus/src/semantic-index";
import { buildReleaseArtifact } from "./release-artifact";
import { activateSemanticRelease, buildSemanticRelease } from "./semantic-release";
import { buildModelDepthRelease, normalizeRelativeDepth } from "./model-depth-release";

test("model depth rejects nonfinite and spatially constant predictions", () => {
  assert.throws(() => normalizeRelativeDepth({ values: new Float32Array([0, 1, NaN, 3]), width: 2, height: 2 }), /Invalid/);
  assert.throws(() => normalizeRelativeDepth({ values: new Float32Array([3, 3, 3, 3]), width: 2, height: 2 }), /variation/);
});

test("depth assets preserve complete image geometry, source release and semantic vectors", async () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-depth-release-"));
  const repository = path.resolve(__dirname, "../../..");
  try {
    const sourceImage = await sharp({ create: { width: 18, height: 6, channels: 3, background: "#456789" } }).png().toBuffer();
    const artworks = parseArtworkRecords(JSON.parse(readFileSync(path.join(repository, "packages/contracts/fixtures/artworks.json"), "utf8")));
    for (const record of artworks) {
      record.metadata.medium = "Oil on canvas";
      record.metadata.subjectTags = ["Paintings"];
      record.media = { ...record.media, depthMap: undefined, baseImageUrl: `images/${record.id}.png`, imageUrlPreview: `images/${record.id}.png`, sourceAssetFingerprint: `sha256:${semanticFingerprint(sourceImage)}` };
    }
    const corpusPath = path.join(rootDir, "corpus.json");
    writeFileSync(corpusPath, JSON.stringify(artworks));
    const outputRoot = path.join(rootDir, "data/releases");
    mkdirSync(path.join(rootDir, "images"));
    for (const record of artworks) writeFileSync(path.join(rootDir, record.media.imageUrlPreview!), sourceImage);
    buildReleaseArtifact({ rootDir: repository, outputRoot, corpusPath, corpusVersion: "base" });
    const semantic = await buildSemanticRelease({ rootDir, baseVersion: "base", version: "semantic", encoder: { model: LOCAL_SEMANTIC_MODEL,
      async embedDocuments(texts) { return texts.map(() => [1, ...Array(383).fill(0)]); }, async embedQueries() { return []; }, async dispose() {} } });
    activateSemanticRelease(semantic.directory, outputRoot);
    const sourceManifest = readFileSync(path.join(outputRoot, "semantic/manifest.json"), "utf8");
    const sourceMedia = readFileSync(path.join(outputRoot, "semantic/media-01.json"), "utf8");
    const prediction = { values: new Float32Array([0, 1, 2, 3, 4, 5]), width: 3, height: 2 };
    let calls = 0;
    await assert.rejects(buildModelDepthRelease({ rootDir, baseVersion: "semantic", version: "depth", estimator: {
      async predict() { if (++calls === 2) throw new Error("simulated interrupted batch"); return prediction; }, async dispose() {} } }), /interrupted batch/);
    calls = 0;
    const result = await buildModelDepthRelease({ rootDir, baseVersion: "semantic", version: "depth", resume: true, estimator: {
      async predict() { calls++; return prediction; }, async dispose() {} } });
    assert.equal(calls, artworks.length - 1, "resume verifies and reuses already completed image assets");
    assert.equal(result.report.length, artworks.length);
    for (const record of result.report) {
      const actual = await sharp(path.join(result.directory, record.url)).metadata();
      assert.equal(actual.width, 18);
      assert.equal(actual.height, 6);
      assert.equal(record.inputSha256, `sha256:${semanticFingerprint(sourceImage)}`);
    }
    assert.equal(readFileSync(path.join(outputRoot, "semantic/manifest.json"), "utf8"), sourceManifest);
    assert.equal(readFileSync(path.join(outputRoot, "semantic/media-01.json"), "utf8"), sourceMedia);
    const nextIndex = JSON.parse(readFileSync(path.join(result.directory, "semantic-index.json"), "utf8"));
    assert.deepEqual(nextIndex.records, semantic.index.records);
    activateSemanticRelease(result.directory, outputRoot);
    await assert.rejects(buildModelDepthRelease({ rootDir, baseVersion: "semantic", version: "depth" }), /already exists/);
  } finally { rmSync(rootDir, { recursive: true, force: true }); }
});
