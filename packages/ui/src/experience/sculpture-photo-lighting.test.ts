import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSculpturePhoto, photoLuminance } from "./sculpture-photo-lighting";

function photograph() {
  const width = 100, height = 60, data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const rgb = y >= height * .87 ? [120, 85, 50] : x > width * .82 ? [195, 220, 250] : x < width * .18 ? [100, 70, 40] : [190, 170, 140];
    data.set([...rgb, 255], (y * width + x) * 4);
  }
  return { width, height, data };
}

test("photograph lighting retains a cool bright window and warm floor bounce instead of a fixed tint", () => {
  const photo = analyzeSculpturePhoto(photograph(), { id: "bg-022", light: "right" });
  assert.ok(photoLuminance(photo.right) > photoLuminance(photo.left));
  assert.ok(photo.key[2] > photo.key[0], "window light follows the sampled cool pixels");
  assert.ok(photo.floor[0] > photo.floor[2], "floor bounce keeps the photograph's warm color");
  assert.ok(photo.sourceUv[0] > .82 && photo.keyDirection[0] > 0 && photo.keyDirection[1] > 0, "source direction follows the visible window");
  const opposite = analyzeSculpturePhoto(photograph(), { id: "other", light: "left" });
  assert.ok(opposite.key[0] > opposite.key[2], "changing the source region changes the lighting color");
  assert.ok(opposite.keyDirection[0] < 0);
});

test("source centroid reacts to the photograph and does not mistake a uniform field for a confident estimate", () => {
  const high = photograph(), low = photograph();
  for (const [image, sourceY] of [[high, 8], [low, 34]] as const) {
    for (let y = 5; y < 43; y++) for (let x = 85; x < 100; x++) image.data.set([70, 75, 80, 255], (y * image.width + x) * 4);
    for (let y = sourceY; y < sourceY + 5; y++) for (let x = 90; x < 97; x++) image.data.set([255, 255, 255, 255], (y * image.width + x) * 4);
  }
  const upper = analyzeSculpturePhoto(high, { id: "bg-022", light: "right" });
  const lower = analyzeSculpturePhoto(low, { id: "bg-022", light: "right" });
  assert.ok(upper.sourceUv[1] < lower.sourceUv[1] && upper.keyDirection[1] > lower.keyDirection[1]);
  assert.ok(upper.sourceConfidence > .5);
  const flat = photograph(); flat.data.fill(255);
  assert.equal(analyzeSculpturePhoto(flat, { id: "bg-034", light: "top" }).sourceConfidence, 0);
});

test("photo exposure is bounded for black, white and transparent images, and malformed samples fail", () => {
  for (const value of [0, 255]) for (const alpha of [0, 255]) {
    const image = photograph();
    for (let index = 0; index < image.data.length; index += 4) image.data.set([value, value, value, alpha], index);
    const result = analyzeSculpturePhoto(image, { id: "bg-034", light: "top" });
    assert.ok(result.key.every(channel => Number.isFinite(channel) && channel >= .45 && channel <= 1));
    assert.ok(result.environmentIntensity >= .32 && result.environmentIntensity <= .5);
    assert.ok(result.keyIntensity >= 2 && result.keyIntensity <= 2.7);
    assert.ok(result.shadowOpacity >= .16 && result.shadowOpacity <= .3);
  }
  assert.throws(() => analyzeSculpturePhoto({ width: 0, height: 1, data: [] }, { id: "bad", light: "top" }));
});
