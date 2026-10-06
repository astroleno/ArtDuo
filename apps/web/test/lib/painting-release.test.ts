import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { loadWebReleaseCatalog, searchReleaseCatalog } from "../../lib/release-catalog";
import { buildCurationNarrative } from "../../lib/curation-narrative";
import { orderSearchForGrowth } from "../../lib/affective-negotiation";

const catalog = loadWebReleaseCatalog({ rootDir: path.resolve(process.cwd(), "../.."), releaseVersion: "2026-10-06-paintings" });

test("curated release keeps concrete subject and artist requests grounded across the complete selection", () => {
  assert.equal(catalog.artworkCount, 236);
  const moon = searchReleaseCatalog(catalog, "安静的月光").results;
  assert.equal(moon.length, 2);
  for (const result of moon) assert.ok(result.matchedTokens.includes("subject:moon"));
  const monet = searchReleaseCatalog(catalog, "想看莫奈").results;
  assert.equal(monet.length, 6);
  for (const result of monet) assert.equal(result.artwork.artistDisplayName, "Claude Monet");
  const stillLife = searchReleaseCatalog(catalog, "想看静物").results;
  assert.equal(stillLife[0]?.artwork.id, "artic-111436");
  const sea = searchReleaseCatalog(catalog, "不要森林，想看海").results;
  assert.ok(sea.length > 0 && sea.length < 12);
  for (const result of sea) {
    assert.ok(result.matchedTokens.includes("subject:sea"));
    assert.doesNotMatch([result.artwork.title, ...result.artwork.subjectTags].join(" "), /\b(?:forest|woods|trees?)\b/i);
  }
});

test("restful complete selections exclude disaster while explicit difficult subjects remain available", () => {
  for (const query of ["有点累，撑了很久", "看了战争新闻很难过，想平静一下", "明亮有活力"]) {
    const search = searchReleaseCatalog(catalog, query);
    assert.equal(search.results.length, 12);
    for (const result of search.results) assert.doesNotMatch([result.artwork.title, ...result.artwork.subjectTags].join(" "), /\b(?:burning|fire|death|battle|war|massacre|rough sea)\b/i);
    const narrative = buildCurationNarrative(search);
    const ordered = orderSearchForGrowth(search, narrative.growthForm);
    assert.deepEqual(new Set(ordered.results.map((result) => result.artwork.id)), new Set(search.results.map((result) => result.artwork.id)));
    assert.deepEqual(ordered.results.map((result) => result.artwork.id), narrative.growthForm.stages.flatMap((stage) => stage.artworkIds));
  }
  assert.ok(searchReleaseCatalog(catalog, "想看战争绘画").results.length > 0);
  assert.ok(searchReleaseCatalog(catalog, "想看死亡题材").results.length > 0);
});

test("exact artwork titles survive a narrow vector shortlist", () => {
  assert.equal(searchReleaseCatalog(catalog, "The Basket of Apples", { vectorCandidateCount: 1 }).results[0]?.artwork.id, "artic-111436");
});
