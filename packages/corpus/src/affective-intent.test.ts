import assert from "node:assert/strict";
import { test } from "node:test";

import { buildUserAffectAgent } from "./affective-intent";

function values(entries: Array<{ value: string }>): string[] {
  return entries.map((entry) => entry.value);
}

test("extracts negative brightness and warm dark visual constraints", () => {
  const agent = buildUserAffectAgent("不要太明亮，想要暗红和深木色");

  assert.ok(values(agent.resistances).includes("bright"));
  assert.ok(values(agent.visualConstraints).includes("burgundy"));
  assert.ok(values(agent.visualConstraints).includes("walnut"));
  assert.ok(values(agent.desires).includes("low-light"));
});

test("extracts explicit quiet wonder calm temporal stages", () => {
  const agent = buildUserAffectAgent("先安静，再惊叹，最后回到平静");
  const stageSignals = agent.temporalShape.stages.map((stage) => values(stage.signals));

  assert.equal(agent.temporalShape.stages.length, 3);
  assert.ok(stageSignals[0]?.includes("quiet"));
  assert.ok(stageSignals[1]?.includes("wonder"));
  assert.ok(stageSignals[2]?.includes("quiet"));
});

test("extracts bedtime memory and broad sadness resistance", () => {
  const agent = buildUserAffectAgent("像睡前，但不要悲伤");

  assert.ok(values(agent.memoryHints).includes("bedtime"));
  assert.ok(values(agent.resistances).includes("sadness"));
  assert.ok(!values(agent.resistances).includes("heavy-grief"));
  assert.ok(!values(agent.desires).includes("melancholy"));
  assert.ok(values(agent.desires).includes("restful"));
});

test("keeps melancholy available when only heavy grief is resisted", () => {
  const agent = buildUserAffectAgent("我想看孤独但不绝望的东西");

  assert.ok(values(agent.resistances).includes("heavy-grief"));
  assert.ok(!values(agent.resistances).includes("sadness"));
  assert.ok(values(agent.desires).includes("melancholy"));
});

test("does not treat Chinese acceptance and double-negative phrases as sadness resistance", () => {
  for (const query of [
    "我不介意悲伤的作品",
    "我不得不面对悲伤",
    "我不是不接受悲伤",
    "我不拒绝悲伤",
    "我不会拒绝悲伤",
    "我不想避免悲伤",
    "我不能不面对悲伤",
  ]) {
    const agent = buildUserAffectAgent(query);
    assert.ok(
      !values(agent.resistances).includes("sadness"),
      `${query} should not create sadness resistance`,
    );
  }
});

test("keeps a separate hard resistance after an accepted sadness clause", () => {
  const agent = buildUserAffectAgent("我不拒绝悲伤，但不要绝望");

  assert.ok(!values(agent.resistances).includes("sadness"));
  assert.ok(values(agent.resistances).includes("heavy-grief"));
});

test("keeps a later hard resistance in the same Chinese clause", () => {
  const agent = buildUserAffectAgent("我不拒绝悲伤也不要绝望");

  assert.ok(!values(agent.resistances).includes("sadness"));
  assert.ok(values(agent.resistances).includes("heavy-grief"));
});

test("does not let an unrelated acceptance clause consume a later hard resistance", () => {
  const cases = [
    ["我不介意先看一会，但不要悲伤", "sadness"],
    ["我不拒绝这种安排，但不要悲伤", "sadness"],
    ["我不会拒绝这条路线，但不要绝望", "heavy-grief"],
  ] as const;

  for (const [query, expectedResistance] of cases) {
    assert.ok(
      values(buildUserAffectAgent(query).resistances).includes(expectedResistance),
      `${query} should preserve ${expectedResistance}`,
    );
  }
});

test("keeps Chinese hard-resistance scope stable across clause boundaries", () => {
  for (const separator of ["，", "。", "；", "！", "\n", "但", "但是", "不过"]) {
    const agent = buildUserAffectAgent(`我不介意先看一会${separator}不要悲伤`);
    assert.ok(
      values(agent.resistances).includes("sadness"),
      `${JSON.stringify(separator)} should preserve the clause boundary`,
    );
  }
});

test("keeps hard resistance after unpunctuated connectors and Unicode separators", () => {
  for (const separator of ["也", "然后", "最后", "并且", "而且", "—", "——", "／", "｜"]) {
    const agent = buildUserAffectAgent(`我不介意先看一会${separator}不要悲伤`);
    assert.ok(
      values(agent.resistances).includes("sadness"),
      `${JSON.stringify(separator)} should stop acceptance scope`,
    );
  }
});

test("binds a Chinese resistance operator only to its direct affect object", () => {
  for (const query of [
    "我拒绝这种安排也喜欢悲伤",
    "我避免这条路线然后接受悲伤",
    "我不想这种构图最后面对绝望",
  ]) {
    assert.deepEqual(
      values(buildUserAffectAgent(query).resistances),
      [],
      `${query} should not turn an unrelated object into a hard resistance`,
    );
  }
});

test("does not treat bie inside tebie as a resistance operator", () => {
  for (const query of [
    "我想看特别悲伤的作品",
    "给我特别明亮的画",
    "我喜欢特别戏剧性的作品",
    "我想看特别吵闹的场景",
    "我能接受特别绝望的作品",
  ]) {
    assert.deepEqual(
      values(buildUserAffectAgent(query).resistances),
      [],
      `${query} should remain a positive request`,
    );
  }
});

test("accepts bounded degree modifiers between a resistance operator and its target", () => {
  const cases = [
    ["不要很悲伤", "heavy-grief"],
    ["不要那么悲伤", "heavy-grief"],
    ["不要太过明亮", "bright"],
    ["避免非常绝望", "heavy-grief"],
    ["拒绝过分戏剧性", "heavy-drama"],
  ] as const;

  for (const [query, expectedResistance] of cases) {
    const resistances = values(buildUserAffectAgent(query).resistances);
    assert.ok(
      resistances.includes(expectedResistance),
      `${query} should create ${expectedResistance} resistance`,
    );
    if (expectedResistance === "heavy-grief" && /悲伤/u.test(query)) {
      assert.ok(
        !resistances.includes("sadness"),
        `${query} should preserve lower-intensity melancholy`,
      );
    }
  }
});

test("does not treat a direct affect negation inside a negated wish as resistance", () => {
  for (const query of [
    "不想不悲伤",
    "我不希望不悲伤",
    "我不愿不悲伤",
  ]) {
    assert.ok(
      !values(buildUserAffectAgent(query).resistances).includes("sadness"),
      `${query} should not create sadness resistance`,
    );
  }
});

test("keeps joy while rejecting cartoonish happiness", () => {
  const agent = buildUserAffectAgent("I want joy but not cartoonish happiness");

  assert.ok(values(agent.desires).includes("joy"));
  assert.ok(values(agent.resistances).includes("cartoonish"));
});

test("keeps quiet desire and rejects loud romance", () => {
  const agent = buildUserAffectAgent("desire in a quiet room, not loud romance");

  assert.ok(values(agent.desires).includes("desire"));
  assert.ok(values(agent.desires).includes("quiet"));
  assert.ok(values(agent.resistances).includes("loud"));
  assert.ok(values(agent.spatialNeeds).includes("room"));
});

test("extracts no drama and overfull plot as heavy drama resistance", () => {
  const english = buildUserAffectAgent("serene, minimal, gallery interior, no drama");
  const chinese = buildUserAffectAgent("我想沉思，不要剧情太满");

  assert.ok(values(english.resistances).includes("heavy-drama"));
  assert.ok(values(chinese.resistances).includes("heavy-drama"));
});
