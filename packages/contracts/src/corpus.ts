import { expectObject, parseArray, readNumber, readObject, readString } from "./internal/validation";

export interface SourceVersions {
  corpusVersion: string;
  backgroundCatalogVersion: string;
  contractsVersion: string;
}

export interface ShardInfo {
  id: string;
  url: string;
  checksum: string;
  sizeBytes: number;
  recordCount: number;
}

export interface ReleaseManifest {
  release: SourceVersions & {
    createdAt: string;
  };
  shards: {
    metadata: ShardInfo[];
    search: ShardInfo[];
    mediaIndex: ShardInfo[];
    backgroundScenes: ShardInfo[];
    embeddings?: ShardInfo[];
  };
}

function parseShardInfo(value: unknown, path: string): ShardInfo {
  const shard = expectObject(value, path);

  return {
    id: readString(shard, "id", path),
    url: readString(shard, "url", path),
    checksum: readString(shard, "checksum", path),
    sizeBytes: readNumber(shard, "sizeBytes", path),
    recordCount: readNumber(shard, "recordCount", path),
  };
}

function parseSourceVersions(value: unknown, path: string): ReleaseManifest["release"] {
  const release = expectObject(value, path);

  return {
    corpusVersion: readString(release, "corpusVersion", path),
    backgroundCatalogVersion: readString(release, "backgroundCatalogVersion", path),
    contractsVersion: readString(release, "contractsVersion", path),
    createdAt: readString(release, "createdAt", path),
  };
}

export function parseReleaseManifest(value: unknown, path = "ReleaseManifest"): ReleaseManifest {
  const manifest = expectObject(value, path);
  const shards = readObject(manifest, "shards", path);
  const embeddings = (shards as { embeddings?: unknown }).embeddings;

  return {
    release: parseSourceVersions(readObject(manifest, "release", path), `${path}.release`),
    shards: {
      metadata: parseArray(shards.metadata, (entry, entryPath) => parseShardInfo(entry, entryPath), `${path}.shards.metadata`),
      search: parseArray(shards.search, (entry, entryPath) => parseShardInfo(entry, entryPath), `${path}.shards.search`),
      mediaIndex: parseArray(shards.mediaIndex, (entry, entryPath) => parseShardInfo(entry, entryPath), `${path}.shards.mediaIndex`),
      backgroundScenes: parseArray(
        shards.backgroundScenes,
        (entry, entryPath) => parseShardInfo(entry, entryPath),
        `${path}.shards.backgroundScenes`,
      ),
      embeddings: embeddings
        ? parseArray(embeddings, (entry, entryPath) => parseShardInfo(entry, entryPath), `${path}.shards.embeddings`)
        : undefined,
    },
  };
}
