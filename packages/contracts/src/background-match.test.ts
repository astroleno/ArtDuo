import assert from "node:assert/strict";
import { test } from "node:test";

import { parseBackgroundMatch } from "./background-match";
import { parseBackgroundSceneRecords } from "./background-scene";
import { loadFixture } from "./test-helpers";

test("background match fixture stays aligned with the candidate scene catalog", () => {
  const match = parseBackgroundMatch(loadFixture("background-match.json"));
  const scenes = parseBackgroundSceneRecords(loadFixture("background-scenes.json"));

  assert.equal(match.role, "focus");
  assert.ok(match.score > 0.8);
  assert.ok(scenes.some((scene) => scene.id === match.sceneId));
  assert.equal(Object.keys(match.breakdown).length, 9);
});
