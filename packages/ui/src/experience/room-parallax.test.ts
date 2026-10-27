import assert from "node:assert/strict";
import test from "node:test";
import { roomParallaxInput } from "./room-parallax";

test("painting and sculpture parallax use bounded absolute input without accumulated displacement", () => {
  for (let move = 0; move < 100; move++) assert.deepEqual(roomParallaxInput({ x: 1, y: -1 }), { x: .65, y: -.65 });
  assert.deepEqual(roomParallaxInput({ x: 400, y: -400 }), { x: .65, y: -.65 });
  assert.deepEqual(roomParallaxInput({ x: 0, y: 0 }), { x: 0, y: 0 });
});

test("invalid sensor or pointer samples return to neutral rather than moving the artwork", () => {
  assert.deepEqual(roomParallaxInput({ x: Number.NaN, y: Infinity }), { x: 0, y: 0 });
  assert.deepEqual(roomParallaxInput({ x: .5, y: -.5 }), { x: .325, y: -.325 });
});
