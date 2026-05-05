import type { ReleaseManifest, ShardInfo } from "@artduo/contracts";

export type ReleaseShardKind = keyof ReleaseManifest["shards"];

export interface PrefetchShard {
  kind: ReleaseShardKind;
  shard: ShardInfo;
}

export interface PrefetchOptions {
  alreadyCachedIds?: Set<string>;
  limit?: number;
  includeEmbeddings?: boolean;
  fetchShard: (shard: ShardInfo, kind: ReleaseShardKind) => Promise<void> | void;
}

export interface PrefetchResult {
  prefetchedIds: string[];
  skippedIds: string[];
  failed: Array<{ id: string; message: string }>;
}

export interface MediaVersionRecord {
  id: string;
  media?: {
    mediaVersion?: string;
    sourceAssetFingerprint?: string;
  };
}

function releaseShards(manifest: ReleaseManifest, includeEmbeddings: boolean): PrefetchShard[] {
  const ordered: PrefetchShard[] = [
    ...manifest.shards.metadata.map((shard) => ({ kind: "metadata" as const, shard })),
    ...manifest.shards.search.map((shard) => ({ kind: "search" as const, shard })),
    ...manifest.shards.mediaIndex.map((shard) => ({ kind: "mediaIndex" as const, shard })),
    ...manifest.shards.backgroundScenes.map((shard) => ({ kind: "backgroundScenes" as const, shard })),
  ];

  if (includeEmbeddings) {
    ordered.push(...(manifest.shards.embeddings ?? []).map((shard) => ({ kind: "embeddings" as const, shard })));
  }

  return ordered;
}

export async function prefetchReleaseShards(
  manifest: ReleaseManifest,
  options: PrefetchOptions,
): Promise<PrefetchResult> {
  const cached = options.alreadyCachedIds ?? new Set<string>();
  const limit = options.limit ?? Number.POSITIVE_INFINITY;
  const skippedIds: string[] = [];
  const prefetchedIds: string[] = [];
  const failed: PrefetchResult["failed"] = [];

  for (const { kind, shard } of releaseShards(manifest, options.includeEmbeddings ?? true)) {
    if (cached.has(shard.id)) {
      skippedIds.push(shard.id);
      continue;
    }

    if (prefetchedIds.length >= limit) {
      break;
    }

    try {
      await options.fetchShard(shard, kind);
      prefetchedIds.push(shard.id);
    } catch (error) {
      failed.push({
        id: shard.id,
        message: error instanceof Error ? error.message : "Unknown prefetch failure",
      });
    }
  }

  return { prefetchedIds, skippedIds, failed };
}

export function validateReleaseMediaVersionInfo(records: MediaVersionRecord[]): void {
  const missingIds = records
    .filter((record) => !record.media?.mediaVersion && !record.media?.sourceAssetFingerprint)
    .map((record) => record.id);

  if (missingIds.length > 0) {
    throw new Error(`missing mediaVersion or sourceAssetFingerprint: ${missingIds.join(", ")}`);
  }
}
