import assert from "node:assert/strict";
import { test } from "node:test";

import type { EmbeddingShardRecord } from "@artduo/contracts";

import { createFallbackEmbeddingProvider, type TextEmbeddingProvider } from "./embedding-provider";
import { runRetrievalDebug, runRetrievalDebugWithProvider } from "./debug-retrieval";
import { embedText } from "./query-embedding";

test("debug retrieval returns vector top-k, rerank, and keyword baseline", () => {
  const records: EmbeddingShardRecord[] = [
    {
      id: "met-1",
      source: "met",
      sourceArtworkId: "1",
      version: "test",
      model: "local-hash-embedding-v1",
      dimensions: 256,
      title: "Oracle",
      grade: "A",
      moodTags: ["mystery"],
      text: "oracle shadow mystery secret",
      tokenCount: 4,
      vector: embedText("oracle shadow mystery secret").vector,
    },
    {
      id: "met-2",
      source: "met",
      sourceArtworkId: "2",
      version: "test",
      model: "local-hash-embedding-v1",
      dimensions: 256,
      title: "Repose",
      grade: "B",
      moodTags: ["serenity"],
      text: "tranquil stillness quiet repose",
      tokenCount: 4,
      vector: embedText("tranquil stillness quiet repose").vector,
    },
  ];

  const result = runRetrievalDebug("enigmatic oracle shadowed hall", records, { limit: 2 });

  assert.equal(result.vectorTopK[0]?.theme, "mystery");
  assert.equal(result.rerankedTopK[0]?.theme, "mystery");
  assert.equal(result.lexicalTopK[0]?.theme, "mystery");
  assert.equal(result.recordCount, 2);
});

test("debug retrieval can embed queries through a fallback provider", async () => {
  const records: EmbeddingShardRecord[] = [
    {
      id: "met-1",
      source: "met",
      sourceArtworkId: "1",
      version: "test",
      model: "local-hash-embedding-v1",
      dimensions: 256,
      title: "Oracle",
      grade: "A",
      moodTags: ["mystery"],
      text: "oracle shadow mystery secret",
      tokenCount: 4,
      vector: embedText("oracle shadow mystery secret").vector,
    },
  ];
  const failingRemote: TextEmbeddingProvider = {
    mode: "remote-openai-compatible",
    model: "broken-remote",
    async embedText(): Promise<never> {
      throw new Error("network down");
    },
    async embedTexts(): Promise<never> {
      throw new Error("network down");
    },
  };

  const result = await runRetrievalDebugWithProvider("enigmatic oracle shadowed hall", records, {
    embeddingProvider: createFallbackEmbeddingProvider(failingRemote, {
      mode: "local-hash",
      model: "local-hash-embedding-v1",
      async embedText(query) {
        return {
          provider: "local-hash",
          ...embedText(query),
        };
      },
      async embedTexts(values) {
        return values.map((value) => ({
          provider: "local-hash" as const,
          ...embedText(value),
        }));
      },
    }),
  });

  assert.equal(result.provider, "local-hash");
  assert.equal(result.rerankedTopK[0]?.theme, "mystery");
});
