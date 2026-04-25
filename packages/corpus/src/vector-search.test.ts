import assert from "node:assert/strict";
import { test } from "node:test";

import { embedText } from "./query-embedding";
import { searchVectorIndex } from "./vector-search";

test("vector search returns the closest document first", () => {
  const documents = [
    { id: "wonder-1", vector: embedText("wonder awe bright miracle").vector },
    { id: "mystery-1", vector: embedText("mystery oracle shadow secret").vector },
    { id: "joy-1", vector: embedText("joy cheerful bright celebration").vector },
  ];

  const results = searchVectorIndex(embedText("enigmatic oracle").vector, documents, { limit: 2 });

  assert.equal(results.length, 2);
  assert.equal(results[0]?.item.id, "mystery-1");
  assert.ok((results[0]?.score ?? 0) > (results[1]?.score ?? 0));
});
