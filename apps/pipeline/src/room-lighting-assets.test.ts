import assert from "node:assert/strict";
import test from "node:test";
import { prepareRoomLightMaps, resizeRoomDepth } from "./room-lighting-assets";

test("smaller lighting fields preserve scalar depth and its full image projection", () => {
  const field = { width: 1000, height: 500, values: Float32Array.from({ length: 500000 }, (_, i) => (i % 1000) / 999) };
  const resized = resizeRoomDepth(field);
  assert.equal(resized.width, 384); assert.equal(resized.height, 192);
  for (const y of [0, 97, 191]) for (const x of [0, 101, 383]) assert.ok(Math.abs(resized.values[y * 384 + x] - x / 383) < 1e-6);
});

test("room assets retain sub-byte depth precision and finite, unit-length surface normals", () => {
  const width = 64, height = 64;
  const values = Float32Array.from({ length: width * height }, (_, i) => i / (width * height - 1));
  const result = prepareRoomLightMaps({ values, width, height });
  const depths = new Set<number>();
  for (let i = 0; i < width * height; i++) {
    depths.add(result.depth[i * 3] * 256 + result.depth[i * 3 + 1]);
    const n = [0, 1, 2].map((c) => result.normals[i * 3 + c] / 255 * 2 - 1);
    assert.ok(Math.abs(Math.hypot(...n) - 1) < .015);
    assert.ok(n[2] > 0);
  }
  assert.ok(depths.size > 1000);
});

test("flat or corrupt model fields cannot masquerade as usable lighting geometry", () => {
  assert.throws(() => prepareRoomLightMaps({ values: new Float32Array(16), width: 4, height: 4 }), /spatial variation/);
  assert.throws(() => prepareRoomLightMaps({ values: Float32Array.from([0, 1, NaN]), width: 3, height: 3 }), /Invalid/);
});
