import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCurationIntentPlan } from "@artduo/contracts";
import { compareCurvePositions } from "../../scripts/curve-metrics";
import { tryStageOrder } from "../../scripts/stage-order-experiment";
import plans from "../fixtures/stage-fit-plans.json";

const template = parseCurationIntentPlan(Object.values(plans).find(value => value.stages.length >= 3)!);
const reading = (value: number) => ({ valence: value, arousal: value, tension: value, wonder: value, intimacy: value });

test("optional stage ordering swaps once after checking both sides and protects explicit and model order", () => {
  const plan = { ...template, stages: template.stages.map((stage, index) => ({ ...stage, ...reading([.2, .5, .8][index] ?? .8) })) };
  const assignments = ["a", "b", "c", "d"].map((artworkId, index) => ({ artworkId, stageIndex: [0, 1, 1, 2][index]! }));
  const byId = new Map([["a", .2], ["b", .6], ["c", .5], ["d", .9]]);
  const ruleReading = (id: string) => reading(byId.get(id)!);
  const base = { plan, assignments, ruleReading, query: "给我几件作品", modelOrdered: false };
  const order = tryStageOrder(base);
  assert.deepEqual(order.assignments.map(work => work.artworkId), ["a", "c", "b", "d"]);
  assert.equal(order.swap?.index, 1);
  assert.deepEqual(assignments.map(work => work.artworkId), ["a", "b", "c", "d"]);
  for (const protectedOrder of [{ modelOrdered: true }, { query: "先看室外，再看室内" }, { query: "比较两幅画" }]) {
    assert.equal(tryStageOrder({ ...base, ...protectedOrder }).assignments, assignments);
  }
  byId.set("d", .8);
  assert.equal(tryStageOrder(base).assignments, assignments, "the right boundary would be worse");
  byId.set("c", .1);
  assert.equal(tryStageOrder(base).assignments, assignments, "a boundary direction would reverse");
});

test("paired curve reporting lists shifted stage boundaries and does not bridge unmatched slots", () => {
  const left = [{ id: "one", requestedWorks: 3, slots: [0, 1, 2].map((stageIndex, index) => ({ artworkId: String(index),
    stageIndex, target: reading(index * .2), readings: { flash: reading(index * .25) } })) }];
  const right = [{ ...left[0]!, slots: left[0]!.slots.slice(0, 2).map((slot, index) => index ? { ...slot, stageIndex: 2 } : slot) }];
  const report = compareCurvePositions(left, right);
  assert.equal(report.positions.comparable, 1);
  assert.equal(report.positions.removed.length, 2);
  assert.equal(report.positions.added.length, 1);
  assert.equal(report.adjacent.comparable, 0);
  assert.equal(report.adjacent.removed.length, 2);
  assert.equal(report.adjacent.added.length, 1);
});
