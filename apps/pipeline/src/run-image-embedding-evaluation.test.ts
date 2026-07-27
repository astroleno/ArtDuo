import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import type { ImageEmbeddingShardRecord } from "@artduo/contracts";

import { runImageEmbeddingEvaluation } from "./run-image-embedding-evaluation";

const RELEASE_VERSION = "image-evaluation-runner-test";

function checksum(value: string | Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function writeJson(filePath: string, value: unknown): {
  id: string;
  url: string;
  checksum: string;
  sizeBytes: number;
  recordCount: number;
} {
  const serialized = JSON.stringify(value, null, 2);
  const content = `${serialized}\n`;
  writeFileSync(filePath, content);
  return {
    id: path.basename(filePath, ".json"),
    url: `./${path.basename(filePath)}`,
    checksum: checksum(serialized),
    sizeBytes: Buffer.byteLength(content),
    recordCount: Array.isArray(value) ? value.length : 1,
  };
}

function imageRecord(
  entityType: "artwork" | "background-scene",
  entityId: string,
  vector: number[],
): ImageEmbeddingShardRecord {
  return {
    id: `${entityType}:${entityId}`,
    entityType,
    entityId,
    releaseVersion: RELEASE_VERSION,
    model: "test-image-model",
    modelRevision: "test-revision",
    modelVariant: "quantized",
    modelArtifactChecksum: checksum("model"),
    provider: "@xenova/transformers",
    providerVersion: "2.17.2",
    dimensions: vector.length,
    preprocessingVersion: "test-preprocessing.v1",
    preprocessingFingerprint: checksum("preprocessing"),
    vectorPrecision: 8,
    source: {
      shardId: entityType === "artwork" ? "media-01" : "background-scenes-01",
      recordId: entityId,
      fieldPath: entityType === "artwork" ? "media.imageUrlPreview" : "asset.local_public_path",
      fingerprint: checksum(`source:${entityType}:${entityId}`),
    },
    vector,
  };
}

function createFixture(): {
  rootDir: string;
  manifestPath: string;
  candidatePath: string;
  buildReportPath: string;
  outputPath: string;
  reviewPackPath: string;
  reviewerViewPath: string;
} {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-image-evaluation-runner-"));
  const releaseDir = path.join(rootDir, "data", "releases", RELEASE_VERSION);
  const reportDir = path.join(rootDir, "data", "curation", "reports", "image-embeddings", RELEASE_VERSION);
  const candidateDir = path.join(reportDir, "candidates");
  mkdirSync(releaseDir, { recursive: true });
  mkdirSync(candidateDir, { recursive: true });

  const artworkIds = Array.from({ length: 30 }, (_, index) => `artwork-${String(index + 1).padStart(2, "0")}`);
  const sceneIds = Array.from({ length: 12 }, (_, index) => `scene-${String(index + 1).padStart(2, "0")}`);
  const metadata = artworkIds.map((id, index) => ({
    id,
    metadata: {
      title: `Artwork ${index + 1}`,
      department: "Paintings",
      moodTags: ["contemplation"],
      colorTags: ["ochre"],
      compositionTags: [`composition-${index + 1}`],
      subjectTags: [`subject-${index + 1}`],
    },
    presentation: { sceneAffinity: { paletteModes: [], sceneTypes: [] } },
  }));
  const search = artworkIds.map((id) => ({
    id,
    retrieval: { searchText: id, emotionLabels: [], keywordBoosts: [] },
  }));
  const media = artworkIds.map((id) => ({
    id,
    media: {
      imageUrlPreview: `https://images.example.test/${id}.jpg`,
      aspectRatioHint: "landscape",
    },
  }));
  const scenes = sceneIds.map((id, index) => ({
    id,
    asset: {
      original_filename: `${id}.jpg`,
      local_public_path: `https://images.example.test/${id}.jpg`,
      label_cn: id,
    },
    image_info: {},
    visual_profile: {
      scene_type: "gallery_interior",
      styles: [],
      materials: [],
      lighting: [],
      mood: [],
      palette: [],
      composition: [],
    },
    curation_profile: { emotion_ids: [], artwork_palette_modes: [] },
    ui_profile: { overlay_readability: "high", safe_text_zones: [], mobile_crop_tolerance: "good", visual_busyness: 0.1 },
    stage_profile: { primary_mount_zone: { shape: "rect", rect: { x: 0, y: 0, width: 1, height: 1 } } },
    transition_profile: { tempo: "slow", intensity: "soft", families: [] },
    retrieval_profile: { search_text: id, search_terms: [] },
  }));

  const metadataShard = writeJson(path.join(releaseDir, "metadata-01.json"), metadata);
  const searchShard = writeJson(path.join(releaseDir, "search-01.json"), search);
  const mediaShard = writeJson(path.join(releaseDir, "media-01.json"), media);
  const sceneShard = writeJson(path.join(releaseDir, "background-scenes-01.json"), scenes);
  const manifestPath = path.join(releaseDir, "manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify({
    release: {
      corpusVersion: RELEASE_VERSION,
      backgroundCatalogVersion: RELEASE_VERSION,
      contractsVersion: "0.1.0",
      createdAt: "2026-07-27T00:00:00.000Z",
    },
    shards: {
      metadata: [metadataShard],
      search: [searchShard],
      mediaIndex: [mediaShard],
      backgroundScenes: [sceneShard],
    },
  }, null, 2)}\n`);

  const promotionAnchorPath = path.join(reportDir, "promotion-anchor-set.json");
  writeFileSync(promotionAnchorPath, `${JSON.stringify({
    schemaVersion: "image-embedding-promotion-anchor-set.v1",
    releaseVersion: RELEASE_VERSION,
    anchors: artworkIds.map((artworkId) => ({ artworkId })),
  }, null, 2)}\n`);
  const candidateRecords = [
    ...artworkIds.map((id) => imageRecord("artwork", id, [1, 0])),
    ...sceneIds.map((id, index) => imageRecord("background-scene", id, index === 1 ? [1, 0] : [-1, 0])),
  ];
  const candidatePath = path.join(candidateDir, "image-embeddings-01.json");
  const candidateShard = writeJson(candidatePath, candidateRecords);
  const buildReportPath = path.join(reportDir, "image-embedding-report.json");
  writeFileSync(buildReportPath, `${JSON.stringify({
    releaseVersion: RELEASE_VERSION,
    baseManifestChecksum: checksum(readFileSync(manifestPath)),
    promotionAnchorSetChecksum: checksum(readFileSync(promotionAnchorPath)),
    model: "test-image-model",
    modelRevision: "test-revision",
    modelVariant: "quantized",
    modelArtifactChecksum: checksum("model"),
    providerVersion: "2.17.2",
    dimensions: 2,
    preprocessingVersion: "test-preprocessing.v1",
    preprocessingFingerprint: checksum("preprocessing"),
    vectorPrecision: 8,
    generatedAt: "2026-07-27T00:00:00.000Z",
    artwork: { eligible: 30, embedded: 30, gradeAEligible: 0, gradeAEmbedded: 0, criticalEligible: 30, criticalEmbedded: 30 },
    backgroundScene: { eligible: 12, embedded: 12 },
    failures: [],
    gates: { vectorsValid: true, sourceRefsValid: true, artworkCoverage: 1, criticalArtworkCoverage: 1, backgroundSceneCoverage: 1, coverageReady: true },
    candidateShard,
  }, null, 2)}\n`);

  return {
    rootDir,
    manifestPath,
    candidatePath,
    buildReportPath,
    outputPath: path.join(reportDir, "evaluation.pre-review.json"),
    reviewPackPath: path.join(reportDir, "review-pack.json"),
    reviewerViewPath: path.join(reportDir, "reviewer-view.html"),
  };
}

test("image embedding runner binds candidate/build inputs and emits a fail-closed pre-review report", async () => {
  const fixture = createFixture();
  const baseManifest = readFileSync(fixture.manifestPath, "utf8");

  const result = await runImageEmbeddingEvaluation({
    rootDir: fixture.rootDir,
    releaseVersion: RELEASE_VERSION,
    manifestPath: fixture.manifestPath,
    candidateShardPath: fixture.candidatePath,
    buildReportPath: fixture.buildReportPath,
    outputPath: fixture.outputPath,
    emitReviewPack: true,
    reviewPackPath: fixture.reviewPackPath,
    reviewerViewOutputPath: fixture.reviewerViewPath,
  });

  assert.equal(result.report.weakLabels.labelSource, "structured-weak-label-v1");
  assert.equal(result.report.reviewPack?.comparisons.length, 30);
  assert.equal(result.report.humanReview.humanReviewComplete, false);
  assert.equal(result.report.promotionBinding.promotionReady, false);
  assert.equal(result.report.promotionBinding.candidateShardChecksum, checksum(JSON.stringify(JSON.parse(readFileSync(fixture.candidatePath, "utf8")), null, 2)));
  assert.equal(existsSync(fixture.outputPath), true);
  assert.equal(existsSync(fixture.reviewPackPath), true);
  assert.equal(existsSync(fixture.reviewerViewPath), true);
  assert.equal(readFileSync(fixture.manifestPath, "utf8"), baseManifest);
});

test("image embedding runner fails closed when a bound build input is changed", async () => {
  for (const mutate of [
    (report: Record<string, unknown>) => { report.baseManifestChecksum = checksum("wrong-manifest"); },
    (report: Record<string, unknown>) => {
      (report.candidateShard as Record<string, unknown>).checksum = checksum("wrong-candidate");
    },
    (report: Record<string, unknown>) => { report.modelRevision = "wrong-revision"; },
  ]) {
    const fixture = createFixture();
    const report = JSON.parse(readFileSync(fixture.buildReportPath, "utf8")) as Record<string, unknown>;
    mutate(report);
    writeFileSync(fixture.buildReportPath, `${JSON.stringify(report, null, 2)}\n`);

    const result = await runImageEmbeddingEvaluation({
      rootDir: fixture.rootDir,
      releaseVersion: RELEASE_VERSION,
      manifestPath: fixture.manifestPath,
      candidateShardPath: fixture.candidatePath,
      buildReportPath: fixture.buildReportPath,
      outputPath: fixture.outputPath,
    });

    assert.equal(result.report.gates.bindingIntegrity, false);
    assert.equal(result.report.promotionBinding.promotionReady, false);
  }
});
