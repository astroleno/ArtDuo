import type { EmbeddingShardRecord } from "@artduo/contracts";

import { runRetrievalDebug, type RetrievalDebugResult } from "./debug-retrieval";

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
    promptCount: results.length,
    rerankTop1HitRate: toRate(results.filter((result) => result.rerankTop1Hit).length, results.length),
    rerankTop5HitRate: toRate(results.filter((result) => result.rerankTop5Hit).length, results.length),
    lexicalTop1HitRate: toRate(results.filter((result) => result.lexicalTop1Hit).length, results.length),
    lexicalTop5HitRate: toRate(results.filter((result) => result.lexicalTop5Hit).length, results.length),
    results,
  };
}
