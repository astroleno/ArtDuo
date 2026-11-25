import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { parseCurationIntentPlan } from "@artduo/contracts";
import { measureCurves, type CurveSlot } from "../../scripts/curve-metrics";
import { readTrackedCurveFixture, sha256 } from "../../scripts/stage-fit-curve-fixture";

const slot = (id: string, stageIndex: number, arousal: number, flash?: number, rules?: number): CurveSlot => ({
  artworkId: id, stageIndex,
  target: { arousal, valence: .5, tension: .5, wonder: .5, intimacy: .5 },
  readings: { flash: flash === undefined ? undefined : { arousal: flash }, rules: rules === undefined ? undefined : { arousal: rules } },
});

test("both floating-point .10 boundaries qualify; same, opposite and flat stay distinct", () => {
  const route = [slot("a", 0, .2, .2), slot("b", 1, .3, .4), slot("c", 2, .2, .5), slot("d", 3, .3, .5), slot("e", 3, .3, .8)];
  const axis = measureCurves([{ id: "ex", requestedWorks: 5, slots: route }]).summary.axes.arousal;
  assert.deepEqual(axis.flash.adjacency.all.directions, { eligible: 3, valid: 3, missing: 0, same: 1, opposite: 1, flat: 1 });
  assert.equal(axis.flash.adjacency.withinStage.pairs, 1);
  assert.equal(axis.flash.adjacency.acrossStage.pairs, 3);
  assert.equal(axis.flash.adjacency.all.absoluteDelta?.max, .3);
  assert.deepEqual(axis.flash.adjacency.all.absoluteDelta?.maxAt, {
    exhibition: "ex", from: 4, to: 5, fromArtworkId: "d", toArtworkId: "e", fromStage: 3, toStage: 3,
  });
  assert.equal(axis.rules.adjacency.all.valid, 0);
});

test("missing readings never connect non-adjacent slots or promote an earlier work to the ending", () => {
  const route = [slot("a", 0, .2, .1, .2), slot("b", 1, .3, NaN, .3), slot("c", 2, .4, .3, .4), slot("d", 3, .5, undefined, .5)];
  const axis = measureCurves([{ id: "ex", requestedWorks: 4, slots: route }]).summary.axes.arousal;
  assert.deepEqual(axis.flash.adjacency.all.directions, { eligible: 3, valid: 0, missing: 3, same: 0, opposite: 0, flat: 0 });
  assert.equal(axis.flash.adjacency.all.absoluteDelta, null);
  assert.equal(axis.flash.errors.endingMissing, 1);
  assert.equal(axis.flash.errors.endingMae, null);
  assert.equal(axis.flash.errors.availableSlots, 2);
  assert.equal(axis.flash.errors.missingSlots, 2);
  assert.equal(axis.flash.errors.centeredRmse, 0);
  assert.equal(axis.rules.adjacency.all.valid, 3);
  assert.equal(axis.rules.errors.endingMae, 0);
});

test("short and empty routes do not contribute shape or adjacent pairs; a constant offset still has MAE", () => {
  const { summary, exhibitions } = measureCurves([
    { id: "empty", requestedWorks: 3, slots: [] },
    { id: "one", requestedWorks: 3, slots: [slot("a", 0, .3, .5)] },
    { id: "constant", requestedWorks: 2, slots: [slot("a", 0, .2, .3), slot("b", 0, .2, .3)] },
    { id: "varying", requestedWorks: 2, slots: [slot("c", 0, .2, .2), slot("d", 1, .4, .6)] },
  ]);
  assert.equal(summary.distinctWorks, 4);
  assert.equal(summary.shortExhibitions, 2);
  assert.equal(exhibitions[0]!.axes.arousal.flash.errors.mae, null);
  assert.equal(exhibitions[1]!.axes.arousal.flash.errors.centeredRmse, null);
  assert.equal(exhibitions[1]!.axes.arousal.flash.errors.mae, .2);
  assert.equal(exhibitions[2]!.axes.arousal.flash.errors.centeredRmse, 0);
  assert.equal(exhibitions[2]!.axes.arousal.flash.errors.mae, .1);
  const blended = summary.axes.arousal.flash;
  assert.equal(blended.errors.centeredRmse, .070711);
  assert.equal(blended.errors.shapeSlots, 4);
  assert.equal(blended.errors.endingEligible, 3);
  assert.equal(blended.adjacency.all.pairs, 2);
});

test("the tracked baseline restores the 25 fixed plans and published arousal counts without a catalog", () => {
  const bytes = readFileSync(path.join(__dirname, "../fixtures/stage-fit-plans.json"));
  const plans = Object.values(JSON.parse(bytes.toString()) as Record<string, unknown>).map(value => parseCurationIntentPlan(value));
  const fixture = readTrackedCurveFixture(sha256(bytes), "2026-11-19-open-gap-739");
  assert.equal(fixture.source.sourceReplaySha256, "2d2914d49a7bf38b222b671bd878daab131bceaf145ee310158983744544f00f");
  assert.equal(fixture.source.selectionVersion, 21);
  assert.equal(fixture.routes.length, plans.length);
  assert.throws(() => readTrackedCurveFixture(sha256(bytes), "wrong-release"), /plans or release/u);
  assert.throws(() => readTrackedCurveFixture("bad-fingerprint"), /plans or release/u);
  const { summary } = measureCurves(fixture.routes.map((route, index) => ({
    id: String(index + 1), requestedWorks: plans[index]!.artworkCount,
    slots: route.works.map(({ artworkId, stage }) => ({
      artworkId, stageIndex: stage, target: plans[index]!.stages[stage]!, readings: fixture.byId.get(artworkId)!,
    })),
  })));
  assert.deepEqual([summary.exhibitions, summary.slots, summary.distinctWorks, summary.shortExhibitions], [25, 91, 77, 3]);
  const arousal = summary.axes.arousal;
  assert.equal(arousal.target.all.pairs, 68);
  assert.equal(arousal.target.all.absoluteDelta?.median, .05);
  assert.equal(arousal.flash.adjacency.all.absoluteDelta?.max, .45);
  assert.deepEqual(arousal.flash.adjacency.all.directions, { eligible: 16, valid: 16, missing: 0, same: 8, opposite: 4, flat: 4 });
});
