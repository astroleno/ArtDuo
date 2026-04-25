import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildArtworkEmbeddingText, embedText, LOCAL_EMBEDDING_MODEL_ID } from "@artduo/corpus";
import {
  type EmbeddingShardRecord as ContractEmbeddingShardRecord,
  parseArtworkRecords,
  parseReleaseManifest,
  type ArtworkRecord,
  type ReleaseManifest,
  type ShardInfo,
} from "@artduo/contracts";

import { resolvePreferredCorpusPath } from "./release-artifact";

export interface EmbeddingBuildOptions {
  rootDir?: string;
  outputRoot?: string;
  corpusPath?: string;
  releaseVersion?: string;
  dimensions?: number;
}

export type EmbeddingShardRecord = ContractEmbeddingShardRecord;

export interface EmbeddingBuildReport {
  releaseVersion: string;
  corpusPath: string;
  manifestPath: string;
  updatedManifest: boolean;
  manifestRecordCount?: number;
  dimensions: number;
  model: string;
  recordCount: number;
  sampleArtworkIds: string[];
}

export interface EmbeddingBuildResult {
  outputDir: string;
  manifestPath: string;
  embeddingsPath: string;
  reportPath: string;
  records: EmbeddingShardRecord[];
  report: EmbeddingBuildReport;
  manifest?: ReleaseManifest;
}

function resolveRootDir(rootDir?: string): string {
  return rootDir ? path.resolve(rootDir) : path.resolve(process.cwd(), "../..");
}

function resolveOutputRoot(rootDir: string, outputRoot?: string): string {
  return outputRoot ? path.resolve(outputRoot) : path.join(rootDir, "data", "releases");
}

function resolveLatestReleaseVersion(outputRoot: string): string {
  const versions = readdirSync(outputRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const latest = versions.at(-1);

  if (!latest) {
    throw new Error(`No release artifacts found under ${outputRoot}`);
  }

  return latest;
}

function ensureDir(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true });
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function writeJsonFile(filePath: string, data: unknown): ShardInfo {
  const serialized = JSON.stringify(data, null, 2);
  writeFileSync(filePath, `${serialized}\n`);

  return {
    id: path.basename(filePath, path.extname(filePath)),
    url: `./${path.basename(filePath)}`,
    checksum: `sha256:${createHash("sha256").update(serialized).digest("hex")}`,
    sizeBytes: Buffer.byteLength(`${serialized}\n`),
    recordCount: Array.isArray(data) ? data.length : 1,
  };
}

function loadCorpusRecords(corpusPath: string): ArtworkRecord[] {
  return parseArtworkRecords(readJsonFile<unknown>(corpusPath), corpusPath);
}

function buildEmbeddingRecord(record: ArtworkRecord, dimensions: number): EmbeddingShardRecord {
  const text = buildArtworkEmbeddingText(record);
  const embedded = embedText(text, { dimensions });

  return {
    id: record.id,
    source: record.source,
    sourceArtworkId: record.sourceArtworkId,
    version: record.version,
    model: embedded.model,
    dimensions: embedded.dimensions,
    title: record.metadata.title,
    artistDisplayName: record.metadata.artistDisplayName,
    grade: record.presentation.grade,
    moodTags: record.metadata.moodTags,
    text: embedded.normalizedText,
    tokenCount: embedded.tokens.length,
    vector: embedded.vector,
  };
}

function collectManifestRecordCounts(manifest: ReleaseManifest): Array<[string, number]> {
  return [
    ["metadata", manifest.shards.metadata[0]?.recordCount ?? 0],
    ["search", manifest.shards.search[0]?.recordCount ?? 0],
    ["mediaIndex", manifest.shards.mediaIndex[0]?.recordCount ?? 0],
  ];
}

export function buildEmbeddingShards(options: EmbeddingBuildOptions = {}): EmbeddingBuildResult {
  const rootDir = resolveRootDir(options.rootDir);
  const outputRoot = resolveOutputRoot(rootDir, options.outputRoot);
  const releaseVersion = options.releaseVersion ?? resolveLatestReleaseVersion(outputRoot);
  const outputDir = path.join(outputRoot, releaseVersion);
  const manifestPath = path.join(outputDir, "manifest.json");
  const corpusPath = options.corpusPath ?? resolvePreferredCorpusPath(rootDir);
  const dimensions = options.dimensions ?? 256;

  if (!corpusPath) {
    throw new Error("Unable to resolve a curated corpus for embedding shard generation.");
  }

  ensureDir(outputDir);

  const artworks = loadCorpusRecords(corpusPath);
  const records = artworks.map((record) => buildEmbeddingRecord(record, dimensions));
  const embeddingsPath = path.join(outputDir, "embeddings-01.json");
  const reportPath = path.join(outputDir, "embedding-report.json");
  let manifest: ReleaseManifest | undefined;
  let manifestRecordCount: number | undefined;

  if (existsSync(manifestPath)) {
    const existing = parseReleaseManifest(readJsonFile<unknown>(manifestPath), manifestPath);
    const mismatchedShards = collectManifestRecordCounts(existing)
      .filter(([, recordCount]) => recordCount !== records.length)
      .map(([shardName, recordCount]) => `${shardName}=${recordCount}`);

    if (mismatchedShards.length > 0) {
      throw new Error(
        `Release manifest does not match the embedding corpus size (${records.length}). Rebuild the release artifact first: ${mismatchedShards.join(", ")}`,
      );
    }

    manifestRecordCount = existing.shards.metadata[0]?.recordCount;
    const embeddingShard = writeJsonFile(embeddingsPath, records);
    manifest = {
      ...existing,
      shards: {
        ...existing.shards,
        embeddings: [{ ...embeddingShard, id: "embeddings-01" }],
      },
    };

    parseReleaseManifest(manifest);
    writeJsonFile(manifestPath, manifest);
  } else {
    writeJsonFile(embeddingsPath, records);
  }

  const report: EmbeddingBuildReport = {
    releaseVersion,
    corpusPath,
    manifestPath,
    updatedManifest: Boolean(manifest),
    manifestRecordCount,
    dimensions,
    model: LOCAL_EMBEDDING_MODEL_ID,
    recordCount: records.length,
    sampleArtworkIds: records.slice(0, 5).map((record) => record.id),
  };

  writeJsonFile(reportPath, report);

  return {
    outputDir,
    manifestPath,
    embeddingsPath,
    reportPath,
    records,
    report,
    manifest,
  };
}
