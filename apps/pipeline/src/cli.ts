import path from "node:path";

import type { CandidatePreviewOptions } from "./candidate-preview";
import type { ConfirmedMetadataBackfillOptions } from "./confirmed-metadata-backfill";
import type { EmbeddingRuntimeCliOptions } from "./embedding-runtime";
import type { EmbeddingBuildOptions } from "./embedding-shards";
import type { ImageEmbeddingBuildOptions } from "./image-embedding-shards";
import type { ImageEmbeddingPromotionEvidenceBuildOptions } from "./build-image-embedding-promotion-evidence";
import type { ImageEmbeddingEvaluationOptions } from "./run-image-embedding-evaluation";
import type { ImageEmbeddingDebugOptions } from "./debug-image-embedding";
import type { MetadataBackfillPreviewOptions } from "./metadata-backfill-preview";
import type { QuantityPreviewOptions } from "./quantity-preview";
import type { ReleaseBuildOptions } from "./release-artifact";
import type { ReleaseReadyBuildOptions } from "./release-ready-corpus";
import type { RelationshipGraphBuildOptions } from "./relationship-graph";
import type { RelationshipGraphEvaluationOptions } from "./relationship-graph-evaluation";
import type { RelationshipGraphPhase0Options } from "./relationship-graph-phase0";
import type { VisualPresentationPreviewOptions } from "./visual-presentation-preview";
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

function resolveCliPath(value: string, workspaceRoot: string): string {
  return path.isAbsolute(value) ? path.resolve(value) : path.resolve(workspaceRoot, value);
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

export function readImageEmbeddingBuildOptions(): ImageEmbeddingBuildOptions {
  const rootDir = readFlag("--root-dir");
  const workspaceRoot = rootDir ? path.resolve(rootDir) : path.resolve(process.cwd(), "../..");
  const releasesRoot = readFlag("--releases-root");
  const reportRoot = readFlag("--report-root");
  const candidateRoot = readFlag("--candidate-root");
  const sourceCacheRoot = readFlag("--source-cache-root") ?? readFlag("--source-cache");
  const promotionAnchorPath = readFlag("--promotion-anchor-set");
  const releaseVersion = readFlag("--release-version");
  const manifestPath = readFlag("--manifest");
  const model = readFlag("--image-embedding-model");
  const modelRevision = readFlag("--image-embedding-model-revision");
  const modelVariant = readFlag("--image-embedding-model-variant");
  const batchSizeValue = readFlag("--image-embedding-batch-size");
  const batchSize = batchSizeValue ? Number.parseInt(batchSizeValue, 10) : undefined;

  return {
    rootDir: rootDir ? path.resolve(rootDir) : undefined,
    releasesRoot: releasesRoot ? path.resolve(workspaceRoot, releasesRoot) : undefined,
    reportRoot: reportRoot ? path.resolve(workspaceRoot, reportRoot) : undefined,
    candidateRoot: candidateRoot ? path.resolve(workspaceRoot, candidateRoot) : undefined,
    sourceCacheRoot: sourceCacheRoot ? path.resolve(workspaceRoot, sourceCacheRoot) : undefined,
    promotionAnchorPath: promotionAnchorPath ? path.resolve(workspaceRoot, promotionAnchorPath) : undefined,
    releaseVersion,
    manifestPath: manifestPath ? path.resolve(workspaceRoot, manifestPath) : undefined,
    model,
    modelRevision,
    modelVariant,
    batchSize: Number.isFinite(batchSize) ? batchSize : undefined,
    refreshSourceCache: readBooleanFlag("--refresh-source-cache"),
    offline: readBooleanFlag("--offline"),
  };
}

export function readImageEmbeddingEvaluationOptions(): ImageEmbeddingEvaluationOptions {
  const rootDir = readFlag("--root-dir");
  const workspaceRoot = rootDir ? path.resolve(rootDir) : path.resolve(process.cwd(), "../..");
  const releasesRoot = readFlag("--releases-root");
  const releaseVersion = readFlag("--release-version");
  const manifestPath = readFlag("--manifest");
  const candidateShardPath = readFlag("--candidate-shard");
  const buildReportPath = readFlag("--build-report");
  const promotionAnchorPath = readFlag("--promotion-anchor-set");
  const outputPath = readFlag("--output");
  const reviewPackPath = readFlag("--review-pack");
  const reviewVerdictsPath = readFlag("--review-verdicts");
  const reviewerViewOutputPath = readFlag("--reviewer-view-output");
  const fusionE2eReportPath = readFlag("--fusion-e2e-report");
  const textBenchmarkBaselinePath = readFlag("--text-benchmark-baseline");
  const a2aBaselinePath = readFlag("--a2a-baseline");
  const e2eBaselinePath = readFlag("--e2e-baseline");
  const textBenchmarkRunnerArtifactPath = readFlag("--text-benchmark-runner-artifact");
  const a2aCaseSetRunnerArtifactPath = readFlag("--a2a-case-set-runner-artifact");
  const a2aReplayRunnerArtifactPath = readFlag("--a2a-replay-runner-artifact");
  const e2eRunnerArtifactPath = readFlag("--e2e-runner-artifact");
  const fusionE2eRunnerArtifactPath = readFlag("--fusion-e2e-runner-artifact");

  return {
    rootDir: rootDir ? workspaceRoot : undefined,
    releasesRoot: releasesRoot ? resolveCliPath(releasesRoot, workspaceRoot) : undefined,
    releaseVersion,
    manifestPath: manifestPath ? resolveCliPath(manifestPath, workspaceRoot) : undefined,
    candidateShardPath: candidateShardPath ? resolveCliPath(candidateShardPath, workspaceRoot) : undefined,
    buildReportPath: buildReportPath ? resolveCliPath(buildReportPath, workspaceRoot) : undefined,
    promotionAnchorPath: promotionAnchorPath ? resolveCliPath(promotionAnchorPath, workspaceRoot) : undefined,
    outputPath: outputPath ? resolveCliPath(outputPath, workspaceRoot) : undefined,
    reviewPackPath: reviewPackPath ? resolveCliPath(reviewPackPath, workspaceRoot) : undefined,
    reviewVerdictsPath: reviewVerdictsPath ? resolveCliPath(reviewVerdictsPath, workspaceRoot) : undefined,
    emitReviewPack: readBooleanFlag("--emit-review-pack"),
    reviewerViewOutputPath: reviewerViewOutputPath ? resolveCliPath(reviewerViewOutputPath, workspaceRoot) : undefined,
    fusionE2eReportPath: fusionE2eReportPath ? resolveCliPath(fusionE2eReportPath, workspaceRoot) : undefined,
    textBenchmarkBaselinePath: textBenchmarkBaselinePath ? resolveCliPath(textBenchmarkBaselinePath, workspaceRoot) : undefined,
    a2aBaselinePath: a2aBaselinePath ? resolveCliPath(a2aBaselinePath, workspaceRoot) : undefined,
    e2eBaselinePath: e2eBaselinePath ? resolveCliPath(e2eBaselinePath, workspaceRoot) : undefined,
    textBenchmarkRunnerArtifactPath: textBenchmarkRunnerArtifactPath ? resolveCliPath(textBenchmarkRunnerArtifactPath, workspaceRoot) : undefined,
    a2aCaseSetRunnerArtifactPath: a2aCaseSetRunnerArtifactPath ? resolveCliPath(a2aCaseSetRunnerArtifactPath, workspaceRoot) : undefined,
    a2aReplayRunnerArtifactPath: a2aReplayRunnerArtifactPath ? resolveCliPath(a2aReplayRunnerArtifactPath, workspaceRoot) : undefined,
    e2eRunnerArtifactPath: e2eRunnerArtifactPath ? resolveCliPath(e2eRunnerArtifactPath, workspaceRoot) : undefined,
    fusionE2eRunnerArtifactPath: fusionE2eRunnerArtifactPath ? resolveCliPath(fusionE2eRunnerArtifactPath, workspaceRoot) : undefined,
  };
}

export function readImageEmbeddingPromotionEvidenceBuildOptions(): ImageEmbeddingPromotionEvidenceBuildOptions {
  const rootDir = readFlag("--root-dir");
  const workspaceRoot = rootDir ? path.resolve(rootDir) : path.resolve(process.cwd(), "../..");
  const releaseVersion = readFlag("--release-version");
  const manifestPath = readFlag("--manifest");
  const promotionAnchorPath = readFlag("--promotion-anchor-set");
  const outputPath = readFlag("--output");
  const textBenchmarkRunnerArtifactPath = readFlag("--text-benchmark-runner-artifact");
  const a2aCaseSetRunnerArtifactPath = readFlag("--a2a-case-set-runner-artifact");
  const a2aReplayRunnerArtifactPath = readFlag("--a2a-replay-runner-artifact");
  const e2eRunnerArtifactPath = readFlag("--e2e-runner-artifact");
  const fusionE2eRunnerArtifactPath = readFlag("--fusion-e2e-runner-artifact");
  const promotionBindingChecksum = readFlag("--promotion-binding-checksum");

  return {
    rootDir: rootDir ? workspaceRoot : undefined,
    releaseVersion,
    manifestPath: manifestPath ? resolveCliPath(manifestPath, workspaceRoot) : undefined,
    promotionAnchorPath: promotionAnchorPath ? resolveCliPath(promotionAnchorPath, workspaceRoot) : undefined,
    outputPath: outputPath ? resolveCliPath(outputPath, workspaceRoot) : undefined,
    textBenchmarkRunnerArtifactPath: textBenchmarkRunnerArtifactPath
      ? resolveCliPath(textBenchmarkRunnerArtifactPath, workspaceRoot)
      : undefined,
    a2aCaseSetRunnerArtifactPath: a2aCaseSetRunnerArtifactPath
      ? resolveCliPath(a2aCaseSetRunnerArtifactPath, workspaceRoot)
      : undefined,
    a2aReplayRunnerArtifactPath: a2aReplayRunnerArtifactPath
      ? resolveCliPath(a2aReplayRunnerArtifactPath, workspaceRoot)
      : undefined,
    e2eRunnerArtifactPath: e2eRunnerArtifactPath
      ? resolveCliPath(e2eRunnerArtifactPath, workspaceRoot)
      : undefined,
    fusionE2eRunnerArtifactPath: fusionE2eRunnerArtifactPath
      ? resolveCliPath(fusionE2eRunnerArtifactPath, workspaceRoot)
      : undefined,
    promotionBindingChecksum,
  };
}

export function readImageEmbeddingDebugOptions(): ImageEmbeddingDebugOptions {
  const rootDir = readFlag("--root-dir");
  const workspaceRoot = rootDir ? path.resolve(rootDir) : path.resolve(process.cwd(), "../..");
  const releaseVersion = readFlag("--release-version");
  const candidateShardPath = readFlag("--candidate-shard");
  const entityType = readFlag("--entity-type");
  const entityId = readFlag("--entity-id");
  const limitValue = readFlag("--limit");
  const outputPath = readFlag("--output");
  const limit = limitValue ? Number.parseInt(limitValue, 10) : undefined;

  if (entityType !== undefined && entityType !== "artwork" && entityType !== "background-scene") {
    throw new TypeError("--entity-type must be artwork or background-scene.");
  }

  return {
    rootDir: rootDir ? workspaceRoot : undefined,
    releaseVersion,
    candidateShardPath: candidateShardPath ? resolveCliPath(candidateShardPath, workspaceRoot) : undefined,
    entityType,
    entityId,
    limit: Number.isFinite(limit) ? limit : undefined,
    outputPath: outputPath ? resolveCliPath(outputPath, workspaceRoot) : undefined,
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

export function readRelationshipGraphPhase0Options(): RelationshipGraphPhase0Options {
  const rootDir = readFlag("--root-dir");
  const releasesRoot = readFlag("--releases-root");
  const releaseVersion = readFlag("--release-version");
  const manifestPath = readFlag("--manifest");
  const reportRoot = readFlag("--report-root");
  const anchorCountValue = readFlag("--anchor-count");
  const negativePairCountValue = readFlag("--negative-pair-count");
  const topKValue = readFlag("--top-k");
  const anchorCount = anchorCountValue ? Number.parseInt(anchorCountValue, 10) : undefined;
  const negativePairCount = negativePairCountValue ? Number.parseInt(negativePairCountValue, 10) : undefined;
  const topK = topKValue ? Number.parseInt(topKValue, 10) : undefined;

  return {
    rootDir: rootDir ? path.resolve(rootDir) : undefined,
    releasesRoot: releasesRoot ? path.resolve(releasesRoot) : undefined,
    releaseVersion,
    manifestPath: manifestPath ? path.resolve(manifestPath) : undefined,
    reportRoot: reportRoot ? path.resolve(reportRoot) : undefined,
    anchorCount: Number.isFinite(anchorCount) ? anchorCount : undefined,
    negativePairCount: Number.isFinite(negativePairCount) ? negativePairCount : undefined,
    topK: Number.isFinite(topK) ? topK : undefined,
  };
}

export function readRelationshipGraphBuildOptions(): RelationshipGraphBuildOptions {
  const rootDir = readFlag("--root-dir");
  const releasesRoot = readFlag("--releases-root");
  const releaseVersion = readFlag("--release-version");
  const manifestPath = readFlag("--manifest");
  const reportRoot = readFlag("--report-root");
  const outputPath = readFlag("--output");
  const updateManifest = readBooleanFlag("--update-manifest");
  const publicSourceRefsValue = readFlag("--public-source-refs-per-signal-node");
  const publicSourceRefsPerSignalNode = publicSourceRefsValue
    ? Number.parseInt(publicSourceRefsValue, 10)
    : undefined;

  return {
    rootDir: rootDir ? path.resolve(rootDir) : undefined,
    releasesRoot: releasesRoot ? path.resolve(releasesRoot) : undefined,
    releaseVersion,
    manifestPath: manifestPath ? path.resolve(manifestPath) : undefined,
    reportRoot: reportRoot ? path.resolve(reportRoot) : undefined,
    outputPath: outputPath ? path.resolve(outputPath) : undefined,
    updateManifest,
    publicSourceRefsPerSignalNode: Number.isFinite(publicSourceRefsPerSignalNode)
      ? publicSourceRefsPerSignalNode
      : undefined,
  };
}

export function readRelationshipGraphEvaluationOptions(): RelationshipGraphEvaluationOptions {
  const rootDir = readFlag("--root-dir");
  const releasesRoot = readFlag("--releases-root");
  const releaseVersion = readFlag("--release-version");
  const manifestPath = readFlag("--manifest");
  const reportRoot = readFlag("--report-root");
  const promptsPath = readFlag("--prompts");
  const outputPath = readFlag("--output");
  const topKValue = readFlag("--top-k");
  const benchmarkLimitValue = readFlag("--benchmark-limit");
  const topK = topKValue ? Number.parseInt(topKValue, 10) : undefined;
  const benchmarkLimit = benchmarkLimitValue ? Number.parseInt(benchmarkLimitValue, 10) : undefined;

  return {
    rootDir: rootDir ? path.resolve(rootDir) : undefined,
    releasesRoot: releasesRoot ? path.resolve(releasesRoot) : undefined,
    releaseVersion,
    manifestPath: manifestPath ? path.resolve(manifestPath) : undefined,
    reportRoot: reportRoot ? path.resolve(reportRoot) : undefined,
    promptsPath: promptsPath ? path.resolve(promptsPath) : undefined,
    outputPath: outputPath ? path.resolve(outputPath) : undefined,
    topK: Number.isFinite(topK) ? topK : undefined,
    benchmarkLimit: Number.isFinite(benchmarkLimit) ? benchmarkLimit : undefined,
  };
}

export function readVisualPresentationPreviewOptions(): VisualPresentationPreviewOptions {
  const rootDir = readFlag("--root-dir");
  const releasesRoot = readFlag("--releases-root");
  const releaseVersion = readFlag("--release-version");
  const manifestPath = readFlag("--manifest");
  const reportRoot = readFlag("--report-root");
  const outputPath = readFlag("--output");
  const limitValue = readFlag("--limit");
  const limit = limitValue ? Number.parseInt(limitValue, 10) : undefined;

  return {
    rootDir: rootDir ? path.resolve(rootDir) : undefined,
    releasesRoot: releasesRoot ? path.resolve(releasesRoot) : undefined,
    releaseVersion,
    manifestPath: manifestPath ? path.resolve(manifestPath) : undefined,
    reportRoot: reportRoot ? path.resolve(reportRoot) : undefined,
    outputPath: outputPath ? path.resolve(outputPath) : undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
  };
}
