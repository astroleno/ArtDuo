import assert from "node:assert/strict";
import test from "node:test";

import {
  MULTITEXT_CASES,
  MULTITEXT_PROMPT_VARIANTS,
  buildMultitextPrompt,
  gradeMultitextOutput,
  parseMultitextOutput,
  summarizeMultitextRuns,
} from "./deepseek-multitext-prompt.mjs";

test("matrix contains four cases in each requested text category", () => {
  const counts = Object.groupBy(MULTITEXT_CASES, (item) => item.category);
  assert.equal(counts.emotion.length, 4);
  assert.equal(counts.artwork_intro.length, 4);
  assert.equal(counts.framing_text.length, 4);
});

test("source-isolated prompt adapts its JSON contract to each category", () => {
  assert.deepEqual(MULTITEXT_PROMPT_VARIANTS, ["plain", "source-isolated-v1", "source-isolated-v2", "source-isolated-v3"]);
  for (const item of MULTITEXT_CASES) {
    const prompt = buildMultitextPrompt(item, "source-isolated-v1");
    assert.match(prompt, /只返回一个 JSON 对象/);
    assert.match(prompt, /封闭信息源/);
    assert.match(prompt, new RegExp(item.output.fields[0]));
    assert.ok(prompt.length < 8000);
  }
});

test("source-isolated v2 adds category-specific anti-invention checks", () => {
  const emotion = buildMultitextPrompt(MULTITEXT_CASES.find((item) => item.id === "emotion_neutral_now"), "source-isolated-v2");
  const artwork = buildMultitextPrompt(MULTITEXT_CASES.find((item) => item.id === "art_uncertain_attribution"), "source-isolated-v2");
  const framing = buildMultitextPrompt(MULTITEXT_CASES.find((item) => item.id === "preface_incomplete_archive"), "source-isolated-v2");

  assert.match(emotion, /不新增现场动作/);
  assert.match(artwork, /记录日期不等于制作日期/);
  assert.match(framing, /每个事实性分句/);
  assert.match(framing, /保存或流转造成/);
});

test("source-isolated v3 gives framing text a fact-ledger drafting scaffold", () => {
  const prompt = buildMultitextPrompt(MULTITEXT_CASES.find((item) => item.id === "closing_night_photos"), "source-isolated-v3");

  assert.match(prompt, /事实清单 → 未知清单 → 正文/);
  assert.match(prompt, /逐个名词和主题反查/);
  assert.match(prompt, /合格示例/);
  assert.match(prompt, /宁可少写/);
});

test("sparse and conflicting artwork records receive explicit evidence modes", () => {
  const sparse = MULTITEXT_CASES.find((item) => item.id === "art_sparse_untitled");
  const conflict = MULTITEXT_CASES.find((item) => item.id === "art_record_conflict");
  assert.match(buildMultitextPrompt(sparse, "source-isolated-v1"), /evidence_mode="metadata_limited"/);
  assert.match(buildMultitextPrompt(conflict, "source-isolated-v1"), /evidence_mode="record_conflict"/);
});

test("parser accepts strict and fenced JSON", () => {
  const value = { introduction: "介绍", evidence_boundary: "边界" };
  assert.deepEqual(parseMultitextOutput(JSON.stringify(value)).parsed, value);
  assert.deepEqual(parseMultitextOutput(`\`\`\`json\n${JSON.stringify(value)}\n\`\`\``).parsed, value);
});

test("grader rejects unsupported artwork claims even when the JSON shape is valid", () => {
  const item = MULTITEXT_CASES.find((entry) => entry.id === "art_sparse_untitled");
  const grade = gradeMultitextOutput(item, {
    introduction: "这件《无题》纸上墨水作品的黑色线条在大面积留白中形成安静构图，也表现出作者对孤独的关注。",
    evidence_boundary: "作者与年代不详。",
  });
  assert.equal(grade.passed, false);
  assert.ok(grade.failures.some((failure) => failure.type === "unsupported_claim"));
});

test("summary reports variant totals and category hard-pass rates", () => {
  const summary = summarizeMultitextRuns([
    { variant: "plain", category: "emotion", parsed: {}, grade: { passed: true, coreCoverage: 1 }, firstTextMs: 100, totalMs: 500, usage: { input_tokens: 50, output_tokens: 20 } },
    { variant: "plain", category: "artwork_intro", parsed: {}, grade: { passed: false, coreCoverage: 0.5 }, firstTextMs: 200, totalMs: 700, usage: { input_tokens: 60, output_tokens: 30 } },
    { variant: "plain", category: "artwork_intro", parsed: null, grade: null, firstTextMs: null, totalMs: 900, usage: {} },
  ]);
  assert.equal(summary[0].samples, 3);
  assert.equal(summary[0].usable, 2);
  assert.equal(summary[0].hardPassRate, 1 / 3);
  assert.equal(summary[0].categories.artwork_intro.hardPassRate, 0);
});

test("grader does not count an explicitly negated forbidden phrase as a violation", () => {
  const item = MULTITEXT_CASES.find((entry) => entry.id === "emotion_relief_guilt");
  const grade = gradeMultitextOutput(item, {
    emotion_read: "项目取消让你松了口气，同时也对团队先前的投入感到愧疚。",
    response: "轻松与愧疚可以同时存在，它们分别回应压力停止和团队付出。我不会劝你看开，也不急着替这两种感受排出先后。",
    boundary: "不了解项目和团队后续，只回应你明确说出的感受。",
  });
  assert.equal(grade.failures.some((failure) => failure.type === "forbidden"), false);
});
