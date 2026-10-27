import assert from "node:assert/strict";
import test from "node:test";
import { glassDisplacementMap } from "./glass-optics";

test("the flat center stays optically neutral and opposite bevels bend inward", () => {
  const map = glassDisplacementMap(136, 46, 8);
  const pixel = (x: number, y: number) => [...map.data.slice((y * map.width + x) * 4, (y * map.width + x) * 4 + 4)];
  assert.deepEqual(pixel(68, 23), [128, 128, 128, 255]);
  assert.ok(pixel(3, 23)[0]! > 128);
  assert.ok(pixel(132, 23)[0]! < 128);
  assert.equal(pixel(3, 23)[1], 128);
  assert.ok(pixel(68, 3)[1]! > 128);
  assert.ok(pixel(68, 42)[1]! < 128);
});

test("rounded corners do not displace pixels outside the glass silhouette", () => {
  const map = glassDisplacementMap(44, 44, 8);
  assert.deepEqual([...map.data.slice(0, 4)], [128, 128, 128, 255]);
  assert.ok(map.data.every((value, i) => i % 4 !== 3 || value === 255));
});

test("a wide control keeps a bounded optical map", () => {
  const map = glassDisplacementMap(2400, 300, 8);
  assert.equal(map.width, 512);
  assert.equal(map.height, 128);
  assert.equal(map.data.byteLength, 512 * 128 * 4);
});
