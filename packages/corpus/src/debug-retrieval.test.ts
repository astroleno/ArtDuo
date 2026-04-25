import assert from "node:assert/strict";
import { test } from "node:test";

import type { EmbeddingShardRecord } from "@artduo/contracts";

import { runRetrievalDebug } from "./debug-retrieval";
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
