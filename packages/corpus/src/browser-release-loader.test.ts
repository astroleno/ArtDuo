import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import type { EmbeddingShardRecord, ImageEmbeddingShardRecord, ShardInfo } from "@artduo/contracts";

import { createIndexedDbBrowserCache, createInMemoryBrowserCache, type IndexedDbFactory } from "./indexeddb-cache";
import { loadBrowserEmbeddingShards, loadBrowserImageEmbeddingShards, loadBrowserReleaseManifest } from "./browser-release-loader";
import * as browserReleaseLoader from "./browser-release-loader";
import { createSearchWorkerHandler } from "./search-worker";
import { searchVectorIndex } from "./vector-search";

function makeJsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function sha256(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function makeImageEmbeddingBrowserFixture() {
  const baseManifestUrl = "https://example.com/releases/image-variant/manifest.json";
  const imageEmbeddingManifestUrl = "https://example.com/releases/image-variant/manifest.image-embedding-v1.json";
  const makeShard = (id: string, url: string, value: unknown): { info: ShardInfo; body: string } => {
    const body = JSON.stringify(value, null, 2);
    return {
      info: {
        id,
        url,
        checksum: sha256(body),
        sizeBytes: Buffer.byteLength(body),
        recordCount: Array.isArray(value) ? value.length : 1,
      },
      body,
    };
  };
  const media = makeShard("media-01", "./media-01.json", [
    { id: "met-1", media: { imageUrlPreview: "https://images.example.com/met-1.png" } },
  ]);
  const backgroundScenes = makeShard("background-scenes-01", "./background-scenes-01.json", [
    { id: "scene-1", asset: { local_public_path: "/artduo-gallery/scene-1.png" } },
  ]);
  const metadata = makeShard("metadata-01", "./metadata-01.json", []);
  const search = makeShard("search-01", "./search-01.json", []);
  const modelArtifactChecksum = sha256("image-model");
  const preprocessingFingerprint = sha256("image-preprocessing");
  const imageRecords: ImageEmbeddingShardRecord[] = [{
    id: "artwork:met-1",
    entityType: "artwork",
    entityId: "met-1",
    releaseVersion: "image-variant",
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
      shardId: "media-01",
      recordId: "met-1",
      fieldPath: "media.imageUrlPreview",
      fingerprint: sha256("source-met-1"),
    },
    vector: [1, 0],
  }];
  const image = makeShard("image-embeddings-01", "./image-embeddings-01.json", imageRecords);
  const baseManifest = {
    release: {
      corpusVersion: "image-variant",
      backgroundCatalogVersion: "image-variant",
      contractsVersion: "0.1.0",
      createdAt: "2026-07-27T00:00:00.000Z",
    },
    shards: {
      metadata: [metadata.info],
      search: [search.info],
      mediaIndex: [media.info],
      backgroundScenes: [backgroundScenes.info],
    },
  };
  const baseManifestBody = JSON.stringify(baseManifest, null, 2);
  const variantManifest = {
    ...baseManifest,
    shards: { ...baseManifest.shards, imageEmbeddings: [image.info] },
    imageEmbeddingSidecar: {
      schemaVersion: "image-embedding-v1",
      baseManifestChecksum: sha256(baseManifestBody),
      promotionReportChecksum: sha256("promotion-report"),
      promotionBindingChecksum: sha256("promotion-binding"),
      imageShardChecksum: image.info.checksum,
      model: "test-image-model",
      modelRevision: "test-revision",
      modelVariant: "quantized",
      modelArtifactChecksum,
      providerVersion: "2.17.2",
      preprocessingFingerprint,
      visualPolicy: { candidateCount: 1, weight: 0.1, lowerCosine: 0.2, upperCosine: 0.8 },
    },
  };
  const variantManifestBody = JSON.stringify(variantManifest, null, 2);
  const bodies = new Map<string, string>([
    [baseManifestUrl, baseManifestBody],
    [imageEmbeddingManifestUrl, variantManifestBody],
    [new URL(media.info.url, baseManifestUrl).toString(), media.body],
    [new URL(backgroundScenes.info.url, baseManifestUrl).toString(), backgroundScenes.body],
    [new URL(image.info.url, imageEmbeddingManifestUrl).toString(), image.body],
  ]);

  return {
    baseManifestUrl,
    imageEmbeddingManifestUrl,
    imageShardUrl: new URL(image.info.url, imageEmbeddingManifestUrl).toString(),
    mediaShardUrl: new URL(media.info.url, baseManifestUrl).toString(),
    baseManifestBody,
    variantManifestBody,
    variantManifestChecksum: sha256(variantManifestBody),
    imageShardChecksum: image.info.checksum,
    preprocessingFingerprint,
    bodies,
  };
}

const sampleManifest = {
  release: {
    corpusVersion: "2026-04-25-curation-b",
    backgroundCatalogVersion: "2026-04-25-curation-b",
    contractsVersion: "0.2.0",
    createdAt: "2026-04-25T00:00:00.000Z",
  },
  shards: {
    metadata: [{ id: "metadata-01", url: "./metadata-01.json", checksum: "sha256:meta", sizeBytes: 1, recordCount: 2 }],
    search: [{ id: "search-01", url: "./search-01.json", checksum: "sha256:search", sizeBytes: 1, recordCount: 2 }],
    mediaIndex: [{ id: "media-01", url: "./media-01.json", checksum: "sha256:media", sizeBytes: 1, recordCount: 2 }],
    backgroundScenes: [{ id: "bg-01", url: "./bg-01.json", checksum: "sha256:bg", sizeBytes: 1, recordCount: 1 }],
    embeddings: [{ id: "embeddings-01", url: "./embeddings-01.json", checksum: "sha256:embed", sizeBytes: 1, recordCount: 2 }],
  },
};

const sampleEmbeddings: EmbeddingShardRecord[] = [
  {
    id: "met-quiet",
    source: "met",
    sourceArtworkId: "1",
    version: "2026-04-25-curation-b",
    theme: "quiet",
    model: "local-hash-embedding-v1",
    dimensions: 4,
    title: "Quiet Moon",
    grade: "A",
    moodTags: ["quiet"],
    text: "quiet moonlit room",
    tokenCount: 3,
    vector: [1, 0, 0, 0],
  },
  {
    id: "met-storm",
    source: "met",
    sourceArtworkId: "2",
    version: "2026-04-25-curation-b",
    theme: "storm",
    model: "local-hash-embedding-v1",
    dimensions: 4,
    title: "Storm Light",
    grade: "B",
    moodTags: ["storm"],
    text: "violent sunlit storm",
    tokenCount: 3,
    vector: [0, 1, 0, 0],
  },
];

class FakeIndexedDbRequest<T = unknown> {
  result?: T;
  error?: unknown;
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onupgradeneeded: (() => void) | null = null;
}

class FakeIndexedDbDatabase {
  readonly stores = new Map<string, Map<string, unknown>>();
  readonly objectStoreNames = {
    contains: (name: string) => this.stores.has(name),
  };

  createObjectStore(name: string) {
    this.stores.set(name, new Map());
  }

  transaction(name: string) {
    const values = this.stores.get(name);

    if (!values) {
      throw new Error(`Missing fake object store ${name}`);
    }

    return {
      objectStore: () => ({
        get: (key: string) => {
          const request = new FakeIndexedDbRequest();
          queueMicrotask(() => {
            request.result = values.get(key);
            request.onsuccess?.();
          });

          return request;
        },
        put: (value: unknown, key: string) => {
          const request = new FakeIndexedDbRequest();
          queueMicrotask(() => {
            values.set(key, value);
            request.result = key;
            request.onsuccess?.();
          });

          return request;
        },
      }),
    };
  }
}

class FakeIndexedDbFactory implements IndexedDbFactory {
  readonly databases = new Map<string, FakeIndexedDbDatabase>();

  open(name: string) {
    const request = new FakeIndexedDbRequest<FakeIndexedDbDatabase>();

    queueMicrotask(() => {
      let database = this.databases.get(name);
      const isNewDatabase = !database;

      if (!database) {
        database = new FakeIndexedDbDatabase();
        this.databases.set(name, database);
      }

      request.result = database;
      if (isNewDatabase) {
        request.onupgradeneeded?.();
      }
      request.onsuccess?.();
    });

    return request;
  }
}

test("browser loader fetches manifest plus required embedding shard and then serves cache", async () => {
  const manifestUrl = "https://example.com/releases/2026-04-25-curation-b/manifest.json";
  const calls: string[] = [];

  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    calls.push(url);

    if (url.endsWith("manifest.json")) {
      return makeJsonResponse(sampleManifest);
    }

    if (url.endsWith("embeddings-01.json")) {
      return makeJsonResponse(sampleEmbeddings);
    }

    return new Response("not-found", { status: 404 });
  };

  const cache = createInMemoryBrowserCache();
  const manifest = await loadBrowserReleaseManifest(manifestUrl, { fetchImpl });

  const first = await loadBrowserEmbeddingShards({ manifestUrl, manifest }, { fetchImpl, cache });
  const firstCount = calls.length;
  const second = await loadBrowserEmbeddingShards({ manifestUrl, manifest }, { fetchImpl, cache });

  assert.equal(first.records.length, 2);
  assert.equal(second.records.length, 2);
  assert.equal(firstCount, calls.length);
  assert.equal(calls.filter((url) => url.endsWith("embeddings-01.json")).length, 1);
});

test("indexeddb browser cache persists release shards across cache instances", async () => {
  const indexedDB = new FakeIndexedDbFactory();
  const firstCache = createIndexedDbBrowserCache({ indexedDB, dbName: "artduo-test", storeName: "release-shards" });
  const secondCache = createIndexedDbBrowserCache({ indexedDB, dbName: "artduo-test", storeName: "release-shards" });

  await firstCache.set("release:test", sampleEmbeddings);

  assert.deepEqual(await secondCache.get<EmbeddingShardRecord[]>("release:test"), sampleEmbeddings);
});

test("browser loader can reuse an indexeddb-backed shard cache", async () => {
  const manifestUrl = "https://example.com/releases/2026-04-25-curation-b/manifest.json";
  const calls: string[] = [];

  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    calls.push(url);

    if (url.endsWith("manifest.json")) {
      return makeJsonResponse(sampleManifest);
    }

    if (url.endsWith("embeddings-01.json")) {
      return makeJsonResponse(sampleEmbeddings);
    }

    return new Response("not-found", { status: 404 });
  };

  const indexedDB = new FakeIndexedDbFactory();
  const manifest = await loadBrowserReleaseManifest(manifestUrl, { fetchImpl });
  const firstCache = createIndexedDbBrowserCache({ indexedDB, dbName: "artduo-loader-test" });
  const secondCache = createIndexedDbBrowserCache({ indexedDB, dbName: "artduo-loader-test" });

  await loadBrowserEmbeddingShards({ manifestUrl, manifest }, { fetchImpl, cache: firstCache });
  const firstCount = calls.length;
  const second = await loadBrowserEmbeddingShards({ manifestUrl, manifest }, { fetchImpl, cache: secondCache });

  assert.equal(second.records.length, 2);
  assert.equal(firstCount, calls.length);
  assert.equal(calls.filter((url) => url.endsWith("embeddings-01.json")).length, 1);
});

test("browser image loader only discovers a sidecar through an explicit variant and caches a verified shard", async () => {
  const fixture = makeImageEmbeddingBrowserFixture();
  const calls: string[] = [];
  const cacheKeys: string[] = [];
  const values = new Map<string, unknown>();
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    const body = fixture.bodies.get(url);
    return body === undefined
      ? new Response("not-found", { status: 404 })
      : new Response(body, {
        status: 200,
        headers: url === fixture.imageShardUrl
          ? { "content-type": "application/json", "content-length": "1" }
          : { "content-type": "application/json" },
      });
  };
  const cache = {
    get: async <T>(key: string): Promise<T | undefined> => {
      cacheKeys.push(key);
      return values.get(key) as T | undefined;
    },
    set: async <T>(key: string, value: T): Promise<void> => {
      cacheKeys.push(key);
      values.set(key, value);
    },
  };

  await loadBrowserReleaseManifest(fixture.baseManifestUrl, { fetchImpl });
  assert.deepEqual(calls, [fixture.baseManifestUrl]);
  calls.length = 0;

  const loadBrowserImageEmbeddingShards = (browserReleaseLoader as Record<string, unknown>).loadBrowserImageEmbeddingShards;
  assert.equal(typeof loadBrowserImageEmbeddingShards, "function", "browser image embedding loader must be exported");
  const first = await (loadBrowserImageEmbeddingShards as (input: {
    manifestUrl: string;
    imageEmbeddingManifestUrl: string;
  }, options: { fetchImpl: typeof fetch; cache: typeof cache }) => Promise<{
    records: ImageEmbeddingShardRecord[];
    imageEmbeddingSidecar?: { modelRevision: string };
  }>)({
    manifestUrl: fixture.baseManifestUrl,
    imageEmbeddingManifestUrl: fixture.imageEmbeddingManifestUrl,
  }, { fetchImpl, cache });
  const second = await (loadBrowserImageEmbeddingShards as (input: {
    manifestUrl: string;
    imageEmbeddingManifestUrl: string;
  }, options: { fetchImpl: typeof fetch; cache: typeof cache }) => Promise<{ records: ImageEmbeddingShardRecord[] }>)({
    manifestUrl: fixture.baseManifestUrl,
    imageEmbeddingManifestUrl: fixture.imageEmbeddingManifestUrl,
  }, { fetchImpl, cache });

  assert.deepEqual(first.records.map((record) => record.id), ["artwork:met-1"]);
  assert.equal(first.imageEmbeddingSidecar?.modelRevision, "test-revision");
  assert.equal(second.records.length, 1);
  assert.equal(calls.filter((url) => url === fixture.imageShardUrl).length, 1);
  assert.equal(calls.filter((url) => url === fixture.mediaShardUrl).length, 2);
  assert.ok(cacheKeys.some((key) => key.includes(fixture.variantManifestChecksum)));
  assert.ok(cacheKeys.some((key) => key.includes("image-variant")));
  assert.ok(cacheKeys.some((key) => key.includes("test-revision")));
  assert.ok(cacheKeys.some((key) => key.includes(fixture.preprocessingFingerprint)));
  assert.ok(cacheKeys.some((key) => key.includes(fixture.imageShardChecksum)));
});

test("browser image loader rejects an over-limit variant before parsing or requesting image shards", async () => {
  const fixture = makeImageEmbeddingBrowserFixture();
  const calls: string[] = [];
  const oversizedVariant = " ".repeat(256 * 1024 + 1);
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url === fixture.baseManifestUrl) {
      return new Response(fixture.baseManifestBody, { status: 200 });
    }
    if (url === fixture.imageEmbeddingManifestUrl) {
      return new Response(oversizedVariant, { status: 200 });
    }
    return new Response("not-found", { status: 404 });
  };
  const loadBrowserImageEmbeddingShards = (browserReleaseLoader as Record<string, unknown>).loadBrowserImageEmbeddingShards;
  assert.equal(typeof loadBrowserImageEmbeddingShards, "function", "browser image embedding loader must be exported");

  await assert.rejects(
    (loadBrowserImageEmbeddingShards as (input: {
      manifestUrl: string;
      imageEmbeddingManifestUrl: string;
    }, options: { fetchImpl: typeof fetch }) => Promise<unknown>)({
      manifestUrl: fixture.baseManifestUrl,
      imageEmbeddingManifestUrl: fixture.imageEmbeddingManifestUrl,
    }, { fetchImpl }),
    /pre-parse bytes/i,
  );
  assert.equal(calls.includes(fixture.imageShardUrl), false);
});

test("browser image loader validates cached image records against the bound base source refs", async () => {
  const fixture = makeImageEmbeddingBrowserFixture();
  const cachedRecords = JSON.parse(fixture.bodies.get(fixture.imageShardUrl) ?? "[]") as Array<Record<string, unknown>>;
  const source = cachedRecords[0]?.source as Record<string, unknown>;
  source.recordId = "met-missing";
  const variantManifest = JSON.parse(fixture.bodies.get(fixture.imageEmbeddingManifestUrl) ?? "{}") as {
    shards: { imageEmbeddings: Array<{ checksum: string }> };
    imageEmbeddingSidecar: { imageShardChecksum: string };
  };
  const cachedChecksum = sha256(JSON.stringify(cachedRecords, null, 2));
  variantManifest.shards.imageEmbeddings[0]!.checksum = cachedChecksum;
  variantManifest.imageEmbeddingSidecar.imageShardChecksum = cachedChecksum;
  fixture.bodies.set(fixture.imageEmbeddingManifestUrl, JSON.stringify(variantManifest, null, 2));
  const fetchImpl: typeof fetch = async (input) => {
    const body = fixture.bodies.get(String(input));
    return body === undefined
      ? new Response("not-found", { status: 404 })
      : new Response(body, { status: 200, headers: { "content-type": "application/json" } });
  };
  const cache = {
    get: async <T>(): Promise<T | undefined> => cachedRecords as T,
    set: async (): Promise<void> => undefined,
  };
  const loadBrowserImageEmbeddingShards = (browserReleaseLoader as Record<string, unknown>).loadBrowserImageEmbeddingShards;
  assert.equal(typeof loadBrowserImageEmbeddingShards, "function");

  await assert.rejects(
    (loadBrowserImageEmbeddingShards as (input: {
      manifestUrl: string;
      imageEmbeddingManifestUrl: string;
    }, options: { fetchImpl: typeof fetch; cache: typeof cache }) => Promise<unknown>)({
      manifestUrl: fixture.baseManifestUrl,
      imageEmbeddingManifestUrl: fixture.imageEmbeddingManifestUrl,
    }, { fetchImpl, cache }),
    /source reference/,
  );
});

test("browser image loader rejects cached records whose canonical bytes no longer match the image shard checksum", async () => {
  const fixture = makeImageEmbeddingBrowserFixture();
  const cachedRecords = JSON.parse(fixture.bodies.get(fixture.imageShardUrl) ?? "[]") as Array<Record<string, unknown>>;
  cachedRecords[0]!.vector = [0, 1];
  const fetchImpl: typeof fetch = async (input) => {
    const body = fixture.bodies.get(String(input));
    return body === undefined
      ? new Response("not-found", { status: 404 })
      : new Response(body, { status: 200, headers: { "content-type": "application/json" } });
  };
  const cache = {
    get: async <T>(): Promise<T | undefined> => cachedRecords as T,
    set: async (): Promise<void> => undefined,
  };

  await assert.rejects(
    loadBrowserImageEmbeddingShards({
      manifestUrl: fixture.baseManifestUrl,
      imageEmbeddingManifestUrl: fixture.imageEmbeddingManifestUrl,
    }, { fetchImpl, cache }),
    /checksum/,
  );
});

test("browser image loader rejects a base manifest passed as an explicit sidecar variant", async () => {
  const fixture = makeImageEmbeddingBrowserFixture();
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url === fixture.baseManifestUrl || url === fixture.imageEmbeddingManifestUrl) {
      return new Response(fixture.baseManifestBody, { status: 200 });
    }
    return new Response("not-found", { status: 404 });
  };

  await assert.rejects(
    loadBrowserImageEmbeddingShards({
      manifestUrl: fixture.baseManifestUrl,
      imageEmbeddingManifestUrl: fixture.imageEmbeddingManifestUrl,
    }, { fetchImpl }),
    /explicit image embedding variant/,
  );
});

test("worker search top hit matches server vector search for quiet moonlit room", () => {
  const handler = createSearchWorkerHandler({
    documents: sampleEmbeddings,
    embed: (query) => query.includes("quiet moonlit room") ? [1, 0, 0, 0] : [0, 1, 0, 0],
  });

  const workerResult = handler({ type: "search", query: "I want a quiet moonlit room", limit: 5 });

  assert.equal(workerResult.type, "result");
  if (workerResult.type !== "result") {
    return;
  }

  const serverResult = searchVectorIndex([1, 0, 0, 0], sampleEmbeddings.map((record) => ({ id: record.id, vector: record.vector })), { limit: 5 });

  assert.equal(workerResult.artworkIds[0], serverResult[0]?.item.id);
});
