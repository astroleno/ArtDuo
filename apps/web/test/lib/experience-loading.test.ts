import assert from "node:assert/strict";
import test from "node:test";

import { experienceLoadingTier } from "../../lib/experience-loading";

test("experience loading feedback adds long-wait and retry affordances at the planned thresholds", () => {
  assert.equal(experienceLoadingTier(9_999), "normal");
  assert.equal(experienceLoadingTier(10_000), "long-wait");
  assert.equal(experienceLoadingTier(19_999), "long-wait");
  assert.equal(experienceLoadingTier(20_000), "retry");
});
