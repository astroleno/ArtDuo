import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCurationNarrative } from "../../lib/curation-narrative";
import { buildExperienceSnapshot } from "../../lib/experience-adapter";
import type { ExperienceArtworkRecord, WebArtwork, WebReleaseCatalog, WebSearchResult } from "../../lib/release-catalog";

function artwork(id: string, title = `Work ${id}`): WebArtwork {
  return {
    id, title, artistDisplayName: "Anonymous", yearLabel: "1900", medium: "Oil on canvas",
    moodTags: ["quiet", "contemplation"], colorTags: ["blue"], subjectTags: ["night"], compositionTags: ["centered"],
    emotionLabels: ["serenity"], keywordBoosts: ["quiet"], searchText: `${title} quiet moon blue`, grade: "A", gradeLabel: "director-focus",
    motionProfile: "static", sceneAffinity: { sceneTypes: [], paletteModes: [], spatialModes: [], transitionTags: [] },
    imageUrl: `/artduo-artwork/${id}`, imageUrlFull: `/artduo-artwork/${id}?variant=full`, detailHref: `/artwork/${id}`,
  };
}

function record(id: string, title: string): ExperienceArtworkRecord {
  return {
    id,
    source: "met",
    metadata: {
      title, artistDisplayName: "Anonymous", yearLabel: "1900", medium: "Oil on canvas", culture: undefined,
      department: "European Paintings", dimensions: "50 × 60 cm", creditLine: undefined, objectUrl: undefined,
      sourceApiUrl: undefined, descriptionRaw: undefined, descriptionClean: `A quiet view in ${title}.`, storySnippet: undefined,
      moodTags: ["quiet"], colorTags: ["blue"], subjectTags: ["night"], compositionTags: ["centered"],
    },
    media: { sourceAssetFingerprint: `fp-${id}`, imageUrlPreview: `https://example.test/${id}.jpg`, imageUrlFull: `https://example.test/${id}-full.jpg`, aspectRatioHint: "landscape", hasMotionAsset: false },
    presentation: { grade: "A", gradeLabel: "director-focus", motionProfile: "static", sceneAffinity: { sceneTypes: [], paletteModes: [], spatialModes: [], transitionTags: [] } },
  } as ExperienceArtworkRecord;
}

function fixture(count: number, missingLast = false) {
  const results = Array.from({ length: count }, (_, index) => {
    const id = `work-${index + 1}`;
    return {
      rank: index + 1, vectorScore: 0.9 - index * 0.01, lexicalScore: 0.8, combinedScore: 0.85 - index * 0.01,
      matchedTokens: ["quiet", "moon"], artwork: artwork(id, index === 0 ? "A Very Long English Title for a Quiet Night" : `Work ${index + 1}`),
    };
  });
  const recordById = new Map(results.slice(0, missingLast ? -1 : undefined).map(({ artwork: item }) => [item.id, record(item.id, item.title)]));
  const catalog = {
    releaseVersion: "release-test",
    artworkRecordById: recordById,
    backgroundSceneRecordById: new Map(),
  } as unknown as WebReleaseCatalog;
  const search: WebSearchResult = { query: "quiet moonlight", normalizedQuery: "quiet moonlight", model: "test", dimensions: 1, results };
  const narrative = buildCurationNarrative(search);
  return { catalog, search, narrative, route: [] };
}

test("experience adapter preserves 0, 1, 5 and 12 result counts with dynamic stages", () => {
  for (const count of [0, 1, 5, 12]) {
    const input = fixture(count);
    const snapshot = buildExperienceSnapshot({ query: input.search.query, ...input });
    assert.equal(snapshot.units.length, count);
    assert.equal(snapshot.omittedUnitCount, 0);
    assert.ok(snapshot.stages.length >= 3 && snapshot.stages.length <= 5);
    assert.deepEqual(snapshot.units.map((unit) => unit.artwork.id), input.search.results.map((result) => result.artwork.id));
    assert.equal(new Set(snapshot.units.map((unit) => unit.exhibition.unitId)).size, count);
    assert.ok(snapshot.units.every((unit) => !unit.stageId || snapshot.stages.some((stage) => stage.id === unit.stageId)));
  }
});

test("experience adapter binds records and versioned media, and keeps missing scene neutral", () => {
  const input = fixture(1);
  const snapshot = buildExperienceSnapshot({ query: input.search.query, ...input });
  const unit = snapshot.units[0]!;
  assert.equal(unit.artwork.metadata.title, "A Very Long English Title for a Quiet Night");
  assert.equal(unit.scene, null);
  assert.equal(unit.media.previewUrl, "/artduo-artwork/work-1?releaseVersion=release-test");
  assert.equal(unit.media.depthMapUrl, undefined);
  assert.equal(unit.caption.source, "grounded");
  assert.equal(unit.exhibition.backgroundSceneId, "unavailable-scene");
});

test("experience adapter counts missing records and rejects duplicate artwork references", () => {
  const missing = fixture(2, true);
  const snapshot = buildExperienceSnapshot({ query: missing.search.query, ...missing });
  assert.equal(snapshot.units.length, 1);
  assert.equal(snapshot.omittedUnitCount, 1);

  const duplicate = fixture(1);
  duplicate.search.results.push({ ...duplicate.search.results[0]!, rank: 2 });
  assert.throws(() => buildExperienceSnapshot({ query: duplicate.search.query, ...duplicate }), /Duplicate experience unit reference/);
});

test("experience prose uses the actual exhibition and excludes long titles, raw prompts and collection scoring notes", () => {
  const input = fixture(2, true);
  const first = input.catalog.artworkRecordById.get("work-1")!;
  first.metadata.title = "A long title ".repeat(30);
  first.metadata.descriptionClean = `${first.metadata.title} by Anonymous. Strong melancholy fit with usable image and title signal (Prints).`;
  const query = "A private long viewing wish ".repeat(30);
  const snapshot = buildExperienceSnapshot({ ...input, query });
  assert.ok(snapshot.preface.text.includes("1 件作品"));
  assert.ok(snapshot.closing.text.includes("1 件作品"));
  assert.ok(!snapshot.preface.text.includes(query));
  assert.ok(!snapshot.preface.text.includes(first.metadata.title));
  assert.ok(snapshot.preface.text.length < 120);
  assert.ok(!snapshot.units[0]!.caption.text.includes("title signal"));
  assert.ok(snapshot.units[0]!.caption.text.includes("Oil on canvas"));
  assert.equal(snapshot.units[0]!.artwork.metadata.title, first.metadata.title);
});
