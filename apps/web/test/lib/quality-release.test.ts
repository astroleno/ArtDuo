import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { galleryArtworkDecision } from "../../lib/artwork-eligibility";
import { getArtworkDetail, loadWebReleaseCatalog, searchReleaseCatalog } from "../../lib/release-catalog";

const root = path.resolve(__dirname, "../../../..");
const current = loadWebReleaseCatalog({ rootDir: root, releaseVersion: "2026-10-13-quality" });
const base = loadWebReleaseCatalog({ rootDir: root, releaseVersion: "2026-10-06-paintings" });

test("quality repair keeps exactly the existing identities and search vectors", () => {
  assert.deepEqual([...current.artworkById.keys()].sort(), [...base.artworkById.keys()].sort());
  assert.deepEqual(current.embeddingRecords.map((record) => record.vector), base.embeddingRecords.map((record) => record.vector));
  assert.equal(current.artworkCount, 236);
});

test("every default exhibit has sourced dimensions and a measured, complete local preview", () => {
  const eligible = current.artworks.filter((record) => galleryArtworkDecision(record).status === "eligible");
  assert.equal(eligible.length, 137);
  for (const record of eligible) {
    assert.ok(record.dimensionsLabel, record.id);
    assert.ok(record.visualPresentation?.contentAspectRatio, record.id);
    assert.equal(record.visualPresentation?.cropStrategy, "preserve-paper");
    assert.ok(existsSync(path.join(current.releaseDir, record.imageUrl)), record.id);
  }
  assert.match(current.artworkById.get("met-78057")!.dimensionsLabel!, /Image \(each\).*Overall with mounting/s);
  assert.equal(current.artworkById.get("met-366377")!.dimensionsLabel, undefined);
});

test("specialist material is retained for direct access and excluded from default selection", () => {
  for (const id of ["met-372886", "met-828433", "met-729602", "met-729663", "met-366377", "met-436203", "met-459024"]) {
    const detail = getArtworkDetail(current, id);
    assert.ok(detail, id);
    assert.equal(galleryArtworkDecision(detail.artwork).status, "specialist-only");
    assert.ok(!searchReleaseCatalog(current, detail.artwork.title).results.some((r) => r.artwork.id === id), id);
  }
  assert.equal(searchReleaseCatalog(current, "想看莫奈").results.length, 6);
  assert.equal(searchReleaseCatalog(current, "想看静物").results[0]?.artwork.id, "artic-111436");
});

test("preview upgrades retain complete narrow and wide works with auditable pixel dimensions", () => {
  const report = JSON.parse(readFileSync(path.join(current.releaseDir, "quality-report.json"), "utf8"));
  for (const id of ["met-44858", "met-55233", "met-737790", "met-829412"]) {
    const row = report.records.find((r: { id: string }) => r.id === id);
    assert.equal(row.fullImageStatus, "decoded");
    assert.equal(Math.max(row.measured.width, row.measured.height), Math.min(2400, Math.max(row.fullMeasured.width, row.fullMeasured.height)), id);
    assert.ok(Math.abs((row.measured.width / row.measured.height) / (row.fullMeasured.width / row.fullMeasured.height) - 1) < 0.005);
  }
});
