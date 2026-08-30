import assert from "node:assert/strict";
import test from "node:test";

import {
  MULTITEXT_CASES,
  MULTITEXT_PROMPT_VARIANTS,
  buildMultitextPrompt,
  buildMultitextRepairPrompt,
  classifyMultitextRiskProfile,
  classifyMultitextTask,
  collectV31GuardIssues,
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
  assert.deepEqual(MULTITEXT_PROMPT_VARIANTS, ["plain", "source-isolated-v1", "source-isolated-v2", "source-isolated-v3", "source-isolated-v3.1", "task-routed-v4", "task-routed-v4.1", "task-routed-v4.2"]);
  for (const item of MULTITEXT_CASES) {
    const prompt = buildMultitextPrompt(item, "source-isolated-v1");
    assert.match(prompt, /只返回一个 JSON 对象/);
    assert.match(prompt, /封闭信息源/);
    assert.match(prompt, new RegExp(item.output.fields[0]));
    assert.ok(prompt.length < 8000);
  }
});

test("task router separates emotion, artwork, preface, and closing requests", () => {
  const routes = Object.fromEntries(MULTITEXT_CASES.map((item) => [item.id, classifyMultitextTask(item)]));

  assert.equal(routes.emotion_relief_guilt, "emotion_response");
  assert.equal(routes.art_rich_contrast, "artwork_intro");
  assert.equal(routes.preface_repair, "exhibition_preface");
  assert.equal(routes.preface_incomplete_archive, "exhibition_preface");
  assert.equal(routes.closing_night_photos, "exhibition_closing");
  assert.equal(routes.closing_memorial_objects, "exhibition_closing");
});

test("task-routed v4 sends only the selected task contract", () => {
  const emotion = buildMultitextPrompt(MULTITEXT_CASES.find((item) => item.id === "emotion_relief_guilt"), "task-routed-v4");
  const artwork = buildMultitextPrompt(MULTITEXT_CASES.find((item) => item.id === "art_uncertain_attribution"), "task-routed-v4");
  const preface = buildMultitextPrompt(MULTITEXT_CASES.find((item) => item.id === "preface_repair"), "task-routed-v4");
  const closing = buildMultitextPrompt(MULTITEXT_CASES.find((item) => item.id === "closing_memorial_objects"), "task-routed-v4");

  assert.match(emotion, /task_type="emotion_response"/);
  assert.match(artwork, /task_type="artwork_intro"/);
  assert.match(preface, /task_type="exhibition_preface"/);
  assert.match(closing, /task_type="exhibition_closing"/);
  assert.doesNotMatch(emotion, /作品介绍规则|前言规则|结语规则/);
  assert.doesNotMatch(artwork, /情感回应规则|前言规则|结语规则/);
  assert.doesNotMatch(preface, /情感回应规则|作品介绍规则|结语规则/);
  assert.doesNotMatch(closing, /情感回应规则|作品介绍规则|前言规则/);
});

test("task-routed v4 is shorter than the current recommended hybrid without dropping high-risk guards", () => {
  for (const item of MULTITEXT_CASES) {
    const baseline = buildMultitextPrompt(item, "source-isolated-v3");
    const routed = buildMultitextPrompt(item, "task-routed-v4");
    assert.ok(routed.length < baseline.length, `${item.id}: ${routed.length} should be shorter than ${baseline.length}`);
  }

  const night = buildMultitextPrompt(MULTITEXT_CASES.find((item) => item.id === "closing_night_photos"), "task-routed-v4");
  const memorial = buildMultitextPrompt(MULTITEXT_CASES.find((item) => item.id === "closing_memorial_objects"), "task-routed-v4");
  assert.match(night, /照片中人物的身份/);
  assert.doesNotMatch(night, /拍摄者身份|摄影者身份/);
  assert.match(memorial, /不预测.*心理.*精神结果/);
  assert.match(memorial, /停留或离开/);
});

test("task-routed v4.1 adds route-specific length plans and remains smaller than v3", () => {
  const expectedPlans = {
    emotion_relief_guilt: /response 写65–85字、两句/,
    emotion_neutral_now: /response 写14–28字/,
    art_sparse_untitled: /introduction 写125–160字、四句/,
    preface_repair: /text 写155–170字、五句/,
    closing_night_photos: /text 写130–145字、五句/,
    preface_incomplete_archive: /text 写155–170字、五句/,
    closing_memorial_objects: /text 写140–155字、五句/,
  };

  for (const [id, pattern] of Object.entries(expectedPlans)) {
    const item = MULTITEXT_CASES.find((entry) => entry.id === id);
    const prompt = buildMultitextPrompt(item, "task-routed-v4.1");
    assert.match(prompt, pattern);
    if (item.category === "framing_text") {
      assert.ok(prompt.length < buildMultitextPrompt(item, "source-isolated-v3").length - 300);
    }
  }

  const baselineChars = MULTITEXT_CASES.reduce((sum, item) => sum + buildMultitextPrompt(item, "source-isolated-v3").length, 0);
  const routedChars = MULTITEXT_CASES.reduce((sum, item) => sum + buildMultitextPrompt(item, "task-routed-v4.1").length, 0);
  assert.ok(routedChars < baselineChars * 0.8);
});

test("v4.2 risk profiler distinguishes explicit emotion, described artwork, uncertain records, and archive fragments", () => {
  const profile = (id) => classifyMultitextRiskProfile(MULTITEXT_CASES.find((item) => item.id === id));

  assert.equal(profile("emotion_apology_anger"), "explicit_emotions_only");
  assert.equal(profile("art_rich_contrast"), "described_artwork");
  assert.equal(profile("art_uncertain_attribution"), "uncertain_attribution");
  assert.equal(profile("preface_incomplete_archive"), "archive_record_fragments");
});

test("task-routed v4.2 isolates the three observed semantic failure families", () => {
  const apology = buildMultitextPrompt(MULTITEXT_CASES.find((item) => item.id === "emotion_apology_anger"), "task-routed-v4.2");
  const artwork = buildMultitextPrompt(MULTITEXT_CASES.find((item) => item.id === "art_rich_contrast"), "task-routed-v4.2");
  const archive = buildMultitextPrompt(MULTITEXT_CASES.find((item) => item.id === "preface_incomplete_archive"), "task-routed-v4.2");

  assert.match(apology, /只允许：道歉发生、道歉后更生气、原因未知/);
  assert.match(apology, /委屈、不甘、困惑、等待、平复/);
  assert.match(artwork, /作者状态=已知：北斋/);
  assert.match(artwork, /约1835年=作品年代/);
  assert.match(archive, /实体单位=馆藏记录/);
  assert.match(archive, /作品是否存世或可见=未知/);

  const riskItems = [
    MULTITEXT_CASES.find((entry) => entry.id === "emotion_apology_anger"),
    MULTITEXT_CASES.find((entry) => entry.id === "art_rich_contrast"),
    MULTITEXT_CASES.find((entry) => entry.id === "preface_incomplete_archive"),
  ];
  const baselineChars = riskItems.reduce((sum, item) => sum + buildMultitextPrompt(item, "source-isolated-v3").length, 0);
  const routedChars = riskItems.reduce((sum, item) => sum + buildMultitextPrompt(item, "task-routed-v4.2").length, 0);
  assert.ok(routedChars < baselineChars * 0.85);
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

test("source-isolated v3.1 compacts framing rules without priming memorial cliches", () => {
  const item = MULTITEXT_CASES.find((entry) => entry.id === "closing_memorial_objects");
  const v3 = buildMultitextPrompt(item, "source-isolated-v3");
  const v31 = buildMultitextPrompt(item, "source-isolated-v3.1");

  assert.ok(v31.length < v3.length - 250);
  assert.match(v31, /不预测观看后的心理或精神结果/);
  assert.match(v31, /停留或离开/);
  assert.match(v31, /合格示例/);
  assert.doesNotMatch(v31, /纪念意义|疗愈|治愈|释然|告别|带走希望/);
  assert.match(v31, /补足字数只能复述/);
});

test("neutral emotion uses a shorter contract without changing other emotion cases", () => {
  const neutral = MULTITEXT_CASES.find((item) => item.id === "emotion_neutral_now");
  const mixed = MULTITEXT_CASES.find((item) => item.id === "emotion_relief_guilt");
  const prompt = buildMultitextPrompt(neutral, "source-isolated-v3.1");

  assert.deepEqual(neutral.output.lengths.emotion_read, [10, 30]);
  assert.deepEqual(neutral.output.lengths.response, [10, 40]);
  assert.deepEqual(mixed.output.lengths.response, [55, 100]);
  assert.match(prompt, /不新增现场动作、物品或服务提议/);
});

test("framing cases expose their exact requested text ranges in the JSON contract", () => {
  const ranges = Object.fromEntries(MULTITEXT_CASES.filter((item) => item.category === "framing_text")
    .map((item) => [item.id, item.output.lengths.text]));

  assert.deepEqual(ranges, {
    preface_repair: [130, 180],
    closing_night_photos: [100, 150],
    preface_incomplete_archive: [120, 180],
    closing_memorial_objects: [110, 160],
  });
});

test("v3.1 framing prompt assigns every sentence to source-backed content", () => {
  const item = MULTITEXT_CASES.find((entry) => entry.id === "closing_memorial_objects");
  const prompt = buildMultitextPrompt(item, "source-isolated-v3.1");

  assert.match(prompt, /目标125–145字/);
  assert.match(prompt, /句1.*7件/);
  assert.match(prompt, /句4.*未记录/);
  assert.match(prompt, /句5.*停留或离开/);
});

test("v3.1 night-photo rule preserves the person-identity field role", () => {
  const item = MULTITEXT_CASES.find((entry) => entry.id === "closing_night_photos");
  const prompt = buildMultitextPrompt(item, "source-isolated-v3.1");

  assert.match(prompt, /资料未提供照片中人物的身份，也未提供拍摄动机/);
  assert.match(prompt, /观众可自行观看这些照片/);
  assert.doesNotMatch(prompt, /拍摄者身份|摄影者身份/);
});

test("v3.1 guard catches semantic drift even when length and shape are valid", () => {
  const memorial = MULTITEXT_CASES.find((item) => item.id === "closing_memorial_objects");
  const neutral = MULTITEXT_CASES.find((item) => item.id === "emotion_neutral_now");
  const memorialIssues = collectV31GuardIssues(memorial, {
    text: "这里陈列七件登记为纪念用途的物件，年代与对象各异。资料未记录原持有者如何哀悼，也没有观众反馈。观众可停留，从这些物件的静默故事中获得安慰，然后离开。",
    evidence_boundary: "仅依据登记用途和未记录信息。",
  });
  const neutralIssues = collectV31GuardIssues(neutral, {
    emotion_read: "今天没有特别情绪，只想安静吃饭。",
    response: "好，不分析。我会陪你吃完，需要时再说。",
    boundary: "不分析。",
  });

  assert.ok(memorialIssues.some((issue) => issue.type === "semantic_guard"));
  assert.ok(neutralIssues.some((issue) => issue.type === "invented_presence"));
});

test("repair prompt targets a safe inner length without repeating risky wording", () => {
  const item = MULTITEXT_CASES.find((entry) => entry.id === "closing_memorial_objects");
  const prompt = buildMultitextRepairPrompt(item, [{ type: "length", field: "text", actual: 78, expected: [110, 160] }]);

  assert.match(prompt, /重新生成/);
  assert.match(prompt, /目标120–150字/);
  assert.match(prompt, /source_evidence/);
  assert.doesNotMatch(prompt, /静默故事|疗愈|释然|告别/);
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
