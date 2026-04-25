import assert from "node:assert/strict";
import { test } from "node:test";

import { parseEmbeddingShardRecords } from "./embedding-shard";

test("embedding shard records preserve retrieval debug metadata", () => {
  const records = parseEmbeddingShardRecords([
    {
      id: "met-1",
      source: "met",
      sourceArtworkId: "1",
      version: "2026-04-25-curation-b",
      theme: "mystery",
      model: "local-hash-embedding-v1",
      dimensions: 4,
      title: "Oracle",
      artistDisplayName: "Jane Painter",
      grade: "A",
      moodTags: ["mystery"],
      text: "oracle shadow mystery",
      tokenCount: 3,
      vector: [0.5, 0.5, 0.5, 0.5],
    },
  ]);

  assert.equal(records[0]?.title, "Oracle");
  assert.equal(records[0]?.grade, "A");
  assert.equal(records[0]?.theme, "mystery");
  assert.deepEqual(records[0]?.moodTags, ["mystery"]);
  assert.equal(records[0]?.vector.length, 4);
});
