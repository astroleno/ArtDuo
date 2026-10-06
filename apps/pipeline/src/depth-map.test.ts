import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { test } from "node:test";

import { estimateDepthMapAsset } from "./depth-map";

test("depth estimator writes a release-bound estimated map from the supplied image", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "artduo-depth-estimate-"));
  try {
    const inputPath = path.join(root, "source.jpg");
    const outputPath = path.join(root, "release-assets", "depth", "sample.png");
    const pixels = Buffer.from([
      18, 24, 34, 48, 62, 80, 104, 130,
      30, 44, 60, 86, 112, 144, 180, 216,
      46, 64, 92, 126, 162, 194, 224, 246,
      20, 52, 88, 124, 158, 198, 230, 255,
    ]);
    await sharp(pixels, { raw: { width: 8, height: 4, channels: 1 } }).jpeg().toFile(inputPath);

    const result = await estimateDepthMapAsset({
      inputImagePath: inputPath,
      outputDepthMapPath: outputPath,
      url: "depth/sample.png",
      version: "release-depth-test",
      sourceAssetFingerprint: "sha256:source-artwork-fixture",
    });
    const outputMeta = await sharp(outputPath).metadata();
    const outputPixels = await sharp(outputPath).greyscale().raw().toBuffer();

    assert.deepEqual(result.depthMap, {
      url: "depth/sample.png",
      version: "release-depth-test",
      sourceAssetFingerprint: "sha256:source-artwork-fixture",
      method: "estimated",
    });
    assert.equal(result.width, 8);
    assert.equal(result.height, 4);
    assert.equal(outputMeta.width, 8);
    assert.equal(outputMeta.height, 4);
    assert.equal(outputMeta.format, "png");
    assert.notEqual(new Set(outputPixels).size, 1);
    assert.equal(result.outputSha256, (await import("node:crypto")).createHash("sha256").update(readFileSync(outputPath)).digest("hex"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("depth estimator rejects unsafe release paths and mismatched source conditions", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "artduo-depth-invalid-"));
  const inputPath = path.join(root, "source.jpg");
  await sharp(Buffer.alloc(8 * 4, 128), { raw: { width: 8, height: 4, channels: 1 } }).jpeg().toFile(inputPath);
  const base = {
    inputImagePath: inputPath,
    outputDepthMapPath: path.join(root, "depth.png"),
    url: "depth/depth.png",
    version: "release-depth-test",
    sourceAssetFingerprint: "fingerprint",
  };
  try {
    await assert.rejects(() => estimateDepthMapAsset({ ...base, url: "../escape.png" }), /safe relative release path/);
    await assert.rejects(() => estimateDepthMapAsset({ ...base, version: "../release" }), /safe release identifier/);
    await assert.rejects(() => estimateDepthMapAsset({ ...base, sourceAssetFingerprint: " " }), /fingerprint is required/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
