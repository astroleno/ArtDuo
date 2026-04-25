import type { EmbeddingShardRecord } from "@artduo/contracts";

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

export function runRetrievalDebug(
  query: string,
  records: EmbeddingShardRecord[],
  options: {
    limit?: number;
    minScore?: number;
  } = {},
): RetrievalDebugResult {
  const embedded = embedText(query);
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
