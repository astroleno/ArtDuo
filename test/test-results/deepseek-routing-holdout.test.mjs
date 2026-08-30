import assert from "node:assert/strict";
import test from "node:test";

import { MULTITEXT_CASES } from "./deepseek-multitext-prompt.mjs";
import {
  HOLDOUT_CASES,
  NARRATION_PACKETS,
  buildHoldoutPrompt,
  buildNarrationPrompts,
  decideRoutingFramework,
} from "./deepseek-routing-holdout.mjs";

test("holdout matrix covers five output tasks without reusing development cases", () => {
  const counts = Object.groupBy(HOLDOUT_CASES, (item) => item.taskType);
  assert.deepEqual(Object.fromEntries(Object.entries(counts).map(([key, items]) => [key, items.length])), {
    emotion_response: 4,
    artwork_intro: 4,
    exhibition_preface: 2,
    exhibition_closing: 2,
    curation_analysis: 4,
  });

  const developmentIds = new Set(MULTITEXT_CASES.map((item) => item.id));
  const developmentSources = new Set(MULTITEXT_CASES.map((item) => item.source));
  assert.equal(HOLDOUT_CASES.some((item) => developmentIds.has(item.id)), false);
  assert.equal(HOLDOUT_CASES.some((item) => developmentSources.has(item.source)), false);
});

test("generic routed prompts expose only the selected task and supplied evidence profile", () => {
  for (const item of HOLDOUT_CASES) {
    const prompt = buildHoldoutPrompt(item, "generic-task-routed-v5");
    assert.match(prompt, new RegExp(`task_type="${item.taskType}"`));
    assert.match(prompt, /evidence_profile=/);
    assert.match(prompt, new RegExp(item.output.fields[0]));
    for (const unrelated of ["北斋", "E. Hart", "12条馆藏记录", "1931", "纪念用途的物件"]) {
      assert.doesNotMatch(prompt, new RegExp(unrelated));
    }
  }
});

test("baseline and routed prompts keep the same observable JSON contract", () => {
  for (const item of HOLDOUT_CASES) {
    const baseline = buildHoldoutPrompt(item, "source-isolated-v3");
    const routed = buildHoldoutPrompt(item, "generic-task-routed-v5");
    for (const field of item.output.fields) {
      assert.match(baseline, new RegExp(field));
      assert.match(routed, new RegExp(field));
    }
  }
});

test("narration benchmark compares one combined call with two source-identical split calls", () => {
  assert.equal(NARRATION_PACKETS.length, 4);
  for (const packet of NARRATION_PACKETS) {
    const prompts = buildNarrationPrompts(packet);
    assert.match(prompts.combined, new RegExp(packet.id));
    assert.match(prompts.preface, new RegExp(packet.id));
    assert.match(prompts.closing, new RegExp(packet.id));
    assert.match(prompts.combined, /preface.*closing/s);
    assert.match(prompts.preface, /task_type="exhibition_preface"/);
    assert.match(prompts.closing, /task_type="exhibition_closing"/);
  }
});

test("framework decision gate confirms only quality-safe and measurably faster results", () => {
  const confirmed = decideRoutingFramework({
    holdoutQualityDelta: -0.1,
    holdoutSevereErrorDelta: 0,
    holdoutParseRate: 1,
    holdoutTtftImprovement: 0.14,
    narrationQualityDelta: 0,
    narrationSevereErrorDelta: -1,
    narrationAllCompleteImprovement: 0.08,
  });
  assert.deepEqual(confirmed, { taskRouter: "confirm", splitNarration: "confirm", framework: "confirm", blockers: [] });

  const held = decideRoutingFramework({
    holdoutQualityDelta: -0.4,
    holdoutSevereErrorDelta: 2,
    holdoutParseRate: 0.98,
    holdoutTtftImprovement: 0.2,
    narrationQualityDelta: 0.1,
    narrationSevereErrorDelta: 0,
    narrationAllCompleteImprovement: -0.05,
  });
  assert.equal(held.taskRouter, "hold");
  assert.equal(held.splitNarration, "hold");
  assert.equal(held.framework, "hold");
  assert.deepEqual(held.blockers, ["holdout_quality", "holdout_severe_errors", "holdout_parse_rate", "narration_all_complete_time"]);
});
