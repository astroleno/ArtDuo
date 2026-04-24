import assert from "node:assert/strict";
import { test } from "node:test";

import { parseBackgroundSceneRecords } from "./background-scene";
import { loadFixture } from "./test-helpers";

test("background scene fixtures expose staging and transition data", () => {
  const scenes = parseBackgroundSceneRecords(loadFixture("background-scenes.json"));

  assert.equal(scenes.length, 3);

  for (const scene of scenes) {
    assert.equal(scene.stage_profile.primary_mount_zone.shape, "rect");
    assert.ok(scene.transition_profile.entry_families.length > 0, `${scene.id} should define entry transitions`);
    assert.ok(scene.ui_profile.overlay_readability, `${scene.id} should define overlay readability`);
  }
});
