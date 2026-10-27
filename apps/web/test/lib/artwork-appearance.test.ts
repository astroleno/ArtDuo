import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { loadArtworkAppearance, measureAppearancePixels } from "../../lib/artwork-appearance";

test("pixel appearance distinguishes light, dark and chromatic images without treating monochrome as dark", () => {
  const light = measureAppearancePixels(Uint8Array.from([240, 240, 240]));
  const dark = measureAppearancePixels(Uint8Array.from([20, 20, 20]));
  const colorful = measureAppearancePixels(Uint8Array.from([240, 180, 40]));
  assert.equal(light.brightShare, 1); assert.equal(light.chroma, 0);
  assert.equal(dark.darkShare, 1); assert.ok(light.meanLightness > dark.meanLightness);
  assert.ok(colorful.chroma > .7);
  assert.equal(colorful.colorVariation, 0, "a constant paper tint is not varied color");
  assert.ok(measureAppearancePixels(Uint8Array.from([240, 180, 40, 40, 180, 240])).colorVariation > .8);
});

test("appearance measurements belong only to their exact source image", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "artduo-appearance-"));
  const metrics = measureAppearancePixels(Uint8Array.from([200, 190, 180]));
  try {
    assert.equal(loadArtworkAppearance(dir, new Map()).byId.size, 0);
    writeFileSync(path.join(dir, "appearance-v2.json"), JSON.stringify({ recipe: "central-80-rgb-v2", records: [
      { artworkId: "valid", sourceFingerprint: "sha256:a", ...metrics },
      { artworkId: "changed", sourceFingerprint: "sha256:old", ...metrics },
      { artworkId: "invalid", sourceFingerprint: "sha256:i", ...metrics, darkShare: 2 },
      { artworkId: "unknown", ...metrics }, null,
    ] }));
    const result = loadArtworkAppearance(dir, new Map([["valid", "sha256:a"], ["changed", "sha256:new"], ["invalid", "sha256:i"]]));
    assert.deepEqual([...result.byId.keys()], ["valid"]);
    assert.ok(result.version?.startsWith("appearance-v2-"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
