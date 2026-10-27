import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { loadSemanticIndex } from "@artduo/corpus/src/semantic-loader";
import { semanticArtworkText } from "@artduo/corpus/src/semantic-index";
import { loadWebReleaseCatalog, searchReleaseCatalog } from "../../lib/release-catalog";
import { isGalleryArtwork } from "../../lib/artwork-eligibility";

const root = path.resolve(__dirname, "../../../..");
const version = "2026-10-21-verified-partial";
const current = loadWebReleaseCatalog({ rootDir: root, releaseVersion: version });
const base = loadWebReleaseCatalog({ rootDir: root, releaseVersion: "2026-10-15-experience" });
const digest = (file: string) => `sha256:${createHash("sha256").update(readFileSync(file)).digest("hex")}`;
const addedIds = ["met-45734", "met-436535"];

test("the frozen partial gallery adds exactly the two fully evidenced candidates", () => {
  assert.equal(base.artworkCount, 236); assert.equal(current.artworkCount, 238);
  assert.equal(current.artworks.filter(isGalleryArtwork).length, 139);
  assert.deepEqual(current.artworks.filter(artwork => !base.artworkById.has(artwork.id)).map(artwork => artwork.id), addedIds);
  const report = JSON.parse(readFileSync(path.join(current.releaseDir, "verified-import-report.json"), "utf8"));
  assert.equal(report.candidateCount, 2734); assert.equal(report.admittedCount, 2); assert.equal(report.heldCount, 2732);
  assert.equal(report.eligibleCount, 139); assert.equal(report.snapshot.urlCount, 4867);
  for (const row of report.decisions.filter((row: any) => row.status === "held")) {
    assert.ok(row.reasons.length); assert.equal(current.artworkById.has(row.candidateId), false);
  }
});

test("existing museum facts, source images and frozen base releases remain intact", () => {
  for (const old of base.artworkRecords) {
    const next = structuredClone(current.artworkRecords.find(record => record.id === old.id)!);
    if (next.media.depthMap && old.media.depthMap) next.media.depthMap.version = old.media.depthMap.version;
    assert.deepEqual(next, old, old.id);
    if (old.media.imageUrlPreview && !/^https?:/u.test(old.media.imageUrlPreview)) {
      assert.equal(digest(path.join(current.releaseDir, old.media.imageUrlPreview)), digest(path.join(base.releaseDir, old.media.imageUrlPreview)));
    }
  }
  const records = current.artworkRecords.filter(record => addedIds.includes(record.id));
  for (const record of records) {
    assert.equal(record.source, "met"); assert.equal(record.metadata.descriptionRaw, undefined);
    assert.equal(record.metadata.objectUrl, `https://www.metmuseum.org/art/collection/search/${record.id.slice(4)}`);
    assert.ok(record.metadata.dimensions); assert.ok(record.metadata.creditLine);
  }
  assert.equal(current.artworkById.get("met-45734")!.medium, "Hanging scroll; ink and color on silk");
  assert.equal(current.artworkById.get("met-436535")!.medium, "Oil on canvas");
});

test("all eligible artworks retain complete image-bound facts and matching model depth", () => {
  for (const artwork of current.artworks.filter(isGalleryArtwork)) {
    const record = current.artworkRecords.find(record => record.id === artwork.id)!;
    assert.ok(artwork.visualEvidence, artwork.id);
    assert.equal(artwork.visualEvidence.imageSha256, digest(path.join(current.releaseDir, artwork.imageUrl)));
    assert.equal(record.media.sourceAssetFingerprint, artwork.visualEvidence.imageSha256);
    assert.equal(record.media.depthMap?.version, version);
    assert.equal(record.media.depthMap?.sourceAssetFingerprint, record.media.sourceAssetFingerprint);
    assert.ok(existsSync(path.join(current.releaseDir, record.media.depthMap!.url)));
  }
  for (const id of addedIds) {
    const record = current.artworkRecords.find(record => record.id === id)!;
    const png = readFileSync(path.join(current.releaseDir, record.media.depthMap!.url));
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.ok(Math.abs(png.readUInt32BE(16) / png.readUInt32BE(20) - record.media.visualPresentation!.contentAspectRatio!) < 1e-9);
  }
  assert.equal(current.artworkById.get("met-436535")!.visualEvidence!.facts.flowers, "present");
  assert.equal(current.artworkById.get("met-436535")!.visualEvidence!.facts.forest, "present");
  assert.equal(current.artworkById.get("met-436535")!.visualEvidence!.facts.architecture, "unknown");
});

test("the new semantic index preserves every old vector and adds the same 384-dimensional model", () => {
  const index = loadSemanticIndex({ manifestPath: current.manifestPath, manifest: current.manifest,
    artworks: current.artworkRecords.map(record => ({ id: record.id,
      text: semanticArtworkText({ ...record.metadata, description: record.metadata.descriptionClean ?? record.metadata.storySnippet }) })) });
  assert.ok(index); assert.equal(index.model.dimensions, 384); assert.equal(index.records.length, 238);
  const old = JSON.parse(readFileSync(path.join(base.releaseDir, "semantic-index.json"), "utf8"));
  assert.deepEqual(index.model, old.model);
  for (const row of old.records) assert.deepEqual(index.records.find(record => record.artworkId === row.artworkId), row);
});

test("new works can be selected while flowers and unknown architecture still enforce exclusions", () => {
  assert.deepEqual(searchReleaseCatalog(current, "只看梵高的户外风景，不要人物，不要室内，不要自画像").results.map(row => row.artwork.id), ["met-436535"]);
  assert.equal(searchReleaseCatalog(current, "Quail and Millet").results[0]?.artwork.id, "met-45734");
  assert.deepEqual(searchReleaseCatalog(current, "只看《Quail and Millet》").results.map(row => row.artwork.id), ["met-45734"]);
  assert.ok(!searchReleaseCatalog(current, "只看梵高，不要花").results.some(row => row.artwork.id === "met-436535"));
  assert.deepEqual(searchReleaseCatalog(current, "只看梵高，不要花").results.map(row => row.artwork.id),
    searchReleaseCatalog(current, "只看梵高，no flowers").results.map(row => row.artwork.id));
  assert.ok(!searchReleaseCatalog(current, "只看梵高，不要建筑").results.some(row => row.artwork.id === "met-436535"));
  assert.ok(!searchReleaseCatalog(current, "只看梵高，no trees").results.some(row => row.artwork.id === "met-436535"));
});

test("Monet and strict water requests keep their original unmet-count boundaries", () => {
  const queries = [
    ["只看莫奈，给我两幅户外风景，排除《睡莲》和《睡莲池》，不要人物。", ["artic-64818"]],
    ["I’m not sad or tired. Give me two paintings of water, but no boats, people, or flowers. I want spacious views, not comfort.", ["met-382737"]],
    ["给我两幅开阔的水景油画，不要人物、船只和花。", []],
  ] as const;
  for (const [query, expected] of queries) {
    assert.deepEqual(searchReleaseCatalog(current, query).results.map(row => row.artwork.id), expected, query);
    assert.deepEqual(searchReleaseCatalog(current, query).results.map(row => row.artwork.id), searchReleaseCatalog(base, query).results.map(row => row.artwork.id));
  }
});
