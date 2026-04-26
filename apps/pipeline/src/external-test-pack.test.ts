import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { parseEmbeddingShardRecords, parseReleaseManifest } from "@artduo/contracts";

interface PackMetadata {
  packId: string;
  scope: string;
  artifacts: Record<string, string>;
  release: {
    releaseVersion: string;
    corpusVersion: string;
    artworkCount: number;
    backgroundSceneCount: number;
    embeddingCount: number;
    embeddingProvider: string;
    embeddingModel: string;
    embeddingDimensions: number;
  };
  benchmarks: {
    localPromotion: {
      promptCount: number;
      rerankTop1HitRate: number;
      rerankTop5HitRate: number;
    };
    localSmoke: {
      promptCount: number;
      rerankTop1HitRate: number;
      rerankTop5HitRate: number;
    };
    remotePromotionKey1: {
      promptCount: number;
      apiKeySlot: number;
      baselineComparable: boolean;
      rerankTop1HitRate: number;
      rerankTop5HitRate: number;
    };
    remotePromotionKey2: {
      promptCount: number;
      apiKeySlot: number;
      baselineComparable: boolean;
      rerankTop1HitRate: number;
      rerankTop5HitRate: number;
    };
  };
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

test("embedding promotion external pack is complete and internally consistent", () => {
  const repoRoot = path.resolve(process.cwd(), "../..");
  const packRoot = path.join(repoRoot, "test-packs", "embedding-promotion-gate", "2026-04-25-curation-b");
  const packMetadataPath = path.join(packRoot, "PACK.json");

  assert.ok(existsSync(packMetadataPath), "PACK.json should exist for the external test pack");

  const pack = readJsonFile<PackMetadata>(packMetadataPath);
  assert.equal(pack.packId, "embedding-promotion-gate-2026-04-25-curation-b");
  assert.equal(pack.scope, "engineering-external-test");

  for (const relativePath of Object.values(pack.artifacts)) {
    assert.ok(existsSync(path.join(packRoot, relativePath)), `missing pack artifact: ${relativePath}`);
  }

  const manifestPath = path.join(packRoot, pack.artifacts.releaseManifest);
  const embeddingReportPath = path.join(packRoot, pack.artifacts.embeddingReport);
  const embeddingsPath = path.join(packRoot, pack.artifacts.embeddingShard);
  const localBenchmarkPath = path.join(packRoot, pack.artifacts.localBenchmarkReport);
  const smokeBenchmarkPath = path.join(packRoot, pack.artifacts.smokeBenchmarkReport);
  const providerKey1Path = path.join(packRoot, pack.artifacts.providerBenchmarkKey1Report);
  const providerKey2Path = path.join(packRoot, pack.artifacts.providerBenchmarkKey2Report);

  const manifest = parseReleaseManifest(readJsonFile<unknown>(manifestPath), manifestPath);
  const embeddingReport = readJsonFile<{
    releaseVersion: string;
    recordCount: number;
    providerMode: string;
    model: string;
    dimensions: number;
  }>(embeddingReportPath);
  const embeddings = parseEmbeddingShardRecords(readJsonFile<unknown>(embeddingsPath), embeddingsPath);
  const localBenchmark = readJsonFile<{
    promptCount: number;
    rerankTop1HitRate: number;
    rerankTop5HitRate: number;
  }>(localBenchmarkPath);
  const smokeBenchmark = readJsonFile<{
    promptCount: number;
    rerankTop1HitRate: number;
    rerankTop5HitRate: number;
  }>(smokeBenchmarkPath);
  const providerKey1 = readJsonFile<{
    baselineComparable: boolean;
    providerSummary: { apiKeySlot: number };
    remoteBenchmark: {
      promptCount: number;
      rerankTop1HitRate: number;
      rerankTop5HitRate: number;
    };
  }>(providerKey1Path);
  const providerKey2 = readJsonFile<{
    baselineComparable: boolean;
    providerSummary: { apiKeySlot: number };
    remoteBenchmark: {
      promptCount: number;
      rerankTop1HitRate: number;
      rerankTop5HitRate: number;
    };
  }>(providerKey2Path);

  assert.equal(manifest.release.corpusVersion, pack.release.corpusVersion);
  assert.equal(manifest.release.contractsVersion, "0.1.0");
  assert.equal(manifest.shards.metadata[0]?.recordCount, pack.release.artworkCount);
  assert.equal(manifest.shards.search[0]?.recordCount, pack.release.artworkCount);
  assert.equal(manifest.shards.mediaIndex[0]?.recordCount, pack.release.artworkCount);
  assert.equal(manifest.shards.backgroundScenes[0]?.recordCount, pack.release.backgroundSceneCount);
  assert.equal(manifest.shards.embeddings?.[0]?.recordCount, pack.release.embeddingCount);

  assert.equal(embeddingReport.releaseVersion, pack.release.releaseVersion);
  assert.equal(embeddingReport.recordCount, pack.release.embeddingCount);
  assert.equal(embeddingReport.providerMode, pack.release.embeddingProvider);
  assert.equal(embeddingReport.model, pack.release.embeddingModel);
  assert.equal(embeddingReport.dimensions, pack.release.embeddingDimensions);

  assert.equal(embeddings.length, pack.release.embeddingCount);
  assert.ok(embeddings.every((record) => record.theme.trim().length > 0), "every embedding record should carry an explicit theme");
  assert.ok(embeddings.every((record) => record.dimensions === pack.release.embeddingDimensions), "baseline embedding dimensions should match pack metadata");

  assert.equal(localBenchmark.promptCount, pack.benchmarks.localPromotion.promptCount);
  assert.equal(localBenchmark.rerankTop1HitRate, pack.benchmarks.localPromotion.rerankTop1HitRate);
  assert.equal(localBenchmark.rerankTop5HitRate, pack.benchmarks.localPromotion.rerankTop5HitRate);

  assert.equal(smokeBenchmark.promptCount, pack.benchmarks.localSmoke.promptCount);
  assert.equal(smokeBenchmark.rerankTop1HitRate, pack.benchmarks.localSmoke.rerankTop1HitRate);
  assert.equal(smokeBenchmark.rerankTop5HitRate, pack.benchmarks.localSmoke.rerankTop5HitRate);

  assert.equal(providerKey1.baselineComparable, pack.benchmarks.remotePromotionKey1.baselineComparable);
  assert.equal(providerKey1.providerSummary.apiKeySlot, pack.benchmarks.remotePromotionKey1.apiKeySlot);
  assert.equal(providerKey1.remoteBenchmark.promptCount, pack.benchmarks.remotePromotionKey1.promptCount);
  assert.equal(providerKey1.remoteBenchmark.rerankTop1HitRate, pack.benchmarks.remotePromotionKey1.rerankTop1HitRate);
  assert.equal(providerKey1.remoteBenchmark.rerankTop5HitRate, pack.benchmarks.remotePromotionKey1.rerankTop5HitRate);

  assert.equal(providerKey2.baselineComparable, pack.benchmarks.remotePromotionKey2.baselineComparable);
  assert.equal(providerKey2.providerSummary.apiKeySlot, pack.benchmarks.remotePromotionKey2.apiKeySlot);
  assert.equal(providerKey2.remoteBenchmark.promptCount, pack.benchmarks.remotePromotionKey2.promptCount);
  assert.equal(providerKey2.remoteBenchmark.rerankTop1HitRate, pack.benchmarks.remotePromotionKey2.rerankTop1HitRate);
  assert.equal(providerKey2.remoteBenchmark.rerankTop5HitRate, pack.benchmarks.remotePromotionKey2.rerankTop5HitRate);

  assert.ok(providerKey1.remoteBenchmark.rerankTop1HitRate >= localBenchmark.rerankTop1HitRate);
  assert.ok(providerKey2.remoteBenchmark.rerankTop1HitRate >= localBenchmark.rerankTop1HitRate);
});
