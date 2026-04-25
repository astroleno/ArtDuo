import path from "node:path";

import type { CandidatePreviewOptions } from "./candidate-preview";
import type { ConfirmedMetadataBackfillOptions } from "./confirmed-metadata-backfill";
import type { EmbeddingRuntimeCliOptions } from "./embedding-runtime";
import type { EmbeddingBuildOptions } from "./embedding-shards";
import type { MetadataBackfillPreviewOptions } from "./metadata-backfill-preview";
import type { QuantityPreviewOptions } from "./quantity-preview";
import type { ReleaseBuildOptions } from "./release-artifact";
import type { ReleaseReadyBuildOptions } from "./release-ready-corpus";
import type { VectorBenchmarkCliOptions } from "./run-vector-benchmark";
import type { VectorProviderBenchmarkCliOptions } from "./run-vector-provider-benchmark";
import type { VectorRetrievalDebugCliOptions } from "./debug-vector-retrieval";

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

function readBooleanFlag(name: string): boolean | undefined {
  const value = readFlag(name);

  if (value === undefined) {
    return undefined;
  }

  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(value.toLowerCase())) {
    return false;
  }

  return undefined;
}

export function readEmbeddingRuntimeCliOptions(): EmbeddingRuntimeCliOptions {
  const rootDir = readFlag("--root-dir");
  const embeddingProviderMode = readFlag("--embedding-provider");
  const embeddingEndpoint = readFlag("--embedding-endpoint");
  const embeddingModel = readFlag("--embedding-model");
  const embeddingApiKey = readFlag("--embedding-api-key");
  const embeddingApiKeySlotValue = readFlag("--embedding-api-key-slot");
  const embeddingTimeoutMsValue = readFlag("--embedding-timeout-ms");
  const embeddingApiKeySlot = embeddingApiKeySlotValue ? Number.parseInt(embeddingApiKeySlotValue, 10) : undefined;
  const embeddingTimeoutMs = embeddingTimeoutMsValue ? Number.parseInt(embeddingTimeoutMsValue, 10) : undefined;
  const embeddingAllowFallback = readBooleanFlag("--embedding-allow-fallback");

  return {
    rootDir: rootDir ? path.resolve(rootDir) : undefined,
    embeddingProviderMode,
    embeddingEndpoint,
    embeddingModel,
    embeddingApiKey,
    embeddingApiKeySlot: Number.isFinite(embeddingApiKeySlot) ? embeddingApiKeySlot : undefined,
    embeddingTimeoutMs: Number.isFinite(embeddingTimeoutMs) ? embeddingTimeoutMs : undefined,
    embeddingAllowFallback,
  };
}

export function readReleaseBuildOptions(): ReleaseBuildOptions {
  const rootDir = readFlag("--root-dir");
  const outputRoot = readFlag("--output-root");
  const corpusPath = readFlag("--corpus-path");
  const corpusVersion = readFlag("--release-version");
  const backgroundCatalogVersion = readFlag("--background-version");
  const contractsVersion = readFlag("--contracts-version");
  const limitValue = readFlag("--limit");
  const limit = limitValue ? Number.parseInt(limitValue, 10) : undefined;

  return {
    rootDir: rootDir ? path.resolve(rootDir) : undefined,
    outputRoot: outputRoot ? path.resolve(outputRoot) : undefined,
    corpusPath: corpusPath ? path.resolve(corpusPath) : undefined,
    corpusVersion,
    backgroundCatalogVersion,
    contractsVersion,
    limit: Number.isFinite(limit) ? limit : undefined,
  };
}

export function readEmbeddingBuildOptions(): EmbeddingBuildOptions {
  const rootDir = readFlag("--root-dir");
  const outputRoot = readFlag("--output-root");
  const corpusPath = readFlag("--corpus-path");
  const releaseVersion = readFlag("--release-version");
  const dimensionsValue = readFlag("--dimensions");
  const dimensions = dimensionsValue ? Number.parseInt(dimensionsValue, 10) : undefined;

  return {
    rootDir: rootDir ? path.resolve(rootDir) : undefined,
    outputRoot: outputRoot ? path.resolve(outputRoot) : undefined,
    corpusPath: corpusPath ? path.resolve(corpusPath) : undefined,
    releaseVersion,
    dimensions: Number.isFinite(dimensions) ? dimensions : undefined,
  };
}

export function readVectorRetrievalDebugOptions(): VectorRetrievalDebugCliOptions {
  const rootDir = readFlag("--root-dir");
  const releasesRoot = readFlag("--releases-root");
  const releaseVersion = readFlag("--release-version");
  const manifestPath = readFlag("--manifest");
  const query = readFlag("--query");
  const outputPath = readFlag("--output");
  const limitValue = readFlag("--limit");
  const limit = limitValue ? Number.parseInt(limitValue, 10) : undefined;

  return {
    rootDir: rootDir ? path.resolve(rootDir) : undefined,
    releasesRoot: releasesRoot ? path.resolve(releasesRoot) : undefined,
    releaseVersion,
    manifestPath: manifestPath ? path.resolve(manifestPath) : undefined,
    query,
    outputPath: outputPath ? path.resolve(outputPath) : undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
  };
}

export function readVectorBenchmarkOptions(): VectorBenchmarkCliOptions {
  const rootDir = readFlag("--root-dir");
  const releasesRoot = readFlag("--releases-root");
  const releaseVersion = readFlag("--release-version");
  const manifestPath = readFlag("--manifest");
  const promptsPath = readFlag("--prompts");
  const outputPath = readFlag("--output");
  const limitValue = readFlag("--limit");
  const limit = limitValue ? Number.parseInt(limitValue, 10) : undefined;

  return {
    rootDir: rootDir ? path.resolve(rootDir) : undefined,
    releasesRoot: releasesRoot ? path.resolve(releasesRoot) : undefined,
    releaseVersion,
    manifestPath: manifestPath ? path.resolve(manifestPath) : undefined,
    promptsPath: promptsPath ? path.resolve(promptsPath) : undefined,
    outputPath: outputPath ? path.resolve(outputPath) : undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
  };
}

export function readVectorProviderBenchmarkOptions(): VectorProviderBenchmarkCliOptions {
  const rootDir = readFlag("--root-dir");
  const corpusPath = readFlag("--corpus-path");
  const releaseVersion = readFlag("--release-version");
  const promptsPath = readFlag("--prompts");
  const baselinePath = readFlag("--baseline");
  const outputPath = readFlag("--output");
  const limitValue = readFlag("--limit");
  const dimensionsValue = readFlag("--dimensions");
  const limit = limitValue ? Number.parseInt(limitValue, 10) : undefined;
  const dimensions = dimensionsValue ? Number.parseInt(dimensionsValue, 10) : undefined;

  return {
    rootDir: rootDir ? path.resolve(rootDir) : undefined,
    corpusPath: corpusPath ? path.resolve(corpusPath) : undefined,
    releaseVersion,
    promptsPath: promptsPath ? path.resolve(promptsPath) : undefined,
    baselinePath: baselinePath ? path.resolve(baselinePath) : undefined,
    outputPath: outputPath ? path.resolve(outputPath) : undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
    dimensions: Number.isFinite(dimensions) ? dimensions : undefined,
  };
}

export function readReleaseReadyBuildOptions(): ReleaseReadyBuildOptions {
  const rootDir = readFlag("--root-dir");
  const confirmedRoot = readFlag("--confirmed-root");
  const metadataBackfillRoot = readFlag("--metadata-backfill-root");
  const outputRoot = readFlag("--output-root");
  const reportRoot = readFlag("--report-root");
  const inputPath = readFlag("--input");
  const corpusVersion = readFlag("--corpus-version");

  return {
    rootDir: rootDir ? path.resolve(rootDir) : undefined,
    confirmedRoot: confirmedRoot ? path.resolve(confirmedRoot) : undefined,
    metadataBackfillRoot: metadataBackfillRoot ? path.resolve(metadataBackfillRoot) : undefined,
    outputRoot: outputRoot ? path.resolve(outputRoot) : undefined,
    reportRoot: reportRoot ? path.resolve(reportRoot) : undefined,
    inputPath: inputPath ? path.resolve(inputPath) : undefined,
    corpusVersion,
  };
}

export function readMetadataBackfillBuildOptions(): ConfirmedMetadataBackfillOptions {
  const rootDir = readFlag("--root-dir");
  const confirmedRoot = readFlag("--confirmed-root");
  const outputRoot = readFlag("--output-root");
  const reportRoot = readFlag("--report-root");
  const inputPath = readFlag("--input");
  const corpusVersion = readFlag("--corpus-version");

  return {
    rootDir: rootDir ? path.resolve(rootDir) : undefined,
    confirmedRoot: confirmedRoot ? path.resolve(confirmedRoot) : undefined,
    outputRoot: outputRoot ? path.resolve(outputRoot) : undefined,
    reportRoot: reportRoot ? path.resolve(reportRoot) : undefined,
    inputPath: inputPath ? path.resolve(inputPath) : undefined,
    corpusVersion,
  };
}

export function readMetadataBackfillPreviewBuildOptions(): MetadataBackfillPreviewOptions {
  const rootDir = readFlag("--root-dir");
  const metadataBackfillRoot = readFlag("--metadata-backfill-root");
  const outputRoot = readFlag("--output-root");
  const reportRoot = readFlag("--report-root");
  const inputPath = readFlag("--input");
  const previewVersion = readFlag("--preview-version");

  return {
    rootDir: rootDir ? path.resolve(rootDir) : undefined,
    metadataBackfillRoot: metadataBackfillRoot ? path.resolve(metadataBackfillRoot) : undefined,
    outputRoot: outputRoot ? path.resolve(outputRoot) : undefined,
    reportRoot: reportRoot ? path.resolve(reportRoot) : undefined,
    inputPath: inputPath ? path.resolve(inputPath) : undefined,
    previewVersion,
  };
}

export function readCandidatePreviewBuildOptions(): CandidatePreviewOptions {
  const rootDir = readFlag("--root-dir");
  const candidateRoot = readFlag("--candidate-root");
  const outputRoot = readFlag("--output-root");
  const reportRoot = readFlag("--report-root");
  const inputPath = readFlag("--input");
  const previewVersion = readFlag("--preview-version");

  return {
    rootDir: rootDir ? path.resolve(rootDir) : undefined,
    candidateRoot: candidateRoot ? path.resolve(candidateRoot) : undefined,
    outputRoot: outputRoot ? path.resolve(outputRoot) : undefined,
    reportRoot: reportRoot ? path.resolve(reportRoot) : undefined,
    inputPath: inputPath ? path.resolve(inputPath) : undefined,
    previewVersion,
  };
}

export function readQuantityPreviewBuildOptions(): QuantityPreviewOptions {
  const rootDir = readFlag("--root-dir");
  const candidateRoot = readFlag("--candidate-root");
  const outputRoot = readFlag("--output-root");
  const reportRoot = readFlag("--report-root");
  const previewVersion = readFlag("--preview-version");
  const targetCountValue = readFlag("--target-count");
  const targetCount = targetCountValue ? Number.parseInt(targetCountValue, 10) : undefined;

  return {
    rootDir: rootDir ? path.resolve(rootDir) : undefined,
    candidateRoot: candidateRoot ? path.resolve(candidateRoot) : undefined,
    outputRoot: outputRoot ? path.resolve(outputRoot) : undefined,
    reportRoot: reportRoot ? path.resolve(reportRoot) : undefined,
    previewVersion,
    targetCount: Number.isFinite(targetCount) ? targetCount : undefined,
  };
}
