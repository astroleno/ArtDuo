import assert from "node:assert/strict";
import test from "node:test";
import { artworkPlaceholderRgb } from "./artwork-placeholder";
import { createStageMotionArrival, stageArtworkReveal, stageTransitionKeyframes, stageTransitionProfile, type StageTransitionProfile } from "./stage-transition";
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

test("placeholder keeps measured luminance ordered and uses a muted hue only when available", () => {
  const values = [.068, .45, .85].map(meanLightness => artworkPlaceholderRgb(["red", "white"], { meanLightness, chroma: .3 })!.split(" ").map(Number));
  assert.ok(values[0]!.every((channel, index) => channel < values[1]![index]!));
  assert.ok(values[1]!.every((channel, index) => channel < values[2]![index]!));
  const noHue = { meanLightness: .45, chroma: .5 };
  assert.equal(artworkPlaceholderRgb([], noHue), "116 116 116");
  assert.equal(artworkPlaceholderRgb(["muted", "contrast", "constructor"], noHue), "116 116 116");
  assert.notEqual(artworkPlaceholderRgb(["red"], noHue), artworkPlaceholderRgb(["pale blue"], noHue));
  assert.equal(artworkPlaceholderRgb(["blue"], { meanLightness: Infinity, chroma: .5 }), undefined);
  assert.equal(artworkPlaceholderRgb(["red"]), undefined);
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
  const late = { keyframes: [{ opacity: .30 }, { opacity: 1 }], duration: 180, easing: "ease-out" };
  for (const [kind, artworkMs, opacity] of [["continue", 128, .84], ["turn", 176, .72], ["settle", 208, .76]] as const) {
    const profile: StageTransitionProfile = { kind, direction: "forward", artworkMs, wallMs: 0, wallOffsetPx: 0 };
    const edge = artworkMs - 32;
    const timely = stageArtworkReveal(profile, edge, edge);
    assert.equal(timely?.duration, 32);
    assert.equal(timely?.keyframes[0]?.opacity, opacity);
    assert.deepEqual(timely?.keyframes, stageTransitionKeyframes(profile).artwork);
    assert.deepEqual(stageArtworkReveal(profile, edge, edge + 1), late);
    assert.deepEqual(stageArtworkReveal(profile, 1200, 1200), late);
  }
  const neutral: StageTransitionProfile = { kind: "neutral", direction: "none", artworkMs: 0, wallMs: 0, wallOffsetPx: 0 };
  assert.equal(stageArtworkReveal(neutral, 179.9, 220), undefined);
  assert.deepEqual(stageArtworkReveal(neutral, 180, 220), late);
});
