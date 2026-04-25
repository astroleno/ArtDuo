import assert from "node:assert/strict";
import { test } from "node:test";

import { buildKeywordBaselineRanking, buildLexicalRanking, rerankVectorResults } from "./rerank";

test("rerank combines vector score, lexical overlap, and grade", () => {
  const items = [
    { id: "a", vector: [0.9, 0.1], text: "enigmatic oracle shadow hall", grade: "A" },
    { id: "b", vector: [0.88, 0.12], text: "mystery oracle chamber", grade: "B" },
    { id: "c", vector: [0.4, 0.6], text: "joyful bright parade", grade: "A" },
  ];

  const lexical = buildLexicalRanking("enigmatic oracle", items, {
    getText: (item) => item.text,
    limit: 2,
  });
  const reranked = rerankVectorResults("enigmatic oracle", [
    { item: items[1], score: 0.88, rank: 1 },
    { item: items[0], score: 0.87, rank: 2 },
  ], {
    getText: (item) => item.text,
    getGrade: (item) => item.grade,
  });

  assert.equal(lexical[0]?.item.id, "a");
  assert.equal(reranked[0]?.item.id, "a");
  assert.ok((reranked[0]?.combinedScore ?? 0) > (reranked[1]?.combinedScore ?? 0));
});

test("keyword baseline ranking uses exact non-stopword overlap", () => {
  const items = [
    { id: "a", text: "quiet reflection in shadow" },
    { id: "b", text: "tranquil stillness and repose" },
    { id: "c", text: "celebration of joy" },
  ];

  const lexical = buildKeywordBaselineRanking("tranquil stillness and quiet reflection", items, {
    getText: (item) => item.text,
    limit: 2,
  });

  assert.equal(lexical.length, 2);
  assert.equal(lexical[0]?.item.id, "a");
  assert.deepEqual(lexical[0]?.matchedTokens, ["quiet", "reflection"]);
  assert.equal(lexical[1]?.item.id, "b");
});
