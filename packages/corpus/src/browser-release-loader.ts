import { parseEmbeddingShardRecords, parseReleaseManifest, type EmbeddingShardRecord, type ReleaseManifest, type ShardInfo } from "@artduo/contracts";

import type { BrowserCacheStore } from "./indexeddb-cache";

export interface BrowserReleaseShardBundle {
  manifest: ReleaseManifest;
  records: EmbeddingShardRecord[];
}

export interface BrowserReleaseLoaderOptions {
  fetchImpl?: typeof fetch;
  cache?: BrowserCacheStore;
}

function resolveUrl(baseUrl: string, relativeUrl: string): string {
  return new URL(relativeUrl, baseUrl).toString();
}

function releaseFingerprint(manifest: ReleaseManifest, shards: ShardInfo[]): string {
  return [
    manifest.release.corpusVersion,
    ...shards.map((shard) => `${shard.id}:${shard.checksum}`),
  ].join("|");
}

async function fetchJson(fetchImpl: typeof fetch, url: string): Promise<unknown> {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.json() as Promise<unknown>;
}

export async function loadBrowserReleaseManifest(
  manifestUrl: string,
  options: BrowserReleaseLoaderOptions = {},
): Promise<ReleaseManifest> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const raw = await fetchJson(fetchImpl, manifestUrl);
  return parseReleaseManifest(raw, manifestUrl);
}

export async function loadBrowserEmbeddingShards(
  input: {
    manifestUrl: string;
    manifest?: ReleaseManifest;
    shards?: ShardInfo[];
  },
  options: BrowserReleaseLoaderOptions = {},
): Promise<BrowserReleaseShardBundle> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const manifest = input.manifest ?? await loadBrowserReleaseManifest(input.manifestUrl, options);
  const shards = input.shards ?? manifest.shards.embeddings ?? [];

  if (shards.length === 0) {
    return { manifest, records: [] };
  }

  const fingerprint = releaseFingerprint(manifest, shards);
  const cacheKey = `release:${fingerprint}`;
  const cached = await options.cache?.get<EmbeddingShardRecord[]>(cacheKey);
  if (cached) {
    return { manifest, records: cached };
  }

  const records: EmbeddingShardRecord[] = [];
  for (const shard of shards) {
    const shardUrl = resolveUrl(input.manifestUrl, shard.url);
    const raw = await fetchJson(fetchImpl, shardUrl);
    records.push(...parseEmbeddingShardRecords(raw, shardUrl));
  }

  await options.cache?.set(cacheKey, records);

  return { manifest, records };
}
