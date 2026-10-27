import assert from "node:assert/strict";
import { constants, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { parseArtworkRecord, type ArtworkRecord } from "@artduo/contracts";
import { applyImageMeasurement, backfillDimensions, measureImage, normalizeSourceEvidence, verifyRepairedRelease } from "./existing-corpus-repair";

function artwork(): ArtworkRecord {
  const records = JSON.parse(readFileSync(path.resolve(__dirname, "../../../data/curation/painting-refresh/2026-10-06-paintings/verified-corpus.json"), "utf8"));
  return parseArtworkRecord(records.find((row: ArtworkRecord) => row.id === "artic-16568"));
}

test("dimension backfill preserves measurement scopes and rejects another artwork's evidence", () => {
  const original = artwork();
  const dimensions = "Image: 40 × 20 cm\r\nOverall with mounting: 80 × 30 cm";
  const filled = backfillDimensions(original, [
    { id: original.id, dimensions: "old measurement", file: "older.json" },
    { id: original.id, dimensions, file: "museum.json" },
    { id: "met-1", dimensions: "999 cm", file: "other.json" },
  ]);
  assert.equal(filled.record.metadata.dimensions, dimensions);
  assert.equal(original.metadata.dimensions, undefined);
  assert.equal(filled.source, "museum.json");
  assert.equal(filled.conflicts.length, 1);
  assert.equal(backfillDimensions(original, []).record.metadata.dimensions, undefined);
});

test("source adapters retain identity across cached museum and legacy formats", () => {
  assert.equal(normalizeSourceEvidence({ sourceUrl: "https://api.artic.edu/api/v1/artworks/16568", response: { data: { id: 16568, dimensions: "89.9 × 94.1 cm", artwork_type_title: "Painting" } } }, "aic.json")?.id, "artic-16568");
  assert.equal(normalizeSourceEvidence({ response: { objectID: 123, dimensions: "Image: 20 cm", objectName: "Hanging scroll" } }, "met.json")?.objectName, "Hanging scroll");
  assert.equal(normalizeSourceEvidence({ id: "met-123", dimensions: "20 cm" }, "legacy.json")?.dimensions, "20 cm");
  assert.equal(normalizeSourceEvidence({ id: 123 }, "unknown.json"), undefined);
});

test("decoded image geometry preserves the complete image and invalidates stale depth", async () => {
  const buffer = await sharp({ create: { width: 1700, height: 310, channels: 3, background: "white" } }).jpeg().toBuffer();
  const measured = await measureImage(buffer);
  assert.deepEqual([measured.width, measured.height], [1700, 310]);
  const record = artwork();
  record.metadata.dimensions = "Image: 10 × 100 cm";
  record.media.depthMap = { url: "depth.png", version: record.version, sourceAssetFingerprint: "old", method: "estimated" };
  applyImageMeasurement(record, measured, "images/scroll.jpg");
  assert.equal(record.media.visualPresentation?.contentAspectRatio, 1700 / 310);
  assert.equal(record.media.visualPresentation?.cropStrategy, "preserve-paper");
  assert.deepEqual(record.media.visualPresentation?.contentBounds, { x: 0, y: 0, width: 1, height: 1 });
  assert.equal(record.media.depthMap, undefined);
  assert.equal(record.metadata.dimensions, "Image: 10 × 100 cm");
  await assert.rejects(measureImage(Buffer.from("not an image")));
});

test("image measurements respect EXIF display orientation", async () => {
  const image = await sharp({ create: { width: 240, height: 120, channels: 3, background: "white" } }).withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const measured = await measureImage(image);
  assert.deepEqual([measured.width, measured.height], [120, 240]);
});

test("release verification rejects damaged previews and shard contents", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "artduo-quality-integrity-"));
  try {
    cpSync(path.resolve(__dirname, "../../../data/releases/2026-10-13-quality"), directory, { recursive: true, mode: constants.COPYFILE_FICLONE });
    verifyRepairedRelease(directory);
    const manifest = JSON.parse(readFileSync(path.join(directory, "manifest.json"), "utf8"));
    const mediaFile = path.join(directory, manifest.shards.mediaIndex[0].url);
    const media = JSON.parse(readFileSync(mediaFile, "utf8"));
    const row = media.find((entry: ArtworkRecord) => entry.media.visualPresentation?.source === "decoded-preview-image");
    const imageFile = path.join(directory, row.media.imageUrlPreview);
    const original = readFileSync(imageFile);
    writeFileSync(imageFile, "corrupted preview");
    assert.throws(() => verifyRepairedRelease(directory), /Image integrity failed/);
    writeFileSync(imageFile, original);
    media[0].id = "met-unknown";
    writeFileSync(mediaFile, JSON.stringify(media));
    assert.throws(() => verifyRepairedRelease(directory), /Shard integrity failed/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
