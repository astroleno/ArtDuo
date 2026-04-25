import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  createLocalHashEmbeddingProvider,
  runVectorBenchmarkWithProvider,
  type VectorBenchmarkPrompt,
  type VectorBenchmarkResult,
} from "@artduo/corpus";
import { parseArtworkRecords, type ArtworkRecord } from "@artduo/contracts";

import { readEmbeddingRuntimeCliOptions, readVectorProviderBenchmarkOptions } from "./cli";
import { buildEmbeddingRecordsWithProvider } from "./embedding-shards";
import { resolveEmbeddingRuntime } from "./embedding-runtime";
import { resolvePreferredCorpusPath } from "./release-artifact";

export interface VectorProviderBenchmarkCliOptions {
  rootDir?: string;
  corpusPath?: string;
  releaseVersion?: string;
  promptsPath?: string;
  baselinePath?: string;
  outputPath?: string;
  limit?: number;
  dimensions?: number;
}

function resolveRootDir(rootDir?: string): string {
  return rootDir ? path.resolve(rootDir) : path.resolve(process.cwd(), "../..");
}

function resolveDefaultPromptsPath(rootDir: string): string {
  return path.join(rootDir, "benchmarks", "vector-promotion-prompts.json");
}

function resolveDefaultBaselinePath(rootDir: string, releaseVersion?: string): string | undefined {
  if (!releaseVersion) {
    return undefined;
  }

  return path.join(rootDir, "data", "curation", "reports", `vector-benchmark-${releaseVersion}.json`);
}

function resolveDefaultOutputPath(rootDir: string, releaseVersion?: string): string {
  const suffix = releaseVersion ?? "provider-smoke";
  return path.join(rootDir, "data", "curation", "reports", `vector-provider-benchmark-${suffix}.json`);
}

function writeJsonFile(filePath: string, data: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function readPrompts(filePath: string): VectorBenchmarkPrompt[] {
  return JSON.parse(readFileSync(filePath, "utf8")) as VectorBenchmarkPrompt[];
}

function readArtworkCorpus(filePath: string): ArtworkRecord[] {
  return parseArtworkRecords(JSON.parse(readFileSync(filePath, "utf8")) as unknown, filePath);
}

function resolveCorpusPath(rootDir: string, explicitCorpusPath?: string, releaseVersion?: string): string {
  if (explicitCorpusPath) {
    return path.resolve(explicitCorpusPath);
  }

  if (releaseVersion) {
    const releaseReadyPath = path.join(rootDir, "data", "curation", "release-ready", `${releaseVersion}.json`);

    if (existsSync(releaseReadyPath)) {
      return releaseReadyPath;
    }
  }

  const preferred = resolvePreferredCorpusPath(rootDir);

  if (!preferred) {
    throw new Error("Unable to resolve a curated corpus for provider benchmark.");
  }

  return preferred;
}

function summarizeBenchmark(result: VectorBenchmarkResult): Record<string, unknown> {
  return {
    provider: result.provider,
    model: result.model,
    dimensions: result.dimensions,
    promptCount: result.promptCount,
    rerankTop1HitRate: result.rerankTop1HitRate,
    rerankTop5HitRate: result.rerankTop5HitRate,
    lexicalTop1HitRate: result.lexicalTop1HitRate,
    lexicalTop5HitRate: result.lexicalTop5HitRate,
  };
}

function buildPromptSignature(prompts: Array<Pick<VectorBenchmarkPrompt, "id" | "expectedThemes">>): string {
  return prompts.map((prompt) => `${prompt.id}:${prompt.expectedThemes.join("|")}`).join("||");
}

function isComparableBaseline(
  prompts: VectorBenchmarkPrompt[],
  baselineBenchmark?: Partial<VectorBenchmarkResult>,
): boolean {
  if (!baselineBenchmark?.results || baselineBenchmark.promptCount !== prompts.length) {
    return false;
  }

  return buildPromptSignature(prompts) === buildPromptSignature(
    baselineBenchmark.results.map((result) => ({
      id: result.id,
      expectedThemes: result.expectedThemes,
    })),
  );
}

function buildPromptComparison(
  localBenchmark: VectorBenchmarkResult,
  remoteBenchmark: VectorBenchmarkResult,
  baselineBenchmark?: Partial<VectorBenchmarkResult>,
): Array<Record<string, unknown>> {
  const baselineById = new Map(
    (baselineBenchmark?.results ?? []).map((result) => [result.id, result]),
  );
  const remoteById = new Map(remoteBenchmark.results.map((result) => [result.id, result]));

  return localBenchmark.results.map((localResult) => {
    const remoteResult = remoteById.get(localResult.id);
    const baselineResult = baselineById.get(localResult.id);

    return {
      id: localResult.id,
      query: localResult.query,
      expectedThemes: localResult.expectedThemes,
      baselineTop1Theme: baselineResult?.retrieval?.rerankedTopK?.[0]?.theme,
      localTop1Theme: localResult.retrieval.rerankedTopK[0]?.theme,
      remoteTop1Theme: remoteResult?.retrieval.rerankedTopK[0]?.theme,
      baselineTop1Hit: baselineResult?.rerankTop1Hit,
      localTop1Hit: localResult.rerankTop1Hit,
      remoteTop1Hit: remoteResult?.rerankTop1Hit,
      localTop5Hit: localResult.rerankTop5Hit,
      remoteTop5Hit: remoteResult?.rerankTop5Hit,
    };
  });
}

async function main(): Promise<void> {
  const options = readVectorProviderBenchmarkOptions();
  const rootDir = resolveRootDir(options.rootDir);
  const corpusPath = resolveCorpusPath(rootDir, options.corpusPath, options.releaseVersion);
  const promptsPath = options.promptsPath ?? resolveDefaultPromptsPath(rootDir);
  const baselinePath = options.baselinePath ?? resolveDefaultBaselinePath(rootDir, options.releaseVersion);
  const outputPath = options.outputPath ?? resolveDefaultOutputPath(rootDir, options.releaseVersion);
  const prompts = readPrompts(promptsPath);
  const artworks = readArtworkCorpus(corpusPath);
  const localProvider = createLocalHashEmbeddingProvider();
  const runtime = resolveEmbeddingRuntime({
    ...readEmbeddingRuntimeCliOptions(),
    rootDir,
  });

  const localRecords = await buildEmbeddingRecordsWithProvider(artworks, {
    dimensions: options.dimensions,
    embeddingProvider: localProvider,
  });
  const remoteRecords = await buildEmbeddingRecordsWithProvider(artworks, {
    dimensions: options.dimensions,
    embeddingProvider: runtime.provider,
  });
  const localBenchmark = await runVectorBenchmarkWithProvider(prompts, localRecords, {
    limit: options.limit,
    embeddingProvider: localProvider,
  });
  const remoteBenchmark = await runVectorBenchmarkWithProvider(prompts, remoteRecords, {
    limit: options.limit,
    embeddingProvider: runtime.provider,
  });
  const baselineBenchmark = baselinePath && existsSync(baselinePath)
    ? JSON.parse(readFileSync(baselinePath, "utf8")) as Partial<VectorBenchmarkResult>
    : undefined;
  const baselineComparable = isComparableBaseline(prompts, baselineBenchmark);
  const payload = {
    generatedAt: new Date().toISOString(),
    corpusPath,
    promptsPath,
    baselinePath: baselineBenchmark ? baselinePath : undefined,
    requestedProviderMode: runtime.requestedProviderMode,
    configuredProviderMode: runtime.summary.configuredProviderMode,
    providerSummary: runtime.summary,
    localBenchmark: summarizeBenchmark(localBenchmark),
    remoteBenchmark: summarizeBenchmark(remoteBenchmark),
    baselineComparable,
    baselineBenchmark: baselineBenchmark ? {
      provider: baselineBenchmark.provider,
      model: baselineBenchmark.model,
      dimensions: baselineBenchmark.dimensions,
      promptCount: baselineBenchmark.promptCount,
      rerankTop1HitRate: baselineBenchmark.rerankTop1HitRate,
      rerankTop5HitRate: baselineBenchmark.rerankTop5HitRate,
      lexicalTop1HitRate: baselineBenchmark.lexicalTop1HitRate,
      lexicalTop5HitRate: baselineBenchmark.lexicalTop5HitRate,
    } : undefined,
    comparison: {
      deltaVsLocal: {
        rerankTop1HitRate: Number((remoteBenchmark.rerankTop1HitRate - localBenchmark.rerankTop1HitRate).toFixed(6)),
        rerankTop5HitRate: Number((remoteBenchmark.rerankTop5HitRate - localBenchmark.rerankTop5HitRate).toFixed(6)),
        lexicalTop1HitRate: Number((remoteBenchmark.lexicalTop1HitRate - localBenchmark.lexicalTop1HitRate).toFixed(6)),
        lexicalTop5HitRate: Number((remoteBenchmark.lexicalTop5HitRate - localBenchmark.lexicalTop5HitRate).toFixed(6)),
      },
      deltaVsBaseline: baselineBenchmark && baselineComparable ? {
        rerankTop1HitRate: Number(((remoteBenchmark.rerankTop1HitRate ?? 0) - (baselineBenchmark.rerankTop1HitRate ?? 0)).toFixed(6)),
        rerankTop5HitRate: Number(((remoteBenchmark.rerankTop5HitRate ?? 0) - (baselineBenchmark.rerankTop5HitRate ?? 0)).toFixed(6)),
        lexicalTop1HitRate: Number(((remoteBenchmark.lexicalTop1HitRate ?? 0) - (baselineBenchmark.lexicalTop1HitRate ?? 0)).toFixed(6)),
        lexicalTop5HitRate: Number(((remoteBenchmark.lexicalTop5HitRate ?? 0) - (baselineBenchmark.lexicalTop5HitRate ?? 0)).toFixed(6)),
      } : undefined,
      prompts: buildPromptComparison(localBenchmark, remoteBenchmark, baselineBenchmark),
    },
  };

  writeJsonFile(outputPath, payload);
  console.log(JSON.stringify(payload, null, 2));
  console.log(`report: ${outputPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
