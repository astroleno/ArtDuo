import assert from "node:assert/strict";
import { test } from "node:test";

import type { ArtworkRecord } from "@artduo/contracts";

import { buildArtworkAgentCapsule } from "./artwork-agent-capsule";

const baseArtwork: ArtworkRecord = {
  id: "art-capsule-1",
  source: "met",
  sourceArtworkId: "1",
  version: "2026-04-25-curation-b",
  metadata: {
    title: "Serene Burgundy Study",
    artistDisplayName: "Example Artist",
    yearLabel: "1888",
    moodTags: ["serenity"],
    colorTags: ["burgundy"],
    subjectTags: ["room"],
    compositionTags: ["centered"],
  },
  retrieval: {
    searchText: "serenity burgundy centered room",
    emotionLabels: ["quiet"],
    energyLevel: "high",
    valence: "mixed",
    pace: "still",
    spaceSense: "close",
  },
  media: {
    baseImageUrl: "https://example.test/art.jpg",
    hasMotionAsset: false,
    mediaVersion: "2026-04-25T00:00:00.000Z",
  },
  presentation: {
    grade: "B",
    gradeLabel: "emotional-pillar",
    motionProfile: "static",
    sceneAffinity: {
      sceneTypes: ["gallery_interior"],
      paletteModes: ["dark-rich"],
      spatialModes: ["close"],
      transitionTags: ["fade"],
    },
  },
};

test("artwork capsule derives mood tags as affect offers", () => {
  const capsule = buildArtworkAgentCapsule(baseArtwork);

  assert.ok(capsule.canOffer.some((signal) => signal.value === "serenity"));
  assert.ok(capsule.canOffer.every((signal) => signal.evidenceIds && signal.evidenceIds.length > 0));
});

test("artwork capsule exposes color tags as aesthetics", () => {
  const capsule = buildArtworkAgentCapsule(baseArtwork);

  assert.ok(capsule.aesthetics.some((signal) => signal.kind === "color" && signal.value === "burgundy"));
  assert.ok(capsule.evidence.some((entry) => entry.fieldPath === "metadata.colorTags" && entry.value === "burgundy"));
});

test("artwork capsule creates high arousal boundary from high energy", () => {
  const capsule = buildArtworkAgentCapsule(baseArtwork);

  assert.ok(capsule.boundaries.some((signal) => signal.value === "high-arousal"));
});

test("artwork capsule creates heavy drama and bright boundaries", () => {
  const capsule = buildArtworkAgentCapsule({
    ...baseArtwork,
    metadata: {
      ...baseArtwork.metadata,
      moodTags: ["grief", "bright"],
    },
    retrieval: {
      ...baseArtwork.retrieval,
      emotionLabels: ["drama"],
      valence: "bright",
      energyLevel: "medium",
    },
  });

  assert.ok(capsule.boundaries.some((signal) => signal.value === "heavy-drama"));
  assert.ok(capsule.boundaries.some((signal) => signal.value === "bright"));
});
