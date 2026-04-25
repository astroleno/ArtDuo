import assert from "node:assert/strict";
import { test } from "node:test";

import type { EmbeddingShardRecord } from "@artduo/contracts";

import { embedText } from "./query-embedding";
import { runVectorBenchmark } from "./vector-benchmark";

test("vector benchmark reports rerank hit rates over fixed prompts", () => {
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

  const benchmark = runVectorBenchmark([
    { id: "mystery-1", query: "enigmatic oracle shadowed hall", expectedThemes: ["mystery"] },
    { id: "serenity-1", query: "tranquil stillness quiet reflection", expectedThemes: ["serenity"] },
  ], records, { limit: 5 });

  assert.equal(benchmark.promptCount, 2);
  assert.equal(benchmark.rerankTop1HitRate, 1);
  assert.equal(benchmark.rerankTop5HitRate, 1);
});
