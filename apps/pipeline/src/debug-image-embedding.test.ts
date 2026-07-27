import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import type { ImageEmbeddingShardRecord } from "@artduo/contracts";

import { buildImageEmbeddingDebugReport } from "./debug-image-embedding";

function checksum(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function record(entityId: string, vector: number[]): ImageEmbeddingShardRecord {
  return {
    id: `artwork:${entityId}`,
    entityType: "artwork",
    entityId,
    releaseVersion: "debug-test",
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
      shardId: "media-01",
      recordId: entityId,
      fieldPath: "media.imageUrlPreview",
      fingerprint: checksum(`source:${entityId}`),
    },
    vector,
  };
}

test("image embedding debug ranks same-type neighbors without exposing local source paths", () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-image-debug-"));
  const candidatePath = path.join(rootDir, "candidate.json");
  writeFileSync(candidatePath, `${JSON.stringify([
    record("anchor", [1, 0]),
    record("nearest", [0.9, Math.sqrt(0.19)]),
    record("far", [-1, 0]),
  ], null, 2)}\n`);

  const report = buildImageEmbeddingDebugReport({
    candidateShardPath: candidatePath,
    entityType: "artwork",
    entityId: "anchor",
    limit: 2,
  });

  assert.deepEqual(report.neighbors.map((neighbor) => neighbor.entityId), ["nearest", "far"]);
  assert.equal(report.neighbors[0]?.model, "test-image-model");
  assert.equal(report.neighbors[0]?.sourceFingerprint, checksum("source:nearest"));
  assert.equal(JSON.stringify(report).includes(rootDir), false);
});
