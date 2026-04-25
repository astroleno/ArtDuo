import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { loadEmbeddingShards } from "./release-loader";

test("release loader resolves embeddings from the manifest", () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-release-loader-"));
  const releaseDir = path.join(rootDir, "data", "releases", "vector-smoke");
  mkdirSync(releaseDir, { recursive: true });

  writeFileSync(path.join(releaseDir, "embeddings-01.json"), JSON.stringify([
    {
      id: "met-1",
      source: "met",
      sourceArtworkId: "1",
      version: "vector-smoke",
      model: "local-hash-embedding-v1",
      dimensions: 4,
      title: "Oracle",
      grade: "A",
      moodTags: ["mystery"],
      text: "oracle shadow mystery",
      tokenCount: 3,
      vector: [0.5, 0.5, 0.5, 0.5],
    },
  ], null, 2));

  writeFileSync(path.join(releaseDir, "manifest.json"), JSON.stringify({
    release: {
      corpusVersion: "vector-smoke",
      backgroundCatalogVersion: "vector-smoke",
      contractsVersion: "0.1.0",
      createdAt: "2026-04-26T00:00:00.000Z",
    },
    shards: {
      metadata: [{ id: "metadata-01", url: "./metadata-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 1 }],
      search: [{ id: "search-01", url: "./search-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 1 }],
      mediaIndex: [{ id: "media-01", url: "./media-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 1 }],
      backgroundScenes: [{ id: "background-scenes-01", url: "./background-scenes-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 1 }],
      embeddings: [{ id: "embeddings-01", url: "./embeddings-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 1 }],
    },
  }, null, 2));

  const loaded = loadEmbeddingShards({
    rootDir,
    releaseVersion: "vector-smoke",
  });

  assert.equal(path.basename(loaded.manifestPath), "manifest.json");
  assert.equal(path.basename(loaded.shardPaths[0] ?? ""), "embeddings-01.json");
  assert.equal(loaded.records[0]?.title, "Oracle");
  assert.equal(loaded.records[0]?.dimensions, 4);
  assert.ok(readFileSync(loaded.shardPaths[0] ?? "", "utf8").includes("local-hash-embedding-v1"));
});

test("release loader backfills legacy embeddings from metadata and search shards", () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-release-loader-legacy-"));
  const releaseDir = path.join(rootDir, "data", "releases", "vector-legacy");
  mkdirSync(releaseDir, { recursive: true });

  writeFileSync(path.join(releaseDir, "embeddings-01.json"), JSON.stringify([
    {
      id: "met-1",
      source: "met",
      sourceArtworkId: "1",
      version: "vector-legacy",
      model: "local-hash-embedding-v1",
      dimensions: 4,
      text: "oracle shadow mystery",
      tokenCount: 3,
      vector: [0.5, 0.5, 0.5, 0.5],
    },
  ], null, 2));
  writeFileSync(path.join(releaseDir, "metadata-01.json"), JSON.stringify([
    {
      id: "met-1",
      metadata: {
        title: "Oracle",
        artistDisplayName: "Unknown",
        moodTags: ["mystery"],
      },
      presentation: {
        grade: "A",
      },
    },
  ], null, 2));
  writeFileSync(path.join(releaseDir, "search-01.json"), JSON.stringify([
    {
      id: "met-1",
      retrieval: {
        searchText: "oracle shadow mystery",
      },
    },
  ], null, 2));

  writeFileSync(path.join(releaseDir, "manifest.json"), JSON.stringify({
    release: {
      corpusVersion: "vector-legacy",
      backgroundCatalogVersion: "vector-legacy",
      contractsVersion: "0.1.0",
      createdAt: "2026-04-26T00:00:00.000Z",
    },
    shards: {
      metadata: [{ id: "metadata-01", url: "./metadata-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 1 }],
      search: [{ id: "search-01", url: "./search-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 1 }],
      mediaIndex: [{ id: "media-01", url: "./media-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 1 }],
      backgroundScenes: [{ id: "background-scenes-01", url: "./background-scenes-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 1 }],
      embeddings: [{ id: "embeddings-01", url: "./embeddings-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 1 }],
    },
  }, null, 2));

  const loaded = loadEmbeddingShards({
    rootDir,
    releaseVersion: "vector-legacy",
  });

  assert.equal(loaded.records[0]?.title, "Oracle");
  assert.equal(loaded.records[0]?.artistDisplayName, "Unknown");
  assert.equal(loaded.records[0]?.grade, "A");
  assert.deepEqual(loaded.records[0]?.moodTags, ["mystery"]);
});
