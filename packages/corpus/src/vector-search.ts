export interface VectorSearchDocument {
  id: string;
  vector: number[];
}

export interface VectorSearchResult<T extends VectorSearchDocument> {
  item: T;
  score: number;
  rank: number;
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length !== right.length) {
    throw new TypeError(`Embedding dimension mismatch: ${left.length} !== ${right.length}`);
  }

  let score = 0;

  for (let index = 0; index < left.length; index += 1) {
    score += left[index] * right[index];
  }

  return Number(score.toFixed(6));
}

export function searchVectorIndex<T extends VectorSearchDocument>(
  queryVector: number[],
  documents: T[],
  options: {
    limit?: number;
    minScore?: number;
  } = {},
): VectorSearchResult<T>[] {
  const limit = options.limit ?? 10;
  const minScore = options.minScore ?? -1;

  return documents
    .map((item) => ({
      item,
      score: cosineSimilarity(queryVector, item.vector),
    }))
    .filter((entry) => entry.score >= minScore)
    .sort((left, right) => {
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
