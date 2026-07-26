import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCurationNarrative, curvePath } from "../../lib/curation-narrative";
import type { WebSearchResult } from "../../lib/release-catalog";

function result(id: string, score: number, mood: string, token: string): WebSearchResult["results"][number] {
  return {
    rank: 1,
    vectorScore: score,
    lexicalScore: score,
    combinedScore: score,
    matchedTokens: [token],
    artwork: {
      id,
      title: `Work ${id}`,
      artistDisplayName: "Museum Painter",
      yearLabel: "1901",
      moodTags: [mood],
      colorTags: ["warm"],
      subjectTags: ["room"],
      compositionTags: [],
      emotionLabels: [mood],
      keywordBoosts: [token],
      searchText: `${mood} ${token}`,
      grade: "A",
      gradeLabel: "director-focus",
      motionProfile: "static",
      sceneAffinity: {
        sceneTypes: ["gallery_interior"],
        paletteModes: ["warm"],
        spatialModes: [],
        transitionTags: [],
      },
      imageUrl: "https://example.test/work.jpg",
      detailHref: `/artwork/${id}`,
    },
    scene: {
      id: "bg-room",
      label: "Warm Room",
      imageUrl: "/artduo-gallery/bg-room.png",
      moods: [mood],
      palette: ["warm"],
      emotionIds: [mood],
      artworkPaletteModes: ["warm"],
      searchText: `${mood} room`,
    },
  };
}

test("curation narrative produces preface closing and a three-stage curve", () => {
  const narrative = buildCurationNarrative({
    query: "I want a quiet room",
    normalizedQuery: "i want a quiet room",
    model: "local",
    dimensions: 4,
    results: [
      result("met-1", 0.91, "quiet", "moon"),
      result("met-2", 0.82, "quiet", "room"),
      result("met-3", 0.71, "still", "shadow"),
      result("met-4", 0.64, "still", "threshold"),
      result("met-5", 0.52, "bright", "return"),
    ],
  });

  assert.match(narrative.preface, /Work met-1/);
  assert.match(narrative.preface, /我把这句愿望理解成/);
  assert.match(narrative.preface, /把注意力从噪声里慢慢收回来/);
  assert.match(narrative.closing, /5 件作品/);
  assert.match(narrative.closing, /不是答案/);
  assert.equal(narrative.curve.length, 3);
  assert.equal(narrative.curve.length, narrative.growthForm.stages.length);
  assert.equal(narrative.growthForm.sourceText, "I want a quiet room");
  assert.ok(narrative.intentSignals.includes("serenity"));
  assert.match(curvePath(narrative.curve), /^M /);
});

test("curation narrative keeps visible copy aligned with hard brightness resistance", () => {
  const narrative = buildCurationNarrative({
    query: "不要太明亮，想要暗红和深木色",
    normalizedQuery: "不要太明亮 想要暗红 深木色",
    model: "local",
    dimensions: 4,
    results: [
      result("met-hope", 0.91, "hope", "wood"),
      result("met-melancholy", 0.82, "melancholy", "walnut"),
      result("met-desire", 0.71, "desire", "dark"),
    ],
  });

  assert.ok(narrative.growthForm.rules.some((rule) => rule.severity === "hard" && rule.signal === "bright"));
  assert.doesNotMatch(narrative.preface, /喜悦|亮起来/);
  assert.doesNotMatch(narrative.title, /向上的光|明亮/);
  assert.match(`${narrative.title} ${narrative.preface}`, /低光|木色|暗红/);
});
