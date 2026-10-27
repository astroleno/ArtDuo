import assert from "node:assert/strict";
import test from "node:test";
import { sculptureAoSize } from "./sculpture-occlusion";

test("AO preserves the viewport aspect and has a fixed pixel budget on desktop and dense phone screens", () => {
  for (const [width, height, ratio] of [[1280, 720, 1], [390, 844, 3], [3840, 2160, 2], [844, 390, 2]]) {
    const size = sculptureAoSize(width, height, ratio);
    assert.ok(size.width * size.height <= 320_000);
    assert.ok(size.width < width * Math.min(ratio, 1.6) && size.height < height * Math.min(ratio, 1.6));
    assert.ok(Math.abs(size.width / size.height - width / height) < .01);
  }
  assert.deepEqual(sculptureAoSize(0, NaN, Infinity), { width: 1, height: 1 });
});
