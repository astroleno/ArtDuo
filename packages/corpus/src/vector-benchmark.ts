import type { EmbeddingShardRecord } from "@artduo/contracts";

import { createLocalHashEmbeddingProvider, type TextEmbeddingProvider } from "./embedding-provider";
import { runRetrievalDebug, runRetrievalDebugWithProvider, type RetrievalDebugResult } from "./debug-retrieval";

export interface VectorBenchmarkPrompt {
  id: string;
  query: string;
  expectedThemes: string[];
  notes?: string;
}

export interface VectorBenchmarkPromptResult {
  id: string;
  query: string;
  expectedThemes: string[];
  notes?: string;
  rerankTop1Hit: boolean;
  rerankTop5Hit: boolean;
  lexicalTop1Hit: boolean;
  lexicalTop5Hit: boolean;
  retrieval: RetrievalDebugResult;
}

export interface VectorBenchmarkResult {
  provider: string;
  model: string;
  dimensions: number;
  promptCount: number;
  rerankTop1HitRate: number;
  rerankTop5HitRate: number;
  lexicalTop1HitRate: number;
  lexicalTop5HitRate: number;
  results: VectorBenchmarkPromptResult[];
}

function toRate(matches: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Number((matches / total).toFixed(6));
}

function topKHit(expectedThemes: string[], themes: Array<string | undefined>): boolean {
  const expected = new Set(expectedThemes);
  return themes.some((theme) => Boolean(theme) && expected.has(theme as string));
}

export function runVectorBenchmark(
  prompts: VectorBenchmarkPrompt[],
  records: EmbeddingShardRecord[],
  options: {
    limit?: number;
  } = {},
): VectorBenchmarkResult {
  const results = prompts.map((prompt) => {
    const retrieval = runRetrievalDebug(prompt.query, records, { limit: options.limit ?? 10 });
    const rerankThemes = retrieval.rerankedTopK.map((entry) => entry.theme);
    const lexicalThemes = retrieval.lexicalTopK.map((entry) => entry.theme);

    return {
      id: prompt.id,
      query: prompt.query,
      expectedThemes: prompt.expectedThemes,
      notes: prompt.notes,
      rerankTop1Hit: topKHit(prompt.expectedThemes, rerankThemes.slice(0, 1)),
      rerankTop5Hit: topKHit(prompt.expectedThemes, rerankThemes.slice(0, 5)),
      lexicalTop1Hit: topKHit(prompt.expectedThemes, lexicalThemes.slice(0, 1)),
      lexicalTop5Hit: topKHit(prompt.expectedThemes, lexicalThemes.slice(0, 5)),
      retrieval,
    };
  });

  return {
    provider: results[0]?.retrieval.provider ?? "local-hash",
    model: results[0]?.retrieval.model ?? createLocalHashEmbeddingProvider().model,
    dimensions: results[0]?.retrieval.dimensions ?? records[0]?.dimensions ?? 0,
    promptCount: results.length,
    rerankTop1HitRate: toRate(results.filter((result) => result.rerankTop1Hit).length, results.length),
    rerankTop5HitRate: toRate(results.filter((result) => result.rerankTop5Hit).length, results.length),
    lexicalTop1HitRate: toRate(results.filter((result) => result.lexicalTop1Hit).length, results.length),
    lexicalTop5HitRate: toRate(results.filter((result) => result.lexicalTop5Hit).length, results.length),
    results,
  };
}

export async function runVectorBenchmarkWithProvider(
  prompts: VectorBenchmarkPrompt[],
  records: EmbeddingShardRecord[],
  options: {
    limit?: number;
    embeddingProvider?: TextEmbeddingProvider;
  } = {},
): Promise<VectorBenchmarkResult> {
  const embeddingProvider = options.embeddingProvider ?? createLocalHashEmbeddingProvider();
  const results = await Promise.all(
    prompts.map(async (prompt) => {
      const retrieval = await runRetrievalDebugWithProvider(prompt.query, records, {
        limit: options.limit ?? 10,
        embeddingProvider,
      });
      const rerankThemes = retrieval.rerankedTopK.map((entry) => entry.theme);
      const lexicalThemes = retrieval.lexicalTopK.map((entry) => entry.theme);

      return {
        id: prompt.id,
        query: prompt.query,
        expectedThemes: prompt.expectedThemes,
        notes: prompt.notes,
        rerankTop1Hit: topKHit(prompt.expectedThemes, rerankThemes.slice(0, 1)),
        rerankTop5Hit: topKHit(prompt.expectedThemes, rerankThemes.slice(0, 5)),
        lexicalTop1Hit: topKHit(prompt.expectedThemes, lexicalThemes.slice(0, 1)),
        lexicalTop5Hit: topKHit(prompt.expectedThemes, lexicalThemes.slice(0, 5)),
        retrieval,
      };
    }),
  );

  return {
    provider: results[0]?.retrieval.provider ?? embeddingProvider.mode,
    model: results[0]?.retrieval.model ?? embeddingProvider.model,
    dimensions: results[0]?.retrieval.dimensions ?? records[0]?.dimensions ?? 0,
    promptCount: results.length,
    rerankTop1HitRate: toRate(results.filter((result) => result.rerankTop1Hit).length, results.length),
    rerankTop5HitRate: toRate(results.filter((result) => result.rerankTop5Hit).length, results.length),
    lexicalTop1HitRate: toRate(results.filter((result) => result.lexicalTop1Hit).length, results.length),
    lexicalTop5HitRate: toRate(results.filter((result) => result.lexicalTop5Hit).length, results.length),
    results,
  };
}
