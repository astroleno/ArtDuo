import assert from "node:assert/strict";
import test from "node:test";
import { artworkPlaceholderRgb } from "./artwork-placeholder";
import { artworkRevealDuration, createStageMotionArrival, isLateNeutralReveal, stageTransitionKeyframes, stageTransitionProfile } from "./stage-transition";
import type { ExperienceStage } from "./types";

const stage = (id: string, role: ExperienceStage["role"], transitionIntent: ExperienceStage["transitionIntent"] = "fade",
  arousal = .4): ExperienceStage => ({ id, label: id, role, valence: .5, arousal, tension: .3, wonder: .5, intimacy: .5, intensity: .4, transitionIntent });

test("stage profiles distinguish continuation, directional turning and the final afterglow", () => {
  const threshold = stage("one", "threshold");
  const turn = stage("three", "turn", "push");
  const afterglow = stage("four", "afterglow", "hold");
  const normal = stageTransitionProfile({ from: threshold, to: threshold, fromIndex: 0, toIndex: 1, count: 6 });
  const forward = stageTransitionProfile({ from: threshold, to: turn, fromIndex: 1, toIndex: 2, count: 6 });
  const backward = stageTransitionProfile({ from: turn, to: threshold, fromIndex: 2, toIndex: 1, count: 6 });
  const ending = stageTransitionProfile({ from: afterglow, to: afterglow, fromIndex: 4, toIndex: 5, count: 6 });
  assert.deepEqual([normal.kind, forward.kind, backward.kind, ending.kind], ["continue", "turn", "turn", "settle"]);
  assert.deepEqual([forward.wallOffsetPx, backward.wallOffsetPx], [4, -4]);
  assert.ok(ending.artworkMs > forward.artworkMs && ending.artworkMs <= 220);
  assert.ok(ending.wallMs > ending.artworkMs);
  assert.equal(stageTransitionKeyframes(normal).shade, undefined);
  assert.deepEqual(stageTransitionKeyframes(backward).wall?.map(frame => frame.transform), ["translateX(-4px)", "translateX(0px)"]);
  assert.ok(stageTransitionKeyframes(ending).shade);
  for (const overrides of [{ from: undefined }, { count: 2 }, { fromIndex: 0, toIndex: 3 }]) {
    assert.equal(stageTransitionProfile({ from: threshold, to: turn, fromIndex: 1, toIndex: 2, count: 6, ...overrides }).kind, "neutral");
  }
});

test("placeholder uses the first known primary colour and returns the existing neutral fallback for old or unrecognized tags", () => {
  assert.equal(artworkPlaceholderRgb(["red", "white"]), "211 181 169");
  assert.equal(artworkPlaceholderRgb(["vivid", "white"]), "227 220 208");
  assert.equal(artworkPlaceholderRgb(["#ff0000"]), "231 158 149");
  assert.notEqual(artworkPlaceholderRgb(["red"]), artworkPlaceholderRgb(["pale blue"]));
  assert.equal(artworkPlaceholderRgb(["muted", "contrast", "constructor"]), undefined);
  assert.equal(artworkPlaceholderRgb(), undefined);
});

test("an artwork arrival gets one animation opportunity, even when motion was disabled at arrival", () => {
  const consumeArrival = createStageMotionArrival();
  assert.equal(consumeArrival(0, false), false);
  assert.equal(consumeArrival(0, true), false);
  assert.equal(consumeArrival(1, true), true);
  assert.equal(consumeArrival(1, false), false);
  assert.equal(consumeArrival(1, true), false);
  assert.equal(consumeArrival(2, false), false);
  assert.equal(consumeArrival(2, true), false);
  assert.equal(consumeArrival(3, true), true);
  assert.equal(consumeArrival(2, true), false);
});

test("warm paint uses the remaining stage time, and late decode gets a complete short reveal", () => {
  assert.equal(artworkRevealDuration(128, 18), 110);
  assert.equal(artworkRevealDuration(208, 176), 32);
  assert.equal(artworkRevealDuration(208, 177), 180);
  assert.equal(artworkRevealDuration(176, 1200), 180);
  assert.equal(isLateNeutralReveal("neutral", 16), false);
  assert.equal(isLateNeutralReveal("neutral", 180), true);
  assert.equal(isLateNeutralReveal("turn", 1200), false);
});
