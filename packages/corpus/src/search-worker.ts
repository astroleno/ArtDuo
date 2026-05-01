import type { EmbeddingShardRecord } from "@artduo/contracts";

import { searchVectorIndex } from "./vector-search";

export type SearchWorkerRequest = { type: "search"; query: string; limit: number };
export type SearchWorkerResponse = { type: "result"; artworkIds: string[] } | { type: "error"; message: string };

export interface SearchWorkerHandlerOptions {
  documents: EmbeddingShardRecord[];
  embed: (query: string) => number[];
}

export function createSearchWorkerHandler(options: SearchWorkerHandlerOptions) {
  return (request: SearchWorkerRequest): SearchWorkerResponse => {
    try {
      if (request.type !== "search") {
        return { type: "error", message: "Unsupported request" };
      }

      const queryVector = options.embed(request.query);
      const documents = options.documents.map((record) => ({ id: record.id, vector: record.vector }));
      const hits = searchVectorIndex(queryVector, documents, { limit: request.limit });

      return {
        type: "result",
        artworkIds: hits.map((entry) => entry.item.id),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Search worker failed";
      return { type: "error", message };
    }
  };
}
