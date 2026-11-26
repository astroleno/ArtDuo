import assert from "node:assert/strict";
import test from "node:test";
import { createPresentedPrefaceStore, prefaceForDisplay, prefaceIdentity, PRESENTED_PREFACE_KEY, readyPreface } from "./presented-preface";
import type { NarrativeBlock } from "./types";

const fallback: NarrativeBlock = { text: "赭黄屋顶在前景叠置。", source: "fallback" };
const grounded: NarrativeBlock = { text: "屋顶与海湾先铺开。", source: "grounded" };
function storage(raw: string | null = null) {
  return { getItem: (_key: string) => raw, setItem: (_key: string, value: string) => { raw = value; } };
}

test("an unread candidate is not recorded; first visible prose wins over late delivery and survives a fresh store", () => {
  const saved = storage(), visit = createPresentedPrefaceStore();
  assert.equal(readyPreface(fallback, true, 3000, 2999), null);
  assert.equal(visit.restore("one", saved), undefined);
  assert.equal(readyPreface(fallback, true, 3000, 3000), fallback);
  assert.deepEqual(visit.present("one", fallback, saved), fallback);
  assert.deepEqual(visit.present("one", grounded, saved), fallback);
  assert.deepEqual(createPresentedPrefaceStore().restore("one", saved), fallback);
  assert.equal(readyPreface(grounded, true, 3000, 500), grounded);
  assert.equal(readyPreface(fallback, false, 3000, 500), fallback);
});

test("preface identity survives route reordering but separates releases, recipes and curations", () => {
  const exhibit = { releaseVersion: "release-a", recipeVersion: "experience-v2" as const, curationId: "curation-a", exhibitionId: "ex-a" };
  const id = prefaceIdentity(exhibit), saved = storage();
  createPresentedPrefaceStore().present(id, grounded, saved);
  assert.deepEqual(createPresentedPrefaceStore().restore(prefaceIdentity({ ...exhibit }), saved), grounded);
  for (const change of [{ releaseVersion: "release-b" }, { recipeVersion: "experience-v1" as const }, { curationId: "curation-b" }])
    assert.equal(createPresentedPrefaceStore().restore(prefaceIdentity({ ...exhibit, ...change }), saved), undefined);
  assert.notEqual(prefaceIdentity({ ...exhibit, curationId: undefined }), prefaceIdentity({ ...exhibit, curationId: undefined, exhibitionId: "ex-b" }));
});

test("invalid and oversized session data never supplies displayed prose", () => {
  for (const raw of ["broken", "null", "x".repeat(120_001), JSON.stringify({ schemaVersion: 2, entries: [] }),
    ...[{ text: "", source: "grounded" }, { text: "x".repeat(4001), source: "fallback" }, { text: "hi", source: "unknown" }]
      .map(block => JSON.stringify({ schemaVersion: 1, entries: [{ identity: "one", block }] })),
  ]) assert.equal(createPresentedPrefaceStore().restore("one", storage(raw)), undefined);
  const saved = storage(JSON.stringify({ schemaVersion: 1, entries: [{ identity: "other", block: grounded }] }));
  assert.equal(createPresentedPrefaceStore().restore("one", saved), undefined);
});

test("blocked storage keeps current-document prose stable and the bounded record retains recent exhibitions", () => {
  const denied = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
  const visit = createPresentedPrefaceStore();
  visit.present("one", fallback, denied);
  assert.deepEqual(visit.present("one", grounded, denied), fallback);
  const saved = storage();
  for (let index = 0; index < 25; index++) visit.present(String(index), grounded, saved);
  const record = JSON.parse(saved.getItem(PRESENTED_PREFACE_KEY)!);
  assert.equal(record.entries.length, 20);
  const restored = createPresentedPrefaceStore();
  assert.equal(restored.restore("0", saved), undefined);
  assert.deepEqual(restored.restore("24", saved), grounded);
});

test("a restored etching preface is projected for display without changing its locked session copy", () => {
  const style = { presentationQuery: "想看六幅馆方没有注明印版材质的蚀刻版画" };
  const identity = "unchanged-exhibition";
  const raw = { text: "先看版材未注明的蚀刻。", source: "grounded" as const };
  const saved = storage(JSON.stringify({ schemaVersion: 1, entries: [{ identity, block: raw }] }));
  const restored = createPresentedPrefaceStore().restore(identity, saved)!;
  assert.deepEqual(prefaceForDisplay(restored, style), { ...restored, text: "先看馆方没有注明印版材质的蚀刻版画。" });
  const atLimit = { ...raw, text: "墨".repeat(60 - Array.from(raw.text).length) + raw.text };
  assert.equal(prefaceForDisplay(atLimit, style)?.text, atLimit.text.replace("版材", "印版"));
  assert.equal(prefaceForDisplay(restored, {}), restored);
  assert.equal(prefaceForDisplay(grounded, style), grounded);
  assert.equal(prefaceForDisplay(null, style), null);
  assert.equal(saved.getItem(PRESENTED_PREFACE_KEY), JSON.stringify({ schemaVersion: 1, entries: [{ identity, block: raw }] }));
});
