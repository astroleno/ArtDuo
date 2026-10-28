import assert from "node:assert/strict";
import { test } from "node:test";

import { buildExperienceEntryHref, experienceHrefForPosition, resolveExperiencePosition, restoreExperienceEntryQuery, restoreExperienceRoute, sanitizeReturnTo } from "../../lib/experience-navigation";
import type { ExhibitionSnapshot } from "@artduo/ui";

const snapshot = {
  releaseVersion: "release-1",
  query: "quiet & blue",
  units: [
    { exhibition: { unitId: "u-1" }, artwork: { id: "met-1" } },
    { exhibition: { unitId: "u-2" }, artwork: { id: "met-2" } },
  ],
} as ExhibitionSnapshot;

test("a cached entry restores the submitted draft from its updated address", () => {
  const query = "海边 & 光 / 夜色？";
  const href = `https://tongye.me/ArtDuo/?${new URLSearchParams({ query })}`;
  assert.equal(restoreExperienceEntryQuery("older server draft", href), query);
  assert.equal(restoreExperienceEntryQuery("older server draft", "https://aitoshuu.me/ArtDuo?query="), "");
  assert.equal(restoreExperienceEntryQuery("server draft", "https://aitoshuu.me/ArtDuo?view=experience"), "server draft");
});

test("entry rendering retains its server value when no browser address is available", () => {
  assert.equal(restoreExperienceEntryQuery("server draft"), "server draft");
  assert.equal(restoreExperienceEntryQuery("server draft", "invalid address"), "server draft");
  assert.equal(restoreExperienceEntryQuery("", "https://tongye.me/ArtDuo?query=first&query=second"), "first");
});

test("Forward restores the latest work and order instead of cached preface props", () => {
  const exhibit = { ...snapshot, curationId: "a".repeat(64) };
  const initial = { phase: "preface" } as const;
  const href = experienceHrefForPosition({ ...exhibit, routeOrder: ["met-2", "met-1"] }, { phase: "walk", unitId: "u-2" });
  const restored = restoreExperienceRoute(exhibit, initial, `https://tongye.me${href}`);
  assert.equal(restored.restored, true);
  assert.deepEqual(restored.position, { phase: "walk", unitId: "u-2" });
  assert.deepEqual(restored.snapshot.routeOrder, ["met-2", "met-1"]);
  assert.equal(exhibit.routeOrder, undefined);
  const closing = restoreExperienceRoute(exhibit, initial, `https://tongye.me${experienceHrefForPosition(exhibit, { phase: "closing", lastUnitId: "u-1" })}`);
  assert.deepEqual(closing.position, { phase: "closing", lastUnitId: "u-1" });
});

test("cached route restoration cannot cross exhibition, release, query or entry boundaries", () => {
  const exhibit = { ...snapshot, curationId: "a".repeat(64) };
  const initial = { phase: "preface" } as const;
  const valid = new URL(experienceHrefForPosition(exhibit, { phase: "walk", unitId: "u-2" }), "https://aitoshuu.me");
  for (const [key, value] of [["curationId", "b".repeat(64)], ["releaseVersion", "other"], ["query", "other"], ["view", "other"]]) {
    const url = new URL(valid); url.searchParams.set(key, value);
    assert.deepEqual(restoreExperienceRoute(exhibit, initial, url.href), { snapshot: exhibit, position: initial, restored: false });
  }
  const entry = new URL(valid); entry.pathname = "/ArtDuo";
  assert.equal(restoreExperienceRoute(exhibit, initial, entry.href).restored, false);
  assert.equal(restoreExperienceRoute(exhibit, initial).restored, false);
  assert.equal(restoreExperienceRoute(exhibit, initial, "invalid").restored, false);
  const invalidOrder = new URL(valid); invalidOrder.searchParams.set("route", "met-2,met-2");
  assert.equal(restoreExperienceRoute(exhibit, initial, invalidOrder.href).snapshot.routeOrder, undefined);
});

test("restarting keeps the viewing wish at the current entry without requesting a curation", () => {
  const entry = new URL(buildExperienceEntryHref("海边 & 光 / 夜色？"), "https://tongye.me");
  assert.equal(entry.pathname, "/");
  assert.equal(entry.searchParams.get("view"), "experience");
  assert.equal(entry.searchParams.get("query"), "海边 & 光 / 夜色？");
  assert.equal(entry.searchParams.has("curationId"), false);
  assert.equal(entry.searchParams.has("phase"), false);
  assert.equal(new URL(buildExperienceEntryHref(), entry).searchParams.has("query"), false);
});

test("experience navigation encodes query and restores a walk or closing position", () => {
  const href = experienceHrefForPosition(snapshot, { phase: "walk", unitId: "u-2" });
  assert.match(href, /query=quiet\+%26\+blue/);
  assert.match(href, /artworkId=met-2/);
  assert.equal(resolveExperiencePosition({ phase: "walk", artworkId: "met-2" }, snapshot).position.phase, "walk");
  assert.deepEqual(resolveExperiencePosition({ phase: "closing", artworkId: "missing" }, snapshot), {
    position: { phase: "closing", lastUnitId: undefined }, corrected: true,
  });
});

test("experience navigation normalizes invalid positions and only allows local gallery return paths", () => {
  assert.deepEqual(resolveExperiencePosition({ phase: "walk", artworkId: "missing" }, snapshot), {
    position: { phase: "walk", unitId: "u-1" }, corrected: true,
  });
  assert.equal(sanitizeReturnTo("https://evil.test/gallery", "/gallery"), "/gallery");
  assert.equal(sanitizeReturnTo("//evil.test/gallery", "/gallery"), "/gallery");
  assert.equal(sanitizeReturnTo("/gallery/local/immersive?phase=walk", "/gallery"), "/gallery/local/immersive?phase=walk");
});

test("experience opens the first artwork by default while explicit preface links still work", () => {
  for (const params of [undefined, {}, { phase: "unknown" }]) {
    assert.deepEqual(resolveExperiencePosition(params, snapshot), {
      position: { phase: "walk", unitId: "u-1" }, corrected: true,
    });
  }
  assert.deepEqual(resolveExperiencePosition({ phase: "preface" }, snapshot), {
    position: { phase: "preface" }, corrected: false,
  });
});

test("detail and refresh links carry the revised artwork order without behavioral records", () => {
  const href = experienceHrefForPosition({ ...snapshot, routeOrder: ["met-2", "met-1"] }, { phase: "walk", unitId: "u-2" });
  assert.equal(new URL(href, "http://localhost").searchParams.get("route"), "met-2,met-1");
  assert.doesNotMatch(href, /dwell|observation|viewingMs/);
});

test("subpath return links normalize once for Next navigation and cannot leave the gallery", () => {
  const previous = process.env.NEXT_PUBLIC_ARTDUO_BASE_PATH;
  process.env.NEXT_PUBLIC_ARTDUO_BASE_PATH = "/ArtDuo";
  try {
    assert.equal(sanitizeReturnTo("/ArtDuo/gallery/local/immersive?phase=closing#card", "/gallery"), "/gallery/local/immersive?phase=closing#card");
    for (const value of ["/ArtDuo-old/gallery", "/ArtDuo/../private", "/ArtDuo//evil.test/gallery", "/ArtDuo/gallery\\evil", "https://tongye.me/ArtDuo/gallery"]) assert.equal(sanitizeReturnTo(value, "/gallery"), "/gallery");
    assert.ok(experienceHrefForPosition(snapshot, { phase: "preface" }).startsWith("/gallery/"), "Next router inputs stay domain-neutral");
  } finally { if (previous === undefined) delete process.env.NEXT_PUBLIC_ARTDUO_BASE_PATH; else process.env.NEXT_PUBLIC_ARTDUO_BASE_PATH = previous; }
});

test("retired classic links restore their selected artwork in the current experience", () => {
  const restored = resolveExperiencePosition({ view: "classic", unit: ["met-2", "met-1"] }, snapshot);
  assert.deepEqual(restored, { position: { phase: "walk", unitId: "u-2" }, corrected: true });
  const canonical = new URL(experienceHrefForPosition(snapshot, restored.position), "https://tongye.me");
  assert.equal(canonical.searchParams.get("query"), snapshot.query);
  assert.equal(canonical.searchParams.get("artworkId"), "met-2");
  assert.equal(canonical.searchParams.get("view"), "experience");
  assert.equal(canonical.searchParams.has("unit"), false);
  assert.deepEqual(resolveExperiencePosition({ phase: "walk", unit: "met-2", artworkId: "met-1" }, snapshot), {
    position: { phase: "walk", unitId: "u-1" }, corrected: true,
  });
});

test("legacy closing and missing artworks normalize without losing a valid last position", () => {
  assert.deepEqual(resolveExperiencePosition({ phase: "closing", unit: "met-2" }, snapshot), {
    position: { phase: "closing", lastUnitId: "u-2" }, corrected: true,
  });
  assert.deepEqual(resolveExperiencePosition({ unit: "missing" }, snapshot), {
    position: { phase: "walk", unitId: "u-1" }, corrected: true,
  });
});
