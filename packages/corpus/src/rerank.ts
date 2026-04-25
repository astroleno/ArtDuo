import { tokenizeKeywordText, tokenizeQueryText } from "./query-embedding";
import type { VectorSearchDocument, VectorSearchResult } from "./vector-search";

export interface LexicalSearchResult<T> {
  item: T;
  score: number;
  matchedTokens: string[];
  rank: number;
}

export interface RerankedVectorResult<T extends VectorSearchDocument> extends VectorSearchResult<T> {
  lexicalScore: number;
  gradeScore: number;
  combinedScore: number;
  matchedTokens: string[];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizeGrade(grade: string | undefined): number {
  if (grade === "A") {
    return 1;
  }
  if (grade === "B") {
    return 0.7;
  }
  if (grade === "C") {
    return 0.4;
  }

  return 0.55;
}

function getSortableId(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || !("id" in value)) {
    return undefined;
  }

  const id = (value as { id?: unknown }).id;
  return typeof id === "string" ? id : undefined;
}

function scoreTokenCoverage(queryTokens: string[], documentTokens: string[]): {
  score: number;
  matchedTokens: string[];
} {
  if (queryTokens.length === 0 || documentTokens.length === 0) {
    return { score: 0, matchedTokens: [] };
  }

  const documentTokenSet = new Set(documentTokens);
  const matchedTokens = unique(queryTokens.filter((token) => documentTokenSet.has(token)));
  const score = matchedTokens.length / queryTokens.length;

  return {
    score: Number(score.toFixed(6)),
    matchedTokens,
  };
}

export function buildLexicalRanking<T>(
  queryText: string,
  items: T[],
  options: {
    getText: (item: T) => string;
    limit?: number;
  },
): LexicalSearchResult<T>[] {
  const limit = options.limit ?? 10;
  const queryTokens = tokenizeQueryText(queryText);

  return items
    .map((item) => {
      const { score, matchedTokens } = scoreTokenCoverage(queryTokens, tokenizeQueryText(options.getText(item)));

      return {
        item,
        score,
        matchedTokens,
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.matchedTokens.length - right.matchedTokens.length;
    })
    .slice(0, limit)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}

export function buildKeywordBaselineRanking<T>(
  queryText: string,
  items: T[],
  options: {
    getText: (item: T) => string;
    limit?: number;
  },
): LexicalSearchResult<T>[] {
  const limit = options.limit ?? 10;
  const queryTokens = tokenizeKeywordText(queryText);

  return items
    .map((item) => {
      const { score, matchedTokens } = scoreTokenCoverage(queryTokens, tokenizeKeywordText(options.getText(item)));

      return {
        item,
        score,
        matchedTokens,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const leftId = getSortableId(left.item);
      const rightId = getSortableId(right.item);

      if (leftId && rightId) {
        return leftId.localeCompare(rightId);
      }

      return left.matchedTokens.length - right.matchedTokens.length;
    })
    .slice(0, limit)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}

export function rerankVectorResults<T extends VectorSearchDocument>(
  queryText: string,
  vectorResults: VectorSearchResult<T>[],
  options: {
    getText: (item: T) => string;
    getGrade?: (item: T) => string | undefined;
    limit?: number;
  },
): RerankedVectorResult<T>[] {
  const limit = options.limit ?? vectorResults.length;
  const queryTokens = tokenizeQueryText(queryText);

  return vectorResults
    .map((entry) => {
      const lexical = scoreTokenCoverage(queryTokens, tokenizeQueryText(options.getText(entry.item)));
      const gradeScore = normalizeGrade(options.getGrade?.(entry.item));
      const combinedScore =
        entry.score * 0.72 +
        lexical.score * 0.22 +
        gradeScore * 0.06;

      return {
        ...entry,
        lexicalScore: lexical.score,
        gradeScore,
        combinedScore: Number(combinedScore.toFixed(6)),
        matchedTokens: lexical.matchedTokens,
      };
    })
    .sort((left, right) => {
      if (right.combinedScore !== left.combinedScore) {
        return right.combinedScore - left.combinedScore;
      }
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.item.id.localeCompare(right.item.id);
    })
    .slice(0, limit)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}
