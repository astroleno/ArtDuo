import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import {
  createTransformersImageEmbeddingProvider,
  IMAGE_EMBEDDING_DIMENSIONS,
  IMAGE_MODEL_ARTIFACT,
  IMAGE_MODEL_ARTIFACT_SHA256,
  IMAGE_PROVIDER_VERSION,
  type ImageEmbeddingRuntime,
} from "./image-embedding-provider";

function unitVector(index: number): number[] {
  return Array.from({ length: IMAGE_EMBEDDING_DIMENSIONS }, (_, entryIndex) => entryIndex === index ? 2 : 0);
}

function fakeRuntime(vectors: number[][]): ImageEmbeddingRuntime {
  return {
    async rawImageFromBlob(blob) {
      return blob;
    },
    async createImageFeatureExtractor() {
      return async () => ({ data: Float32Array.from(vectors.flat()) });
    },
    async getModelArtifactProvenance() {
      return {
        artifact: IMAGE_MODEL_ARTIFACT,
        checksum: IMAGE_MODEL_ARTIFACT_SHA256,
        providerVersion: IMAGE_PROVIDER_VERSION,
      };
    },
  };
}

test("image embedding provider preserves batch order and emits normalized pinned metadata", async () => {
  const provider = createTransformersImageEmbeddingProvider({
    runtimeLoader: async () => fakeRuntime([unitVector(0), unitVector(1)]),
  });

  const embedded = await provider.embedImages([
    { entityType: "artwork", entityId: "met-1", bytes: new Uint8Array([1]), mediaType: "image/png" },
    { entityType: "background-scene", entityId: "bg-1", bytes: new Uint8Array([2]), mediaType: "image/jpeg" },
  ]);

  assert.equal(embedded.length, 2);
  assert.equal(embedded[0]?.dimensions, IMAGE_EMBEDDING_DIMENSIONS);
  assert.equal(embedded[0]?.vector[0], 1);
  assert.equal(embedded[1]?.vector[1], 1);
  assert.equal(embedded[0]?.modelRevision, "d15189d7028b43f1d3e65039190477f6af591c2a");
  assert.equal(embedded[0]?.providerVersion, "2.17.2");
  assert.ok(Math.abs(Math.hypot(...(embedded[0]?.vector ?? [])) - 1) < 1e-8);
});

test("image embedding provider rejects an unverified runtime artifact and never reports its pinned checksum", async () => {
  const provider = createTransformersImageEmbeddingProvider({
    runtimeLoader: async () => ({
      ...fakeRuntime([unitVector(0)]),
      async getModelArtifactProvenance() {
        return {
          artifact: IMAGE_MODEL_ARTIFACT,
          checksum: `sha256:${createHash("sha256").update("tampered-model").digest("hex")}`,
          providerVersion: IMAGE_PROVIDER_VERSION,
        };
      },
    }),
  });

  await assert.rejects(
    provider.embedImages([
      { entityType: "artwork", entityId: "met-1", bytes: new Uint8Array([1]), mediaType: "image/png" },
    ]),
    /artifact checksum does not match the pinned artifact/,
  );
});

test("image embedding provider rejects a runtime that returns the wrong vector count", async () => {
  const provider = createTransformersImageEmbeddingProvider({
    runtimeLoader: async () => fakeRuntime([unitVector(0)]),
  });

  await assert.rejects(
    provider.embedImages([
      { entityType: "artwork", entityId: "met-1", bytes: new Uint8Array([1]), mediaType: "image/png" },
      { entityType: "artwork", entityId: "met-2", bytes: new Uint8Array([2]), mediaType: "image/png" },
    ]),
    /returned 1 vectors for 2 inputs/,
  );
});
