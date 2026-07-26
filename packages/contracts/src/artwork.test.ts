import assert from "node:assert/strict";
import { test } from "node:test";

import { parseArtworkRecords } from "./artwork";
import { loadFixture } from "./test-helpers";

const baseArtworkRecord = {
  id: "met-crop",
  source: "met",
  sourceArtworkId: "1",
  version: "2026-04-25-curation-b",
  metadata: {
    title: "Crop Study",
    moodTags: ["quiet"],
    colorTags: ["white"],
    subjectTags: ["paper"],
    compositionTags: ["centered"],
  },
  retrieval: {
    searchText: "quiet paper crop study",
    emotionLabels: ["quiet"],
  },
  media: {
    baseImageUrl: "https://example.test/crop.jpg",
    aspectRatioHint: "portrait",
    hasMotionAsset: false,
    mediaVersion: "2026-04-25T00:00:00.000Z",
  },
  presentation: {
    grade: "B",
    gradeLabel: "emotional-pillar",
    motionProfile: "static",
  },
};

test("artwork fixtures satisfy the Phase 1 display/data baseline", () => {
  const records = parseArtworkRecords(loadFixture("artworks.json"));

  assert.equal(records.length, 3);

  for (const record of records) {
    assert.ok(record.metadata.storySnippet, `${record.id} should carry a fixture story snippet`);
    assert.ok(record.retrieval.searchText.length > 0, `${record.id} should be searchable`);
    assert.ok(record.media.baseImageUrl || record.media.imageUrlPreview, `${record.id} should expose a primary image`);
    assert.ok(record.media.mediaVersion || record.media.sourceAssetFingerprint, `${record.id} should be replayable`);
  }
});

test("artwork parser accepts visual presentation crop metadata", () => {
  const records = parseArtworkRecords([
    {
      ...baseArtworkRecord,
      media: {
        ...baseArtworkRecord.media,
        visualPresentation: {
          contentBounds: { x: 0.08, y: 0.12, width: 0.84, height: 0.74 },
          contentAspectRatio: 1.45,
          whiteBorderRatio: 0.24,
          cropStrategy: "trim-border",
          confidence: 0.82,
          source: "vlm",
          notes: ["large paper border"],
        },
      },
    },
  ]);

  assert.equal(records[0]?.media.visualPresentation?.cropStrategy, "trim-border");
  assert.deepEqual(records[0]?.media.visualPresentation?.contentBounds, { x: 0.08, y: 0.12, width: 0.84, height: 0.74 });
});

test("artwork parser rejects visual presentation bounds outside the image", () => {
  assert.throws(
    () => parseArtworkRecords([
      {
        ...baseArtworkRecord,
        media: {
          ...baseArtworkRecord.media,
          visualPresentation: {
            contentBounds: { x: 0.8, y: 0.2, width: 0.4, height: 0.4 },
            cropStrategy: "trim-border",
          },
        },
      },
    ]),
    /expected bounds to fit inside the image/,
  );
});
