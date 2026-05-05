import assert from "node:assert/strict";
import { test } from "node:test";

import { buildMotionProfile } from "../../src/services/curation/build-motion-profile";

test("motion profile falls back to static image with light motion when no dynamic media exists", () => {
  const profile = buildMotionProfile({
    artworkId: "met-static",
    grade: "B",
    imageUrl: "/artworks/met-static.jpg",
    hasMotionAsset: false,
  });

  assert.equal(profile.usesDynamicMedia, false);
  assert.equal(profile.mediaUrl, "/artworks/met-static.jpg");
  assert.equal(profile.posterUrl, "/artworks/met-static.jpg");
  assert.equal(profile.motionProfile, "ambient-loop");
  assert.equal(profile.displayStrategy, "static-frame");
  assert.equal(profile.transitionIntensity, "moderate");
});

test("motion profile gives A-grade motion assets a director-focus strategy", () => {
  const profile = buildMotionProfile({
    artworkId: "met-focus",
    grade: "A",
    imageUrl: "/artworks/met-focus.jpg",
    hasMotionAsset: true,
    videoUrlMain: "/artworks/met-focus-main.mp4",
    videoUrlCloseup: "/artworks/met-focus-closeup.mp4",
    videoPosterUrl: "/artworks/met-focus-poster.jpg",
    focusTarget: { x: 0.42, y: 0.36, radius: 0.18 },
  });

  assert.equal(profile.usesDynamicMedia, true);
  assert.equal(profile.mediaUrl, "/artworks/met-focus-closeup.mp4");
  assert.equal(profile.posterUrl, "/artworks/met-focus-poster.jpg");
  assert.equal(profile.motionProfile, "push-in");
  assert.equal(profile.displayStrategy, "director-focus");
  assert.equal(profile.transitionIntensity, "dramatic");
  assert.deepEqual(profile.focusTarget, { x: 0.42, y: 0.36, radius: 0.18 });
});
