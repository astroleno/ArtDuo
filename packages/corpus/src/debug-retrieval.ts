import type { EmbeddingShardRecord } from "@artduo/contracts";

import { createLocalHashEmbeddingProvider, type EmbeddedTextVector, type TextEmbeddingProvider } from "./embedding-provider";
import { embedText } from "./query-embedding";
import { buildKeywordBaselineRanking, rerankVectorResults } from "./rerank";
import { searchVectorIndex } from "./vector-search";

export interface RetrievalDebugEntry {
  id: string;
  title: string;
  artistDisplayName?: string;
  sourceArtworkId: string;
  theme?: string;
  grade: string;
  rank: number;
  vectorScore: number;
  lexicalScore?: number;
  combinedScore?: number;
  matchedTokens?: string[];
}

export interface RetrievalDebugResult {
  query: string;
  provider: string;
  normalizedQuery: string;
  model: string;
  dimensions: number;
  recordCount: number;
  vectorTopK: RetrievalDebugEntry[];
  rerankedTopK: RetrievalDebugEntry[];
  lexicalTopK: Array<RetrievalDebugEntry & { lexicalScore: number; matchedTokens: string[] }>;
}

function toEntry(record: EmbeddingShardRecord, rank: number, vectorScore: number): RetrievalDebugEntry {
  return {
    id: record.id,
    title: record.title,
    artistDisplayName: record.artistDisplayName,
    sourceArtworkId: record.sourceArtworkId,
    theme: record.moodTags[0],
    grade: record.grade,
    rank,
    vectorScore,
  };
}

function buildRetrievalDebugResult(
  query: string,
  records: EmbeddingShardRecord[],
  embedded: EmbeddedTextVector,
  options: {
    limit?: number;
    minScore?: number;
  },
): RetrievalDebugResult {
  const limit = options.limit ?? 10;
  const vectorTopK = searchVectorIndex(embedded.vector, records, {
    limit,
    minScore: options.minScore,
  });
  const rerankedTopK = rerankVectorResults(query, vectorTopK, {
    getText: (record) => record.text,
    getGrade: (record) => record.grade,
    limit,
  });
  const lexicalTopK = buildKeywordBaselineRanking(query, records, {
    getText: (record) => record.text,
    limit,
  });

  return {
    query,
    provider: embedded.provider,
    normalizedQuery: embedded.normalizedText,
    model: embedded.model,
    dimensions: embedded.dimensions,
    recordCount: records.length,
    vectorTopK: vectorTopK.map((entry) => toEntry(entry.item, entry.rank, entry.score)),
    rerankedTopK: rerankedTopK.map((entry) => ({
      ...toEntry(entry.item, entry.rank, entry.score),
      lexicalScore: entry.lexicalScore,
      combinedScore: entry.combinedScore,
      matchedTokens: entry.matchedTokens,
    })),
    lexicalTopK: lexicalTopK.map((entry) => ({
      ...toEntry(entry.item, entry.rank, entry.score),
      lexicalScore: entry.score,
      matchedTokens: entry.matchedTokens,
    })),
  };
}

export function runRetrievalDebug(
  query: string,
  records: EmbeddingShardRecord[],
  options: {
    limit?: number;
    minScore?: number;
  } = {},
): RetrievalDebugResult {
  return buildRetrievalDebugResult(query, records, {
    provider: "local-hash",
    ...embedText(query),
  }, options);
}

export async function runRetrievalDebugWithProvider(
  query: string,
  records: EmbeddingShardRecord[],
  options: {
    limit?: number;
    minScore?: number;
    embeddingProvider?: TextEmbeddingProvider;
  } = {},
): Promise<RetrievalDebugResult> {
  const embeddingProvider = options.embeddingProvider ?? createLocalHashEmbeddingProvider();
  const embedded = await embeddingProvider.embedText(query, {
    dimensions: records[0]?.dimensions,
  });

  return buildRetrievalDebugResult(query, records, embedded, options);
}
