import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { prepareArtworkPreview, readArtworkPreview, PREVIEW_RECIPE } from "../../lib/artwork-preview";

import { test } from "node:test";
test("preview preserves the full aspect ratio and remains usable without the original", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "artduo-preview-"));
  try {
    const original = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: "#d98b54" } }).png().toBuffer();
    const fingerprint = `sha256:${createHash("sha256").update(original).digest("hex")}`;
    const preview = await prepareArtworkPreview(root, fingerprint, async () => original);
    assert.equal(preview.width, 1600); assert.equal(preview.height, 800);
    assert.equal(preview.sourceFingerprint, fingerprint); assert.notEqual(preview.sha256, fingerprint);
    assert.equal((await sharp(preview.body).metadata()).format, "webp");
    const saved = await prepareArtworkPreview(root, fingerprint, async () => { throw new Error("Must use persistent preview"); });
    assert.deepEqual(saved.body, preview.body);
    const file = path.join(root, ".cache/artduo-runtime/artwork-previews", `${fingerprint.slice(7)}-${PREVIEW_RECIPE}.webp`);
    await writeFile(file, "corrupt"); assert.equal(await readArtworkPreview(root, fingerprint), undefined);
    await assert.rejects(prepareArtworkPreview(root, fingerprint, async () => Buffer.from("wrong source")), /fingerprint mismatch/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
