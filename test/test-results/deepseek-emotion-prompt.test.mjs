import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PROMPT_VARIANTS,
  RECOMMENDED_PROMPT_VARIANT,
  buildSingleCasePrompt,
  extractOpenAIStreamDelta,
  gradeSingleOutput,
  parseSingleOutput,
  summarizeVariantRuns,
} from "./deepseek-emotion-prompt.mjs";

const golden = JSON.parse(readFileSync(new URL("./emotion-golden-cases-v1.json", import.meta.url), "utf8"));
const fearCase = golden.cases.find((item) => item.id === "fear");
const conflictCase = golden.cases.find((item) => item.id === "title_description_conflict");

test("recommended production variant is the frozen unseen-validation winner", () => {
  assert.equal(RECOMMENDED_PROMPT_VARIANT, "golden-aligned-v3");
});

test("single-case prompt exposes one object contract without the batch wrapper", () => {
  const prompt = buildSingleCasePrompt(fearCase, "contract-first");

  assert.match(prompt, /只返回一个 JSON 对象/);
  assert.match(prompt, /emotion_read/);
  assert.match(prompt, /art_connection/);
  assert.match(prompt, /事情发生时我会失去控制/);
  assert.match(prompt, /雷东1866年蚀刻版画《恐惧》/);
  assert.doesNotMatch(prompt, /"results"/);
});

test("every declared prompt variant builds a bounded single-case request", () => {
  for (const variant of PROMPT_VARIANTS) {
    const prompt = buildSingleCasePrompt(fearCase, variant);
    assert.ok(prompt.length < 7000, `${variant} prompt should stay compact`);
    assert.match(prompt, /不要输出思考过程/);
    assert.match(prompt, /45–90/);
    assert.match(prompt, /45–100/);
  }
});

test("golden-aligned prompt uses a hard artwork fact gate and midpoint length targets", () => {
  assert.ok(PROMPT_VARIANTS.includes("golden-aligned-v1"));
  const prompt = buildSingleCasePrompt(fearCase, "golden-aligned-v1");

  assert.match(prompt, /事实白名单/);
  assert.match(prompt, /无画面资料/);
  assert.match(prompt, /留白/);
  assert.match(prompt, /锁.*秘密/);
  assert.match(prompt, /55–80/);
  assert.match(prompt, /60–85/);
});

test("golden-aligned v2 isolates user and artwork sources with sentence-count scaffolding", () => {
  assert.ok(PROMPT_VARIANTS.includes("golden-aligned-v2"));
  const prompt = buildSingleCasePrompt(fearCase, "golden-aligned-v2");

  assert.match(prompt, /用户源与作品源隔离/);
  assert.match(prompt, /不得回写/);
  assert.match(prompt, /资料未提供.*作品中不存在/);
  assert.match(prompt, /reply.*恰好两句/s);
  assert.match(prompt, /art_connection.*恰好两句/s);
  assert.match(prompt, /不得承诺/);
});

test("golden-aligned v3 adds derived evidence mode and golden demonstrations", () => {
  assert.ok(PROMPT_VARIANTS.includes("golden-aligned-v3"));
  const sparsePrompt = buildSingleCasePrompt(fearCase, "golden-aligned-v3");
  const conflictPrompt = buildSingleCasePrompt(conflictCase, "golden-aligned-v3");

  assert.match(sparsePrompt, /evidence_mode="metadata_limited"/);
  assert.match(conflictPrompt, /evidence_mode="record_conflict"/);
  assert.match(sparsePrompt, /高质量示例/);
  assert.match(sparsePrompt, /我不会说“都会好的”/);
  assert.match(sparsePrompt, /单一标题不足以规定/);
  assert.match(sparsePrompt, /reply：恰好三句/);
});

test("parser accepts strict and fenced JSON objects", () => {
  const row = {
    emotion_read: "核心是害怕失控，而不是害怕失败本身，也担心临场无法掌握自己。",
    reply: "你担心的是事情发生时抓不住自己，这种不安很具体。我不会说你会没事；可以只辨认哪些环节能预先安排，哪些仍然未知。",
    art_connection: "雷东的蚀刻版画只有题名以及男人、马、丘陵等标签，或许可以让人想到一种尚未形成叙事的恐惧，但不能补出具体场景。",
    boundary: "资料有限，也无法据此判断你的实际风险。",
  };

  assert.deepEqual(parseSingleOutput(JSON.stringify(row)).parsed, row);
  assert.deepEqual(parseSingleOutput(`\n\`\`\`json\n${JSON.stringify(row)}\n\`\`\`\n`).parsed, row);
});

test("OpenAI-compatible stream events separate reasoning from visible output", () => {
  assert.deepEqual(extractOpenAIStreamDelta({
    model: "deepseek-v4-flash",
    choices: [{ delta: { reasoning_content: "先检查边界", content: "{\"emotion_read\":" }, finish_reason: null }],
    usage: { prompt_tokens: 80, completion_tokens: 12 },
  }), {
    text: "{\"emotion_read\":",
    thinking: "先检查边界",
    finishReason: null,
    model: "deepseek-v4-flash",
    usage: { input_tokens: 80, output_tokens: 12 },
  });
});

test("grader allows an explicitly negated reassurance phrase", () => {
  const row = {
    emotion_read: "核心是害怕失控，而不是害怕失败本身，也担心临场无法掌握自己。",
    reply: "你担心的是事情发生时抓不住自己，这种不安很具体。我不会说你会没事；可以只辨认哪些环节能预先安排，哪些仍然未知。",
    art_connection: "雷东的蚀刻版画只有题名以及男人、马、丘陵等标签，或许可以让人想到一种尚未形成叙事的恐惧，但不能补出具体场景。",
    boundary: "资料有限，也无法据此判断你的实际风险。",
  };

  const grade = gradeSingleOutput(fearCase, row);
  assert.equal(grade.passed, true, JSON.stringify(grade.failures));
});

test("grader rejects artwork details outside the supplied evidence", () => {
  const row = {
    emotion_read: "核心是害怕失控，而不是害怕失败本身，也担心临场无法掌握自己。",
    reply: "你担心的是事情发生时抓不住自己，这种不安很具体。我不会保证结果；可以只辨认哪些环节能预先安排，哪些仍然未知。",
    art_connection: "画中马匹受惊并开始奔跑，或许可以让人想到事情忽然失控时的慌乱，以及人在现场无法稳定自己的感受。",
    boundary: "资料有限，也无法据此判断你的实际风险。",
  };

  const grade = gradeSingleOutput(fearCase, row);
  assert.equal(grade.passed, false);
  assert.ok(grade.failures.some((failure) => failure.type === "unsupported_art_detail"));
});

test("unknown prompt variants are rejected", () => {
  assert.throws(() => buildSingleCasePrompt(fearCase, "unknown"), /Unknown prompt variant/);
});

test("variant summary counts missing final text as a failed case and reports medians", () => {
  const summary = summarizeVariantRuns([
    { variant: "baseline", parsed: {}, grade: { passed: true, coreCoverage: 1 }, firstTextMs: 1000, totalMs: 3000, usage: { output_tokens: 100 } },
    { variant: "baseline", parsed: null, grade: null, firstTextMs: null, totalMs: 9000, usage: { output_tokens: 4096 } },
    { variant: "baseline", parsed: {}, grade: { passed: false, coreCoverage: 0.5 }, firstTextMs: 2000, totalMs: 4000, usage: { output_tokens: 200 } },
  ]);

  assert.deepEqual(summary, [{
    variant: "baseline",
    samples: 3,
    usable: 2,
    hardPasses: 1,
    hardPassRate: 1 / 3,
    coreCoverageAverage: 0.5,
    firstTextMedianMs: 1500,
    totalMedianMs: 4000,
    outputTokensAverage: 1465.3333333333333,
  }]);
});
