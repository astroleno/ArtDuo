import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { cosineSimilarity } from "@artduo/corpus";
import {
  parseImageEmbeddingShardRecords,
  type ImageEmbeddingEntityType,
  type ImageEmbeddingShardRecord,
} from "@artduo/contracts";

import { readImageEmbeddingDebugOptions } from "./cli";

export interface ImageEmbeddingDebugOptions {
  rootDir?: string;
  releaseVersion?: string;
  candidateShardPath?: string;
  entityType?: ImageEmbeddingEntityType;
  entityId?: string;
  limit?: number;
  outputPath?: string;
}

export interface ImageEmbeddingDebugNeighbor {
  entityType: ImageEmbeddingEntityType;
  entityId: string;
  cosineScore: number;
  model: string;
  modelRevision: string;
  modelVariant: string;
  sourceFingerprint: string;
}

export interface ImageEmbeddingDebugReport {
  releaseVersion: string;
  query: {
    entityType: ImageEmbeddingEntityType;
    entityId: string;
    model: string;
    modelRevision: string;
    modelVariant: string;
  };
  neighbors: ImageEmbeddingDebugNeighbor[];
}

function resolveRootDir(rootDir?: string): string {
  return rootDir ? path.resolve(rootDir) : path.resolve(process.cwd(), "../..");
}

function resolveCandidatePath(options: ImageEmbeddingDebugOptions): string {
  if (options.candidateShardPath) {
    return path.resolve(options.candidateShardPath);
  }
  if (!options.releaseVersion) {
    throw new TypeError("Image embedding debug requires --candidate-shard or --release-version.");
  }
  return path.join(
    resolveRootDir(options.rootDir),
    "data",
    "curation",
    "reports",
    "image-embeddings",
    options.releaseVersion,
    "candidates",
    "image-embeddings-01.json",
  );
}

function comparable(left: ImageEmbeddingShardRecord, right: ImageEmbeddingShardRecord): boolean {
  return left.dimensions === right.dimensions
    && left.model === right.model
    && left.modelRevision === right.modelRevision
    && left.modelVariant === right.modelVariant
    && left.modelArtifactChecksum === right.modelArtifactChecksum
    && left.preprocessingFingerprint === right.preprocessingFingerprint;
}

function normalizedLimit(value: number | undefined): number {
  if (value === undefined) {
    return 10;
  }
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new TypeError("Image embedding debug limit must be an integer between 1 and 100.");
  }
  return value;
}

export function buildImageEmbeddingDebugReport(options: ImageEmbeddingDebugOptions): ImageEmbeddingDebugReport {
  if (!options.entityType || !options.entityId) {
    throw new TypeError("Image embedding debug requires --entity-type and --entity-id.");
  }
  const candidatePath = resolveCandidatePath(options);
  const records = parseImageEmbeddingShardRecords(JSON.parse(readFileSync(candidatePath, "utf8")) as unknown, candidatePath);
  const query = records.find((record) => record.entityType === options.entityType && record.entityId === options.entityId);
  if (!query) {
    throw new TypeError(`Image embedding debug could not find ${options.entityType}:${options.entityId}.`);
  }
  if (options.releaseVersion && query.releaseVersion !== options.releaseVersion) {
    throw new TypeError("Image embedding debug query record does not match --release-version.");
  }
  const neighbors = records
    .filter((record) => record.entityType === query.entityType && record.entityId !== query.entityId && comparable(query, record))
    .map((record) => ({
      entityType: record.entityType,
      entityId: record.entityId,
      cosineScore: cosineSimilarity(query.vector, record.vector),
      model: record.model,
      modelRevision: record.modelRevision,
      modelVariant: record.modelVariant,
      sourceFingerprint: record.source.fingerprint,
    }))
    .sort((left, right) => right.cosineScore - left.cosineScore || left.entityId.localeCompare(right.entityId))
    .slice(0, normalizedLimit(options.limit));

  return {
    releaseVersion: query.releaseVersion,
    query: {
      entityType: query.entityType,
      entityId: query.entityId,
      model: query.model,
      modelRevision: query.modelRevision,
      modelVariant: query.modelVariant,
    },
    neighbors,
  };
}

async function main(): Promise<void> {
  const options = readImageEmbeddingDebugOptions();
  const report = buildImageEmbeddingDebugReport(options);
  if (options.outputPath) {
    mkdirSync(path.dirname(options.outputPath), { recursive: true });
    writeFileSync(options.outputPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1]?.endsWith("debug-image-embedding.ts")) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
