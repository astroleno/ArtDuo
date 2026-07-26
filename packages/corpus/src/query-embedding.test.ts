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
  assert.ok(tokenizeQueryText("今天想看快乐、跳跃、明亮的东西").includes("joy"));
  assert.ok(tokenizeQueryText("给我像书房一样专注的路线").includes("contemplation"));
  assert.ok(tokenizeQueryText("像进入一座古老教堂，庄重但温柔").includes("awe"));
  assert.ok(tokenizeQueryText("关于想念、远方和没说出口的话").includes("desire"));
  assert.ok(tokenizeQueryText("我今天不太想说话，只想看留白").includes("silence"));
  assert.ok(tokenizeQueryText("I want happiness in a museum whisper").includes("joy"));
  assert.ok(tokenizeQueryText("有没有风景，最好像走到远处").includes("landscape"));
  assert.ok(tokenizeQueryText("暖金色的房间，适合慢慢停留").includes("gold"));
  assert.ok(tokenizeQueryText("I need a quiet room after a difficult day").includes("serenity"));
  assert.ok(tokenizeQueryText("warm museum hall, gold, reverent, old-world").includes("wonder"));
  assert.ok(tokenizeQueryText("我想看蓝灰色、冷一点、很安静").includes("serenity"));
  assert.ok(!tokenizeQueryText("不要太明亮，想要暗红和深木色").includes("joy"));
  assert.deepEqual(first.vector, second.vector);
  assert.equal(first.model, "local-hash-embedding-v1");
  assert.equal(first.dimensions, 256);
  assert.ok(first.tokens.includes("mystery"));
});

test("quiet keeps its serenity expansion without injecting contemplation", () => {
  const tokens = tokenizeQueryText("I need a quiet room after a difficult day");

  assert.ok(tokens.includes("serenity"));
  assert.equal(tokens.includes("contemplation"), false);
});

test("quiet does not overwrite an explicit grief intent with serenity aliases", () => {
  const tokens = tokenizeQueryText("quiet grief beneath ash colored light");

  assert.ok(tokens.includes("quiet"));
  assert.ok(tokens.includes("grief"));
  assert.equal(tokens.includes("serenity"), false);
  assert.equal(tokens.includes("calm"), false);
  assert.equal(tokens.includes("stillness"), false);
});
