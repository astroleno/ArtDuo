import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseImageEmbeddingShardRecord,
  parseImageEmbeddingShardRecords,
} from "./image-embedding-shard";

const CHECKSUM = `sha256:${"a".repeat(64)}`;
const OTHER_CHECKSUM = `sha256:${"b".repeat(64)}`;

function validRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "artwork:met-1",
    entityType: "artwork",
    entityId: "met-1",
    releaseVersion: "2026-04-25-curation-b",
    model: "Xenova/clip-vit-base-patch32",
    modelRevision: "d15189d7028b43f1d3e65039190477f6af591c2a",
    modelVariant: "quantized",
    modelArtifactChecksum: CHECKSUM,
    provider: "@xenova/transformers",
    providerVersion: "2.17.2",
    dimensions: 4,
    preprocessingVersion: "image-preprocess.v1",
    preprocessingFingerprint: OTHER_CHECKSUM,
    vectorPrecision: 8,
    source: {
      shardId: "media-01",
      recordId: "met-1",
      fieldPath: "media.imageUrlPreview",
      fingerprint: CHECKSUM,
    },
    vector: [0.5, 0.5, 0.5, 0.5],
    ...overrides,
  };
}

test("image embedding records parse artwork and background scene vectors", () => {
  const artwork = parseImageEmbeddingShardRecord(validRecord());
  const scene = parseImageEmbeddingShardRecord(validRecord({
    id: "background-scene:bg-1",
    entityType: "background-scene",
    entityId: "bg-1",
    source: {
      shardId: "background-scenes-01",
      recordId: "bg-1",
      fieldPath: "asset.local_public_path",
      fingerprint: CHECKSUM,
    },
  }));

  assert.equal(artwork.id, "artwork:met-1");
  assert.equal(scene.entityType, "background-scene");
  assert.equal(scene.source.fieldPath, "asset.local_public_path");
});

test("image embedding records reject invalid vectors and dimensions", () => {
  assert.throws(() => parseImageEmbeddingShardRecord(validRecord({ vector: [] })), /expected 4 values, received 0/);
  assert.throws(() => parseImageEmbeddingShardRecord(validRecord({ vector: [0.5, Number.POSITIVE_INFINITY, 0.5, 0.5] })), /must be finite/);
  assert.throws(() => parseImageEmbeddingShardRecord(validRecord({ dimensions: 3 })), /expected 3 values, received 4/);
  assert.throws(() => parseImageEmbeddingShardRecord(validRecord({ vector: [0, 0, 0, 0] })), /L2 normalized/);
  assert.throws(() => parseImageEmbeddingShardRecord(validRecord({ dimensions: 4097 })), /between 1 and 4096/);
  assert.throws(() => parseImageEmbeddingShardRecord(validRecord({ vector: [1, 1, 1, 1] })), /L2 normalized/);
});

test("image embedding records enforce entity identity and safe source references", () => {
  assert.throws(() => parseImageEmbeddingShardRecord(validRecord({ entityType: "painting" })), /expected one of artwork, background-scene/);
  assert.throws(() => parseImageEmbeddingShardRecord(validRecord({ id: "artwork:other" })), /must equal artwork:met-1/);
  assert.throws(() => parseImageEmbeddingShardRecord(validRecord({
    source: {
      shardId: "media-01",
      recordId: "file:///Users/person/secret.jpg",
      fieldPath: "media.imageUrlPreview",
      fingerprint: CHECKSUM,
    },
  })), /must not contain local paths or traversal/);
  assert.throws(() => parseImageEmbeddingShardRecord(validRecord({
    source: {
      shardId: "media-01",
      recordId: "met-1",
      fieldPath: "media.sourceUrl",
      fingerprint: CHECKSUM,
    },
  })), /not allowed for artwork/);
  assert.throws(() => parseImageEmbeddingShardRecord(validRecord({
    source: {
      shardId: "media-01",
      recordId: "met-1",
      fieldPath: "media.imageUrlPreview",
      fingerprint: "",
    },
  })), /expected sha256 checksum/);
});

test("image embedding shard records reject duplicate ids and inconsistent fingerprints", () => {
  assert.throws(() => parseImageEmbeddingShardRecords([
    validRecord(),
    validRecord(),
  ]), /duplicate id artwork:met-1/);

  assert.throws(() => parseImageEmbeddingShardRecords([
    validRecord(),
    validRecord({
      id: "artwork:met-2",
      entityId: "met-2",
      modelRevision: "other-revision",
    }),
  ]), /modelRevision must be consistent/);

  assert.throws(() => parseImageEmbeddingShardRecords([
    validRecord(),
    validRecord({
      id: "artwork:met-2",
      entityId: "met-2",
      releaseVersion: "2026-05-01-curation-c",
    }),
  ]), /releaseVersion must be consistent/);
});

test("image embedding shards cap records at 1,000", () => {
  const records = Array.from({ length: 1_001 }, (_, index) => validRecord({
    id: `artwork:met-${index}`,
    entityId: `met-${index}`,
  }));

  assert.throws(() => parseImageEmbeddingShardRecords(records), /at most 1000 records/);
});
