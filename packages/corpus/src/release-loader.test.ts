import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import type { RelationshipGraphShard } from "@artduo/contracts";

import { loadEmbeddingShards, loadImageEmbeddingShards, loadRelationshipGraphShard, readJsonObject } from "./release-loader";
import * as releaseLoader from "./release-loader";

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

function checksum(value: Uint8Array | string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function writeJsonShard(releaseDir: string, fileName: string, value: unknown) {
  const serialized = JSON.stringify(value, null, 2);
  const content = `${serialized}\n`;
  writeFileSync(path.join(releaseDir, fileName), content);
  return {
    id: path.basename(fileName, ".json"),
    url: `./${fileName}`,
    checksum: checksum(serialized),
    sizeBytes: Buffer.byteLength(content),
    recordCount: Array.isArray(value) ? value.length : 1,
  };
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

test("image embedding loader returns an empty optional sidecar when the base manifest has none", () => {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-image-embedding-absent-"));
  const releaseDir = path.join(rootDir, "data", "releases", "image-absent");
  mkdirSync(releaseDir, { recursive: true });
  writeBaseManifest(releaseDir, {});

  const loadImageEmbeddingShards = (releaseLoader as Record<string, unknown>).loadImageEmbeddingShards;
  assert.equal(typeof loadImageEmbeddingShards, "function", "image embedding loader must be exported");
  const loaded = (loadImageEmbeddingShards as (options: { rootDir: string; releaseVersion: string }) => {
    records: unknown[];
    shardPaths: string[];
  })({ rootDir, releaseVersion: "image-absent" });

  assert.deepEqual(loaded.records, []);
  assert.deepEqual(loaded.shardPaths, []);
});

function createImageEmbeddingVariantFixture(entityType: "artwork" | "background-scene" = "artwork") {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-image-embedding-variant-"));
  const releaseVersion = "image-variant";
  const releaseDir = path.join(rootDir, "data", "releases", releaseVersion);
  mkdirSync(releaseDir, { recursive: true });
  const metadata = writeJsonShard(releaseDir, "metadata-01.json", []);
  const search = writeJsonShard(releaseDir, "search-01.json", []);
  const media = writeJsonShard(releaseDir, "media-01.json", [
    { id: "met-1", media: { imageUrlPreview: "https://images.metmuseum.org/met-1.png" } },
  ]);
  const backgroundScenes = writeJsonShard(releaseDir, "background-scenes-01.json", [
    { id: "scene-1", asset: { local_public_path: "/artduo-gallery/scene-1.png" } },
  ]);
  const baseManifest = {
    release: {
      corpusVersion: releaseVersion,
      backgroundCatalogVersion: releaseVersion,
      contractsVersion: "0.1.0",
      createdAt: "2026-07-27T00:00:00.000Z",
    },
    shards: { metadata: [metadata], search: [search], mediaIndex: [media], backgroundScenes: [backgroundScenes] },
  };
  const baseManifestPath = path.join(releaseDir, "manifest.json");
  writeFileSync(baseManifestPath, `${JSON.stringify(baseManifest, null, 2)}\n`);
  const baseManifestChecksum = checksum(readFileSync(baseManifestPath));
  const modelArtifactChecksum = checksum("image-model");
  const preprocessingFingerprint = checksum("image-preprocessing");
  const entityId = entityType === "artwork" ? "met-1" : "scene-1";
  const imageShard = writeJsonShard(releaseDir, "image-embeddings-01.json", [
    {
      id: `${entityType}:${entityId}`,
      entityType,
      entityId,
      releaseVersion,
      model: "test-image-model",
      modelRevision: "test-revision",
      modelVariant: "quantized",
      modelArtifactChecksum,
      provider: "@xenova/transformers",
      providerVersion: "2.17.2",
      dimensions: 2,
      preprocessingVersion: "test-preprocessing.v1",
      preprocessingFingerprint,
      vectorPrecision: 8,
      source: {
        shardId: entityType === "artwork" ? "media-01" : "background-scenes-01",
        recordId: entityId,
        fieldPath: entityType === "artwork" ? "media.imageUrlPreview" : "asset.local_public_path",
        fingerprint: checksum(`source-${entityId}`),
      },
      vector: [1, 0],
    },
  ]);
  const variantManifest = {
    ...baseManifest,
    shards: { ...baseManifest.shards, imageEmbeddings: [imageShard] },
    imageEmbeddingSidecar: {
      schemaVersion: "image-embedding-v1",
      baseManifestChecksum,
      promotionReportChecksum: checksum("promotion-report"),
      promotionBindingChecksum: checksum("promotion-binding"),
      imageShardChecksum: imageShard.checksum,
      model: "test-image-model",
      modelRevision: "test-revision",
      modelVariant: "quantized",
      modelArtifactChecksum,
      providerVersion: "2.17.2",
      preprocessingFingerprint,
      visualPolicy: { candidateCount: 1, weight: 0.1, lowerCosine: 0.2, upperCosine: 0.8 },
    },
  };
  const variantManifestPath = path.join(releaseDir, "manifest.image-embedding-v1.json");
  writeFileSync(variantManifestPath, `${JSON.stringify(variantManifest, null, 2)}\n`);

  return { rootDir, releaseVersion, releaseDir, variantManifestPath, imageShard, variantManifest };
}

test("image embedding loader reads a bound explicit variant and its image shard", () => {
  const fixture = createImageEmbeddingVariantFixture();

  const loaded = loadImageEmbeddingShards({
    rootDir: fixture.rootDir,
    releaseVersion: fixture.releaseVersion,
    imageEmbeddingManifestPath: fixture.variantManifestPath,
  });

  assert.deepEqual(loaded.records.map((record) => record.id), ["artwork:met-1"]);
  assert.equal(loaded.shardPaths[0], path.join(fixture.releaseDir, "image-embeddings-01.json"));
  assert.equal(loaded.imageEmbeddingSidecar?.imageShardChecksum, fixture.imageShard.checksum);
});

test("image embedding loader resolves a bound background-scene source reference", () => {
  const fixture = createImageEmbeddingVariantFixture("background-scene");

  const loaded = loadImageEmbeddingShards({
    rootDir: fixture.rootDir,
    releaseVersion: fixture.releaseVersion,
    imageEmbeddingManifestPath: fixture.variantManifestPath,
  });

  assert.deepEqual(loaded.records.map((record) => record.id), ["background-scene:scene-1"]);
});

test("image embedding loader enforces the variant pre-parse limit before JSON parsing", () => {
  const fixture = createImageEmbeddingVariantFixture();
  writeFileSync(fixture.variantManifestPath, `${" ".repeat(1024)}{}`);

  assert.throws(
    () => loadImageEmbeddingShards({
      rootDir: fixture.rootDir,
      releaseVersion: fixture.releaseVersion,
      imageEmbeddingManifestPath: fixture.variantManifestPath,
      maxPreParseBytes: 64,
    }),
    /pre-parse bytes/,
  );
});

test("image embedding loader rejects an explicit variant outside the requested release version", () => {
  const fixture = createImageEmbeddingVariantFixture();

  assert.throws(
    () => loadImageEmbeddingShards({
      rootDir: fixture.rootDir,
      releaseVersion: "different-release",
      imageEmbeddingManifestPath: fixture.variantManifestPath,
    }),
    /releaseVersion/,
  );
});

test("async image embedding loader reads the same explicitly selected sidecar", async () => {
  const fixture = createImageEmbeddingVariantFixture();
  const loadImageEmbeddingShardsAsync = (releaseLoader as Record<string, unknown>).loadImageEmbeddingShardsAsync;
  assert.equal(typeof loadImageEmbeddingShardsAsync, "function", "async image embedding loader must be exported");

  const loaded = await (loadImageEmbeddingShardsAsync as (options: {
    rootDir: string;
    releaseVersion: string;
    imageEmbeddingManifestPath: string;
  }) => Promise<{ records: Array<{ id: string }>; imageEmbeddingSidecar?: { modelRevision: string } }>)({
    rootDir: fixture.rootDir,
    releaseVersion: fixture.releaseVersion,
    imageEmbeddingManifestPath: fixture.variantManifestPath,
  });

  assert.deepEqual(loaded.records.map((record) => record.id), ["artwork:met-1"]);
  assert.equal(loaded.imageEmbeddingSidecar?.modelRevision, "test-revision");
});

test("async image embedding loader surfaces an already-aborted signal without reading the sidecar", async () => {
  const fixture = createImageEmbeddingVariantFixture();
  const controller = new AbortController();
  controller.abort();
  const loadImageEmbeddingShardsAsync = (releaseLoader as Record<string, unknown>).loadImageEmbeddingShardsAsync;
  assert.equal(typeof loadImageEmbeddingShardsAsync, "function", "async image embedding loader must be exported");

  await assert.rejects(
    (loadImageEmbeddingShardsAsync as (options: {
      rootDir: string;
      releaseVersion: string;
      imageEmbeddingManifestPath: string;
      signal: AbortSignal;
    }) => Promise<unknown>)({
      rootDir: fixture.rootDir,
      releaseVersion: fixture.releaseVersion,
      imageEmbeddingManifestPath: path.join(fixture.releaseDir, "must-not-be-read.json"),
      signal: controller.signal,
    }),
    /aborted/i,
  );
});

test("image embedding loader rejects a source reference that is absent from the base release shard", () => {
  const fixture = createImageEmbeddingVariantFixture();
  const imageShardPath = path.join(fixture.releaseDir, "image-embeddings-01.json");
  const records = JSON.parse(readFileSync(imageShardPath, "utf8")) as Array<Record<string, unknown>>;
  const source = records[0]?.source as Record<string, unknown>;
  source.recordId = "met-missing";
  const imageShard = writeJsonShard(fixture.releaseDir, "image-embeddings-01.json", records);
  const variantManifest = fixture.variantManifest as {
    shards: { imageEmbeddings: Array<unknown> };
    imageEmbeddingSidecar: { imageShardChecksum: string };
  };
  variantManifest.shards.imageEmbeddings = [imageShard];
  variantManifest.imageEmbeddingSidecar.imageShardChecksum = imageShard.checksum;
  writeFileSync(fixture.variantManifestPath, `${JSON.stringify(variantManifest, null, 2)}\n`);

  assert.throws(
    () => loadImageEmbeddingShards({
      rootDir: fixture.rootDir,
      releaseVersion: fixture.releaseVersion,
      imageEmbeddingManifestPath: fixture.variantManifestPath,
    }),
    /source reference/,
  );
});
