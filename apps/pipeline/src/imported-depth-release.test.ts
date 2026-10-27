import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { parseArtworkRecords } from "@artduo/contracts";
import { LOCAL_SEMANTIC_MODEL, semanticFingerprint } from "@artduo/corpus/src/semantic-index";
import { buildReleaseArtifact } from "./release-artifact";
import { activateSemanticRelease, buildSemanticRelease } from "./semantic-release";
import { buildModelDepthRelease } from "./model-depth-release";
import { buildImportedDepthRelease } from "./imported-depth-release";

test("external depths import unchanged, retain missing assets, and reject invalid batches before writing", async () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-import-depth-"));
  const repository = path.resolve(__dirname, "../../..");
  try {
    const sourceImage = await sharp({ create: { width: 18, height: 6, channels: 3, background: "#456789" } }).png().toBuffer();
    const artworks = parseArtworkRecords(JSON.parse(readFileSync(path.join(repository, "packages/contracts/fixtures/artworks.json"), "utf8")));
    for (const record of artworks) {
      record.metadata.medium = "Oil on canvas";
      record.metadata.subjectTags = ["Paintings"];
      record.media = { ...record.media, depthMap: undefined, baseImageUrl: `images/${record.id}.png`, imageUrlPreview: `images/${record.id}.png`, sourceAssetFingerprint: `sha256:${semanticFingerprint(sourceImage)}` };
    }
    const corpusPath = path.join(rootDir, "corpus.json"), outputRoot = path.join(rootDir, "data/releases");
    writeFileSync(corpusPath, JSON.stringify(artworks));
    mkdirSync(path.join(rootDir, "images"));
    for (const record of artworks) writeFileSync(path.join(rootDir, record.media.imageUrlPreview!), sourceImage);
    buildReleaseArtifact({ rootDir: repository, outputRoot, corpusPath, corpusVersion: "base" });
    const semantic = await buildSemanticRelease({ rootDir, baseVersion: "base", version: "semantic", encoder: { model: LOCAL_SEMANTIC_MODEL,
      async embedDocuments(texts) { return texts.map(() => [1, ...Array(383).fill(0)]); }, async embedQueries() { return []; }, async dispose() {} } });
    activateSemanticRelease(semantic.directory, outputRoot);
    const old = await buildModelDepthRelease({ rootDir, baseVersion: "semantic", version: "old", estimator: {
      async predict() { return { values: new Float32Array([0, 1, 2, 3, 4, 5]), width: 3, height: 2 }; }, async dispose() {} } });
    const oldDir = activateSemanticRelease(old.directory, outputRoot);
    const oldManifest = readFileSync(path.join(oldDir, "manifest.json"));
    const oldMedia = readFileSync(path.join(oldDir, "media-01.json"));
    writeFileSync(path.join(oldDir, "visual-reviews.json"), JSON.stringify({ schemaVersion: 2, releaseVersion: "old", reviews: artworks.map(record => ({ artworkId: record.id, imagePath: record.media.imageUrlPreview })) }));
    const creditsDir = path.join(rootDir, "data/curation/public-url-import/old");
    mkdirSync(creditsDir, { recursive: true });
    writeFileSync(path.join(creditsDir, "creator-credits.json"), JSON.stringify({ schemaVersion: 1, releaseVersion: "old", entries: [] }));
    const inputDir = path.join(rootDir, "incoming");
    mkdirSync(inputDir);
    const id = artworks[0]!.id, filename = path.join(inputDir, `${id}.png`);
    const replacement = await sharp(Buffer.from([0, 32, 64, 128, 200, 255, 0, 32, 64, 128, 200, 255]), { raw: { width: 6, height: 2, channels: 1 } }).toColourspace("b-w").png().toBuffer();
    writeFileSync(filename, replacement);
    const options = { rootDir, baseVersion: "old", version: "imported", inputDir, modelId: "DA3Mono-Large", expectedCount: 1 };
    const candidate = path.join(rootDir, "data/curation/preview/imported");
    await assert.rejects(buildImportedDepthRelease({ ...options, expectedCount: 2 }), /Expected 2/);
    writeFileSync(path.join(inputDir, "unknown.png"), replacement);
    await assert.rejects(buildImportedDepthRelease(options), /Unknown or duplicate/);
    rmSync(path.join(inputDir, "unknown.png"));
    const alias = `%${id.charCodeAt(0).toString(16)}${id.slice(1)}.png`;
    writeFileSync(path.join(inputDir, alias), replacement);
    await assert.rejects(buildImportedDepthRelease({ ...options, expectedCount: 2 }), /Unknown or duplicate/);
    rmSync(path.join(inputDir, alias));
    writeFileSync(filename, sourceImage);
    await assert.rejects(buildImportedDepthRelease(options), /grayscale/);
    writeFileSync(filename, await sharp({ create: { width: 6, height: 2, channels: 3, background: "#888888" } }).toColourspace("b-w").png().toBuffer());
    await assert.rejects(buildImportedDepthRelease(options), /variation/);
    writeFileSync(filename, await sharp(replacement).resize(4, 4).toColourspace("b-w").png().toBuffer());
    await assert.rejects(buildImportedDepthRelease(options), /aspect ratio/);
    assert.equal(existsSync(candidate), false, "rejected batches must not create a candidate");
    writeFileSync(filename, replacement);

    const result = await buildImportedDepthRelease(options);
    assert.equal(result.report.importedCount, 1);
    assert.equal(result.report.retainedCount, artworks.length - 1);
    assert.equal(result.report.model.weightsSha256, null, "external weights must not be invented");
    for (const item of result.report.records) {
      assert.equal(item.modelInputSha256, null, "external inference inputs were not independently verified");
      const expected = item.artworkId === id ? replacement : readFileSync(path.join(oldDir, item.url));
      assert.deepEqual(readFileSync(path.join(result.directory, item.url)), expected);
    }
    const nextIndex = JSON.parse(readFileSync(path.join(result.directory, "semantic-index.json"), "utf8"));
    assert.deepEqual(nextIndex.records, semantic.index.records);
    const nextMedia = JSON.parse(readFileSync(path.join(result.directory, "media-01.json"), "utf8"));
    assert.ok(nextMedia.every((row: any) => row.version === "imported" && row.media.depthMap.version === "imported"));
    assert.equal(JSON.parse(readFileSync(path.join(result.directory, "visual-reviews.json"), "utf8")).releaseVersion, "imported");
    assert.equal(JSON.parse(readFileSync(path.join(result.directory, "creator-credits.json"), "utf8")).releaseVersion, "imported");
    assert.deepEqual(readFileSync(path.join(rootDir, "data/curation/public-url-import/imported/creator-credits.json")), readFileSync(path.join(result.directory, "creator-credits.json")), "older app builds retain the same corrected credits");
    assert.deepEqual(readFileSync(path.join(oldDir, "manifest.json")), oldManifest);
    assert.deepEqual(readFileSync(path.join(oldDir, "media-01.json")), oldMedia);
    assert.deepEqual(readFileSync(filename), replacement);
    assert.deepEqual(readFileSync(path.join(result.directory, "depth-history/old.json")), readFileSync(path.join(oldDir, "depth-report.json")));
    activateSemanticRelease(result.directory, outputRoot);
    await assert.rejects(buildImportedDepthRelease(options), /already exists/);

    const excludedArtworkIds = artworks.slice(1).map(record => record.id);
    await assert.rejects(buildImportedDepthRelease({ ...options, version: "pruned", excludedArtworkIds: ["missing"] }), /Excluded artwork identities/);
    await assert.rejects(buildImportedDepthRelease({ ...options, version: "pruned", excludedArtworkIds: [id, id] }), /Excluded artwork identities/);
    const pruned = await buildImportedDepthRelease({ ...options, version: "pruned", excludedArtworkIds });
    assert.equal(pruned.report.artworkCount, 1); assert.equal(pruned.report.count, 1); assert.equal(pruned.report.retainedCount, 0);
    assert.deepEqual(pruned.report.excludedArtworkIds, [...excludedArtworkIds].sort());
    const prunedManifest = JSON.parse(readFileSync(path.join(pruned.directory, "manifest.json"), "utf8"));
    for (const kind of ["metadata", "search", "mediaIndex", "embeddings"]) for (const shard of prunedManifest.shards[kind] ?? []) {
      const rows = JSON.parse(readFileSync(path.join(pruned.directory, shard.url), "utf8"));
      assert.deepEqual(rows.map((row: { id: string }) => row.id), [id]);
      assert.equal(shard.recordCount, 1);
    }
    const prunedIndex = JSON.parse(readFileSync(path.join(pruned.directory, "semantic-index.json"), "utf8"));
    assert.deepEqual(prunedIndex.records, semantic.index.records.filter(row => row.artworkId === id));
    assert.deepEqual(JSON.parse(readFileSync(path.join(pruned.directory, "visual-reviews.json"), "utf8")).reviews.map((row: { artworkId: string }) => row.artworkId), [id]);
    for (const removed of artworks.slice(1)) {
      assert.equal(existsSync(path.join(pruned.directory, removed.media.imageUrlPreview!)), false);
      assert.equal(existsSync(path.join(pruned.directory, "depth", `${removed.id}.png`)), false);
    }
    assert.equal(existsSync(path.join(pruned.directory, "depth-history")), false, "the active release must not duplicate excluded historical records");
    assert.deepEqual(readFileSync(path.join(oldDir, "manifest.json")), oldManifest);
    activateSemanticRelease(pruned.directory, outputRoot);
  } finally { rmSync(rootDir, { recursive: true, force: true }); }
});
