import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { readFile as readFileAsync, stat as statAsync } from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_RELATIONSHIP_GRAPH_LIMITS,
  parseEmbeddingShardRecord,
  parseEmbeddingShardRecords,
  parseImageEmbeddingShardRecords as parseImageEmbeddingShardRecordsFromContract,
  type ImageEmbeddingManifestBinding,
  type ImageEmbeddingShardRecord,
  parseRelationshipGraphShard,
  parseReleaseManifest,
  type EmbeddingShardRecord,
  type RelationshipGraphParserLimits,
  type RelationshipGraphShard,
  type ReleaseManifest,
  type ShardInfo,
} from "@artduo/contracts";

export interface ReleaseLoaderOptions {
  rootDir?: string;
  releasesRoot?: string;
  releaseVersion?: string;
  manifestPath?: string;
}

export interface LoadedReleaseManifest {
  manifestPath: string;
  releaseVersion: string;
  releaseDir: string;
  manifest: ReleaseManifest;
}

export interface LoadedEmbeddingShards extends LoadedReleaseManifest {
  shardPaths: string[];
  records: EmbeddingShardRecord[];
}

export interface ImageEmbeddingLoaderOptions extends ReleaseLoaderOptions {
  imageEmbeddingManifestPath?: string;
  maxPreParseBytes?: number;
}

export interface AsyncImageEmbeddingLoaderOptions extends ImageEmbeddingLoaderOptions {
  imageEmbeddingManifestPath: string;
  signal?: AbortSignal;
}

export interface LoadedImageEmbeddingShards extends LoadedReleaseManifest {
  shardPaths: string[];
  records: ImageEmbeddingShardRecord[];
  imageEmbeddingSidecar?: ImageEmbeddingManifestBinding;
}

export interface RelationshipGraphLoaderOptions extends ReleaseLoaderOptions {
  parserLimits?: RelationshipGraphParserLimits;
  maxPreParseBytes?: number;
}

export interface LoadedRelationshipGraphShard extends LoadedReleaseManifest {
  shardPath: string;
  shard: ShardInfo;
  graph: RelationshipGraphShard;
}

interface LegacyEmbeddingMetadataFallback {
  theme: string;
  title: string;
  artistDisplayName?: string;
  grade: string;
  moodTags: string[];
}

interface LegacyEmbeddingSearchFallback {
  searchText: string;
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

interface BoundBaseManifest {
  binding: ImageEmbeddingManifestBinding;
  manifestPath: string;
  manifest: ReleaseManifest;
}

interface BaseSourceRecord {
  shardId: string;
  record: Record<string, unknown>;
}

function resolveRootDir(rootDir?: string): string {
  return rootDir ? path.resolve(rootDir) : path.resolve(process.cwd(), "../..");
}

function resolveReleasesRoot(rootDir: string, releasesRoot?: string): string {
  return releasesRoot ? path.resolve(releasesRoot) : path.join(rootDir, "data", "releases");
}

function sha256(value: Uint8Array | string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function isInside(parentPath: string, childPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function resolveBoundedBytes(value: number | undefined, hardLimit: number, label: string): number {
  if (value === undefined) {
    return hardLimit;
  }
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${label}: max pre-parse bytes must be a positive integer`);
  }
  return Math.min(value, hardLimit);
}

function createImageEmbeddingAbortError(): Error {
  const error = new Error("Image embedding load aborted");
  error.name = "AbortError";
  return error;
}

function throwIfImageEmbeddingLoadAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw createImageEmbeddingAbortError();
  }
}

function readBoundedFileSync(filePath: string, maxBytes: number, label: string): Buffer {
  const stats = statSync(filePath);
  if (!stats.isFile()) {
    throw new TypeError(`${filePath}: must be a regular file`);
  }
  if (stats.size > maxBytes) {
    throw new TypeError(`${filePath}: exceeds ${label}`);
  }
  const raw = readFileSync(filePath);
  if (raw.byteLength > maxBytes) {
    throw new TypeError(`${filePath}: exceeds ${label}`);
  }
  return raw;
}

async function readBoundedFileAsync(
  filePath: string,
  maxBytes: number,
  label: string,
  signal: AbortSignal | undefined,
): Promise<Buffer> {
  throwIfImageEmbeddingLoadAborted(signal);
  try {
    const stats = await statAsync(filePath);
    throwIfImageEmbeddingLoadAborted(signal);
    if (!stats.isFile()) {
      throw new TypeError(`${filePath}: must be a regular file`);
    }
    if (stats.size > maxBytes) {
      throw new TypeError(`${filePath}: exceeds ${label}`);
    }
    const raw = await readFileAsync(filePath, signal ? { signal } : undefined);
    throwIfImageEmbeddingLoadAborted(signal);
    if (raw.byteLength > maxBytes) {
      throw new TypeError(`${filePath}: exceeds ${label}`);
    }
    return raw;
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw createImageEmbeddingAbortError();
    }
    throw error;
  }
}

export function resolveLatestReleaseVersion(releasesRoot: string): string {
  const versions = readdirSync(releasesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const latest = versions.at(-1);

  if (!latest) {
    throw new Error(`No release artifacts found under ${releasesRoot}`);
  }

  return latest;
}

export function resolveReleaseManifestPath(options: ReleaseLoaderOptions = {}): string {
  if (options.manifestPath) {
    return path.resolve(options.manifestPath);
  }

  const rootDir = resolveRootDir(options.rootDir);
  const releasesRoot = resolveReleasesRoot(rootDir, options.releasesRoot);
  const releaseVersion = options.releaseVersion ?? resolveLatestReleaseVersion(releasesRoot);

  return path.join(releasesRoot, releaseVersion, "manifest.json");
}

export function loadReleaseManifest(options: ReleaseLoaderOptions = {}): LoadedReleaseManifest {
  const manifestPath = resolveReleaseManifestPath(options);
  const manifest = parseReleaseManifest(JSON.parse(readFileSync(manifestPath, "utf8")) as unknown, manifestPath);
  const releaseDir = path.dirname(manifestPath);

  return {
    manifestPath,
    releaseVersion: path.basename(releaseDir),
    releaseDir,
    manifest,
  };
}

export function resolveShardPath(manifestPath: string, shard: ShardInfo): string {
  return path.resolve(path.dirname(manifestPath), shard.url);
}

function resolveImageEmbeddingShardPath(manifestPath: string, shard: ShardInfo): string {
  if (!shard.url.startsWith("./") || shard.url.includes("\\")) {
    throw new TypeError(`${manifestPath}: image embedding shard URL must be a safe relative path`);
  }
  const releaseDir = path.dirname(manifestPath);
  const shardPath = path.resolve(releaseDir, shard.url);
  if (!isInside(releaseDir, shardPath)) {
    throw new TypeError(`${manifestPath}: image embedding shard URL escapes the release directory`);
  }
  return shardPath;
}

export function readJsonObject(filePath: string, maxPreParseBytes = DEFAULT_RELATIONSHIP_GRAPH_LIMITS.maxPreParseBytes): Record<string, unknown> {
  const raw = readFileSync(filePath, "utf8");
  const sizeBytes = Buffer.byteLength(raw, "utf8");

  if (sizeBytes > maxPreParseBytes) {
    throw new TypeError(`${filePath}: exceeds max pre-parse bytes`);
  }

  const value = JSON.parse(raw) as unknown;

  return expectObject(value, filePath);
}

function expectObject(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path}: expected object`);
  }

  return value as Record<string, unknown>;
}

function expectArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${path}: expected array`);
  }

  return value;
}

function readString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${path}: expected non-empty string`);
  }

  return value;
}

function readOptionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readString(value, path);
}

function readStringArray(value: unknown, path: string): string[] {
  return expectArray(value, path).map((entry, index) => readString(entry, `${path}[${index}]`));
}

function loadMetadataFallbackIndex(loaded: LoadedReleaseManifest): Map<string, LegacyEmbeddingMetadataFallback> {
  const index = new Map<string, LegacyEmbeddingMetadataFallback>();

  for (const shard of loaded.manifest.shards.metadata) {
    const shardPath = resolveShardPath(loaded.manifestPath, shard);
    const records = expectArray(JSON.parse(readFileSync(shardPath, "utf8")) as unknown, shardPath);

    for (const [recordIndex, value] of records.entries()) {
      const recordPath = `${shardPath}[${recordIndex}]`;
      const record = expectObject(value, recordPath);
      const metadata = expectObject(record.metadata, `${recordPath}.metadata`);
      const presentation = expectObject(record.presentation, `${recordPath}.presentation`);
      const id = readString(record.id, `${recordPath}.id`);
      const moodTags = readStringArray(metadata.moodTags, `${recordPath}.metadata.moodTags`);

      index.set(id, {
        theme: moodTags[0] ?? "",
        title: readString(metadata.title, `${recordPath}.metadata.title`),
        artistDisplayName: readOptionalString(metadata.artistDisplayName, `${recordPath}.metadata.artistDisplayName`),
        grade: readString(presentation.grade, `${recordPath}.presentation.grade`),
        moodTags,
      });
    }
  }

  return index;
}

function loadSearchFallbackIndex(loaded: LoadedReleaseManifest): Map<string, LegacyEmbeddingSearchFallback> {
  const index = new Map<string, LegacyEmbeddingSearchFallback>();

  for (const shard of loaded.manifest.shards.search) {
    const shardPath = resolveShardPath(loaded.manifestPath, shard);
    const records = expectArray(JSON.parse(readFileSync(shardPath, "utf8")) as unknown, shardPath);

    for (const [recordIndex, value] of records.entries()) {
      const recordPath = `${shardPath}[${recordIndex}]`;
      const record = expectObject(value, recordPath);
      const retrieval = expectObject(record.retrieval, `${recordPath}.retrieval`);
      const id = readString(record.id, `${recordPath}.id`);

      index.set(id, {
        searchText: readString(retrieval.searchText, `${recordPath}.retrieval.searchText`),
      });
    }
  }

  return index;
}

function normalizeLegacyEmbeddingShardRecords(
  value: unknown,
  path: string,
  metadataFallbacks: Map<string, LegacyEmbeddingMetadataFallback>,
  searchFallbacks: Map<string, LegacyEmbeddingSearchFallback>,
): EmbeddingShardRecord[] {
  return expectArray(value, path).map((entry, index) => {
    const recordPath = `${path}[${index}]`;
    const record = expectObject(entry, recordPath);
    const id = readString(record.id, `${recordPath}.id`);
    const metadataFallback = metadataFallbacks.get(id);

    if (!metadataFallback) {
      throw new TypeError(`${recordPath}: missing metadata fallback for ${id}`);
    }

    const searchFallback = searchFallbacks.get(id);
    const text = typeof record.text === "string" && record.text.trim() !== ""
      ? record.text
      : searchFallback?.searchText ?? metadataFallback.title;
    const tokenCount = typeof record.tokenCount === "number" && Number.isFinite(record.tokenCount)
      ? record.tokenCount
      : text.split(/\s+/u).filter(Boolean).length;

    return parseEmbeddingShardRecord(
      {
        ...record,
        title: typeof record.title === "string" && record.title.trim() !== "" ? record.title : metadataFallback.title,
        artistDisplayName: typeof record.artistDisplayName === "string" && record.artistDisplayName.trim() !== ""
          ? record.artistDisplayName
          : metadataFallback.artistDisplayName,
        grade: typeof record.grade === "string" && record.grade.trim() !== "" ? record.grade : metadataFallback.grade,
        theme: typeof record.theme === "string" && record.theme.trim() !== "" ? record.theme : metadataFallback.theme,
        moodTags: Array.isArray(record.moodTags) && record.moodTags.length > 0 ? record.moodTags : metadataFallback.moodTags,
        text,
        tokenCount,
      },
      recordPath,
    );
  });
}

export function loadEmbeddingShards(options: ReleaseLoaderOptions = {}): LoadedEmbeddingShards {
  const loaded = loadReleaseManifest(options);
  const embeddingShards = loaded.manifest.shards.embeddings;

  if (!embeddingShards || embeddingShards.length === 0) {
    throw new Error(`Release ${loaded.releaseVersion} does not expose embeddings shards.`);
  }

  const shardPaths = embeddingShards.map((shard) => resolveShardPath(loaded.manifestPath, shard));
  let metadataFallbacks: Map<string, LegacyEmbeddingMetadataFallback> | undefined;
  let searchFallbacks: Map<string, LegacyEmbeddingSearchFallback> | undefined;
  const records = shardPaths.flatMap((filePath) => {
    const raw = JSON.parse(readFileSync(filePath, "utf8")) as unknown;

    try {
      return parseEmbeddingShardRecords(raw, filePath);
    } catch (error) {
      if (!(error instanceof TypeError)) {
        throw error;
      }

      metadataFallbacks ??= loadMetadataFallbackIndex(loaded);
      searchFallbacks ??= loadSearchFallbackIndex(loaded);

      return normalizeLegacyEmbeddingShardRecords(raw, filePath, metadataFallbacks, searchFallbacks);
    }
  });

  return {
    ...loaded,
    shardPaths,
    records,
  };
}

function resolveImageEmbeddingManifestPath(options: ImageEmbeddingLoaderOptions): string {
  return options.imageEmbeddingManifestPath
    ? path.resolve(options.imageEmbeddingManifestPath)
    : resolveReleaseManifestPath(options);
}

function parseBoundedImageEmbeddingManifest(
  manifestPath: string,
  raw: Buffer,
): LoadedReleaseManifest {
  const manifest = parseReleaseManifest(JSON.parse(raw.toString("utf8")) as unknown, manifestPath);
  const releaseDir = path.dirname(manifestPath);

  return {
    manifestPath,
    releaseVersion: path.basename(releaseDir),
    releaseDir,
    manifest,
  };
}

function assertRequestedImageEmbeddingReleaseVersion(
  loaded: LoadedReleaseManifest,
  requestedReleaseVersion: string | undefined,
): void {
  if (requestedReleaseVersion && loaded.releaseVersion !== requestedReleaseVersion) {
    throw new TypeError(
      `${loaded.manifestPath}: image embedding manifest releaseVersion ${loaded.releaseVersion} does not match requested releaseVersion ${requestedReleaseVersion}`,
    );
  }
}

function loadBoundedImageEmbeddingManifest(
  options: ImageEmbeddingLoaderOptions,
): LoadedReleaseManifest {
  const manifestPath = resolveImageEmbeddingManifestPath(options);
  const maxPreParseBytes = resolveBoundedBytes(
    options.maxPreParseBytes,
    IMAGE_EMBEDDING_MANIFEST_MAX_BYTES,
    manifestPath,
  );
  const raw = readBoundedFileSync(manifestPath, maxPreParseBytes, "image embedding manifest pre-parse bytes");
  const loaded = parseBoundedImageEmbeddingManifest(manifestPath, raw);
  assertRequestedImageEmbeddingReleaseVersion(loaded, options.releaseVersion);
  return loaded;
}

function imageEmbeddingShardByteLimit(shard: ShardInfo, shardPath: string, label: string): number {
  if (!Number.isInteger(shard.sizeBytes) || shard.sizeBytes <= 0) {
    throw new TypeError(`${shardPath}: ${label} sizeBytes must be a positive integer`);
  }
  if (!Number.isInteger(shard.recordCount) || shard.recordCount < 0) {
    throw new TypeError(`${shardPath}: ${label} recordCount must be a non-negative integer`);
  }
  if (shard.sizeBytes > IMAGE_EMBEDDING_SHARD_MAX_BYTES) {
    throw new TypeError(`${shardPath}: exceeds ${label} byte limits`);
  }
  return shard.sizeBytes;
}

function parseImageEmbeddingShardRecords(
  shardPath: string,
  shard: ShardInfo,
  raw: Buffer,
): ImageEmbeddingShardRecord[] {
  const maxBytes = imageEmbeddingShardByteLimit(shard, shardPath, "image embedding shard");
  if (raw.byteLength > maxBytes) {
    throw new TypeError(`${shardPath}: exceeds image embedding shard byte limits`);
  }
  if (raw.byteLength !== shard.sizeBytes) {
    throw new TypeError(`${shardPath}: image embedding shard size does not match manifest binding`);
  }
  const parsed = JSON.parse(raw.toString("utf8")) as unknown;
  if (!Array.isArray(parsed)) {
    throw new TypeError(`${shardPath}: image embedding shard must be an array`);
  }
  if (sha256(JSON.stringify(parsed, null, 2)) !== shard.checksum) {
    throw new TypeError(`${shardPath}: image embedding shard checksum does not match manifest binding`);
  }
  const records = parseImageEmbeddingShardRecordsFromContract(parsed, shardPath);
  if (records.length !== shard.recordCount) {
    throw new TypeError(`${shardPath}: image embedding shard record count does not match manifest binding`);
  }
  return records;
}

function loadImageEmbeddingShardRecords(
  manifestPath: string,
  shard: ShardInfo,
): { shardPath: string; records: ImageEmbeddingShardRecord[] } {
  const shardPath = resolveImageEmbeddingShardPath(manifestPath, shard);
  const maxBytes = imageEmbeddingShardByteLimit(shard, shardPath, "image embedding shard");
  const raw = readBoundedFileSync(shardPath, maxBytes, "image embedding shard byte limits");
  return { shardPath, records: parseImageEmbeddingShardRecords(shardPath, shard, raw) };
}

function parseBoundBaseManifest(
  loaded: LoadedReleaseManifest,
  baseManifestRaw: Buffer,
): BoundBaseManifest {
  const binding = loaded.manifest.imageEmbeddingSidecar;
  if (!binding) {
    throw new TypeError(`${loaded.manifestPath}: image embedding shards require a sidecar binding`);
  }
  const baseManifestPath = path.join(loaded.releaseDir, "manifest.json");
  if (sha256(baseManifestRaw) !== binding.baseManifestChecksum) {
    throw new TypeError(`${loaded.manifestPath}: base manifest checksum does not match image sidecar binding`);
  }
  const manifest = parseReleaseManifest(JSON.parse(baseManifestRaw.toString("utf8")) as unknown, baseManifestPath);
  if (manifest.release.corpusVersion !== loaded.releaseVersion || JSON.stringify(manifest.release) !== JSON.stringify(loaded.manifest.release)) {
    throw new TypeError(`${loaded.manifestPath}: image sidecar variant does not match the base release metadata`);
  }
  for (const field of BASE_RELEASE_SHARD_FIELDS) {
    if (JSON.stringify(loaded.manifest.shards[field]) !== JSON.stringify(manifest.shards[field])) {
      throw new TypeError(`${loaded.manifestPath}: image sidecar variant changes base ${field} shard bindings`);
    }
  }
  return { binding, manifestPath: baseManifestPath, manifest };
}

function loadBoundBaseManifest(
  loaded: LoadedReleaseManifest,
): BoundBaseManifest {
  const baseManifestPath = path.join(loaded.releaseDir, "manifest.json");
  const baseManifestRaw = readBoundedFileSync(
    baseManifestPath,
    IMAGE_EMBEDDING_MANIFEST_MAX_BYTES,
    "image embedding manifest pre-parse bytes",
  );
  return parseBoundBaseManifest(loaded, baseManifestRaw);
}

function assertImageEmbeddingBinding(
  loaded: LoadedReleaseManifest,
  shards: ShardInfo[],
  records: ImageEmbeddingShardRecord[],
  base: BoundBaseManifest,
): void {
  const binding = base.binding;
  if (shards.length !== 1 || shards[0]?.checksum !== binding.imageShardChecksum) {
    throw new TypeError(`${loaded.manifestPath}: image sidecar must bind exactly one matching shard`);
  }
  for (const record of records) {
    if (
      record.releaseVersion !== loaded.releaseVersion ||
      record.model !== binding.model ||
      record.modelRevision !== binding.modelRevision ||
      record.modelVariant !== binding.modelVariant ||
      record.modelArtifactChecksum !== binding.modelArtifactChecksum ||
      record.providerVersion !== binding.providerVersion ||
      record.preprocessingFingerprint !== binding.preprocessingFingerprint
    ) {
      throw new TypeError(`${loaded.manifestPath}: image embedding record metadata does not match sidecar binding`);
    }
  }
}

function parseVerifiedBaseSourceRecords(
  shardPath: string,
  shard: ShardInfo,
  raw: Buffer,
): BaseSourceRecord[] {
  const maxBytes = imageEmbeddingShardByteLimit(shard, shardPath, "base source shard");
  if (raw.byteLength > maxBytes || raw.byteLength !== shard.sizeBytes) {
    throw new TypeError(`${shardPath}: base source shard size does not match manifest binding`);
  }
  const parsed = JSON.parse(raw.toString("utf8")) as unknown;
  if (!Array.isArray(parsed) || parsed.length !== shard.recordCount) {
    throw new TypeError(`${shardPath}: base source shard record count does not match manifest binding`);
  }
  if (sha256(JSON.stringify(parsed, null, 2)) !== shard.checksum) {
    throw new TypeError(`${shardPath}: base source shard checksum does not match manifest binding`);
  }
  return parsed.map((value, index) => ({
    shardId: shard.id,
    record: expectObject(value, `${shardPath}[${index}]`),
  }));
}

function loadVerifiedBaseSourceRecords(baseManifestPath: string, shard: ShardInfo): BaseSourceRecord[] {
  const shardPath = resolveImageEmbeddingShardPath(baseManifestPath, shard);
  const maxBytes = imageEmbeddingShardByteLimit(shard, shardPath, "base source shard");
  const raw = readBoundedFileSync(shardPath, maxBytes, "base source shard byte limits");
  return parseVerifiedBaseSourceRecords(shardPath, shard, raw);
}

function indexBaseSourceRecords(baseManifestPath: string, shards: ShardInfo[]): Map<string, Map<string, BaseSourceRecord>> {
  const byShard = new Map<string, Map<string, BaseSourceRecord>>();
  for (const shard of shards) {
    if (byShard.has(shard.id)) {
      throw new TypeError(`${baseManifestPath}: duplicate base source shard id ${shard.id}`);
    }
    const records = new Map<string, BaseSourceRecord>();
    for (const entry of loadVerifiedBaseSourceRecords(baseManifestPath, shard)) {
      const recordId = readString(entry.record.id, `${baseManifestPath}:${shard.id}.id`);
      if (records.has(recordId)) {
        throw new TypeError(`${baseManifestPath}: duplicate base source record ${shard.id}:${recordId}`);
      }
      records.set(recordId, entry);
    }
    byShard.set(shard.id, records);
  }
  return byShard;
}

function assertImageEmbeddingSourceReferences(
  records: ImageEmbeddingShardRecord[],
  base: BoundBaseManifest,
  mediaRecords = records.some((record) => record.entityType === "artwork")
    ? indexBaseSourceRecords(base.manifestPath, base.manifest.shards.mediaIndex)
    : new Map<string, Map<string, BaseSourceRecord>>(),
  sceneRecords = records.some((record) => record.entityType === "background-scene")
    ? indexBaseSourceRecords(base.manifestPath, base.manifest.shards.backgroundScenes)
    : new Map<string, Map<string, BaseSourceRecord>>(),
): void {
  for (const record of records) {
    const sourceIndex = record.entityType === "artwork" ? mediaRecords : sceneRecords;
    const source = sourceIndex.get(record.source.shardId)?.get(record.source.recordId);
    if (!source || record.source.recordId !== record.entityId) {
      throw new TypeError(`${base.manifestPath}: image source reference does not resolve for ${record.id}`);
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
        throw new TypeError(`${base.manifestPath}: image source reference has no matching artwork media field for ${record.id}`);
      }
      continue;
    }
    const asset = expectObject(source.record.asset, `${record.id}.source.asset`);
    if (
      record.source.fieldPath !== "asset.local_public_path" ||
      typeof asset.local_public_path !== "string" ||
      asset.local_public_path.trim() === ""
    ) {
      throw new TypeError(`${base.manifestPath}: image source reference has no matching background scene field for ${record.id}`);
    }
  }
}

export function loadImageEmbeddingShards(
  options: ImageEmbeddingLoaderOptions = {},
): LoadedImageEmbeddingShards {
  const loaded = loadBoundedImageEmbeddingManifest(options);
  const imageEmbeddingShards = loaded.manifest.shards.imageEmbeddings ?? [];

  if (imageEmbeddingShards.length === 0) {
    return {
      ...loaded,
      shardPaths: [],
      records: [],
      imageEmbeddingSidecar: undefined,
    };
  }

  const loadedShards = imageEmbeddingShards.map((shard) => loadImageEmbeddingShardRecords(loaded.manifestPath, shard));
  const shardPaths = loadedShards.map((entry) => entry.shardPath);
  const records = loadedShards.flatMap((entry) => entry.records);
  const base = loadBoundBaseManifest(loaded);
  assertImageEmbeddingBinding(loaded, imageEmbeddingShards, records, base);
  assertImageEmbeddingSourceReferences(records, base);

  return {
    ...loaded,
    shardPaths,
    records,
    imageEmbeddingSidecar: base.binding,
  };
}

async function loadImageEmbeddingShardRecordsAsync(
  manifestPath: string,
  shard: ShardInfo,
  signal: AbortSignal | undefined,
): Promise<{ shardPath: string; records: ImageEmbeddingShardRecord[] }> {
  const shardPath = resolveImageEmbeddingShardPath(manifestPath, shard);
  const maxBytes = imageEmbeddingShardByteLimit(shard, shardPath, "image embedding shard");
  const raw = await readBoundedFileAsync(shardPath, maxBytes, "image embedding shard byte limits", signal);
  return { shardPath, records: parseImageEmbeddingShardRecords(shardPath, shard, raw) };
}

async function indexBaseSourceRecordsAsync(
  baseManifestPath: string,
  shards: ShardInfo[],
  signal: AbortSignal | undefined,
): Promise<Map<string, Map<string, BaseSourceRecord>>> {
  const byShard = new Map<string, Map<string, BaseSourceRecord>>();
  for (const shard of shards) {
    if (byShard.has(shard.id)) {
      throw new TypeError(`${baseManifestPath}: duplicate base source shard id ${shard.id}`);
    }
    const shardPath = resolveImageEmbeddingShardPath(baseManifestPath, shard);
    const maxBytes = imageEmbeddingShardByteLimit(shard, shardPath, "base source shard");
    const raw = await readBoundedFileAsync(shardPath, maxBytes, "base source shard byte limits", signal);
    const records = new Map<string, BaseSourceRecord>();
    for (const entry of parseVerifiedBaseSourceRecords(shardPath, shard, raw)) {
      const recordId = readString(entry.record.id, `${baseManifestPath}:${shard.id}.id`);
      if (records.has(recordId)) {
        throw new TypeError(`${baseManifestPath}: duplicate base source record ${shard.id}:${recordId}`);
      }
      records.set(recordId, entry);
    }
    byShard.set(shard.id, records);
  }
  return byShard;
}

export async function loadImageEmbeddingShardsAsync(
  options: AsyncImageEmbeddingLoaderOptions,
): Promise<LoadedImageEmbeddingShards> {
  throwIfImageEmbeddingLoadAborted(options.signal);
  const manifestPath = resolveImageEmbeddingManifestPath(options);
  const maxPreParseBytes = resolveBoundedBytes(
    options.maxPreParseBytes,
    IMAGE_EMBEDDING_MANIFEST_MAX_BYTES,
    manifestPath,
  );
  const manifestRaw = await readBoundedFileAsync(
    manifestPath,
    maxPreParseBytes,
    "image embedding manifest pre-parse bytes",
    options.signal,
  );
  const loaded = parseBoundedImageEmbeddingManifest(manifestPath, manifestRaw);
  assertRequestedImageEmbeddingReleaseVersion(loaded, options.releaseVersion);
  const imageEmbeddingShards = loaded.manifest.shards.imageEmbeddings ?? [];

  if (imageEmbeddingShards.length === 0) {
    return {
      ...loaded,
      shardPaths: [],
      records: [],
      imageEmbeddingSidecar: undefined,
    };
  }

  const loadedShards: Array<{ shardPath: string; records: ImageEmbeddingShardRecord[] }> = [];
  for (const shard of imageEmbeddingShards) {
    loadedShards.push(await loadImageEmbeddingShardRecordsAsync(loaded.manifestPath, shard, options.signal));
  }
  const shardPaths = loadedShards.map((entry) => entry.shardPath);
  const records = loadedShards.flatMap((entry) => entry.records);
  const baseManifestPath = path.join(loaded.releaseDir, "manifest.json");
  const baseManifestRaw = await readBoundedFileAsync(
    baseManifestPath,
    IMAGE_EMBEDDING_MANIFEST_MAX_BYTES,
    "image embedding manifest pre-parse bytes",
    options.signal,
  );
  const base = parseBoundBaseManifest(loaded, baseManifestRaw);
  assertImageEmbeddingBinding(loaded, imageEmbeddingShards, records, base);
  const mediaRecords = records.some((record) => record.entityType === "artwork")
    ? await indexBaseSourceRecordsAsync(base.manifestPath, base.manifest.shards.mediaIndex, options.signal)
    : new Map<string, Map<string, BaseSourceRecord>>();
  const sceneRecords = records.some((record) => record.entityType === "background-scene")
    ? await indexBaseSourceRecordsAsync(base.manifestPath, base.manifest.shards.backgroundScenes, options.signal)
    : new Map<string, Map<string, BaseSourceRecord>>();
  assertImageEmbeddingSourceReferences(records, base, mediaRecords, sceneRecords);

  return {
    ...loaded,
    shardPaths,
    records,
    imageEmbeddingSidecar: base.binding,
  };
}

export function loadRelationshipGraphShard(
  options: RelationshipGraphLoaderOptions = {},
): LoadedRelationshipGraphShard | undefined {
  const loaded = loadReleaseManifest(options);
  const graphShards = loaded.manifest.shards.relationshipGraph;

  if (!graphShards || graphShards.length === 0) {
    return undefined;
  }

  if (graphShards.length > 1) {
    throw new Error(`Release ${loaded.releaseVersion} exposes multiple relationship graph shards; one object shard is supported.`);
  }

  const shard = graphShards[0] as ShardInfo;
  const shardPath = resolveShardPath(loaded.manifestPath, shard);
  const maxPreParseBytes = options.maxPreParseBytes ?? options.parserLimits?.maxPreParseBytes;
  const graph = parseRelationshipGraphShard(
    readJsonObject(shardPath, maxPreParseBytes),
    shardPath,
    options.parserLimits,
  );

  if (graph.releaseVersion !== loaded.releaseVersion) {
    throw new TypeError(`${shardPath}: graph releaseVersion must match release ${loaded.releaseVersion}`);
  }
  if (shard.recordCount !== graph.nodes.length) {
    throw new TypeError(`${shardPath}: ShardInfo.recordCount must equal relationship graph nodes.length`);
  }

  return {
    ...loaded,
    shardPath,
    shard,
    graph,
  };
}
