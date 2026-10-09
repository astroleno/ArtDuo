import assert from "node:assert/strict";
import test from "node:test";
import type { ExhibitionSnapshot, ExperienceUnit } from "./types";
import { applyPendingPreference, createViewingSession, enterArtwork, observedPace, queuePreference, restoreViewingSession, sequenceExhibition, settleViewingClock, snapshotForSession, validRouteOrder } from "./viewing-session";

function unit(id: string, subjects: string[], moods: string[] = [], stageId = "s1"): ExperienceUnit {
  return { artwork: { id, metadata: { title: id, subjectTags: subjects, moodTags: moods, colorTags: [], compositionTags: [] } },
    exhibition: { unitId: `unit-${id}`, order: 0, backgroundSceneId: stageId }, stageId,
    scene: null, media: { previewUrl: `${id}.jpg`, backgroundUrl: `${stageId}.jpg` }, rationale: { text: "", source: "grounded" } } as ExperienceUnit;
}
const base = { exhibitionId: "test", units: [unit("a", ["pond"]), unit("b", ["portrait"]), unit("c", ["pond"], ["quiet", "serenity"], "s2"), unit("d", ["sea"], [], "s2")] } as ExhibitionSnapshot;

test("explicit feedback applies at the unseen boundary and freezes every visited position", () => {
  let session = enterArtwork(createViewingSession(base), "a");
  session = enterArtwork(session, "b");
  session = queuePreference(session, "similar", "a");
  assert.equal(applyPendingPreference(session, base, "a"), session);
  const changed = applyPendingPreference(session, base, "b");
  assert.deepEqual(changed.order.slice(0, 2), ["a", "b"]);
  assert.equal(validRouteOrder(changed.order, base), true);
  assert.equal(changed.pending, undefined);
  session = queuePreference(enterArtwork(createViewingSession(base), "a"), "similar", "a");
  const reordered = applyPendingPreference(session, base, "a");
  assert.deepEqual(reordered.order, ["a", "c", "b", "d"]);
  assert.equal(reordered.revisions[0]?.frozenThrough, 0);
});

test("restoring the original remainder never rewrites a prefix already walked after adaptation", () => {
  let session = applyPendingPreference(queuePreference(enterArtwork(createViewingSession(base), "a"), "similar", "a"), base, "a");
  session = enterArtwork(session, "c");
  const restored = applyPendingPreference(queuePreference(session, "original", "c"), base, "c");
  assert.deepEqual(restored.order, ["a", "c", "b", "d"]);
  assert.equal(restored.pending, undefined);
  const beforeWalking = applyPendingPreference(queuePreference({ ...session, frontier: 0 }, "original", "a"), base, "a");
  assert.deepEqual(beforeWalking.order, ["a", "b", "c", "d"]);
});

test("quieter and different choose from the original eligible set without inventing or dropping works", () => {
  const session = enterArtwork(createViewingSession(base), "a");
  const quiet = applyPendingPreference(queuePreference(session, "quieter", "a"), base, "a");
  assert.equal(quiet.order[1], "c");
  const different = applyPendingPreference(queuePreference(quiet, "different", "a"), base, "a");
  assert.equal(different.order[1], "b");
  assert.deepEqual(new Set(different.order), new Set(session.order));
  assert.deepEqual(session.order, ["a", "b", "c", "d"]);
});

test("changing the route preserves stable IDs, source pixels and the current room", () => {
  const session = applyPendingPreference(queuePreference(enterArtwork(createViewingSession(base), "a"), "similar", "a"), base, "a");
  const active = snapshotForSession(base, session);
  assert.equal(active.units[0]?.media.backgroundUrl, base.units[0]?.media.backgroundUrl);
  assert.equal(active.units[1]?.exhibition.unitId, "unit-c");
  assert.equal(active.units[1]?.media.previewUrl, "c.jpg");
  assert.equal(active.units[1]?.media.backgroundUrl, "s1.jpg");
  assert.equal(active.units[2]?.media.backgroundUrl, "s2.jpg");
});

test("a new pending decision replaces the previous one; no-op and end-of-route stay usable", () => {
  let session = enterArtwork(createViewingSession(base), "a");
  session = queuePreference(queuePreference(session, "similar", "a"), "quieter", "a");
  assert.equal(session.pending?.preference, "quieter");
  const result = applyPendingPreference(queuePreference(session, "original", "a"), base, "a");
  assert.equal(result.revisions.length, 0);
  assert.match(result.message, /保留当前顺序/);
  assert.equal(queuePreference(enterArtwork(session, "d"), "similar", "d").pending, undefined);
});

test("only decoded visible viewing and zoom time contributes to pace; reading and hidden time remain separate", () => {
  let session = enterArtwork(createViewingSession(base), "a");
  session = settleViewingClock(session, { artworkId: "a", mode: "viewing", since: 100 }, 2100);
  session = settleViewingClock(session, { artworkId: "a", mode: "zoom", since: 2100 }, 5100);
  session = settleViewingClock(session, { artworkId: "a", mode: "reading", since: 5100 }, 9100);
  session = settleViewingClock(session, { artworkId: "a", mode: "paused", since: 9100 }, 60000);
  assert.deepEqual([session.observations[0]?.viewingMs, session.observations[0]?.zoomMs, session.observations[0]?.readingMs], [2000, 3000, 4000]);
  assert.equal(observedPace(session), "steady");
  for (const id of ["b", "c"]) session = enterArtwork(session, id);
  session.observations = session.observations.map((item) => ({ ...item, viewingMs: 15000, completedVisits: 1 }));
  assert.equal(observedPace(session), "unhurried");
  assert.equal(observedPace({ ...session, paceEnabled: false }), "steady");
  assert.deepEqual(session.order, ["a", "b", "c", "d"]);
});

test("session persistence validates identities, counters, versions and URL precedence", () => {
  const session = enterArtwork(createViewingSession(base), "a");
  assert.deepEqual(restoreViewingSession(JSON.stringify(session), base)?.order, session.order);
  for (const value of [null, "broken", JSON.stringify({ ...session, schemaVersion: 2 }), JSON.stringify({ ...session, order: ["a", "a", "c", "d"] }), JSON.stringify({ ...session, order: ["a", "b", "c", "outside"] }), JSON.stringify({ ...session, frontier: 99 }), JSON.stringify({ ...session, observations: [{ ...session.observations[0], viewingMs: -1 }] })]) {
    assert.equal(restoreViewingSession(value, base), undefined);
  }
  assert.equal(restoreViewingSession(JSON.stringify(session), { ...base, routeOrder: ["a", "c", "b", "d"] }), undefined);
  assert.deepEqual(createViewingSession({ ...base, routeOrder: ["a", "c", "b", "d"] }).order, ["a", "c", "b", "d"]);
});

test("initial curation links related subjects without changing the opening work or stage membership", () => {
  const works = [unit("first", ["pond"]), unit("second", ["portrait"]), unit("third", ["pond"]), unit("fourth", ["pond"], [], "s2")];
  const ordered = sequenceExhibition(works);
  assert.deepEqual(ordered.map((work) => work.artwork.id), ["first", "third", "second", "fourth"]);
  assert.match(ordered[1]!.rationale.text, /水面/);
  assert.deepEqual(ordered.map((work) => work.stageId), ["s1", "s1", "s1", "s2"]);
});
