import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getSculptureNarrative, validateSculptureProse } from "../../lib/sculpture-narrative";
import selection from "../../../../data/sculptures/selection-v1.json";
import evidence from "../../../../data/sculptures/visual-evidence-v1.json";

const text = "先沿着雕塑的外轮廓慢慢看一遍，再把目光留在亮部与暗部相接的地方。轻轻移动视点，比较表面起伏怎样改变光影，不必急着寻找一个答案。";

test("sculpture prose rejects fabricated dates, authors, injected markup and personal diagnoses", () => {
  assert.equal(validateSculptureProse({ text }), text);
  for (const bad of [text + "它创作于一千年前。", text + "作者是米开朗基罗。", text + "你一定很焦虑。", text + "它来自公元前530年。", "<script>" + text, "过短"])
    assert.throws(() => validateSculptureProse({ text: bad }));
  assert.throws(() => validateSculptureProse({ text, author: "invented" }));
  assert.throws(() => validateSculptureProse({ text: text + "再看看肩部与衣纹的关系。" }, ["头部", "面部", "颈部"]));
  assert.throws(() => validateSculptureProse({ text: text + "沿着弓弦看看手指。" }, ["身体", "手部"]));
  assert.throws(() => validateSculptureProse({ text: text + "接着看老渔夫的脚与渔网。" }, ["身体", "手部"]));
  assert.throws(() => validateSculptureProse({ text: text + "再看她怀里的小猫。" }, ["头部", "身体", "手部"]));
  assert.throws(() => validateSculptureProse({ text: text + "接着看她的双手。" }, ["身体", "手部"]));
  assert.throws(() => validateSculptureProse({ text: text + "再看胡须与圆盘的边缘。" }, ["头部", "身体"]));
  assert.throws(() => validateSculptureProse({ text: text + "再看看他们组成的群像。" }, ["头部", "身体"]));
  assert.equal(validateSculptureProse({ text: text + "再看她怀里的小猫。" }, ["头部", "身体", "手部", "猫"]), text + "再看她怀里的小猫。");
  assert.equal(validateSculptureProse({ text: text + "再看看圆盘与身体的关系。" }, ["身体", "铁饼"]), text + "再看看圆盘与身体的关系。");
});

test("the eighteen-work pool includes the six recognizable human subjects with reviewed visible parts", () => {
  assert.equal(selection.models.length, 18);
  assert.deepEqual(selection.models.map(model => model.id).sort(), Object.keys(evidence.models).sort());
  assert.equal(selection.models.filter(model => model.tags.includes("人的生活")).length, 6);
  assert.ok(evidence.models.calais.includes("多人"));
  assert.ok(evidence.models.discobolus.includes("铁饼"));
  assert.ok(!evidence.models.socrates.includes("身体"));
  assert.ok(!evidence.models.balzac.includes("手部"));
  assert.ok(!evidence.models.beethoven.includes("双手"));
  assert.ok(!selection.models.some(model => model.id === "old-fisherman"));
});

test("a grounded model receives the verified cast facts; concurrent calls deduplicate and cache survives process state", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "artduo-sculpture-copy-"));
  let calls = 0;
  try {
    const stream = async function* (messages: Array<{ content: string }>) {
      calls++;
      assert.match(messages[1]!.content, /Battista Lorenzi|巴蒂斯塔/);
      assert.match(messages[1]!.content, /石膏翻模/);
      assert.ok(JSON.parse(messages[1]!.content).verifiedSourceSummary);
      yield JSON.stringify({ text });
    };
    const [one, two] = await Promise.all([getSculptureNarrative("michelangelo-portrait", "创作与凝视", { rootDir, stream }), getSculptureNarrative("michelangelo-portrait", "创作与凝视", { rootDir, stream })]);
    assert.equal(calls, 1); assert.deepEqual(one, two); assert.equal(one.source, "grounded");
    const memory = (globalThis as typeof globalThis & { __artduoSculptureNarratives?: Map<string, unknown> }).__artduoSculptureNarratives!;
    for (const key of memory.keys()) if (key.startsWith(rootDir + ":")) memory.delete(key);
    assert.equal((await getSculptureNarrative("michelangelo-portrait", "创作与凝视", { rootDir, stream })).source, "grounded");
    assert.equal(calls, 1, "the bound disk cache survives loss of process memory");
    await getSculptureNarrative("michelangelo-portrait", "安静地看", { rootDir, stream });
    assert.equal(calls, 2, "different exhibition contexts do not reuse unrelated prose");
  } finally { await rm(rootDir, { recursive: true, force: true }); }
});

test("invalid/unavailable model text falls back to the selected work without changing its identity", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "artduo-sculpture-fallback-"));
  try {
    const result = await getSculptureNarrative("nefertiti", "安静", { rootDir, disk: false, stream: async function* () { yield JSON.stringify({ text: text + "这位作者在1234年雕刻它。" }); } });
    assert.equal(result.source, "fallback"); assert.match(result.text, /头部轮廓/);
    await assert.rejects(getSculptureNarrative("not-in-catalog", "安静", { rootDir }));
    await assert.rejects(getSculptureNarrative("nefertiti", "a".repeat(513), { rootDir }));
  } finally { await rm(rootDir, { recursive: true, force: true }); }
});
