import assert from "node:assert/strict";
import test from "node:test";
import { SCULPTURE_INTERACTION, sculptureFloorLine, sculptureInputBlend, sculpturePointerLight } from "./sculpture-interaction";

test("floor clipping stays on the stationary photographed floor through wide and portrait cover crops", () => {
  assert.equal(sculptureFloorLine(.76, 16 / 9, 16 / 9), .76);
  assert.equal(sculptureFloorLine(.76, .5, 16 / 9), .76);
  assert.ok(Math.abs(sculptureFloorLine(.76, 3, 16 / 9) - .595) < 1e-8);
  assert.equal(sculptureFloorLine(1, 3, 16 / 9), 1);
});

test("the sculpture keeps a bounded viewpoint while background light remains subordinate", () => {
  assert.ok(SCULPTURE_INTERACTION.backgroundLightRatio > 0 && SCULPTURE_INTERACTION.backgroundLightRatio < .2);
  assert.ok(Math.atan(.65 * SCULPTURE_INTERACTION.cameraX) * 180 / Math.PI < 2);
});

test("shared light uses screen right and screen up consistently and smooths independently of frame rate", () => {
  const light = sculpturePointerLight({ x: .8, y: -.5 }, 16 / 9);
  assert.ok(light.x > 0 && light.y > 0 && light.z > 0);
  assert.deepEqual(sculpturePointerLight({ x: Infinity, y: NaN }, 1), { x: 0, y: 0, z: SCULPTURE_INTERACTION.lightHeight });
  const thirty = 1 - (1 - sculptureInputBlend(1 / 30)) ** 30;
  const sixty = 1 - (1 - sculptureInputBlend(1 / 60)) ** 60;
  assert.ok(Math.abs(thirty - sixty) < 1e-10);
});
