import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { parseArtworkRecord, parseBackgroundSceneRecords } from "@artduo/contracts";

import { matchArtworkToScenes } from "./curation-coverage";

test("scene matching treats multi-orientation scene support as fully compatible", () => {
  const scenes = parseBackgroundSceneRecords(JSON.parse(
    readFileSync(path.resolve(__dirname, "../../../packages/contracts/fixtures/background-scenes.json"), "utf8"),
  ));

  const record = parseArtworkRecord({
    id: "met-test-wonder",
    source: "met",
    sourceArtworkId: "test-wonder",
    version: "test",
    metadata: {
      title: "Wonder Study",
      artistDisplayName: "Test Artist",
      medium: "Oil on canvas",
      department: "European Paintings",
      objectUrl: "https://example.com/wonder",
      descriptionRaw: "A portrait that leans into wonder and amazement.",
      descriptionClean: "A portrait that leans into wonder and amazement.",
      storySnippet: "A portrait that leans into wonder and amazement.",
      moodTags: ["wonder"],
      colorTags: ["brown"],
      subjectTags: ["portrait"],
      compositionTags: ["single-subject", "portrait-bias"],
    },
    retrieval: {
      searchText: "wonder portrait amazement",
      searchTextShort: "wonder portrait",
      emotionLabels: ["wonder"],
      energyLevel: "high",
      valence: "bright",
      pace: "active",
      spaceSense: "close",
      keywordBoosts: ["wonder", "amazement"],
    },
    media: {
      baseImageUrl: "https://example.com/wonder.jpg",
      imageUrlPreview: "https://example.com/wonder.jpg",
      imageUrlFull: "https://example.com/wonder-full.jpg",
      aspectRatioHint: "portrait",
      hasMotionAsset: false,
      mediaVersion: "test",
    },
    presentation: {
      grade: "B",
      gradeLabel: "emotional-pillar",
      motionProfile: "static",
      narrationMode: "caption",
    },
  });

  const topMatch = matchArtworkToScenes(record, "wonder", scenes)[0];

  assert.ok(topMatch);
  assert.equal(topMatch.sceneId, "bg-014");
  assert.equal(topMatch.breakdown.orientationScore, 1);
  assert.ok(topMatch.score >= 0.6);
});
