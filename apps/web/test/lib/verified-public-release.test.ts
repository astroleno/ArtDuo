import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { loadWebReleaseCatalog, searchReleaseCatalog } from "../../lib/release-catalog";
import { isGalleryArtwork } from "../../lib/artwork-eligibility";
import { loadSemanticIndex } from "@artduo/corpus/src/semantic-loader";
import { semanticArtworkText } from "@artduo/corpus/src/semantic-index";

const root = path.resolve(__dirname, "../../../..");
const version = "2026-10-21-verified-public-url";
const current = loadWebReleaseCatalog({ rootDir: root, releaseVersion: version });
const base = loadWebReleaseCatalog({ rootDir: root, releaseVersion: "2026-10-21-verified-partial" });
const report = JSON.parse(readFileSync(path.join(current.releaseDir, "verified-import-report.json"), "utf8"));
const added = current.artworkRecords.filter(record => !base.artworkRecordById.has(record.id));
const digest = (filename: string) => `sha256:${createHash("sha256").update(readFileSync(filename)).digest("hex")}`;

test("the original public gallery freezes the reviewed cohort and preserves its original eligibility gates", () => {
  assert.equal(report.candidateCount, 3274); assert.equal(report.admittedCount, 500);
  assert.equal(added.length, report.admittedCount);
  assert.equal(current.artworkCount, 238 + added.length);
  assert.equal(current.artworks.filter(isGalleryArtwork).length, 139 + added.length);
  assert.equal(report.eligibleCount, 139 + added.length);
  for (const row of report.decisions.filter((row: any) => row.status === "held" && !row.reasons.includes("already-in-release"))) {
    assert.ok(row.reasons.length); assert.equal(current.artworkById.has(row.candidateId), false);
  }
});

test("public sources retain image-bound visual evidence and actual complete model depth", () => {
  const depth = JSON.parse(readFileSync(path.join(current.releaseDir, "depth-report.json"), "utf8"));
  assert.equal(depth.model.weightsSha256, "e4e2ffe9b0396ebd4a0c09b855762b186aab338e79f76531b09777aafc91db84");
  const receipts = readFileSync(path.join(root, "data/curation/public-url-import", version, "image-receipts.jsonl"), "utf8")
    .trim().split("\n").map(line => JSON.parse(line)).filter(row => row.status === "fetched");
  for (const record of added) {
    const ref = record.media.verifiedRemoteImage!;
    assert.ok(ref && ref.url.startsWith("https://"));
    assert.equal(record.media.imageUrlFull, ref.url); assert.equal(record.media.imageUrlPreview, ref.url);
    assert.equal(record.media.sourceAssetFingerprint, ref.sha256);
    assert.ok(receipts.some(row => row.candidateId === record.id && row.ref.sha256 === ref.sha256 && row.ref.url === ref.url));
    assert.ok(Math.min(ref.width, ref.height) >= 320 && Math.max(ref.width, ref.height) >= 1600);
    const evidence = current.artworkById.get(record.id)!.visualEvidence!;
    assert.equal(evidence.imageSha256, ref.sha256); assert.equal(Object.keys(evidence.facts).length, 17);
    const item = depth.records.find((row: any) => row.artworkId === record.id);
    assert.ok(item); assert.equal(item.inputSha256, ref.sha256);
    if (item.modelInputSha256) assert.match(item.modelInputSha256, /^sha256:[a-f0-9]{64}$/u);
    else {
      const proof = JSON.parse(readFileSync(path.join(current.releaseDir, "recovery-evidence/completed-output-proof.json"), "utf8"));
      const original = proof.records.find((row: any) => row.artworkId === record.id);
      assert.ok(original); assert.equal(original.inputSha256, ref.sha256);
      assert.equal(original.outputSha256, item.outputSha256);
      assert.equal(original.ordinal, item.recoveredFromCompletedRun.ordinal);
      assert.equal(proof.runLog.sha256, item.recoveredFromCompletedRun.runLogSha256);
      assert.equal(item.recoveredFromCompletedRun.preprocessedInputDigest, "not-retained-before-interruption");
      assert.equal(proof.modelWeightsSha256, depth.model.weightsSha256);
    }
    assert.equal(digest(path.join(current.releaseDir, item.url)), `sha256:${item.outputSha256}`);
    const png = readFileSync(path.join(current.releaseDir, item.url));
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.equal(png.readUInt32BE(16), item.width); assert.equal(png.readUInt32BE(20), item.height);
    assert.ok(Math.max(item.width, item.height) <= 1024);
    assert.ok(Math.abs(item.width / item.height / (ref.width / ref.height) - 1) < .005);
  }
});

test("the original partial release facts, images and real vectors remain intact", () => {
  for (const old of base.artworkRecords) {
    const next = structuredClone(current.artworkRecordById.get(old.id)!);
    if (next.media.depthMap && old.media.depthMap) next.media.depthMap.version = old.media.depthMap.version;
    assert.deepEqual(next, old);
    if (old.media.imageUrlPreview && !/^https?:/u.test(old.media.imageUrlPreview))
      assert.equal(digest(path.join(current.releaseDir, old.media.imageUrlPreview)), digest(path.join(base.releaseDir, old.media.imageUrlPreview)));
  }
  const index = loadSemanticIndex({ manifestPath: current.manifestPath, manifest: current.manifest,
    artworks: current.artworkRecords.map(record => ({ id: record.id, text: semanticArtworkText({ ...record.metadata,
      description: record.metadata.descriptionClean ?? record.metadata.storySnippet }) })) });
  assert.ok(index); assert.equal(index.model.dimensions, 384); assert.equal(index.records.length, current.artworkCount);
  const previous = JSON.parse(readFileSync(path.join(base.releaseDir, "semantic-index.json"), "utf8"));
  assert.deepEqual(index.model, previous.model);
  for (const item of previous.records) assert.deepEqual(index.records.find(row => row.artworkId === item.artworkId), item);
});

test("Monet and strict unpeopled water requests gain actual evidenced options", () => {
  const monet = searchReleaseCatalog(current, "只看莫奈，给我两幅户外油画，不要人物和花卉。").results.map(row => row.artwork.id);
  assert.deepEqual(new Set(monet), new Set(["artic-64818", "getty-9a9cebf1-6d57-4153-aeac-3d5aa0ad9b2c"]));
  const water = searchReleaseCatalog(current, "给我两幅开阔的水景油画，不要人物、船只和花卉。").results.map(row => row.artwork.id);
  assert.deepEqual(new Set(water), new Set(["smk-DEP693", "smk-KMS8575"]));
  for (const id of water) {
    const facts = current.artworkById.get(id)!.visualEvidence!.facts;
    assert.equal(facts.water, "present");
    for (const subject of ["people", "boats", "flowers"] as const) assert.equal(facts[subject], "absent");
  }
});

test("admitted source catalog and raw evidence archives remain independently inspectable", () => {
  for (const item of report.sourceEvidence) assert.equal(digest(path.join(root, item.catalogPath)), item.catalogSha256);
  const archive = JSON.parse(readFileSync(path.join(root, "data/sources/public-url/2026-10-21/catalogs/source-evidence-index.json"), "utf8"));
  assert.ok(archive.files.length);
  for (const item of archive.files) assert.equal(digest(path.join(root, item.file)), `sha256:${item.sha256}`);
  assert.ok(existsSync(path.join(current.releaseDir, "visual-reviews.json")));
  const recovery = JSON.parse(readFileSync(path.join(current.releaseDir, "recovery-evidence/index.json"), "utf8"));
  assert.equal(recovery.completedCount, 286);
  for (const file of recovery.files) assert.equal(digest(path.join(current.releaseDir, file.file)), file.sha256);
});
