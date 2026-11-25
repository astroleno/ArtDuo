import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { officialMuseumCulture, museumCultureForArtwork, MUSEUM_CULTURE_SUPPLEMENTS } from "../../lib/museum-culture";
import { loadWebReleaseCatalog } from "../../lib/release-catalog";

const rootDir = path.resolve(__dirname, "../../../..");

test("culture supplements are exact official record fields and are projected without an author credit", () => {
  const catalog = loadWebReleaseCatalog({ rootDir, releaseVersion: "2026-11-19-open-gap-739" });
  assert.equal(Object.keys(MUSEUM_CULTURE_SUPPLEMENTS).length, 10);
  for (const [id, row] of Object.entries(MUSEUM_CULTURE_SUPPLEMENTS)) {
    const file = path.join(rootDir, "data/sources/open-collections", row.sourceBatch, "records", id + ".json");
    const official = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(row.objectUrl, official.url ?? official.objectURL, id);
    assert.equal(row.culture, officialMuseumCulture(official.culture), id);
    const artwork = catalog.artworkById.get(id)!;
    const immersive = catalog.artworkRecordById.get(id)!;
    assert.equal(artwork.objectUrl, row.objectUrl);
    assert.equal(artwork.culture, row.culture);
    assert.equal(immersive.metadata.culture, row.culture);
    assert.equal(artwork.artistDisplayName, undefined, id);
    assert.equal(immersive.metadata.artistDisplayName, undefined, id);
  }
});

test("culture never overwrites a recorded value or falls back across object identities", () => {
  const id = "cma-164466";
  const { objectUrl, culture } = MUSEUM_CULTURE_SUPPLEMENTS[id]!;
  assert.equal(museumCultureForArtwork(id, "Original museum field", objectUrl), "Original museum field");
  assert.equal(museumCultureForArtwork(id, " ", objectUrl), culture);
  assert.equal(museumCultureForArtwork(id, undefined, objectUrl + "/"), undefined);
  assert.equal(museumCultureForArtwork("different-artwork", undefined, objectUrl), undefined);
  assert.equal(officialMuseumCulture([" North ", "", null, "South"]), "North; South");
  assert.equal(officialMuseumCulture(" "), undefined);
});
