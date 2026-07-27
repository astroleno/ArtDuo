import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import type { ImageEmbeddingEntityType, ImageEmbeddingShardRecord } from "@artduo/contracts";

import * as imageEmbedding from "./image-embedding";
import * as corpus from "./index";

function checksum(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function record(
  entityType: ImageEmbeddingEntityType,
  entityId: string,
  vector: number[],
): ImageEmbeddingShardRecord {
  return {
    id: `${entityType}:${entityId}`,
    entityType,
    entityId,
    releaseVersion: "image-index-test",
    model: "test-image-model",
    modelRevision: "test-revision",
    modelVariant: "quantized",
    modelArtifactChecksum: checksum("model"),
    provider: "@xenova/transformers",
    providerVersion: "2.17.2",
    dimensions: 2,
    preprocessingVersion: "test-preprocessing.v1",
    preprocessingFingerprint: checksum("preprocessing"),
    vectorPrecision: 8,
    source: {
      shardId: entityType === "artwork" ? "media-01" : "background-scenes-01",
      recordId: entityId,
      fieldPath: entityType === "artwork" ? "media.imageUrlPreview" : "asset.local_public_path",
      fingerprint: checksum(`source:${entityId}`),
    },
    vector,
  };
}

test("image embedding index keeps entity types isolated and uses stable visual-neighbor ordering", () => {
  const createImageEmbeddingIndex = (imageEmbedding as Record<string, unknown>).createImageEmbeddingIndex;
  const searchVisualNeighbors = (imageEmbedding as Record<string, unknown>).searchVisualNeighbors;
  const scoreArtworkBackgroundCompatibility = (imageEmbedding as Record<string, unknown>).scoreArtworkBackgroundCompatibility;
  assert.equal(typeof createImageEmbeddingIndex, "function", "image embedding index factory must be exported");
  assert.equal(typeof searchVisualNeighbors, "function", "visual neighbor search must be exported");
  assert.equal(typeof scoreArtworkBackgroundCompatibility, "function", "compatibility scorer must be exported");

  const index = (createImageEmbeddingIndex as (records: ImageEmbeddingShardRecord[]) => unknown)([
    record("artwork", "art-a", [1, 0]),
    record("artwork", "art-c", [0.8, -0.6]),
    record("background-scene", "scene-a", [0, 1]),
    record("artwork", "art-b", [0.8, 0.6]),
  ]);
  const neighbors = (searchVisualNeighbors as (
    index: unknown,
    input: { entityType: ImageEmbeddingEntityType; entityId: string; limit?: number },
  ) => Array<{ entityId: string; score: number }>)(index, {
    entityType: "artwork",
    entityId: "art-a",
    limit: 3,
  });
  const compatibility = (scoreArtworkBackgroundCompatibility as (
    index: unknown,
    artworkId: string,
    backgroundSceneId: string,
  ) => number | undefined)(index, "art-a", "scene-a");

  assert.deepEqual(neighbors, [
    { entityId: "art-b", score: 0.8 },
    { entityId: "art-c", score: 0.8 },
  ]);
  assert.equal(compatibility, 0);
});

test("image embedding index rejects incompatible vector dimensions", () => {
  assert.throws(
    () => imageEmbedding.createImageEmbeddingIndex([
      record("artwork", "art-a", [1, 0]),
      {
        ...record("artwork", "art-b", [1, 0]),
        dimensions: 3,
        vector: [Math.sqrt(0.5), Math.sqrt(0.25), Math.sqrt(0.25)],
      },
    ]),
    /incompatible record/,
  );
});

test("image embedding loader and index APIs are exported from the corpus package", () => {
  assert.equal(typeof (corpus as Record<string, unknown>).loadImageEmbeddingShards, "function");
  assert.equal(typeof (corpus as Record<string, unknown>).createImageEmbeddingIndex, "function");
  assert.equal(typeof (corpus as Record<string, unknown>).searchVisualNeighbors, "function");
});

test("image embedding synthetic diagnostic measures the deterministic 271 by 512 fixture against Node and browser budgets", () => {
  const createPayload = (imageEmbedding as Record<string, unknown>).createImageEmbeddingDiagnosticPayload;
  const measureDiagnostic = (imageEmbedding as Record<string, unknown>).measureImageEmbeddingDiagnostic;
  const assessBudget = (imageEmbedding as Record<string, unknown>).assessImageEmbeddingPerformanceBudget;
  assert.equal(typeof createPayload, "function", "diagnostic payload factory must be exported");
  assert.equal(typeof measureDiagnostic, "function", "diagnostic measurement API must be exported");
  assert.equal(typeof assessBudget, "function", "diagnostic budget assessor must be exported");

  const payload = (createPayload as () => string)();
  const fixture = JSON.parse(payload) as Array<{ dimensions: number }>;
  let tick = 0;
  const measurement = (measureDiagnostic as (payload: string, options: { now: () => number }) => {
    payloadBytes: number;
    recordCount: number;
    dimensions: number;
    parseDurationMs: number;
    indexBuildDurationMs: number;
    estimatedHeapBytes: number;
    queryCount: number;
    queryP50Ms: number;
    queryP95Ms: number;
  })(payload, { now: () => tick++ });
  const nodeBudget = (assessBudget as (measurement: typeof measurement, runtime: "server" | "browser-diagnostic") => {
    passed: boolean;
    violations: string[];
  })(measurement, "server");
  const browserBudget = (assessBudget as (measurement: typeof measurement, runtime: "server" | "browser-diagnostic") => {
    passed: boolean;
    violations: string[];
  })(measurement, "browser-diagnostic");
  const liveMeasurement = (measureDiagnostic as (payload: string) => typeof measurement)(payload);
  const liveNodeBudget = (assessBudget as (measurement: typeof measurement, runtime: "server" | "browser-diagnostic") => {
    passed: boolean;
    violations: string[];
  })(liveMeasurement, "server");
  const liveBrowserBudget = (assessBudget as (measurement: typeof measurement, runtime: "server" | "browser-diagnostic") => {
    passed: boolean;
    violations: string[];
  })(liveMeasurement, "browser-diagnostic");
  const exceededPayloadBudget = (assessBudget as (measurement: typeof measurement, runtime: "server" | "browser-diagnostic") => {
    passed: boolean;
    violations: string[];
  })({ ...measurement, payloadBytes: 4 * 1024 * 1024 + 1 }, "browser-diagnostic");

  assert.equal(fixture.length, 271);
  assert.ok(fixture.every((record) => record.dimensions === 512));
  assert.ok(measurement.payloadBytes <= 4 * 1024 * 1024);
  assert.equal(measurement.recordCount, 271);
  assert.equal(measurement.dimensions, 512);
  assert.equal(measurement.parseDurationMs, 1);
  assert.equal(measurement.indexBuildDurationMs, 1);
  assert.equal(measurement.queryCount, 50);
  assert.equal(measurement.queryP50Ms, 1);
  assert.equal(measurement.queryP95Ms, 1);
  assert.ok(measurement.estimatedHeapBytes <= 16 * 1024 * 1024);
  assert.deepEqual(nodeBudget, { passed: true, violations: [] });
  assert.deepEqual(browserBudget, { passed: true, violations: [] });
  assert.deepEqual(liveNodeBudget, { passed: true, violations: [] });
  assert.deepEqual(liveBrowserBudget, { passed: true, violations: [] });
  assert.equal(exceededPayloadBudget.passed, false);
  assert.ok(exceededPayloadBudget.violations.some((violation) => violation.includes("payload")));
});
