import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import type { RelationshipGraphShard } from "@artduo/contracts";

import { loadEmbeddingShards, loadRelationshipGraphShard, readJsonObject } from "./release-loader";

function validRelationshipGraph(): RelationshipGraphShard {
  return {
    schemaVersion: "relationship-graph.v1",
    releaseVersion: "graph-smoke",
    generatedAt: "2026-05-14T00:00:00.000Z",
    build: {
      builderName: "@artduo/pipeline/relationship-graph",
      builderVersion: "relationship-graph-builder.v1",
      taxonomyVersion: "relationship-taxonomy.v1",
      inputFingerprints: [
        {
          artifact: "manifest",
          checksum: "sha256:manifest",
          sizeBytes: 100,
        },
      ],
    },
    stats: {
      nodeCount: 2,
      edgeCount: 1,
    },
    limits: {
      maxPreParseBytes: 2046976,
      maxShardSizeBytes: 2046976,
      maxGzipSizeBytes: 78848,
      maxNodes: 10,
      maxEdges: 10,
      maxDegreePerNode: 5,
      maxSourceRefsPerNode: 5,
      maxSourceRefsPerEdge: 1,
      maxFieldPathBytes: 128,
      maxStringBytes: 448,
      maxReasonLabelBytes: 160,
    },
    nodes: [
      {
        id: "artwork:met-1",
        type: "artwork",
        label: "Oracle",
        sourceRefs: [
          {
            artifact: "metadata",
            shardId: "metadata-01",
            recordId: "met-1",
            fieldPath: "id",
            releaseVersion: "graph-smoke",
          },
        ],
      },
      {
        id: "emotion:mystery",
        type: "emotion",
        label: "mystery",
        sourceRefs: [
          {
            artifact: "search",
            shardId: "search-01",
            recordId: "met-1",
            fieldPath: "retrieval.emotionLabels[0]",
            releaseVersion: "graph-smoke",
          },
        ],
      },
    ],
    edges: [
      {
        id: "artwork:met-1->emotion:mystery:has_emotion",
        source: "artwork:met-1",
        target: "emotion:mystery",
        relation: "has_emotion",
        direction: "directed",
        symmetric: false,
        confidence: "EXTRACTED",
        confidenceScore: 1,
        sourceQuality: "release-field",
        reasonCode: "has_emotion:mystery",
        reasonLabel: "mystery extracted from release emotion fields",
        sourceRefs: [
          {
            artifact: "search",
            shardId: "search-01",
            recordId: "met-1",
            fieldPath: "retrieval.emotionLabels[0]",
            releaseVersion: "graph-smoke",
          },
        ],
      },
    ],
  };
}

function writeBaseManifest(releaseDir: string, shards: Record<string, unknown>): void {
  writeFileSync(path.join(releaseDir, "manifest.json"), JSON.stringify({
    release: {
      corpusVersion: path.basename(releaseDir),
      backgroundCatalogVersion: path.basename(releaseDir),
      contractsVersion: "0.1.0",
      createdAt: "2026-04-26T00:00:00.000Z",
    },
    shards: {
      metadata: [{ id: "metadata-01", url: "./metadata-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 1 }],
      search: [{ id: "search-01", url: "./search-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 1 }],
      mediaIndex: [{ id: "media-01", url: "./media-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 1 }],
      backgroundScenes: [{ id: "background-scenes-01", url: "./background-scenes-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 1 }],
      ...shards,
    },
  }, null, 2));
}

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
      theme: "mystery",
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
  assert.equal(loaded.records[0]?.theme, "mystery");
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
  assert.equal(loaded.records[0]?.theme, "mystery");
  assert.deepEqual(loaded.records[0]?.moodTags, ["mystery"]);
});

test("relationship graph loader resolves optional object shards", () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-relationship-graph-loader-"));
  const releaseDir = path.join(rootDir, "data", "releases", "graph-smoke");
  mkdirSync(releaseDir, { recursive: true });

  writeFileSync(path.join(releaseDir, "relationship-graph-01.json"), JSON.stringify(validRelationshipGraph(), null, 2));
  writeBaseManifest(releaseDir, {
    relationshipGraph: [
      {
        id: "relationship-graph-01",
        url: "./relationship-graph-01.json",
        checksum: "sha256:test",
        sizeBytes: 1,
        recordCount: 2,
      },
    ],
  });

  const loaded = loadRelationshipGraphShard({
    rootDir,
    releaseVersion: "graph-smoke",
  });

  assert.ok(loaded);
  assert.equal(path.basename(loaded.shardPath), "relationship-graph-01.json");
  assert.equal(loaded.shard.recordCount, loaded.graph.nodes.length);
  assert.equal(loaded.graph.edges[0]?.confidence, "EXTRACTED");
});

test("relationship graph loader returns undefined when sidecar is absent", () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-relationship-graph-absent-"));
  const releaseDir = path.join(rootDir, "data", "releases", "graph-absent");
  mkdirSync(releaseDir, { recursive: true });
  writeBaseManifest(releaseDir, {});

  const loaded = loadRelationshipGraphShard({
    rootDir,
    releaseVersion: "graph-absent",
  });

  assert.equal(loaded, undefined);
});

test("relationship graph loader verifies object shape, pre-parse cap, and recordCount", () => {
  const objectRoot = mkdtempSync(path.join(os.tmpdir(), "artduo-relationship-graph-object-"));
  const objectPath = path.join(objectRoot, "array.json");
  writeFileSync(objectPath, "[]\n");
  assert.throws(() => readJsonObject(objectPath), /expected object/);
  assert.throws(() => readJsonObject(objectPath, 1), /pre-parse/);

  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-relationship-graph-count-"));
  const releaseDir = path.join(rootDir, "data", "releases", "graph-count");
  mkdirSync(releaseDir, { recursive: true });

  const graph = validRelationshipGraph();
  graph.releaseVersion = "graph-count";
  graph.nodes.forEach((node) => {
    node.sourceRefs.forEach((ref) => {
      ref.releaseVersion = "graph-count";
    });
  });
  graph.edges.forEach((edge) => {
    edge.sourceRefs.forEach((ref) => {
      ref.releaseVersion = "graph-count";
    });
  });

  writeFileSync(path.join(releaseDir, "relationship-graph-01.json"), JSON.stringify(graph, null, 2));
  writeBaseManifest(releaseDir, {
    relationshipGraph: [
      {
        id: "relationship-graph-01",
        url: "./relationship-graph-01.json",
        checksum: "sha256:test",
        sizeBytes: 1,
        recordCount: 1,
      },
    ],
  });

  assert.throws(
    () => loadRelationshipGraphShard({
      rootDir,
      releaseVersion: "graph-count",
      parserLimits: {
        ...graph.limits,
        maxPreParseBytes: 1,
      },
    }),
    /pre-parse/,
  );
  assert.throws(() => loadRelationshipGraphShard({ rootDir, releaseVersion: "graph-count" }), /recordCount/);
});

test("relationship graph loader rejects stale sidecar release versions", () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-relationship-graph-stale-"));
  const releaseDir = path.join(rootDir, "data", "releases", "graph-current");
  mkdirSync(releaseDir, { recursive: true });

  const graph = validRelationshipGraph();
  writeFileSync(path.join(releaseDir, "relationship-graph-01.json"), JSON.stringify(graph, null, 2));
  writeBaseManifest(releaseDir, {
    relationshipGraph: [
      {
        id: "relationship-graph-01",
        url: "./relationship-graph-01.json",
        checksum: "sha256:test",
        sizeBytes: 1,
        recordCount: 2,
      },
    ],
  });

  assert.throws(
    () => loadRelationshipGraphShard({ rootDir, releaseVersion: "graph-current" }),
    /graph releaseVersion must match release graph-current/,
  );
});
