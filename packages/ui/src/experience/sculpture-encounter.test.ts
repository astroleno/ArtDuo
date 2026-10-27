import assert from "node:assert/strict";
import test from "node:test";
import { permitsSculptureEncounter, planSculptureEncounter, restoreSculptureEncounter } from "./sculpture-encounter";
import { createViewingSession, validRouteOrder } from "./viewing-session";
import type { ExhibitionSnapshot } from "./types";
import type { SculptureRoomScene, SculptureWork } from "./sculpture-types";

const snapshot = { exhibitionId: "visit-one", query: "慢慢看看光和身体", units: ["a", "b", "c", "d", "e", "f"].map((id, index) => ({
  artwork: { id, metadata: { title: id, moodTags: ["quiet"] } }, exhibition: { unitId: `unit-${id}`, order: index }, stageId: index < 3 ? "first" : "second",
})) } as ExhibitionSnapshot;
const works = [{ id: "venus", tags: ["身体", "quiet"] }, { id: "apollo", tags: ["光"] }, { id: "head", tags: ["portrait"] }] as SculptureWork[];
const scenes = [{ id: "room", tone: "neutral", light: "top" }] as SculptureRoomScene[];

test("50% is one opportunity per eligible exhibition; painting count and membership stay exact", () => {
  let count = 0;
  const before = JSON.stringify(snapshot), session = createViewingSession(snapshot);
  for (let i = 0; i < 1000; i++) {
    const plan = planSculptureEncounter(snapshot, works, scenes, { roll: i / 1000, selection: .2 });
    if (plan.status === "pending") count++;
  }
  assert.equal(count, 500);
  assert.equal(planSculptureEncounter(snapshot, works, scenes, { roll: .499999, selection: 0 }).status, "pending");
  assert.equal(planSculptureEncounter(snapshot, works, scenes, { roll: .5, selection: 0 }).status, "absent");
  assert.equal(JSON.stringify(snapshot), before);
  assert.equal(snapshot.units.length, 6);
  assert.equal(validRouteOrder(session.order, snapshot), true);
  assert.equal(planSculptureEncounter({ ...snapshot, units: snapshot.units.slice(0, 3) }, works, scenes, { roll: 0, selection: 0 }).status, "absent");
});

test("a chapter interlude follows at least two paintings, preserving first and last", () => {
  const plan = planSculptureEncounter(snapshot, works, scenes, { roll: .1, selection: 0 });
  assert.equal(plan.anchorArtworkId, "c"); assert.equal(plan.nextArtworkId, "d");
  const single = { ...snapshot, units: snapshot.units.map(unit => ({ ...unit, stageId: "one" })) };
  assert.equal(planSculptureEncounter(single, works, scenes, { roll: 0, selection: 0 }).anchorArtworkId, "c");
  const short = { ...single, units: single.units.slice(0, 4) };
  assert.equal(planSculptureEncounter(short, works, scenes, { roll: 0, selection: 0 }).anchorArtworkId, "b");
});

test("explicit medium and subject restrictions take priority over a lucky roll", () => {
  for (const query of ["只看油画", "只想看风景", "不要雕塑", "不看人物", "paintings only", "without sculptures", "only landscapes"]) {
    assert.equal(permitsSculptureEncounter(query), false, query);
    assert.equal(planSculptureEncounter({ ...snapshot, query }, works, scenes, { roll: 0, selection: 0 }).status, "absent");
  }
  assert.equal(permitsSculptureEncounter("想看绘画，也想偶然遇见雕塑"), true);
});

test("themes increase selection affinity while recent works are downweighted", () => {
  const choose = (recent: string[] = []) => Array.from({ length: 1000 }, (_, i) => planSculptureEncounter(snapshot, works, scenes, { roll: 0, selection: i / 1000, recent }).modelId);
  const original = choose(), repeated = choose(["venus"]);
  assert.ok(original.filter(id => id === "venus").length > original.filter(id => id === "head").length);
  assert.ok(repeated.filter(id => id === "venus").length < 100);
});

test("refresh restores the same absent, pending, active or completed decision without reroll", () => {
  const plan = planSculptureEncounter(snapshot, works, scenes, { roll: .1, selection: .2 });
  for (const status of ["pending", "active", "complete"] as const) {
    const saved = { ...plan, status };
    assert.deepEqual(restoreSculptureEncounter(JSON.stringify(saved), snapshot, works, scenes), saved);
  }
  const absent = planSculptureEncounter(snapshot, works, scenes, { roll: .8, selection: 0 });
  assert.deepEqual(restoreSculptureEncounter(JSON.stringify(absent), snapshot, works, scenes), absent);
  assert.equal(restoreSculptureEncounter(JSON.stringify(plan), snapshot, [], scenes)?.status, "absent", "a retired work never causes a replacement roll");
  assert.equal(restoreSculptureEncounter(JSON.stringify({ ...plan, exhibitionId: "another" }), snapshot, works, scenes), undefined);
  assert.equal(restoreSculptureEncounter("broken", snapshot, works, scenes), undefined);
});
