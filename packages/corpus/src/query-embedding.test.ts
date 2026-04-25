import assert from "node:assert/strict";
import { test } from "node:test";

import { embedText, normalizeQueryText, tokenizeQueryText } from "./query-embedding";

test("query embedding normalizes and embeds text deterministically", () => {
  const first = embedText("Enigmatic oracle in a shadowed hall");
  const second = embedText("enigmatic oracle in a shadowed hall");

  assert.equal(normalizeQueryText(" Enigmatic   ORACLE "), "enigmatic oracle");
  assert.deepEqual(tokenizeQueryText("tranquil stillness"), [
    "tranquil",
    "serenity",
    "calm",
    "peaceful",
    "still",
    "stillness",
    "tranquil:stillness",
  ]);
  assert.deepEqual(first.vector, second.vector);
  assert.equal(first.model, "local-hash-embedding-v1");
  assert.equal(first.dimensions, 256);
  assert.ok(first.tokens.includes("mystery"));
});
