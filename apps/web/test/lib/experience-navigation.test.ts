import assert from "node:assert/strict";
import { test } from "node:test";

import { experienceHrefForPosition, resolveExperiencePosition, sanitizeReturnTo } from "../../lib/experience-navigation";
import type { ExhibitionSnapshot } from "@artduo/ui";

const snapshot = {
  releaseVersion: "release-1",
  query: "quiet & blue",
  units: [
    { exhibition: { unitId: "u-1" }, artwork: { id: "met-1" } },
    { exhibition: { unitId: "u-2" }, artwork: { id: "met-2" } },
  ],
} as ExhibitionSnapshot;

test("experience navigation encodes query and restores a walk or closing position", () => {
  const href = experienceHrefForPosition(snapshot, { phase: "walk", unitId: "u-2" });
  assert.match(href, /query=quiet\+%26\+blue/);
  assert.match(href, /artworkId=met-2/);
  assert.equal(resolveExperiencePosition({ phase: "walk", artworkId: "met-2" }, snapshot).position.phase, "walk");
  assert.deepEqual(resolveExperiencePosition({ phase: "closing", artworkId: "missing" }, snapshot), {
    position: { phase: "closing", lastUnitId: undefined }, corrected: true,
  });
});

test("experience navigation normalizes invalid positions and only allows local gallery return paths", () => {
  assert.deepEqual(resolveExperiencePosition({ phase: "walk", artworkId: "missing" }, snapshot), {
    position: { phase: "walk", unitId: "u-1" }, corrected: true,
  });
  assert.equal(sanitizeReturnTo("https://evil.test/gallery", "/gallery"), "/gallery");
  assert.equal(sanitizeReturnTo("//evil.test/gallery", "/gallery"), "/gallery");
  assert.equal(sanitizeReturnTo("/gallery/local/immersive?phase=walk", "/gallery"), "/gallery/local/immersive?phase=walk");
});

test("experience opens the first artwork by default while explicit preface links still work", () => {
  for (const params of [undefined, {}, { phase: "unknown" }]) {
    assert.deepEqual(resolveExperiencePosition(params, snapshot), {
      position: { phase: "walk", unitId: "u-1" }, corrected: true,
    });
  }
  assert.deepEqual(resolveExperiencePosition({ phase: "preface" }, snapshot), {
    position: { phase: "preface" }, corrected: false,
  });
});
