import assert from "node:assert/strict";
import { test } from "node:test";

import type { EmbeddingShardRecord } from "@artduo/contracts";

import { createIndexedDbBrowserCache, createInMemoryBrowserCache, type IndexedDbFactory } from "./indexeddb-cache";
import { loadBrowserEmbeddingShards, loadBrowserReleaseManifest } from "./browser-release-loader";
import { createSearchWorkerHandler } from "./search-worker";
import { searchVectorIndex } from "./vector-search";

function makeJsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
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
