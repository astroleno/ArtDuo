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

test("explicit sculpture and medium exclusions take priority over a lucky roll", () => {
  for (const query of ["只看油画", "只想看风景", "不要雕塑", "paintings only", "without sculptures", "only landscapes"]) {
    assert.equal(permitsSculptureEncounter(query), false, query);
    assert.equal(planSculptureEncounter({ ...snapshot, query }, works, scenes, { roll: 0, selection: 0 }).status, "absent");
  }
  assert.equal(permitsSculptureEncounter("想看绘画，也想偶然遇见雕塑"), true);
});

test("painting figure exclusions do not filter the separate sculpture easter egg", () => {
  for (const query of ["无人海景", "我想看没有人的海边", "不看人物", "不要人像", "no people", "without portraits"]) {
    assert.equal(permitsSculptureEncounter(query), true, query);
    assert.equal(planSculptureEncounter({ ...snapshot, query }, works, scenes, { roll: .1, selection: 0 }).status, "pending", query);
  }
});

test("natural sculpture negations and exclusive media remain hard encounter boundaries", () => {
  for (const query of ["我不想看到雕塑", "别给我雕塑", "不要看到雕塑", "不要人物雕塑", "避免雕塑", "I don't want statues", "sculptures are not welcome", "只想看版画", "仅限水墨", "只要素描", "只看粉彩", "only watercolors", "watercolours only", "only gouache"]) {
    assert.equal(permitsSculptureEncounter(query), false, query);
    assert.equal(planSculptureEncounter({ ...snapshot, query }, works, scenes, { roll: 0, selection: 0 }).status, "absent", query);
  }
  for (const query of ["只看版画，也欢迎雕塑", "只看油画，雕塑也可以", "only watercolors; sculptures are welcome", "只想看水墨，不介意雕塑", "不只看油画", "不要油画，而是想看雕塑", "无人海景", "不要人物", "想看绘画与雕塑"]) {
    assert.equal(permitsSculptureEncounter(query), true, query);
  }
  assert.equal(permitsSculptureEncounter("雕塑也可以，但这次只看版画"), false);
  const saved = planSculptureEncounter(snapshot, works, scenes, { roll: 0, selection: 0 });
  assert.equal(restoreSculptureEncounter(JSON.stringify(saved), { ...snapshot, query: "我不想看到雕塑" }, works, scenes)?.status, "absent", "new eligibility must retire a saved encounter without rerolling");
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

test("the encounter follows the planned stages: none in a still visit, at the turn, and never toward a city in a quiet stage", () => {
  const stage = (id: string, role: string, arousal: number) => ({ id, role, label: id, valence: .5, arousal, tension: .2, wonder: .4, intimacy: .5, intensity: .3, transitionIntent: "fade" });
  const staged = (stageIds: string[], stages: ReturnType<typeof stage>[]) => ({ ...snapshot,
    units: snapshot.units.map((unit, index) => ({ ...unit, stageId: stageIds[index]! })), stages }) as unknown as ExhibitionSnapshot;
  const rooms = [{ id: "harbour", tone: "warm", light: "right", view: "city" }, { id: "soft", tone: "neutral", light: "top" }] as SculptureRoomScene[];

  const still = staged(["s1", "s1", "s2", "s2", "s3", "s3"], [stage("s1", "threshold", .15), stage("s2", "turn", .2), stage("s3", "afterglow", .18)]);
  assert.equal(planSculptureEncounter(still, works, rooms, { roll: 0, selection: 0 }).status, "absent", "a fully still visit is not interrupted");

  const turning = staged(["s1", "s1", "s2", "s3", "s3", "s4"], [stage("s1", "threshold", .2), stage("s2", "mirror", .3), stage("s3", "turn", .55), stage("s4", "afterglow", .3)]);
  const atTurn = planSculptureEncounter(turning, works, rooms, { roll: 0, selection: 0 });
  assert.equal(atTurn.status, "pending");
  assert.deepEqual([atTurn.anchorArtworkId, atTurn.nextArtworkId], ["c", "d"], "the side hall opens where the route turns");

  const quietTurn = staged(["s1", "s2", "s2", "s3", "s3", "s4"], [stage("s1", "threshold", .2), stage("s2", "mirror", .3), stage("s3", "turn", .35), stage("s4", "afterglow", .3)]);
  const anchorUnit = { ...quietTurn.units[2]!, sceneMatch: { lightDirection: "right" } };
  const quiet = { ...quietTurn, units: quietTurn.units.map((unit, index) => index === 2 ? anchorUnit : unit) } as ExhibitionSnapshot;
  assert.equal(planSculptureEncounter(quiet, works, rooms, { roll: 0, selection: 0 }).roomId, "soft", "a quiet stage does not open onto the harbour city");
});
