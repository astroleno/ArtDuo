import assert from "node:assert/strict";
import { test } from "node:test";

import { embedText, normalizeQueryText, tokenizeKeywordText, tokenizeQueryText } from "./query-embedding";

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
    "quiet",
    "tranquil:stillness",
  ]);
  assert.deepEqual(tokenizeKeywordText("tranquil stillness"), ["tranquil", "stillness"]);
  assert.ok(tokenizeQueryText("optimism renewal").includes("hope"));
  assert.deepEqual(tokenizeKeywordText("renewal after darkness"), ["renewal", "darkness"]);
  assert.ok(tokenizeQueryText("静默沉思 cloister reflection").includes("contemplation"));
  assert.ok(tokenizeQueryText("渴望 devotion and longing").includes("desire"));
  assert.ok(tokenizeQueryText("神谕 shadowed chamber secret").includes("mystery"));
  assert.ok(tokenizeQueryText("restful hush beside clear water").includes("serenity"));
  assert.ok(tokenizeQueryText("laughter carried by festival air").includes("joy"));
  assert.ok(tokenizeQueryText("revelation under impossible skies").includes("wonder"));
  assert.deepEqual(first.vector, second.vector);
  assert.equal(first.model, "local-hash-embedding-v1");
  assert.equal(first.dimensions, 256);
  assert.ok(first.tokens.includes("mystery"));
});
