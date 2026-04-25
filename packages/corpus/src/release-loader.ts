import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { parseEmbeddingShardRecord, parseEmbeddingShardRecords, parseReleaseManifest, type EmbeddingShardRecord, type ReleaseManifest, type ShardInfo } from "@artduo/contracts";

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

function resolveRootDir(rootDir?: string): string {
  return rootDir ? path.resolve(rootDir) : path.resolve(process.cwd(), "../..");
}

function resolveReleasesRoot(rootDir: string, releasesRoot?: string): string {
  return releasesRoot ? path.resolve(releasesRoot) : path.join(rootDir, "data", "releases");
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
