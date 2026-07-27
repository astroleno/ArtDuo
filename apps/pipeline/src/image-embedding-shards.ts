import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  parseImageEmbeddingShardRecords,
  parseReleaseManifest,
  type ImageEmbeddingEntityType,
  type ImageEmbeddingShardRecord,
  type ReleaseManifest,
  type ShardInfo,
} from "@artduo/contracts";

import {
  createTransformersImageEmbeddingProvider,
  type EmbeddedImageVector,
  type ImageEmbeddingProvider,
} from "./image-embedding-provider";
import { ImageSourceCache } from "./image-source-cache";
import {
  resolveImageEmbeddingSource,
  type ImageEmbeddingSourceInput,
  type ImageEmbeddingSourceOptions,
  type ResolveImageEmbeddingSourceResult,
  type ResolvedImageEmbeddingSource,
} from "./image-embedding-sources";

type ImageEmbeddingFailureCode =
  | "missing-source"
  | "offline-cache-miss"
  | "fetch-failed"
  | "decode-failed"
  | "provider-failed";

interface ImageEmbeddingFailure {
  entityType: ImageEmbeddingEntityType;
  entityId: string;
  code: ImageEmbeddingFailureCode;
  message: string;
}

interface PromotionAnchorSet {
  releaseVersion: string;
  anchors: Array<{ artworkId: string }>;
}

interface ArtworkMetadataRecord {
  id: string;
  presentation?: { grade?: unknown };
}

interface ArtworkMediaRecord {
  id: string;
  media?: {
    baseImageUrl?: unknown;
    imageUrlPreview?: unknown;
    imageUrlFull?: unknown;
  };
}

interface BackgroundSceneRecord {
  id: string;
  asset?: { local_public_path?: unknown };
}

interface ShardRecord<T> {
  shard: ShardInfo;
  record: T;
}

interface PendingEmbedding {
  entityType: ImageEmbeddingEntityType;
  entityId: string;
  sourceShardId: string;
  source: ResolvedImageEmbeddingSource;
}

export interface ImageEmbeddingBuildOptions {
  rootDir?: string;
  releasesRoot?: string;
  reportRoot?: string;
  candidateRoot?: string;
  sourceCacheRoot?: string;
  promotionAnchorPath?: string;
  releaseVersion?: string;
  manifestPath?: string;
  model?: string;
  modelRevision?: string;
  modelVariant?: string;
  batchSize?: number;
  refreshSourceCache?: boolean;
  offline?: boolean;
  provider?: ImageEmbeddingProvider;
  fetchImpl?: typeof fetch;
  /** Dependency injection for deterministic unit tests. */
  sourceResolver?: (
    input: ImageEmbeddingSourceInput,
    options: ImageEmbeddingSourceOptions,
  ) => Promise<ResolveImageEmbeddingSourceResult>;
}

export interface ImageEmbeddingBuildReport {
  releaseVersion: string;
  baseManifestChecksum: string;
  promotionAnchorSetChecksum: string;
  model: string;
  modelRevision: string;
  modelVariant: string;
  modelArtifactChecksum: string;
  providerVersion: string;
  dimensions: number;
  preprocessingVersion: string;
  preprocessingFingerprint: string;
  vectorPrecision: number;
  generatedAt: string;
  artwork: {
    eligible: number;
    embedded: number;
    gradeAEligible: number;
    gradeAEmbedded: number;
    criticalEligible: number;
    criticalEmbedded: number;
  };
  backgroundScene: { eligible: number; embedded: number };
  failures: ImageEmbeddingFailure[];
  gates: {
    vectorsValid: boolean;
    sourceRefsValid: boolean;
    artworkCoverage: number;
    criticalArtworkCoverage: number;
    backgroundSceneCoverage: number;
    coverageReady: boolean;
  };
  candidateShard: ShardInfo;
}

export interface ImageEmbeddingBuildResult {
  candidatePath: string;
  reportPath: string;
  records: ImageEmbeddingShardRecord[];
  report: ImageEmbeddingBuildReport;
}

function sha256(value: Uint8Array | string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function isInside(parentPath: string, childPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function resolveRootDir(rootDir?: string): string {
  return rootDir ? path.resolve(rootDir) : path.resolve(process.cwd(), "../..");
}

function resolveReleasesRoot(rootDir: string, releasesRoot?: string): string {
  return releasesRoot ? path.resolve(releasesRoot) : path.join(rootDir, "data", "releases");
}

function resolveLatestReleaseVersion(releasesRoot: string): string {
  const releaseVersion = readdirSync(releasesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .at(-1);

  if (!releaseVersion) {
    throw new Error(`No release artifacts found under ${releasesRoot}.`);
  }

  return releaseVersion;
}

function assertSafeReleaseVersion(value: string): string {
  if (
    value.trim() === "" ||
    value !== value.trim() ||
    value === "." ||
    value === ".." ||
    value.includes("/") ||
    value.includes("\\") ||
    value.includes("\0")
  ) {
    throw new TypeError("Image embedding build requires a safe release version.");
  }
  return value;
}

function readJson(pathname: string): unknown {
  return JSON.parse(readFileSync(pathname, "utf8")) as unknown;
}

function readObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function readSafeId(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "" || value.includes("\\") || value.includes("..") || value.startsWith("/")) {
    throw new TypeError(`${label} must be a safe non-empty id.`);
  }
  return value;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function resolveShardPath(releaseDir: string, shard: ShardInfo): string {
  if (!shard.url.startsWith("./") || shard.url.includes("\\")) {
    throw new Error(`Release shard ${shard.id} has an unsafe URL.`);
  }
  const resolved = path.resolve(releaseDir, shard.url);
  if (!isInside(releaseDir, resolved)) {
    throw new Error(`Release shard ${shard.id} escapes the release directory.`);
  }
  return resolved;
}

function readShardRecords<T>(releaseDir: string, shard: ShardInfo): T[] {
  const shardPath = resolveShardPath(releaseDir, shard);
  const bytes = readFileSync(shardPath);
  if (bytes.byteLength !== shard.sizeBytes) {
    throw new Error(`Release shard ${shard.id} size does not match its manifest binding.`);
  }
  const parsed = JSON.parse(bytes.toString("utf8")) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`Release shard ${shard.id} must contain an array.`);
  }
  if (parsed.length !== shard.recordCount) {
    throw new Error(`Release shard ${shard.id} record count does not match its manifest binding.`);
  }
  const canonical = JSON.stringify(parsed, null, 2);
  if (sha256(canonical) !== shard.checksum) {
    throw new Error(`Release shard ${shard.id} checksum does not match its manifest binding.`);
  }
  return parsed as T[];
}

function loadShardRecords<T>(releaseDir: string, shards: ShardInfo[]): Array<ShardRecord<T>> {
  return shards.flatMap((shard) => readShardRecords<T>(releaseDir, shard).map((record) => ({ shard, record })));
}

function indexById<T extends { id: string }>(records: Array<ShardRecord<T>>, label: string): Map<string, ShardRecord<T>> {
  const indexed = new Map<string, ShardRecord<T>>();
  for (const entry of records) {
    const id = readSafeId(entry.record.id, `${label} record id`);
    if (indexed.has(id)) {
      throw new Error(`${label} contains duplicate record id ${id}.`);
    }
    indexed.set(id, entry);
  }
  return indexed;
}

function parseArtworkMetadata(value: unknown): ArtworkMetadataRecord {
  const record = readObject(value, "Artwork metadata record");
  const presentation = record.presentation;
  const parsedPresentation = presentation && typeof presentation === "object" && !Array.isArray(presentation)
    ? { grade: (presentation as Record<string, unknown>).grade }
    : undefined;
  return { id: readSafeId(record.id, "Artwork metadata record id"), presentation: parsedPresentation };
}

function parseArtworkMedia(value: unknown): ArtworkMediaRecord {
  const record = readObject(value, "Artwork media record");
  const media = record.media;
  const parsedMedia = media && typeof media === "object" && !Array.isArray(media)
    ? {
      baseImageUrl: (media as Record<string, unknown>).baseImageUrl,
      imageUrlPreview: (media as Record<string, unknown>).imageUrlPreview,
      imageUrlFull: (media as Record<string, unknown>).imageUrlFull,
    }
    : undefined;
  return { id: readSafeId(record.id, "Artwork media record id"), media: parsedMedia };
}

function parseBackgroundScene(value: unknown): BackgroundSceneRecord {
  const record = readObject(value, "Background scene record");
  const asset = record.asset;
  const parsedAsset = asset && typeof asset === "object" && !Array.isArray(asset)
    ? { local_public_path: (asset as Record<string, unknown>).local_public_path }
    : undefined;
  return { id: readSafeId(record.id, "Background scene record id"), asset: parsedAsset };
}

function readPromotionAnchorSet(anchorPath: string, releaseVersion: string): PromotionAnchorSet {
  const anchorSet = readObject(readJson(anchorPath), "Promotion anchor set");
  if (anchorSet.releaseVersion !== releaseVersion) {
    throw new Error("Promotion anchor set does not match the selected release version.");
  }
  if (!Array.isArray(anchorSet.anchors)) {
    throw new TypeError("Promotion anchor set anchors must be an array.");
  }
  const anchors = anchorSet.anchors.map((entry, index) => {
    const anchor = readObject(entry, `Promotion anchor ${index}`);
    return { artworkId: readSafeId(anchor.artworkId, `Promotion anchor ${index} artworkId`) };
  });
  return { releaseVersion, anchors };
}

function sortedEntityOrder(left: { entityType: ImageEmbeddingEntityType; entityId: string }, right: { entityType: ImageEmbeddingEntityType; entityId: string }): number {
  if (left.entityType !== right.entityType) {
    return left.entityType.localeCompare(right.entityType);
  }
  return left.entityId.localeCompare(right.entityId);
}

function toSourceFailureCode(reason: string): ImageEmbeddingFailureCode {
  if (reason === "missing-source" || reason === "offline-cache-miss" || reason === "decode-failed") {
    return reason;
  }
  return "fetch-failed";
}

function addFailure(
  failures: ImageEmbeddingFailure[],
  entityType: ImageEmbeddingEntityType,
  entityId: string,
  code: ImageEmbeddingFailureCode,
): void {
  failures.push({
    entityType,
    entityId,
    code,
    message: code === "provider-failed"
      ? "Image embedding provider failed for this source."
      : `Image source could not be resolved (${code}).`,
  });
}

function sourceMatchesBaseRecord(
  entityType: ImageEmbeddingEntityType,
  source: ResolvedImageEmbeddingSource,
  media?: ArtworkMediaRecord,
  scene?: BackgroundSceneRecord,
): boolean {
  if (source.entityType !== entityType) {
    return false;
  }
  if (entityType === "artwork") {
    if (!media) {
      return false;
    }
    if (source.fieldPath === "media.imageUrlPreview") {
      return Boolean(readOptionalString(media.media?.imageUrlPreview));
    }
    if (source.fieldPath === "media.baseImageUrl") {
      return Boolean(readOptionalString(media.media?.baseImageUrl));
    }
    return source.fieldPath === "media.imageUrlFull" && Boolean(readOptionalString(media.media?.imageUrlFull));
  }
  return source.fieldPath === "asset.local_public_path" && Boolean(readOptionalString(scene?.asset?.local_public_path));
}

function createShardInfo(candidatePath: string, records: ImageEmbeddingShardRecord[]): ShardInfo {
  const serialized = JSON.stringify(records, null, 2);
  return {
    id: path.basename(candidatePath, path.extname(candidatePath)),
    url: `./${path.basename(candidatePath)}`,
    checksum: sha256(serialized),
    sizeBytes: Buffer.byteLength(`${serialized}\n`),
    recordCount: records.length,
  };
}

function writeJsonAtomically(candidatePath: string, value: unknown, validate?: (value: unknown) => void): void {
  const directory = path.dirname(candidatePath);
  mkdirSync(directory, { recursive: true });
  const temporaryPath = path.join(directory, `.${path.basename(candidatePath)}.${process.pid}.${Date.now()}.tmp`);
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  try {
    validate?.(JSON.parse(payload));
    writeFileSync(temporaryPath, payload);
    renameSync(temporaryPath, candidatePath);
  } catch (error) {
    try {
      unlinkSync(temporaryPath);
    } catch {
      // The temporary file was never written or has already been renamed.
    }
    throw error;
  }
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function buildRecord(
  pending: PendingEmbedding,
  embedded: EmbeddedImageVector,
  releaseVersion: string,
): ImageEmbeddingShardRecord {
  return {
    id: `${pending.entityType}:${pending.entityId}`,
    entityType: pending.entityType,
    entityId: pending.entityId,
    releaseVersion,
    model: embedded.model,
    modelRevision: embedded.modelRevision,
    modelVariant: embedded.modelVariant,
    modelArtifactChecksum: embedded.modelArtifactChecksum,
    provider: "@xenova/transformers",
    providerVersion: embedded.providerVersion,
    dimensions: embedded.dimensions,
    preprocessingVersion: embedded.preprocessingVersion,
    preprocessingFingerprint: embedded.preprocessingFingerprint,
    vectorPrecision: 8,
    source: {
      shardId: pending.sourceShardId,
      recordId: pending.entityId,
      fieldPath: pending.source.fieldPath,
      fingerprint: pending.source.fingerprint,
    },
    vector: embedded.vector,
  };
}

function assertRequestedProviderProvenance(
  options: ImageEmbeddingBuildOptions,
  provider: ImageEmbeddingProvider,
): void {
  if (
    (options.model !== undefined && options.model !== provider.model) ||
    (options.modelRevision !== undefined && options.modelRevision !== provider.modelRevision) ||
    (options.modelVariant !== undefined && options.modelVariant !== provider.modelVariant)
  ) {
    throw new Error("Requested image model flags must match the configured provider provenance.");
  }
}

export async function buildImageEmbeddingShards(
  options: ImageEmbeddingBuildOptions = {},
): Promise<ImageEmbeddingBuildResult> {
  if (options.fetchImpl !== undefined) {
    throw new TypeError("Image embedding build does not accept a custom fetch adapter because it cannot preserve verified DNS binding.");
  }
  const rootDir = resolveRootDir(options.rootDir);
  const releasesRoot = resolveReleasesRoot(rootDir, options.releasesRoot);
  const releaseVersion = assertSafeReleaseVersion(options.releaseVersion ?? resolveLatestReleaseVersion(releasesRoot));
  const manifestPath = options.manifestPath
    ? path.resolve(options.manifestPath)
    : path.join(releasesRoot, releaseVersion, "manifest.json");
  const releaseDir = path.dirname(manifestPath);
  const baseManifestBytes = readFileSync(manifestPath);
  const manifest = parseReleaseManifest(JSON.parse(baseManifestBytes.toString("utf8")), manifestPath);
  if (manifest.release.corpusVersion !== releaseVersion) {
    throw new Error("Base manifest corpus version does not match the selected release version.");
  }

  const defaultReportRoot = path.join(rootDir, "data", "curation", "reports", "image-embeddings");
  const reportRoot = options.reportRoot ? path.resolve(options.reportRoot) : defaultReportRoot;
  const reportDirectory = path.join(reportRoot, releaseVersion);
  const candidateDirectory = options.candidateRoot
    ? path.resolve(options.candidateRoot)
    : path.join(reportDirectory, "candidates");
  const candidatePath = path.join(candidateDirectory, "image-embeddings-01.json");
  const reportPath = path.join(reportDirectory, "image-embedding-report.json");
  if (isInside(releaseDir, candidatePath) || isInside(releaseDir, reportPath)) {
    throw new Error("Image embedding candidates and reports must remain outside the release directory.");
  }

  const promotionAnchorPath = options.promotionAnchorPath
    ? path.resolve(options.promotionAnchorPath)
    : path.join(defaultReportRoot, releaseVersion, "promotion-anchor-set.json");
  const promotionAnchorBytes = readFileSync(promotionAnchorPath);
  const anchorSet = readPromotionAnchorSet(promotionAnchorPath, releaseVersion);
  const provider = options.provider ?? createTransformersImageEmbeddingProvider();
  assertRequestedProviderProvenance(options, provider);

  const metadata = indexById(
    loadShardRecords<ArtworkMetadataRecord>(releaseDir, manifest.shards.metadata)
      .map((entry) => ({ ...entry, record: parseArtworkMetadata(entry.record) })),
    "Metadata shard",
  );
  const media = indexById(
    loadShardRecords<ArtworkMediaRecord>(releaseDir, manifest.shards.mediaIndex)
      .map((entry) => ({ ...entry, record: parseArtworkMedia(entry.record) })),
    "Media index shard",
  );
  const scenes = indexById(
    loadShardRecords<BackgroundSceneRecord>(releaseDir, manifest.shards.backgroundScenes)
      .map((entry) => ({ ...entry, record: parseBackgroundScene(entry.record) })),
    "Background scene shard",
  );

  const gradeAIds = new Set(
    [...metadata.values()]
      .filter((entry) => entry.record.presentation?.grade === "A")
      .map((entry) => entry.record.id),
  );
  const anchorIds = new Set(anchorSet.anchors.map((anchor) => anchor.artworkId));
  for (const artworkId of anchorIds) {
    if (!metadata.has(artworkId)) {
      throw new Error(`Promotion anchor ${artworkId} is not present in the base metadata shard.`);
    }
  }
  const criticalIds = new Set([...gradeAIds, ...anchorIds]);
  const failures: ImageEmbeddingFailure[] = [];
  const pending: PendingEmbedding[] = [];
  const sourceResolver = options.sourceResolver ?? resolveImageEmbeddingSource;
  const sourceOptions: ImageEmbeddingSourceOptions = {
    rootDir,
    cache: new ImageSourceCache(options.sourceCacheRoot ?? path.join(rootDir, ".cache", "artduo", "image-sources")),
    refreshSourceCache: options.refreshSourceCache,
    offline: options.offline,
  };

  const artworkState = {
    eligible: metadata.size,
    embedded: 0,
    gradeAEligible: gradeAIds.size,
    gradeAEmbedded: 0,
    criticalEligible: criticalIds.size,
    criticalEmbedded: 0,
  };
  const backgroundSceneState = { eligible: scenes.size, embedded: 0 };

  const entities = [
    ...[...metadata.values()].map((entry) => ({ entityType: "artwork" as const, entityId: entry.record.id, metadata: entry.record, media: media.get(entry.record.id) })),
    ...[...scenes.values()].map((entry) => ({ entityType: "background-scene" as const, entityId: entry.record.id, scene: entry.record, sceneShardId: entry.shard.id })),
  ].sort(sortedEntityOrder);

  for (const entity of entities) {
    if (entity.entityType === "artwork") {
      const mediaEntry = entity.media;
      if (!mediaEntry) {
        addFailure(failures, entity.entityType, entity.entityId, "missing-source");
        continue;
      }
      const input: ImageEmbeddingSourceInput = {
        entityType: "artwork",
        entityId: entity.entityId,
        media: {
          baseImageUrl: readOptionalString(mediaEntry.record.media?.baseImageUrl),
          imageUrlPreview: readOptionalString(mediaEntry.record.media?.imageUrlPreview),
          imageUrlFull: readOptionalString(mediaEntry.record.media?.imageUrlFull),
        },
      };
      let resolved: ResolveImageEmbeddingSourceResult;
      try {
        resolved = await sourceResolver(input, sourceOptions);
      } catch {
        addFailure(failures, entity.entityType, entity.entityId, "fetch-failed");
        continue;
      }
      if (resolved.status === "failed") {
        addFailure(failures, entity.entityType, entity.entityId, toSourceFailureCode(resolved.failure.reason));
        continue;
      }
      if (resolved.source.entityId !== entity.entityId || !sourceMatchesBaseRecord(entity.entityType, resolved.source, mediaEntry.record)) {
        throw new Error(`Artwork ${entity.entityId} resolved to an invalid base source reference.`);
      }
      pending.push({ entityType: entity.entityType, entityId: entity.entityId, sourceShardId: mediaEntry.shard.id, source: resolved.source });
      continue;
    }

    const input: ImageEmbeddingSourceInput = {
      entityType: "background-scene",
      entityId: entity.entityId,
      asset: { local_public_path: readOptionalString(entity.scene.asset?.local_public_path) },
    };
    let resolved: ResolveImageEmbeddingSourceResult;
    try {
      resolved = await sourceResolver(input, sourceOptions);
    } catch {
      addFailure(failures, entity.entityType, entity.entityId, "fetch-failed");
      continue;
    }
    if (resolved.status === "failed") {
      addFailure(failures, entity.entityType, entity.entityId, toSourceFailureCode(resolved.failure.reason));
      continue;
    }
    if (resolved.source.entityId !== entity.entityId || !sourceMatchesBaseRecord(entity.entityType, resolved.source, undefined, entity.scene)) {
      throw new Error(`Background scene ${entity.entityId} resolved to an invalid base source reference.`);
    }
    pending.push({ entityType: entity.entityType, entityId: entity.entityId, sourceShardId: entity.sceneShardId, source: resolved.source });
  }

  const batchSize = options.batchSize ?? 8;
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error("Image embedding batch size must be a positive integer.");
  }

  const records: ImageEmbeddingShardRecord[] = [];
  let providerVersion = "unavailable";
  let modelArtifactChecksum = provider.expectedModelArtifactChecksum;
  let vectorsValid = true;
  if (pending.length > 0) {
    try {
      const provenance = await provider.getModelArtifactProvenance();
      if (provenance.checksum !== provider.expectedModelArtifactChecksum) {
        throw new Error("Image provider artifact provenance does not match its pinned checksum.");
      }
      providerVersion = provenance.providerVersion;
      modelArtifactChecksum = provenance.checksum;
      for (let index = 0; index < pending.length; index += batchSize) {
        const batch = pending.slice(index, index + batchSize);
        const embedded = await provider.embedImages(batch.map((entry) => ({
          entityType: entry.entityType,
          entityId: entry.entityId,
          bytes: entry.source.bytes,
          mediaType: entry.source.mediaType,
        })));
        if (embedded.length !== batch.length) {
          throw new Error("Image embedding provider returned the wrong number of vectors.");
        }
        for (const [embeddedIndex, vector] of embedded.entries()) {
          const entry = batch[embeddedIndex];
          if (!entry || vector.model !== provider.model || vector.modelRevision !== provider.modelRevision || vector.modelVariant !== provider.modelVariant || vector.modelArtifactChecksum !== modelArtifactChecksum || vector.providerVersion !== providerVersion) {
            throw new Error("Image embedding provider returned mismatched provenance.");
          }
          records.push(buildRecord(entry, vector, releaseVersion));
        }
      }
      parseImageEmbeddingShardRecords(records);
    } catch {
      vectorsValid = false;
      records.length = 0;
      for (const entry of pending) {
        addFailure(failures, entry.entityType, entry.entityId, "provider-failed");
      }
    }
  }

  for (const record of records) {
    if (record.entityType === "artwork") {
      artworkState.embedded += 1;
      if (gradeAIds.has(record.entityId)) {
        artworkState.gradeAEmbedded += 1;
      }
      if (criticalIds.has(record.entityId)) {
        artworkState.criticalEmbedded += 1;
      }
    } else {
      backgroundSceneState.embedded += 1;
    }
  }

  const candidateShard = createShardInfo(candidatePath, records);
  writeJsonAtomically(candidatePath, records, (value) => {
    parseImageEmbeddingShardRecords(value);
  });

  const artworkCoverage = ratio(artworkState.embedded, artworkState.eligible);
  const criticalArtworkCoverage = ratio(artworkState.criticalEmbedded, artworkState.criticalEligible);
  const backgroundSceneCoverage = ratio(backgroundSceneState.embedded, backgroundSceneState.eligible);
  const sourceRefsValid = records.every((record) => {
    if (record.entityType === "artwork") {
      const mediaRecord = media.get(record.entityId);
      return mediaRecord?.shard.id === record.source.shardId && sourceMatchesBaseRecord("artwork", {
        ...record.source,
        entityType: record.entityType,
        entityId: record.entityId,
        bytes: new Uint8Array(),
        mediaType: "image/png",
        width: 1,
        height: 1,
        sourceLocatorFingerprint: record.source.fingerprint,
      }, mediaRecord.record);
    }
    const sceneRecord = scenes.get(record.entityId);
    return sceneRecord?.shard.id === record.source.shardId && sourceMatchesBaseRecord("background-scene", {
      ...record.source,
      entityType: record.entityType,
      entityId: record.entityId,
      bytes: new Uint8Array(),
      mediaType: "image/png",
      width: 1,
      height: 1,
      sourceLocatorFingerprint: record.source.fingerprint,
    }, undefined, sceneRecord?.record);
  });
  const firstRecord = records[0];
  const coverageReady = vectorsValid && sourceRefsValid && artworkState.eligible > 0 && artworkState.criticalEligible > 0 && backgroundSceneState.eligible > 0 && artworkCoverage >= 0.95 && criticalArtworkCoverage === 1 && backgroundSceneCoverage >= 0.95;
  const report: ImageEmbeddingBuildReport = {
    releaseVersion,
    baseManifestChecksum: sha256(baseManifestBytes),
    promotionAnchorSetChecksum: sha256(promotionAnchorBytes),
    model: firstRecord?.model ?? options.model ?? provider.model,
    modelRevision: firstRecord?.modelRevision ?? options.modelRevision ?? provider.modelRevision,
    modelVariant: firstRecord?.modelVariant ?? options.modelVariant ?? provider.modelVariant,
    modelArtifactChecksum: firstRecord?.modelArtifactChecksum ?? modelArtifactChecksum,
    providerVersion: firstRecord?.providerVersion ?? providerVersion,
    dimensions: firstRecord?.dimensions ?? 0,
    preprocessingVersion: firstRecord?.preprocessingVersion ?? "unavailable",
    preprocessingFingerprint: firstRecord?.preprocessingFingerprint ?? provider.expectedModelArtifactChecksum,
    vectorPrecision: firstRecord?.vectorPrecision ?? 8,
    generatedAt: new Date().toISOString(),
    artwork: artworkState,
    backgroundScene: backgroundSceneState,
    failures: failures.sort(sortedEntityOrder),
    gates: {
      vectorsValid,
      sourceRefsValid,
      artworkCoverage,
      criticalArtworkCoverage,
      backgroundSceneCoverage,
      coverageReady,
    },
    candidateShard,
  };
  writeJsonAtomically(reportPath, report);

  return { candidatePath, reportPath, records, report };
}
