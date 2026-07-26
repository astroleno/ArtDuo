import assert from "node:assert/strict";
import { test } from "node:test";

import { buildAffectiveGrowthForm } from "../../lib/affective-negotiation";
import { buildGallerySceneRoute, sceneRouteStopForIndex } from "../../lib/gallery-route";
import type { WebBackgroundScene, WebSceneSearchResult, WebSearchResult } from "../../lib/release-catalog";

const nightHall: WebBackgroundScene = {
  id: "bg-night",
  label: "夜蓝古典博物馆厅",
  imageUrl: "/artduo-gallery/night.jpg",
  sceneType: "museum_hall",
  moods: ["quiet", "introspective"],
  palette: ["midnight blue", "slate", "muted gold"],
  emotionIds: ["melancholy", "contemplation", "depth"],
  artworkPaletteModes: ["cool_dark", "muted"],
  searchText: "quiet midnight museum hall",
  searchTerms: ["quiet", "midnight", "museum"],
  embeddingText: "夜蓝古典博物馆厅; mood=quiet introspective; palette=midnight blue slate; scene_type=museum_hall",
};

const whiteRoom: WebBackgroundScene = {
  id: "bg-white",
  label: "雾白静室",
  imageUrl: "/artduo-gallery/white.jpg",
  sceneType: "gallery_interior",
  moods: ["focused", "neutral", "calm"],
  palette: ["light gray", "off-white", "charcoal"],
  emotionIds: ["clarity", "calm", "focus"],
  artworkPaletteModes: ["cool_neutral", "monochrome"],
  searchText: "quiet white room",
  searchTerms: ["quiet", "white", "room"],
  embeddingText: "雾白静室; mood=focused neutral calm; palette=light gray off-white; scene_type=gallery_interior",
};

const redGallery: WebBackgroundScene = {
  id: "bg-red",
  label: "暗红回廊",
  imageUrl: "/artduo-gallery/red.jpg",
  sceneType: "museum_hall",
  moods: ["dramatic", "intimate", "formal"],
  palette: ["burgundy", "walnut", "gold"],
  emotionIds: ["awe", "focus", "drama"],
  artworkPaletteModes: ["dark-rich", "warm-rich"],
  searchText: "dark red gallery return",
  searchTerms: ["dark", "red", "return"],
  embeddingText: "暗红回廊; mood=dramatic intimate formal; palette=burgundy walnut gold; scene_type=museum_hall",
};

function sceneResult(scene: WebBackgroundScene, rank: number): WebSceneSearchResult["results"][number] {
  return {
    rank,
    vectorScore: 0.9 - rank * 0.04,
    lexicalScore: 0.6,
    combinedScore: 0.9 - rank * 0.04,
    matchedTokens: ["quiet", "room"],
    scene,
  };
}

function result(index: number, scene: WebBackgroundScene): WebSearchResult["results"][number] {
  const stageMood = index < 4 ? "contemplation" : index < 8 ? "calm" : "drama";

  return {
    rank: index + 1,
    vectorScore: 0.8,
    lexicalScore: 0.4,
    combinedScore: 0.6,
    matchedTokens: ["quiet", "moonlit", "room"],
    artwork: {
      id: `met-${index}`,
      title: `Work ${index}`,
      artistDisplayName: "Museum Painter",
      yearLabel: "1901",
      moodTags: [stageMood],
      colorTags: index < 8 ? ["slate"] : ["burgundy"],
      subjectTags: ["room"],
      compositionTags: [],
      emotionLabels: [stageMood],
      keywordBoosts: [],
      searchText: `${stageMood} room`,
      grade: "A",
      gradeLabel: "director-focus",
      motionProfile: "static",
      sceneAffinity: {
        sceneTypes: index < 8 ? ["gallery_interior"] : ["museum_hall"],
        paletteModes: index < 4 ? ["cool_dark"] : index < 8 ? ["cool_neutral"] : ["dark-rich"],
        spatialModes: [],
        transitionTags: [],
      },
      imageUrl: "https://example.test/work.jpg",
      detailHref: `/artwork/met-${index}`,
    },
    scene,
  };
}

test("gallery scene route promotes background scenes into three visible stages", () => {
  const search: WebSearchResult = {
    query: "I want a quiet moonlit room",
    normalizedQuery: "i want a quiet moonlit room",
    model: "local",
    dimensions: 4,
    results: Array.from({ length: 12 }, (_, index) => result(index, nightHall)),
  };

  const route = buildGallerySceneRoute(search, [nightHall, whiteRoom, redGallery], {
    sceneResults: [sceneResult(nightHall, 1), sceneResult(whiteRoom, 2), sceneResult(redGallery, 3)],
  });

  assert.deepEqual(route.map((stop) => stop.stageLabel), ["Opening", "Drift", "Return"]);
  assert.deepEqual(route.map((stop) => stop.scene.label), ["夜蓝古典博物馆厅", "雾白静室", "暗红回廊"]);
  assert.equal(new Set(route.map((stop) => stop.scene.id)).size, 3);
  assert.match(route[0]?.reason ?? "", /因/);
  assert.equal(route[0]?.sourceLabel, "观看意图直达");
  assert.doesNotMatch(route.map((stop) => stop.whisper).join(" "), /因|适合|score|token|matched/i);
  assert.doesNotMatch(route.map((stop) => stop.reason).join(" "), /score|token|matched|close to|i, quiet/i);
});

test("scene route lookup keeps immersive stages aligned with scene index", () => {
  const search: WebSearchResult = {
    query: "quiet room",
    normalizedQuery: "quiet room",
    model: "local",
    dimensions: 4,
    results: Array.from({ length: 12 }, (_, index) => result(index, nightHall)),
  };
  const route = buildGallerySceneRoute(search, [nightHall, whiteRoom, redGallery]);

  assert.equal(sceneRouteStopForIndex(route, 0)?.stageLabel, "Opening");
  assert.equal(sceneRouteStopForIndex(route, 5)?.stageLabel, "Drift");
  assert.equal(sceneRouteStopForIndex(route, 11)?.stageLabel, "Return");
});

test("growth form stages drive route stop count when supplied", () => {
  const search: WebSearchResult = {
    query: "先安静，再神秘，再惊叹，最后希望",
    normalizedQuery: "先安静 再神秘 再惊叹 最后希望",
    model: "local",
    dimensions: 4,
    results: Array.from({ length: 12 }, (_, index) => result(index, index < 4 ? nightHall : index < 8 ? whiteRoom : redGallery)),
  };
  const growthForm = buildAffectiveGrowthForm({
    query: search.query,
    results: search.results,
    backgroundScenes: [nightHall, whiteRoom, redGallery],
  });

  const route = buildGallerySceneRoute(search, [nightHall, whiteRoom, redGallery], {
    growthForm,
  });

  assert.equal(growthForm.stages.length, 4);
  assert.equal(route.length, 4);
  assert.deepEqual(route.map((stop) => stop.growthStageId), growthForm.stages.map((stage) => stage.id));
});
