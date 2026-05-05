import assert from "node:assert/strict";
import { test } from "node:test";

import { buildImmersiveScenes, getInitialImmersiveScene, type ImmersiveGalleryUnit } from "./scene-orchestrator";

const units: ImmersiveGalleryUnit[] = [
  {
    id: "met-1",
    title: "Moon Room",
    imageUrl: "https://example.test/moon.jpg",
    transitionFamily: "dissolve",
  },
  {
    id: "met-2",
    title: "Spring Window",
    imageUrl: "https://example.test/spring.jpg",
    transitionFamily: "depth-push",
  },
];

test("scene orchestrator builds scenes for minimal exhibition data", () => {
  const scenes = buildImmersiveScenes(units.slice(0, 1));

  assert.equal(scenes.length, 1);
  assert.equal(scenes[0]?.unit.title, "Moon Room");
  assert.equal(scenes[0]?.transition.family, "dissolve");
});

test("scene orchestrator lets different units use different transition families", () => {
  const scenes = buildImmersiveScenes(units);

  assert.equal(scenes[0]?.transition.family, "dissolve");
  assert.equal(scenes[1]?.transition.family, "depth-push");
});

test("scene orchestrator falls back to first scene when selected unit is unknown", () => {
  const scene = getInitialImmersiveScene(units, { selectedUnitId: "missing" });

  assert.equal(scene?.unit.id, "met-1");
});
