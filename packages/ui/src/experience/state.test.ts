import assert from "node:assert/strict";
import test from "node:test";

import { createExperienceState, experienceReducer, positionOfExperienceState } from "./state";
import type { ExhibitionSnapshot, ExperiencePosition } from "./types";

function snapshot(count: number): ExhibitionSnapshot {
  return {
    schemaVersion: 1,
    recipeVersion: "experience-v1",
    releaseVersion: "test",
    exhibitionId: "test-exhibition",
    query: "quiet",
    title: "Quiet",
    preface: { text: "Preface", source: "grounded" },
    closing: { text: "Closing", source: "grounded" },
    stages: [],
    omittedUnitCount: 0,
    units: Array.from({ length: count }, (_, index) => ({ exhibition: { unitId: `u${index}`, order: index } } as never)),
  };
}

function reduce(state: ReturnType<typeof createExperienceState>, event: Parameters<typeof experienceReducer>[1], current: ExhibitionSnapshot) {
  return experienceReducer(state, event, current);
}

test("experience state covers skip, navigation boundaries, closing, revisit and old media results", () => {
  const current = snapshot(2);
  let state = createExperienceState(current, { phase: "preface" });
  state = reduce(state, { type: "SKIP" }, current);
  assert.deepEqual(positionOfExperienceState(state), { phase: "walk", unitId: "u0" });
  assert.equal(reduce(state, { type: "PREVIOUS" }, current), state);
  state = reduce(state, { type: "NEXT" }, current);
  assert.equal(state.transitioning, true);
  assert.equal(reduce(state, { type: "NEXT" }, current), state);
  state = reduce(state, { type: "RESTORE_TRANSITION" }, current);
  state = reduce(state, { type: "NEXT" }, current);
  assert.deepEqual(positionOfExperienceState(state), { phase: "closing", lastUnitId: "u1" });
  state = reduce(state, { type: "REVISIT" }, current);
  assert.deepEqual(positionOfExperienceState(state), { phase: "walk", unitId: "u1" });
  state = reduce(state, { type: "MEDIA_FAILED", artworkId: "met-1" }, current);
  state = reduce(state, { type: "CONNECTIVITY_CHANGED", online: false }, current);
  assert.deepEqual(state.failedMediaIds, ["met-1"]);
  assert.equal(state.online, false);
});

test("experience state keeps empty results out of walk and closing", () => {
  const current = snapshot(0);
  const state = createExperienceState(current, { phase: "preface" } satisfies ExperiencePosition);
  assert.equal(reduce(state, { type: "SKIP" }, current), state);
  assert.equal(reduce(state, { type: "NEXT" }, current), state);
});

test("lightbox isolates navigation until it is closed", () => {
  const current = snapshot(3);
  let state = createExperienceState(current, { phase: "walk", unitId: "u1" });
  state = reduce(state, { type: "OPEN_LIGHTBOX" }, current);
  for (const event of [{ type: "NEXT" }, { type: "PREVIOUS" }, { type: "SELECT_UNIT", unitId: "u2" }] as const) {
    assert.equal(reduce(state, event, current), state);
  }
  state = reduce(state, { type: "CLOSE_OVERLAY" }, current);
  assert.equal(reduce(state, { type: "NEXT" }, current).unitId, "u2");
});
