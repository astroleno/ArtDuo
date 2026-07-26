import type { EmbeddingShardRecord } from "@artduo/contracts";

import { createLocalHashEmbeddingProvider, type EmbeddedTextVector, type TextEmbeddingProvider } from "./embedding-provider";
import { embedText } from "./query-embedding";
import { buildKeywordBaselineRanking, rerankVectorResults } from "./rerank";
import {
  selectRelationshipGraphEvidence,
  type RelationshipGraphEvidenceItem,
  type RelationshipGraphIndex,
} from "./relationship-graph";
import { searchVectorIndex } from "./vector-search";

export interface RetrievalDebugRelationshipGraphSummary {
  selectorVersion: RelationshipGraphIndex["selectorVersion"];
  status: RelationshipGraphIndex["status"];
  releaseVersion?: string;
  unavailableReason?: RelationshipGraphIndex["unavailableReason"];
  unavailableMessage?: string;
  nodeCount: number;
  edgeCount: number;
  warnings: string[];
}

export interface RetrievalDebugOptions {
  limit?: number;
  minScore?: number;
  relationshipGraphIndex?: RelationshipGraphIndex;
  relationshipEvidenceLimit?: number;
  relationshipEvidenceMaxFanoutPerNode?: number;
  relationshipEvidenceMaxSourceRefsPerEvidence?: number;
}

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
  relationshipEvidence?: RelationshipGraphEvidenceItem[];
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
  relationshipGraph?: RetrievalDebugRelationshipGraphSummary;
}

function toEntry(record: EmbeddingShardRecord, rank: number, vectorScore: number): RetrievalDebugEntry {
  return {
    id: record.id,
    title: record.title,
    artistDisplayName: record.artistDisplayName,
    sourceArtworkId: record.sourceArtworkId,
    theme: record.theme,
    grade: record.grade,
    rank,
    vectorScore,
  };
}

function relationshipGraphSummary(index: RelationshipGraphIndex): RetrievalDebugRelationshipGraphSummary {
  return {
    selectorVersion: index.selectorVersion,
    status: index.status,
    releaseVersion: index.releaseVersion,
    unavailableReason: index.unavailableReason,
    unavailableMessage: index.unavailableMessage,
    nodeCount: index.nodeCount,
    edgeCount: index.edgeCount,
    warnings: index.status === "ready"
      ? []
      : [`Relationship graph ${index.unavailableReason}; relationshipEvidence is empty.`],
  };
}

function addRelationshipEvidence(
  entry: RetrievalDebugEntry,
  record: EmbeddingShardRecord,
  options: RetrievalDebugOptions,
): RetrievalDebugEntry {
  if (!options.relationshipGraphIndex) {
    return entry;
  }

  return {
    ...entry,
    relationshipEvidence: selectRelationshipGraphEvidence(options.relationshipGraphIndex, record.id, {
      maxResults: options.relationshipEvidenceLimit,
      maxFanoutPerNode: options.relationshipEvidenceMaxFanoutPerNode,
      maxSourceRefsPerEvidence: options.relationshipEvidenceMaxSourceRefsPerEvidence,
    }),
  };
}

function buildRetrievalDebugResult(
  query: string,
  records: EmbeddingShardRecord[],
  embedded: EmbeddedTextVector,
  options: RetrievalDebugOptions,
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

  const result: RetrievalDebugResult = {
    query,
    provider: embedded.provider,
    normalizedQuery: embedded.normalizedText,
    model: embedded.model,
    dimensions: embedded.dimensions,
    recordCount: records.length,
    vectorTopK: vectorTopK.map((entry) => addRelationshipEvidence(
      toEntry(entry.item, entry.rank, entry.score),
      entry.item,
      options,
    )),
    rerankedTopK: rerankedTopK.map((entry) => ({
      ...addRelationshipEvidence(toEntry(entry.item, entry.rank, entry.score), entry.item, options),
      lexicalScore: entry.lexicalScore,
      combinedScore: entry.combinedScore,
      matchedTokens: entry.matchedTokens,
    })),
    lexicalTopK: lexicalTopK.map((entry) => ({
      ...addRelationshipEvidence(toEntry(entry.item, entry.rank, entry.score), entry.item, options),
      lexicalScore: entry.score,
      matchedTokens: entry.matchedTokens,
    })),
  };

  if (options.relationshipGraphIndex) {
    result.relationshipGraph = relationshipGraphSummary(options.relationshipGraphIndex);
  }

  return result;
}

export function runRetrievalDebug(
  query: string,
  records: EmbeddingShardRecord[],
  options: RetrievalDebugOptions = {},
): RetrievalDebugResult {
  return buildRetrievalDebugResult(query, records, {
    provider: "local-hash",
    ...embedText(query),
  }, options);
}

export async function runRetrievalDebugWithProvider(
  query: string,
  records: EmbeddingShardRecord[],
  options: RetrievalDebugOptions & {
    embeddingProvider?: TextEmbeddingProvider;
  } = {},
): Promise<RetrievalDebugResult> {
  const embeddingProvider = options.embeddingProvider ?? createLocalHashEmbeddingProvider();
  const embedded = await embeddingProvider.embedText(query, {
    dimensions: records[0]?.dimensions,
  });

  return buildRetrievalDebugResult(query, records, embedded, options);
}
