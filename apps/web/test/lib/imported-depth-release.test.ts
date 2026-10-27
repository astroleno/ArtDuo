import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { loadWebReleaseCatalog } from "../../lib/release-catalog";
import { isGalleryArtwork } from "../../lib/artwork-eligibility";
import { artworkImageUrl } from "../../lib/artwork-image-url";

const rootDir = path.resolve(__dirname, "../../../..");
const version = "2026-10-24-da3-cleaned-630";
const current = loadWebReleaseCatalog({ rootDir, releaseVersion: version });
const previous = loadWebReleaseCatalog({ rootDir, releaseVersion: "2026-10-21-verified-public-url" });
const read = (file: string) => JSON.parse(readFileSync(path.join(current.releaseDir, file), "utf8"));
const report = read("depth-report.json");
const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");

test("the original depth import serves 630 imported DA3 maps and explicitly retains nine previous maps", () => {
  assert.equal(current.artworks.filter(isGalleryArtwork).length, 639);
  assert.equal(report.count, 639); assert.equal(report.importedCount, 630); assert.equal(report.retainedCount, 9);
  assert.equal(report.model.id, "DA3Mono-Large"); assert.equal(report.model.weightsSha256, null);
  assert.deepEqual([...report.retainedIds].sort(), ["met-337674", "met-438105", "met-472301", "met-50897", "met-55233", "met-737790", "met-78057", "smk-KKSgb22230", "smk-KKSgb22231"].sort());
  const seen = new Set();
  for (const item of report.records) {
    assert.equal(seen.has(item.artworkId), false); seen.add(item.artworkId);
    const record = current.artworkRecordById.get(item.artworkId)!;
    assert.ok(record); assert.equal(record.media.depthMap?.version, version);
    assert.equal(record.media.depthMap?.sourceAssetFingerprint, record.media.sourceAssetFingerprint);
    assert.equal(item.sourceAssetFingerprint, record.media.sourceAssetFingerprint);
    assert.equal(hash(path.join(current.releaseDir, item.url)), item.outputSha256);
    assert.equal(hash(path.join(previous.releaseDir, item.url)), item.previousOutputSha256);
    if (item.status === "retained") assert.equal(item.outputSha256, item.previousOutputSha256);
    else { assert.equal(item.status, "imported"); assert.notEqual(item.outputSha256, item.previousOutputSha256); }
    const url = new URL(artworkImageUrl(item.artworkId, "depth", version), "https://artduo.test");
    assert.equal(url.searchParams.get("releaseVersion"), version);
    assert.equal(url.searchParams.get("variant"), "depth");
  }
  assert.equal(seen.size, 639);
});

test("depth replacement preserves artwork facts, original images, search vectors, visual evidence and corrected credits", () => {
  assert.equal(current.artworkCount, previous.artworkCount);
  for (const old of previous.artworkRecords) {
    const next = structuredClone(current.artworkRecordById.get(old.id)!);
    if (next.media.depthMap && old.media.depthMap) next.media.depthMap.version = old.media.depthMap.version;
    assert.deepEqual(next, old);
    assert.deepEqual(current.artworkById.get(old.id)?.displayCredits, previous.artworkById.get(old.id)?.displayCredits);
  }
  assert.equal(current.artworks.filter(artwork => artwork.displayCredits).length, 11);
  const previousIndex = JSON.parse(readFileSync(path.join(previous.releaseDir, "semantic-index.json"), "utf8"));
  assert.deepEqual(read("semantic-index.json").records, previousIndex.records);
  const previousReviews = JSON.parse(readFileSync(path.join(previous.releaseDir, "visual-reviews.json"), "utf8"));
  assert.deepEqual(read("visual-reviews.json"), { ...previousReviews, releaseVersion: version });
  assert.equal(hash(path.join(current.releaseDir, report.previousReport)), hash(path.join(previous.releaseDir, "depth-report.json")));
});
