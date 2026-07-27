import {
  parseImageEmbeddingShardRecords,
  type ImageEmbeddingEntityType,
  type ImageEmbeddingShardRecord,
} from "@artduo/contracts";

import { cosineSimilarity, searchVectorIndex } from "./vector-search";

export interface ImageEmbeddingIndex {
  model: string;
  modelRevision: string;
  modelArtifactChecksum: string;
  preprocessingFingerprint: string;
  dimensions: number;
  byId: Map<string, ImageEmbeddingShardRecord>;
  artworkRecords: ImageEmbeddingShardRecord[];
  backgroundSceneRecords: ImageEmbeddingShardRecord[];
}

export interface ImageEmbeddingDiagnosticMeasurement {
  payloadBytes: number;
  recordCount: number;
  dimensions: number;
  parseDurationMs: number;
  indexBuildDurationMs: number;
  estimatedHeapBytes: number;
  queryCount: number;
  queryP50Ms: number;
  queryP95Ms: number;
}

export interface ImageEmbeddingPerformanceAssessment {
  passed: boolean;
  violations: string[];
}

export const IMAGE_EMBEDDING_NODE_PERFORMANCE_BUDGET = {
  maxPayloadBytes: 4 * 1024 * 1024,
  maxParseAndIndexMs: 150,
  maxEstimatedHeapBytes: 16 * 1024 * 1024,
  maxQueryP95Ms: 150,
} as const;

export const IMAGE_EMBEDDING_BROWSER_DIAGNOSTIC_BUDGET = {
  maxPayloadBytes: 4 * 1024 * 1024,
  maxParseAndIndexMs: 400,
  maxQueryP95Ms: 400,
} as const;

const DIAGNOSTIC_ARTWORK_COUNT = 221;
const DIAGNOSTIC_BACKGROUND_SCENE_COUNT = 50;
const DIAGNOSTIC_DIMENSIONS = 512;
const DIAGNOSTIC_CHECKSUM = `sha256:${"a".repeat(64)}`;
const DIAGNOSTIC_PREPROCESSING_FINGERPRINT = `sha256:${"b".repeat(64)}`;
const DIAGNOSTIC_SOURCE_FINGERPRINT = `sha256:${"c".repeat(64)}`;

function assertUnitVector(record: ImageEmbeddingShardRecord): void {
  if (record.vector.length !== record.dimensions) {
    throw new TypeError(`Image embedding ${record.id} has inconsistent dimensions.`);
  }
  const norm = Math.hypot(...record.vector);
  if (!Number.isFinite(norm) || Math.abs(norm - 1) > 1e-4) {
    throw new TypeError(`Image embedding ${record.id} must be unit normalized.`);
  }
}

export function createImageEmbeddingIndex(
  records: ImageEmbeddingShardRecord[],
): ImageEmbeddingIndex {
  const first = records[0];
  if (!first) {
    throw new TypeError("Image embedding index requires at least one record.");
  }
  const byId = new Map<string, ImageEmbeddingShardRecord>();
  const artworkRecords: ImageEmbeddingShardRecord[] = [];
  const backgroundSceneRecords: ImageEmbeddingShardRecord[] = [];

  for (const record of records) {
    if (byId.has(record.id)) {
      throw new TypeError(`Image embedding index contains duplicate id ${record.id}.`);
    }
    if (
      record.model !== first.model ||
      record.modelRevision !== first.modelRevision ||
      record.modelArtifactChecksum !== first.modelArtifactChecksum ||
      record.preprocessingFingerprint !== first.preprocessingFingerprint ||
      record.dimensions !== first.dimensions
    ) {
      throw new TypeError(`Image embedding index contains incompatible record ${record.id}.`);
    }
    assertUnitVector(record);
    byId.set(record.id, record);
    if (record.entityType === "artwork") {
      artworkRecords.push(record);
    } else {
      backgroundSceneRecords.push(record);
    }
  }

  return {
    model: first.model,
    modelRevision: first.modelRevision,
    modelArtifactChecksum: first.modelArtifactChecksum,
    preprocessingFingerprint: first.preprocessingFingerprint,
    dimensions: first.dimensions,
    byId,
    artworkRecords,
    backgroundSceneRecords,
  };
}

function recordId(entityType: ImageEmbeddingEntityType, entityId: string): string {
  return `${entityType}:${entityId}`;
}

export function searchVisualNeighbors(
  index: ImageEmbeddingIndex,
  input: {
    entityType: ImageEmbeddingEntityType;
    entityId: string;
    limit?: number;
  },
): Array<{ entityId: string; score: number }> {
  const source = index.byId.get(recordId(input.entityType, input.entityId));
  if (!source) {
    throw new TypeError(`Image embedding is unavailable for ${input.entityType}:${input.entityId}.`);
  }
  const candidates = input.entityType === "artwork"
    ? index.artworkRecords
    : index.backgroundSceneRecords;
  return searchVectorIndex(source.vector, candidates.filter((record) => record.id !== source.id), { limit: input.limit })
    .map((entry) => ({ entityId: entry.item.entityId, score: entry.score }));
}

export function scoreArtworkBackgroundCompatibility(
  index: ImageEmbeddingIndex,
  artworkId: string,
  backgroundSceneId: string,
): number | undefined {
  const artwork = index.byId.get(recordId("artwork", artworkId));
  const backgroundScene = index.byId.get(recordId("background-scene", backgroundSceneId));
  if (!artwork || !backgroundScene) {
    return undefined;
  }
  return cosineSimilarity(artwork.vector, backgroundScene.vector);
}

function createDiagnosticVector(recordIndex: number): number[] {
  const values = Array.from({ length: DIAGNOSTIC_DIMENSIONS }, (_, dimensionIndex) => {
    const phase = (recordIndex + 1) * (dimensionIndex + 17);
    return 3 + Math.sin(phase * 0.17) + Math.cos(phase * 0.11);
  });
  const norm = Math.hypot(...values);
  return values.map((value) => Number((value / norm).toFixed(8)));
}

export function createImageEmbeddingDiagnosticPayload(): string {
  const recordCount = DIAGNOSTIC_ARTWORK_COUNT + DIAGNOSTIC_BACKGROUND_SCENE_COUNT;
  const records: ImageEmbeddingShardRecord[] = Array.from({ length: recordCount }, (_, index) => {
    const entityType: ImageEmbeddingEntityType = index < DIAGNOSTIC_ARTWORK_COUNT ? "artwork" : "background-scene";
    const entityId = entityType === "artwork"
      ? `artwork-${String(index + 1).padStart(3, "0")}`
      : `scene-${String(index - DIAGNOSTIC_ARTWORK_COUNT + 1).padStart(3, "0")}`;
    return {
      id: `${entityType}:${entityId}`,
      entityType,
      entityId,
      releaseVersion: "image-embedding-diagnostic",
      model: "diagnostic-image-model",
      modelRevision: "diagnostic-revision",
      modelVariant: "quantized",
      modelArtifactChecksum: DIAGNOSTIC_CHECKSUM,
      provider: "@xenova/transformers",
      providerVersion: "2.17.2",
      dimensions: DIAGNOSTIC_DIMENSIONS,
      preprocessingVersion: "diagnostic-preprocessing.v1",
      preprocessingFingerprint: DIAGNOSTIC_PREPROCESSING_FINGERPRINT,
      vectorPrecision: 8,
      source: {
        shardId: entityType === "artwork" ? "media-01" : "background-scenes-01",
        recordId: entityId,
        fieldPath: entityType === "artwork" ? "media.imageUrlPreview" : "asset.local_public_path",
        fingerprint: DIAGNOSTIC_SOURCE_FINGERPRINT,
      },
      vector: createDiagnosticVector(index),
    };
  });
  return JSON.stringify(records);
}

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1));
  return sorted[index] ?? 0;
}

function estimateImageEmbeddingHeapBytes(payloadBytes: number, records: ImageEmbeddingShardRecord[]): number {
  return payloadBytes + records.reduce((total, record) => {
    const stringBytes = (
      record.id.length
      + record.entityId.length
      + record.source.shardId.length
      + record.source.recordId.length
      + record.source.fieldPath.length
    ) * 2;
    return total + record.vector.length * Float64Array.BYTES_PER_ELEMENT + stringBytes + 256;
  }, 0);
}

function defaultNow(): number {
  return globalThis.performance?.now() ?? Date.now();
}

export function measureImageEmbeddingDiagnostic(
  payload: string,
  options: {
    now?: () => number;
  } = {},
): ImageEmbeddingDiagnosticMeasurement {
  const now = options.now ?? defaultNow;
  const payloadBytes = new TextEncoder().encode(payload).byteLength;
  const parseStartedAt = now();
  const records = parseImageEmbeddingShardRecords(JSON.parse(payload) as unknown, "image-embedding-diagnostic");
  const parseDurationMs = Math.max(0, now() - parseStartedAt);
  const indexStartedAt = now();
  const index = createImageEmbeddingIndex(records);
  const indexBuildDurationMs = Math.max(0, now() - indexStartedAt);

  if (index.artworkRecords.length === 0 || index.backgroundSceneRecords.length === 0) {
    throw new TypeError("Image embedding diagnostic requires artwork and background-scene records.");
  }

  const queryDurations: number[] = [];
  for (let queryIndex = 0; queryIndex < 50; queryIndex += 1) {
    const artwork = index.artworkRecords[queryIndex % index.artworkRecords.length];
    const backgroundScene = index.backgroundSceneRecords[queryIndex % index.backgroundSceneRecords.length];
    if (!artwork || !backgroundScene) {
      throw new TypeError("Image embedding diagnostic fixture is incomplete.");
    }
    const queryStartedAt = now();
    searchVisualNeighbors(index, { entityType: "artwork", entityId: artwork.entityId, limit: 10 });
    scoreArtworkBackgroundCompatibility(index, artwork.entityId, backgroundScene.entityId);
    queryDurations.push(Math.max(0, now() - queryStartedAt));
  }

  return {
    payloadBytes,
    recordCount: records.length,
    dimensions: index.dimensions,
    parseDurationMs,
    indexBuildDurationMs,
    estimatedHeapBytes: estimateImageEmbeddingHeapBytes(payloadBytes, records),
    queryCount: queryDurations.length,
    queryP50Ms: percentile(queryDurations, 50),
    queryP95Ms: percentile(queryDurations, 95),
  };
}

export function assessImageEmbeddingPerformanceBudget(
  measurement: ImageEmbeddingDiagnosticMeasurement,
  runtime: "server" | "browser-diagnostic",
): ImageEmbeddingPerformanceAssessment {
  const budget = runtime === "server"
    ? IMAGE_EMBEDDING_NODE_PERFORMANCE_BUDGET
    : IMAGE_EMBEDDING_BROWSER_DIAGNOSTIC_BUDGET;
  const violations: string[] = [];
  if (measurement.payloadBytes > budget.maxPayloadBytes) {
    violations.push(`payload exceeds ${budget.maxPayloadBytes} bytes`);
  }
  if (measurement.parseDurationMs + measurement.indexBuildDurationMs > budget.maxParseAndIndexMs) {
    violations.push(`parse/index exceeds ${budget.maxParseAndIndexMs} ms`);
  }
  if (measurement.queryP95Ms > budget.maxQueryP95Ms) {
    violations.push(`query p95 exceeds ${budget.maxQueryP95Ms} ms`);
  }
  if (
    runtime === "server"
    && measurement.estimatedHeapBytes > IMAGE_EMBEDDING_NODE_PERFORMANCE_BUDGET.maxEstimatedHeapBytes
  ) {
    violations.push(`estimated heap exceeds ${IMAGE_EMBEDDING_NODE_PERFORMANCE_BUDGET.maxEstimatedHeapBytes} bytes`);
  }
  return { passed: violations.length === 0, violations };
}
