import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { loadWebReleaseCatalog } from "../../lib/release-catalog";
import { isGalleryArtwork } from "../../lib/artwork-eligibility";

const rootDir = path.resolve(__dirname, "../../../..");
const version = "2026-10-24-da3-curated-630";
const current = loadWebReleaseCatalog({ rootDir, releaseVersion: version });
const previous = loadWebReleaseCatalog({ rootDir, releaseVersion: "2026-10-24-da3-cleaned-630" });
const removed = new Set(["met-337674", "met-438105", "met-472301", "met-50897", "met-55233", "met-737790", "met-78057", "smk-KKSgb22230", "smk-KKSgb22231"]);
const read = (file: string) => JSON.parse(readFileSync(path.join(current.releaseDir, file), "utf8"));
const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");

test("the active library completely removes the nine artworks and uses DA3 for all 630 exhibit candidates", () => {
  assert.equal(loadWebReleaseCatalog({ rootDir }).releaseVersion, version);
  assert.equal(current.artworkCount, 729);
  assert.equal(current.artworks.filter(isGalleryArtwork).length, 630);
  const report = read("depth-report.json");
  assert.equal(report.count, 630); assert.equal(report.importedCount, 630); assert.equal(report.retainedCount, 0);
  assert.deepEqual(report.retainedIds, []);
  assert.deepEqual(report.excludedArtworkIds, [...removed].sort());
  assert.equal(readdirSync(path.join(current.releaseDir, "depth")).length, 630);
  for (const id of removed) {
    assert.equal(current.artworkById.has(id), false);
    assert.equal(current.artworkRecordById.has(id), false);
    const media = previous.artworkRecordById.get(id)!.media;
    for (const url of [media.baseImageUrl, media.imageUrlPreview, media.imageUrlFull, media.depthMap?.url]) {
      if (url && !/^https?:/u.test(url)) assert.equal(existsSync(path.join(current.releaseDir, url)), false, `removed asset ${url}`);
    }
  }
  for (const kind of ["metadata", "search", "mediaIndex", "embeddings"] as const) for (const shard of current.manifest.shards[kind] ?? []) {
    const rows = read(shard.url);
    assert.equal(shard.recordCount, rows.length);
    assert.ok(rows.every((row: { id: string }) => !removed.has(row.id)));
  }
  assert.equal(read("visual-reviews.json").reviews.length, 630);
  assert.ok(read("visual-reviews.json").reviews.every((row: { artworkId: string }) => !removed.has(row.artworkId)));
  for (const item of report.records) {
    assert.equal(item.status, "imported"); assert.equal(removed.has(item.artworkId), false);
    const ref = current.artworkRecordById.get(item.artworkId)!.media.depthMap!;
    assert.equal(ref.version, version);
    assert.equal(hash(path.join(current.releaseDir, item.url)), item.outputSha256);
    assert.equal(hash(path.join(previous.releaseDir, item.url)), item.outputSha256);
  }
  for (const historical of ["depth-history", "recovery-evidence", "verified-import-report.json"]) assert.equal(existsSync(path.join(current.releaseDir, historical)), false);
});

test("removal preserves the other library records, vectors, reviews and corrected creator credits", () => {
  for (const old of previous.artworkRecords.filter(record => !removed.has(record.id))) {
    const next = structuredClone(current.artworkRecordById.get(old.id)!);
    if (next.media.depthMap && old.media.depthMap) next.media.depthMap.version = old.media.depthMap.version;
    assert.deepEqual(next, old);
    assert.deepEqual(current.artworkById.get(old.id)?.displayCredits, previous.artworkById.get(old.id)?.displayCredits);
  }
  assert.equal(current.artworks.filter(artwork => artwork.displayCredits).length, 11);
  const oldIndex = JSON.parse(readFileSync(path.join(previous.releaseDir, "semantic-index.json"), "utf8"));
  const nextIndex = read("semantic-index.json");
  assert.equal(nextIndex.records.length, 729);
  assert.deepEqual(nextIndex.records, oldIndex.records.filter((record: { artworkId: string }) => !removed.has(record.artworkId)));
  assert.equal(current.manifest.shards.semanticEmbeddings![0]!.recordCount, 729);
});
