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
  ]) {
    const agent = buildUserAffectAgent(query);
    assert.ok(
      !values(agent.resistances).includes("sadness"),
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
