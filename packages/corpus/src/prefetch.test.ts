import assert from "node:assert/strict";
import { test } from "node:test";

import type { ReleaseManifest } from "@artduo/contracts";
import { prefetchReleaseShards, validateReleaseMediaVersionInfo } from "./prefetch";

const manifest: ReleaseManifest = {
  release: {
    corpusVersion: "2026-04-25-curation-b",
    backgroundCatalogVersion: "2026-04-25-curation-b",
    contractsVersion: "0.2.0",
    createdAt: "2026-04-25T00:00:00.000Z",
  },
  shards: {
    metadata: [{ id: "metadata-01", url: "./metadata-01.json", checksum: "sha256:a", sizeBytes: 10, recordCount: 1 }],
    search: [{ id: "search-01", url: "./search-01.json", checksum: "sha256:b", sizeBytes: 10, recordCount: 1 }],
    mediaIndex: [{ id: "media-01", url: "./media-01.json", checksum: "sha256:c", sizeBytes: 10, recordCount: 1 }],
    backgroundScenes: [{ id: "scene-01", url: "./scene-01.json", checksum: "sha256:d", sizeBytes: 10, recordCount: 1 }],
    embeddings: [{ id: "embeddings-01", url: "./embeddings-01.json", checksum: "sha256:e", sizeBytes: 10, recordCount: 1 }],
  },
};

test("prefetch release shards skips cached shards and resolves the next batch", async () => {
  const fetched: string[] = [];
  const result = await prefetchReleaseShards(manifest, {
    alreadyCachedIds: new Set(["metadata-01"]),
    limit: 2,
    fetchShard: async (shard) => {
      fetched.push(shard.url);
    },
  });

  assert.deepEqual(fetched, ["./search-01.json", "./media-01.json"]);
  assert.deepEqual(result.prefetchedIds, ["search-01", "media-01"]);
  assert.deepEqual(result.skippedIds, ["metadata-01"]);
});

test("release media version validation accepts version or source fingerprint", () => {
  assert.doesNotThrow(() =>
    validateReleaseMediaVersionInfo([
      { id: "with-version", media: { mediaVersion: "media-v1" } },
      { id: "with-fingerprint", media: { sourceAssetFingerprint: "sha256:asset" } },
    ]),
  );
  assert.throws(
    () => validateReleaseMediaVersionInfo([{ id: "missing", media: {} }]),
    /missing mediaVersion or sourceAssetFingerprint: missing/,
  );
});
