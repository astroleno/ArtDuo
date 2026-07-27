import {
  parseEmbeddingShardRecords,
  parseImageEmbeddingShardRecords,
  parseReleaseManifest,
  type EmbeddingShardRecord,
  type ImageEmbeddingManifestBinding,
  type ImageEmbeddingShardRecord,
  type ReleaseManifest,
  type ShardInfo,
} from "@artduo/contracts";

import type { BrowserCacheStore } from "./indexeddb-cache";

export interface BrowserReleaseShardBundle {
  manifest: ReleaseManifest;
  records: EmbeddingShardRecord[];
}

export interface BrowserImageEmbeddingShardBundle {
  manifest: ReleaseManifest;
  baseManifest: ReleaseManifest;
  shardUrls: string[];
  records: ImageEmbeddingShardRecord[];
  imageEmbeddingSidecar: ImageEmbeddingManifestBinding;
}

export interface BrowserReleaseLoaderOptions {
  fetchImpl?: typeof fetch;
  cache?: BrowserCacheStore;
}

interface BrowserLoadedManifest {
  manifest: ReleaseManifest;
  checksum: string;
}

interface BrowserBaseSourceRecord {
  shardId: string;
  record: Record<string, unknown>;
}

const IMAGE_EMBEDDING_MANIFEST_MAX_BYTES = 256 * 1024;
const IMAGE_EMBEDDING_SHARD_MAX_BYTES = 4 * 1024 * 1024;
const BASE_RELEASE_SHARD_FIELDS = [
  "metadata",
  "search",
  "mediaIndex",
  "backgroundScenes",
  "embeddings",
  "relationshipGraph",
] as const;

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

function resolveImageEmbeddingShardUrl(manifestUrl: string, shard: ShardInfo): string {
  if (!shard.url.startsWith("./") || shard.url.includes("\\") || shard.url.includes("?") || shard.url.includes("#")) {
    throw new TypeError(`${manifestUrl}: image embedding shard URL must be a safe relative path`);
  }
  const manifest = new URL(manifestUrl);
  const releaseDirectory = new URL("./", manifest);
  const shardUrl = new URL(shard.url, manifest);
  if (shardUrl.origin !== releaseDirectory.origin || !shardUrl.pathname.startsWith(releaseDirectory.pathname)) {
    throw new TypeError(`${manifestUrl}: image embedding shard URL escapes the release directory`);
  }
  return shardUrl.toString();
}

async function readBoundedResponseBytes(
  fetchImpl: typeof fetch,
  url: string,
  maxBytes: number,
  label: string,
): Promise<Uint8Array> {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  if (!response.body) {
    throw new TypeError(`${url}: response body is unavailable`);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value) {
        continue;
      }
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new TypeError(`${url}: exceeds ${label}`);
      }
      chunks.push(value);
    }
  } catch (error) {
    try {
      await reader.cancel();
    } catch {
      // The reader may already have been cancelled after exceeding the hard cap.
    }
    throw error;
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function parseJsonBytes(bytes: Uint8Array, path: string): unknown {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid JSON";
    throw new TypeError(`${path}: ${message}`);
  }
}

async function sha256(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto SHA-256 is unavailable in this runtime");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("")}`;
}

async function canonicalJsonChecksum(value: unknown): Promise<string> {
  return sha256(new TextEncoder().encode(JSON.stringify(value, null, 2)));
}

async function loadBoundedBrowserManifest(
  fetchImpl: typeof fetch,
  manifestUrl: string,
): Promise<BrowserLoadedManifest> {
  const raw = await readBoundedResponseBytes(
    fetchImpl,
    manifestUrl,
    IMAGE_EMBEDDING_MANIFEST_MAX_BYTES,
    "image embedding manifest pre-parse bytes",
  );
  return {
    manifest: parseReleaseManifest(parseJsonBytes(raw, manifestUrl), manifestUrl),
    checksum: await sha256(raw),
  };
}

function imageEmbeddingShardByteLimit(shard: ShardInfo, shardUrl: string, label: string): number {
  if (!Number.isInteger(shard.sizeBytes) || shard.sizeBytes <= 0) {
    throw new TypeError(`${shardUrl}: ${label} sizeBytes must be a positive integer`);
  }
  if (!Number.isInteger(shard.recordCount) || shard.recordCount < 0) {
    throw new TypeError(`${shardUrl}: ${label} recordCount must be a non-negative integer`);
  }
  if (shard.sizeBytes > IMAGE_EMBEDDING_SHARD_MAX_BYTES) {
    throw new TypeError(`${shardUrl}: exceeds ${label} byte limits`);
  }
  return shard.sizeBytes;
}

function expectObject(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path}: expected object`);
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${path}: expected non-empty string`);
  }
  return value;
}

function assertImageEmbeddingBinding(
  variant: BrowserLoadedManifest,
  base: BrowserLoadedManifest,
  records: ImageEmbeddingShardRecord[],
): ImageEmbeddingManifestBinding {
  const binding = variant.manifest.imageEmbeddingSidecar;
  const imageEmbeddingShards = variant.manifest.shards.imageEmbeddings ?? [];
  if (!binding || imageEmbeddingShards.length !== 1 || imageEmbeddingShards[0]?.checksum !== binding.imageShardChecksum) {
    throw new TypeError(`${variant.manifest.release.corpusVersion}: image sidecar must bind exactly one matching shard`);
  }
  if (base.checksum !== binding.baseManifestChecksum) {
    throw new TypeError(`${variant.manifest.release.corpusVersion}: base manifest checksum does not match image sidecar binding`);
  }
  if (JSON.stringify(base.manifest.release) !== JSON.stringify(variant.manifest.release)) {
    throw new TypeError(`${variant.manifest.release.corpusVersion}: image sidecar variant does not match the base release metadata`);
  }
  for (const field of BASE_RELEASE_SHARD_FIELDS) {
    if (JSON.stringify(base.manifest.shards[field]) !== JSON.stringify(variant.manifest.shards[field])) {
      throw new TypeError(`${variant.manifest.release.corpusVersion}: image sidecar variant changes base ${field} shard bindings`);
    }
  }
  if (records.length !== imageEmbeddingShards[0].recordCount) {
    throw new TypeError(`${variant.manifest.release.corpusVersion}: image embedding record count does not match manifest binding`);
  }
  for (const record of records) {
    if (
      record.releaseVersion !== variant.manifest.release.corpusVersion ||
      record.model !== binding.model ||
      record.modelRevision !== binding.modelRevision ||
      record.modelVariant !== binding.modelVariant ||
      record.modelArtifactChecksum !== binding.modelArtifactChecksum ||
      record.providerVersion !== binding.providerVersion ||
      record.preprocessingFingerprint !== binding.preprocessingFingerprint
    ) {
      throw new TypeError(`${variant.manifest.release.corpusVersion}: image embedding record metadata does not match sidecar binding`);
    }
  }
  return binding;
}

async function loadBrowserImageEmbeddingShard(
  fetchImpl: typeof fetch,
  manifestUrl: string,
  shard: ShardInfo,
): Promise<{ shardUrl: string; records: ImageEmbeddingShardRecord[] }> {
  const shardUrl = resolveImageEmbeddingShardUrl(manifestUrl, shard);
  const maxBytes = imageEmbeddingShardByteLimit(shard, shardUrl, "image embedding shard");
  const raw = await readBoundedResponseBytes(fetchImpl, shardUrl, maxBytes, "image embedding shard byte limits");
  if (raw.byteLength !== shard.sizeBytes) {
    throw new TypeError(`${shardUrl}: image embedding shard size does not match manifest binding`);
  }
  const parsed = parseJsonBytes(raw, shardUrl);
  if (!Array.isArray(parsed)) {
    throw new TypeError(`${shardUrl}: image embedding shard must be an array`);
  }
  if (await canonicalJsonChecksum(parsed) !== shard.checksum) {
    throw new TypeError(`${shardUrl}: image embedding shard checksum does not match manifest binding`);
  }
  const records = parseImageEmbeddingShardRecords(parsed, shardUrl);
  if (records.length !== shard.recordCount) {
    throw new TypeError(`${shardUrl}: image embedding shard record count does not match manifest binding`);
  }
  return { shardUrl, records };
}

async function indexBrowserBaseSourceRecords(
  fetchImpl: typeof fetch,
  baseManifestUrl: string,
  shards: ShardInfo[],
): Promise<Map<string, Map<string, BrowserBaseSourceRecord>>> {
  const byShard = new Map<string, Map<string, BrowserBaseSourceRecord>>();
  for (const shard of shards) {
    if (byShard.has(shard.id)) {
      throw new TypeError(`${baseManifestUrl}: duplicate base source shard id ${shard.id}`);
    }
    const shardUrl = resolveImageEmbeddingShardUrl(baseManifestUrl, shard);
    const maxBytes = imageEmbeddingShardByteLimit(shard, shardUrl, "base source shard");
    const raw = await readBoundedResponseBytes(fetchImpl, shardUrl, maxBytes, "base source shard byte limits");
    if (raw.byteLength !== shard.sizeBytes) {
      throw new TypeError(`${shardUrl}: base source shard size does not match manifest binding`);
    }
    const parsed = parseJsonBytes(raw, shardUrl);
    if (!Array.isArray(parsed) || parsed.length !== shard.recordCount) {
      throw new TypeError(`${shardUrl}: base source shard record count does not match manifest binding`);
    }
    if (await canonicalJsonChecksum(parsed) !== shard.checksum) {
      throw new TypeError(`${shardUrl}: base source shard checksum does not match manifest binding`);
    }
    const records = new Map<string, BrowserBaseSourceRecord>();
    for (const [index, value] of parsed.entries()) {
      const record = expectObject(value, `${shardUrl}[${index}]`);
      const recordId = readString(record.id, `${shardUrl}[${index}].id`);
      if (records.has(recordId)) {
        throw new TypeError(`${shardUrl}: duplicate base source record ${shard.id}:${recordId}`);
      }
      records.set(recordId, { shardId: shard.id, record });
    }
    byShard.set(shard.id, records);
  }
  return byShard;
}

function assertBrowserImageEmbeddingSourceReferences(
  records: ImageEmbeddingShardRecord[],
  baseManifest: ReleaseManifest,
  mediaRecords: Map<string, Map<string, BrowserBaseSourceRecord>>,
  sceneRecords: Map<string, Map<string, BrowserBaseSourceRecord>>,
): void {
  for (const record of records) {
    const sourceIndex = record.entityType === "artwork" ? mediaRecords : sceneRecords;
    const source = sourceIndex.get(record.source.shardId)?.get(record.source.recordId);
    if (!source || record.source.recordId !== record.entityId) {
      throw new TypeError(`${baseManifest.release.corpusVersion}: image source reference does not resolve for ${record.id}`);
    }
    if (record.entityType === "artwork") {
      const media = expectObject(source.record.media, `${record.id}.source.media`);
      const fieldName = record.source.fieldPath === "media.imageUrlPreview"
        ? "imageUrlPreview"
        : record.source.fieldPath === "media.baseImageUrl"
          ? "baseImageUrl"
          : record.source.fieldPath === "media.imageUrlFull"
            ? "imageUrlFull"
            : undefined;
      if (!fieldName || typeof media[fieldName] !== "string" || media[fieldName].trim() === "") {
        throw new TypeError(`${baseManifest.release.corpusVersion}: image source reference has no matching artwork media field for ${record.id}`);
      }
      continue;
    }
    const asset = expectObject(source.record.asset, `${record.id}.source.asset`);
    if (
      record.source.fieldPath !== "asset.local_public_path" ||
      typeof asset.local_public_path !== "string" ||
      asset.local_public_path.trim() === ""
    ) {
      throw new TypeError(`${baseManifest.release.corpusVersion}: image source reference has no matching background scene field for ${record.id}`);
    }
  }
}

async function assertBrowserImageEmbeddingSourceReferencesFromRelease(
  fetchImpl: typeof fetch,
  baseManifestUrl: string,
  baseManifest: ReleaseManifest,
  records: ImageEmbeddingShardRecord[],
): Promise<void> {
  const mediaRecords = records.some((record) => record.entityType === "artwork")
    ? await indexBrowserBaseSourceRecords(fetchImpl, baseManifestUrl, baseManifest.shards.mediaIndex)
    : new Map<string, Map<string, BrowserBaseSourceRecord>>();
  const sceneRecords = records.some((record) => record.entityType === "background-scene")
    ? await indexBrowserBaseSourceRecords(fetchImpl, baseManifestUrl, baseManifest.shards.backgroundScenes)
    : new Map<string, Map<string, BrowserBaseSourceRecord>>();
  assertBrowserImageEmbeddingSourceReferences(records, baseManifest, mediaRecords, sceneRecords);
}

function imageEmbeddingCacheKey(
  variantManifestChecksum: string,
  manifest: ReleaseManifest,
  binding: ImageEmbeddingManifestBinding,
): string {
  return [
    "image-embedding-sidecar",
    variantManifestChecksum,
    manifest.release.corpusVersion,
    binding.modelRevision,
    binding.preprocessingFingerprint,
    binding.imageShardChecksum,
  ].join("|");
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

export async function loadBrowserImageEmbeddingShards(
  input: {
    manifestUrl: string;
    imageEmbeddingManifestUrl: string;
  },
  options: BrowserReleaseLoaderOptions = {},
): Promise<BrowserImageEmbeddingShardBundle> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = await loadBoundedBrowserManifest(fetchImpl, input.manifestUrl);
  const variant = await loadBoundedBrowserManifest(fetchImpl, input.imageEmbeddingManifestUrl);
  const sidecar = variant.manifest.imageEmbeddingSidecar;
  const imageEmbeddingShards = variant.manifest.shards.imageEmbeddings ?? [];
  const imageEmbeddingShard = imageEmbeddingShards[0];

  if (!sidecar || imageEmbeddingShards.length !== 1 || !imageEmbeddingShard) {
    throw new TypeError(`${input.imageEmbeddingManifestUrl}: an explicit image embedding variant is required`);
  }

  const cacheKey = imageEmbeddingCacheKey(variant.checksum, variant.manifest, sidecar);
  const cached = await options.cache?.get<unknown>(cacheKey);
  if (cached !== undefined) {
    const records = parseImageEmbeddingShardRecords(cached, `cache:${cacheKey}`);
    if (await canonicalJsonChecksum(records) !== imageEmbeddingShard.checksum) {
      throw new TypeError(`${input.imageEmbeddingManifestUrl}: cached image embedding records do not match the shard checksum`);
    }
    const binding = assertImageEmbeddingBinding(variant, base, records);
    await assertBrowserImageEmbeddingSourceReferencesFromRelease(
      fetchImpl,
      input.manifestUrl,
      base.manifest,
      records,
    );
    return {
      manifest: variant.manifest,
      baseManifest: base.manifest,
      shardUrls: [resolveImageEmbeddingShardUrl(input.imageEmbeddingManifestUrl, imageEmbeddingShard)],
      records,
      imageEmbeddingSidecar: binding,
    };
  }

  const loadedShard = await loadBrowserImageEmbeddingShard(
    fetchImpl,
    input.imageEmbeddingManifestUrl,
    imageEmbeddingShard,
  );
  const records = loadedShard.records;
  const binding = assertImageEmbeddingBinding(variant, base, records);
  await assertBrowserImageEmbeddingSourceReferencesFromRelease(
    fetchImpl,
    input.manifestUrl,
    base.manifest,
    records,
  );
  await options.cache?.set(cacheKey, records);

  return {
    manifest: variant.manifest,
    baseManifest: base.manifest,
    shardUrls: [loadedShard.shardUrl],
    records,
    imageEmbeddingSidecar: binding,
  };
}
