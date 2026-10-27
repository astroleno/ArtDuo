import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadArtworkCredits } from "../../lib/artwork-credits";
import { loadWebReleaseCatalog, searchReleaseCatalog, type ExperienceArtworkRecord } from "../../lib/release-catalog";

test("source-bound display credits preserve raw records and reject stale or mismatched identities", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "artduo-credits-"));
  const releaseVersion = "test";
  const releaseDir = path.join(root, "data/releases/test");
  const dir = path.join(root, "data/curation/public-url-import/test");
  mkdirSync(dir, { recursive: true });
  const record = { id: "smk-test", metadata: { artistDisplayName: "Artist; Publisher", objectUrl: "https://museum.test/object" }, media: { sourceAssetFingerprint: "sha256:verified" } } as ExperienceArtworkRecord;
  const original = structuredClone(record);
  const row = { artworkId: record.id, originalArtistDisplayName: "Artist; Publisher", artistDisplayName: "Artist", publishers: ["Publisher"], objectUrl: record.metadata.objectUrl, sourceAssetFingerprint: record.media.sourceAssetFingerprint };
  const write = (entries: object[]) => writeFileSync(path.join(dir, "creator-credits.json"), JSON.stringify({ schemaVersion: 1, releaseVersion, entries }));
  try {
    assert.equal(loadArtworkCredits({ releaseDir, releaseVersion, records: [record] }).size, 0);
    write([row]);
    assert.deepEqual(loadArtworkCredits({ releaseDir, releaseVersion, records: [record] }).get(record.id), { artistDisplayName: "Artist", publishers: ["Publisher"] });
    assert.deepEqual(record, original);
    write([{ ...row, artistDisplayName: null }]);
    assert.equal(loadArtworkCredits({ releaseDir, releaseVersion, records: [record] }).get(record.id)?.artistDisplayName, null, "an unknown creator must not fall back to the publisher");
    for (const mismatch of [{ originalArtistDisplayName: "Other" }, { objectUrl: "https://other.test" }, { sourceAssetFingerprint: "other" }, { publishers: [] }]) {
      write([{ ...row, ...mismatch }]);
      assert.throws(() => loadArtworkCredits({ releaseDir, releaseVersion, records: [record] }), /Unbound creator credit/u);
    }
    write([row, row]);
    assert.throws(() => loadArtworkCredits({ releaseDir, releaseVersion, records: [record] }), /Unbound creator credit/u);
    mkdirSync(releaseDir, { recursive: true });
    const embedded = path.join(releaseDir, "creator-credits.json");
    writeFileSync(embedded, JSON.stringify({ schemaVersion: 1, releaseVersion, entries: [row] }));
    assert.deepEqual(loadArtworkCredits({ releaseDir, releaseVersion, records: [record] }).get(record.id), { artistDisplayName: "Artist", publishers: ["Publisher"] }, "embedded credits take precedence over a legacy external ledger");
    writeFileSync(embedded, JSON.stringify({ schemaVersion: 1, releaseVersion: "stale", entries: [row] }));
    assert.throws(() => loadArtworkCredits({ releaseDir, releaseVersion, records: [record] }), /Invalid creator credit ledger/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("published role corrections retain source evidence and never match a publisher as the artist", () => {
  const catalog = loadWebReleaseCatalog({ rootDir: path.resolve(__dirname, "../../../.."), releaseVersion: "2026-10-21-verified-public-url" });
  assert.equal(catalog.artworks.filter(artwork => artwork.displayCredits).length, 11);
  assert.equal(catalog.artworkById.get("smk-KKS3423")?.artistDisplayName, "Ancher, Anna");
  assert.equal(catalog.artworkRecordById.get("smk-KKS3423")?.metadata.artistDisplayName, "Ancher, Anna; Alfred Jacobsens Forlag");
  for (const id of ["smk-KKSgb1404", "smk-KKSgb1403"]) {
    assert.equal(catalog.artworkById.get(id)?.artistDisplayName, undefined);
    assert.equal(catalog.artworkById.get(id)?.displayCredits?.artistDisplayName, null);
  }
  assert.equal(searchReleaseCatalog(catalog, "只看Alfred Jacobsens Forlag的作品", { limit: 6 }).results.length, 0);
});
