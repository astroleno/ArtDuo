import assert from "node:assert/strict";
import { test } from "node:test";

import { parseCurationGradeProfile, parseMotionPlaybackProfile } from "./curation-grade";

test("curation grade profile parses the A/B/C display contract", () => {
  const profile = parseCurationGradeProfile({
    artworkId: "met-1",
    grade: "A",
    gradeLabel: "director-focus",
    displayStrategy: "director-focus",
    rank: 1,
    score: 0.98,
    reasons: ["top-ranked", "motion-ready"],
  });

  assert.equal(profile.grade, "A");
  assert.equal(profile.gradeLabel, "director-focus");
  assert.deepEqual(profile.reasons, ["top-ranked", "motion-ready"]);
});

test("motion playback profile keeps dynamic media optional", () => {
  const profile = parseMotionPlaybackProfile({
    artworkId: "met-2",
    grade: "B",
    motionProfile: "ambient-loop",
    displayStrategy: "static-frame",
    transitionIntensity: "moderate",
    usesDynamicMedia: false,
    mediaUrl: "/artworks/met-2.jpg",
    posterUrl: "/artworks/met-2.jpg",
  });

  assert.equal(profile.usesDynamicMedia, false);
  assert.equal(profile.mediaUrl, "/artworks/met-2.jpg");
});
