import { expectObject, parseArray, readLiteral, readNumber, readString } from "./internal/validation";

export const IMAGE_EMBEDDING_ENTITY_TYPES = ["artwork", "background-scene"] as const;
export type ImageEmbeddingEntityType = (typeof IMAGE_EMBEDDING_ENTITY_TYPES)[number];
export const MAX_IMAGE_EMBEDDING_SHARD_RECORDS = 1_000;

export interface ImageEmbeddingSourceRef {
  shardId: string;
  recordId: string;
  fieldPath: string;
  fingerprint: string;
}

export interface ImageEmbeddingShardRecord {
  id: string;
  entityType: ImageEmbeddingEntityType;
  entityId: string;
  releaseVersion: string;
  model: string;
  modelRevision: string;
  modelVariant: string;
  modelArtifactChecksum: string;
  provider: "@xenova/transformers";
  providerVersion: string;
  dimensions: number;
  preprocessingVersion: string;
  preprocessingFingerprint: string;
  vectorPrecision: number;
  source: ImageEmbeddingSourceRef;
  vector: number[];
}

const SHA256_CHECKSUM = /^sha256:[a-f0-9]{64}$/iu;
const ARTWORK_SOURCE_FIELD_PATHS = new Set([
  "media.imageUrlPreview",
  "media.baseImageUrl",
  "media.imageUrlFull",
]);
const BACKGROUND_SCENE_SOURCE_FIELD_PATHS = new Set(["asset.local_public_path"]);
const CONSISTENT_SHARD_FIELDS = [
  "releaseVersion",
  "model",
  "modelRevision",
  "modelVariant",
  "modelArtifactChecksum",
  "provider",
  "providerVersion",
  "dimensions",
  "preprocessingVersion",
  "preprocessingFingerprint",
  "vectorPrecision",
] as const;

function fail(path: string, message: string): never {
  throw new TypeError(`${path}: ${message}`);
}

function parseChecksum(value: unknown, path: string): string {
  if (typeof value !== "string" || !SHA256_CHECKSUM.test(value)) {
    fail(path, "expected sha256 checksum");
  }

  return value;
}

function assertSafeReference(value: string, path: string): string {
  const lower = value.toLowerCase();
  const isAbsoluteLocalPath = /^(?:\/|~\/|[a-z]:[\\/])/iu.test(value);

  if (
    lower.includes("file://") ||
    value.includes("\\") ||
    value.includes("..") ||
    isAbsoluteLocalPath ||
    /(?:^|\/)(?:users|home|private|var|tmp)(?:\/|$)/iu.test(value)
  ) {
    fail(path, "must not contain local paths or traversal");
  }

  return value;
}

function parseImageVector(value: unknown, dimensions: number, path: string): number[] {
  if (!Number.isInteger(dimensions) || dimensions <= 0 || dimensions > 4096) {
    fail(path, "dimensions must be an integer between 1 and 4096");
  }

  const vector = parseArray(
    value,
    (entry, entryPath) => readNumber({ value: entry }, "value", entryPath),
    path,
  );

  if (vector.length !== dimensions) {
    fail(path, `expected ${dimensions} values, received ${vector.length}`);
  }
  if (vector.some((entry) => !Number.isFinite(entry))) {
    fail(path, "vector values must be finite");
  }

  const norm = Math.hypot(...vector);
  if (!Number.isFinite(norm) || Math.abs(norm - 1) > 1e-4) {
    fail(path, "vector must be L2 normalized");
  }

  return vector;
}

function parseSourceRef(value: unknown, entityType: ImageEmbeddingEntityType, path: string): ImageEmbeddingSourceRef {
  const source = expectObject(value, path);
  const fieldPath = assertSafeReference(readString(source, "fieldPath", path), `${path}.fieldPath`);
  const allowedFieldPaths = entityType === "artwork"
    ? ARTWORK_SOURCE_FIELD_PATHS
    : BACKGROUND_SCENE_SOURCE_FIELD_PATHS;

  if (!allowedFieldPaths.has(fieldPath)) {
    fail(`${path}.fieldPath`, `not allowed for ${entityType}`);
  }

  return {
    shardId: assertSafeReference(readString(source, "shardId", path), `${path}.shardId`),
    recordId: assertSafeReference(readString(source, "recordId", path), `${path}.recordId`),
    fieldPath,
    fingerprint: parseChecksum(source.fingerprint, `${path}.fingerprint`),
  };
}

export function parseImageEmbeddingShardRecord(
  value: unknown,
  path = "ImageEmbeddingShardRecord",
): ImageEmbeddingShardRecord {
  const record = expectObject(value, path);
  const entityType = readLiteral(record, "entityType", IMAGE_EMBEDDING_ENTITY_TYPES, path);
  const entityId = assertSafeReference(readString(record, "entityId", path), `${path}.entityId`);
  const id = readString(record, "id", path);

  if (id !== `${entityType}:${entityId}`) {
    fail(`${path}.id`, `must equal ${entityType}:${entityId}`);
  }

  const dimensions = readNumber(record, "dimensions", path);
  const vectorPrecision = readNumber(record, "vectorPrecision", path);
  if (!Number.isInteger(vectorPrecision) || vectorPrecision !== 8) {
    fail(`${path}.vectorPrecision`, "must be the fixed value 8");
  }

  return {
    id,
    entityType,
    entityId,
    releaseVersion: readString(record, "releaseVersion", path),
    model: readString(record, "model", path),
    modelRevision: readString(record, "modelRevision", path),
    modelVariant: readString(record, "modelVariant", path),
    modelArtifactChecksum: parseChecksum(record.modelArtifactChecksum, `${path}.modelArtifactChecksum`),
    provider: readLiteral(record, "provider", ["@xenova/transformers"] as const, path),
    providerVersion: readString(record, "providerVersion", path),
    dimensions,
    preprocessingVersion: readString(record, "preprocessingVersion", path),
    preprocessingFingerprint: parseChecksum(record.preprocessingFingerprint, `${path}.preprocessingFingerprint`),
    vectorPrecision,
    source: parseSourceRef(record.source, entityType, `${path}.source`),
    vector: parseImageVector(record.vector, dimensions, `${path}.vector`),
  };
}

export function parseImageEmbeddingShardRecords(
  value: unknown,
  path = "ImageEmbeddingShardRecord[]",
): ImageEmbeddingShardRecord[] {
  const records = parseArray(value, (entry, entryPath) => parseImageEmbeddingShardRecord(entry, entryPath), path);
  if (records.length > MAX_IMAGE_EMBEDDING_SHARD_RECORDS) {
    fail(path, `must contain at most ${MAX_IMAGE_EMBEDDING_SHARD_RECORDS} records`);
  }
  const ids = new Set<string>();

  for (const record of records) {
    if (ids.has(record.id)) {
      fail(path, `duplicate id ${record.id}`);
    }
    ids.add(record.id);
  }

  const first = records[0];
  if (!first) {
    return records;
  }

  for (const record of records.slice(1)) {
    for (const field of CONSISTENT_SHARD_FIELDS) {
      if (record[field] !== first[field]) {
        fail(path, `${field} must be consistent within one shard`);
      }
    }
  }

  return records;
}
