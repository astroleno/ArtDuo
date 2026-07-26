import assert from "node:assert/strict";
import { test } from "node:test";

import { buildAffectiveGrowthForm } from "../../lib/affective-negotiation";
import type { WebBackgroundScene, WebSearchResult } from "../../lib/release-catalog";

const quietScene: WebBackgroundScene = {
  id: "bg-quiet",
  label: "Quiet Room",
  sceneType: "gallery_interior",
  moods: ["quiet", "serenity"],
  palette: ["charcoal", "walnut"],
  emotionIds: ["quiet", "calm"],
  artworkPaletteModes: ["dark-rich"],
  searchText: "quiet dark room",
};

function result(
  id: string,
  tags: {
    mood?: string[];
    emotion?: string[];
    color?: string[];
    tokens?: string[];
  },
  rank = 1,
): WebSearchResult["results"][number] {
  const moodTags = tags.mood ?? [];
  const emotionLabels = tags.emotion ?? moodTags;
  const colorTags = tags.color ?? [];
  const matchedTokens = tags.tokens ?? [...moodTags, ...emotionLabels, ...colorTags];

  return {
    rank,
    vectorScore: 0.7,
    lexicalScore: 0.6,
    combinedScore: 0.8 - rank * 0.01,
    matchedTokens,
    artwork: {
      id,
      title: `Work ${id}`,
      artistDisplayName: "Museum Painter",
      yearLabel: "1901",
      moodTags,
      colorTags,
      subjectTags: ["room"],
      compositionTags: [],
      emotionLabels,
      keywordBoosts: matchedTokens,
      searchText: matchedTokens.join(" "),
      grade: "A",
      gradeLabel: "director-focus",
      motionProfile: "static",
      sceneAffinity: {
        sceneTypes: ["gallery_interior"],
        paletteModes: colorTags,
        spatialModes: ["close"],
        transitionTags: [],
      },
      imageUrl: "https://example.test/work.jpg",
      detailHref: `/artwork/${id}`,
    },
    scene: quietScene,
  };
}

test("growth form creates a hard bright rule and rejects bright candidates", () => {
  const form = buildAffectiveGrowthForm({
    query: "不要太明亮，想要暗红和深木色",
    results: [
      result("bright-work", { mood: ["joy"], color: ["bright"] }, 1),
      result("dark-work", { mood: ["quiet"], color: ["burgundy", "walnut"] }, 2),
      result("third-work", { mood: ["serenity"], color: ["charcoal"] }, 3),
    ],
    backgroundScenes: [quietScene],
  });

  assert.ok(form.rules.some((rule) => rule.signal === "bright" && rule.severity === "hard"));
  assert.ok(form.rejectedArtworkIds.includes("bright-work"));
  assert.ok(form.supportingArtworkIds.includes("dark-work"));
});

test("growth form makes quiet-wonder-calm stages with middle arousal peak", () => {
  const form = buildAffectiveGrowthForm({
    query: "先安静，再惊叹，最后回到平静",
    results: [
      result("quiet-work", { mood: ["quiet"] }, 1),
      result("wonder-work", { mood: ["wonder", "awe"] }, 2),
      result("return-work", { mood: ["calm"] }, 3),
    ],
    backgroundScenes: [quietScene],
  });

  assert.equal(form.stages.length, 3);
  assert.ok(form.stages[0]!.arousal < form.stages[1]!.arousal);
  assert.ok(form.stages[2]!.arousal < form.stages[1]!.arousal);
});

test("growth form preserves ordered stage signals from Chinese stage words", () => {
  const form = buildAffectiveGrowthForm({
    query: "开头孤独，中段有神秘，最后要有希望",
    results: [
      result("melancholy-work", { mood: ["melancholy"] }, 1),
      result("mystery-work", { mood: ["mystery"] }, 2),
      result("hope-work", { mood: ["hope"] }, 3),
    ],
    backgroundScenes: [quietScene],
  });

  const stageSignals = form.stages.map((stage) => stage.signals.map((signal) => signal.value));

  assert.ok(stageSignals[0]?.includes("melancholy"));
  assert.ok(stageSignals[1]?.includes("mystery"));
  assert.ok(stageSignals[2]?.includes("hope"));
});
