import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { VISUAL_SUBJECTS, type ArtworkRecord } from "@artduo/contracts";
import { semanticSourceFingerprint } from "@artduo/corpus/src/semantic-index";
import { loadSemanticIndex } from "@artduo/corpus/src/semantic-loader";
import { artworkToSemanticText, readReleaseArtworks } from "./semantic-release";
import { assessVerifiedImport, buildVerifiedPartialRelease, readVerifiedLinkSnapshot,
  type LinkSnapshot, type VerifiedImportInput } from "./verified-partial-import";

const repository = path.resolve(__dirname, "../../..");
const hash = (bytes: Buffer | string) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const writeJson = (file: string, value: unknown) => {
  const serialized = JSON.stringify(value, null, 2);
  mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, serialized + "\n");
  return { checksum: hash(serialized), sizeBytes: Buffer.byteLength(serialized + "\n") };
};
async function fixture() {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-verified-intake-"));
  const bytes = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: "#84906a" } }).jpeg().toBuffer();
  writeFileSync(path.join(rootDir, "image.jpg"), bytes);
  const facts = { title: "Test landscape", artistDisplayName: "Fixture painter", yearLabel: "1889", medium: "Oil on canvas",
    classification: "Paintings", dimensions: "10 × 16 cm", creditLine: "Test fixture", objectUrl: "https://www.metmuseum.org/art/collection/search/900001", subjectTags: ["Landscapes"] };
  const raw = [{ id: "met-900001", objectID: 900001, source: "met", title: facts.title, artist: facts.artistDisplayName,
    year: facts.yearLabel, medium: facts.medium, classification: facts.classification, dimensions: facts.dimensions,
    creditLine: facts.creditLine, objectURL: facts.objectUrl, isPublicDomain: true }];
  writeJson(path.join(rootDir, "raw.json"), raw);
  const catalog = { schemaVersion: 1, institutionKey: "met", sourceObjectId: 900001, facts,
    rights: { status: "public-domain", evidenceUrl: facts.objectUrl },
    pageCheck: { publicDomain: true, facts: { ...facts } },
    legacyEvidence: { path: "raw.json", sha256: hash(readFileSync(path.join(rootDir, "raw.json"))) } };
  writeJson(path.join(rootDir, "catalog.json"), catalog);
  const candidate: VerifiedImportInput = { candidateId: "met-900001", catalogPath: "catalog.json", sourceImagePath: "image.jpg",
    sourceImageUrl: "https://images.metmuseum.org/CRDImages/ep/original/fixture.jpg",
    review: { sourceImageSha256: hash(bytes), reviewedAt: "2026-10-21", reviewer: "local-image-review", view: "complete-frontal",
      facts: Object.fromEntries(VISUAL_SUBJECTS.map(subject => [subject, subject === "architecture" ? "unknown" : "absent"])),
      spatialFraming: "open", observation: "Test fixture observation, never used as real artwork evidence." },
    editorial: { description: "A test fixture landscape.", moodTags: ["wonder"], colorTags: ["green"], compositionTags: ["landscape"], energyLevel: "low", valence: "mixed", pace: "still" } };
  const snapshot: LinkSnapshot = { schemaVersion: 1, sourceFile: "snapshot.csv", sourceSha256: hash("fixture"), urlCount: 1,
    statusCounts: { single_success: 1 }, candidates: [{ candidateId: candidate.candidateId, institutionKey: "met",
      links: [{ url: candidate.sourceImageUrl, status: "single_success", record: 1, queue: "source_url", completedAt: "2026-10-21" }] }] };
  return { rootDir, candidate, catalog, raw, snapshot, cleanup: () => rmSync(rootDir, { recursive: true, force: true }) };
}
const assess = (f: Awaited<ReturnType<typeof fixture>>, existing: ArtworkRecord[] = []) => assessVerifiedImport({
  rootDir: f.rootDir, version: "new", snapshot: f.snapshot, candidates: [f.candidate], existing });

test("snapshot CSV preserves BOM, escaped JSON, embedded newlines and shared candidate links", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "artduo-snapshot-csv-"));
  try {
    const filename = path.join(root, "snapshot.csv");
    writeFileSync(filename, '\ufeffqueue,source_keys,candidate_ids,url,latest_status,latest_complete_success_time_utc,evidence\r\nsource_url,met,met-1|met-2,https://example.org/one,single_success,2026-10-21,"{""note"":""first\nsecond""}"\r\nsource_url,met,met-3,https://example.org/two,not_measured,,\r\n');
    const projection = readVerifiedLinkSnapshot(repository, filename);
    assert.equal(projection.urlCount, 2); assert.equal(projection.candidates.length, 3);
    assert.deepEqual(projection.statusCounts, { single_success: 1, not_measured: 1 });
    assert.equal(projection.candidates[0].links[0].url, projection.candidates[1].links[0].url);
    writeFileSync(filename, "source_keys,candidate_ids,url,latest_status\nmet,met-1,same,single_success\nmet,met-2,same,single_success\n");
    assert.throws(() => readVerifiedLinkSnapshot(repository, filename), /duplicate URL/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("admission retains original facts, full geometry and unknown visual states", async () => {
  const f = await fixture();
  try {
    const result = await assess(f);
    assert.equal(result.accepted.length, 1); assert.equal(result.decisions[0].status, "admitted");
    const { record, preview, full } = result.accepted[0];
    assert.equal(record.metadata.title, f.catalog.facts.title); assert.equal(record.metadata.dimensions, "10 × 16 cm");
    assert.equal(record.metadata.descriptionRaw, undefined, "assistant prose cannot become a raw museum description");
    assert.equal(record.media.sourceAssetFingerprint, hash(preview)); assert.deepEqual(full, readFileSync(path.join(f.rootDir, "image.jpg")));
    assert.equal(record.media.visualPresentation?.contentAspectRatio, 1.6);
    assert.equal(result.accepted[0].review.facts.architecture, "unknown");
    const existing = structuredClone(record); existing.id = "met-900000";
    assert.match((await assess(f, [existing])).decisions[0].reasons.join(), /duplicate-image/);
    assert.deepEqual((await assess(f, [record])).decisions[0].reasons, ["already-in-release"]);
  } finally { f.cleanup(); }
});

test("successful links never replace missing master data or new institution adapters", async () => {
  const f = await fixture();
  try {
    const unknown = structuredClone(f.snapshot.candidates[0]); unknown.candidateId = "smk-1"; unknown.institutionKey = "smk";
    const result = await assessVerifiedImport({ rootDir: f.rootDir, version: "new", snapshot: { ...f.snapshot, candidates: [unknown] }, candidates: [], existing: [] });
    assert.equal(result.accepted.length, 0);
    assert.ok(result.decisions[0].reasons.includes("missing-candidate-master"));
    assert.ok(result.decisions[0].reasons.includes("missing-asset-rights"));
    assert.ok(result.decisions[0].reasons.includes("source-adapter-required"));
    f.snapshot.candidates[0].links[0].status = "not_measured";
    assert.ok((await assess(f)).decisions[0].reasons.includes("no-successful-link"));
  } finally { f.cleanup(); }
});

test("catalog facts, public-domain evidence and exact image/source identity fail closed", async t => {
  const variants: Array<[string, (f: Awaited<ReturnType<typeof fixture>>) => void, RegExp]> = [
    ["missing title", f => { f.catalog.facts.title = ""; }, /missing-title/],
    ["wrong object", f => { f.catalog.sourceObjectId = 900002; }, /catalog-identity-mismatch/],
    ["uncertain rights", f => { f.catalog.rights.status = "unknown"; }, /rights-unconfirmed/],
    ["page conflicts with old facts", f => { f.catalog.pageCheck.facts.medium = "Watercolor"; }, /catalog-fact-conflict/],
    ["changed raw record", f => { writeFileSync(path.join(f.rootDir, "raw.json"), "[]"); }, /catalog-evidence-changed/],
    ["different successful image", f => { f.candidate.sourceImageUrl += ".other"; }, /source-image-not-verified/],
    ["non-museum host", f => { f.candidate.sourceImageUrl = "https://example.org/image.jpg"; }, /source-image-not-verified/],
  ];
  for (const [name, mutate, reason] of variants) await t.test(name, async () => {
    const f = await fixture();
    try { mutate(f); writeJson(path.join(f.rootDir, "catalog.json"), f.catalog); const result = await assess(f);
      assert.equal(result.accepted.length, 0); assert.match(result.decisions[0].reasons.join(), reason);
    } finally { f.cleanup(); }
  });
});

test("changed images, detail views, incomplete reviews and undecodable bodies remain held", async t => {
  for (const view of ["detail", "verso", "installation"] as const) await t.test(view, async () => {
    const f = await fixture(); try { f.candidate.review.view = view; assert.match((await assess(f)).decisions[0].reasons.join(), /visual-review-unconfirmed/); } finally { f.cleanup(); }
  });
  const f = await fixture();
  try {
    const oldHash = f.candidate.review.sourceImageSha256;
    f.candidate.review.sourceImageSha256 = hash("other");
    assert.match((await assess(f)).decisions[0].reasons.join(), /visual-review-unconfirmed/);
    f.candidate.review.sourceImageSha256 = oldHash; delete f.candidate.review.facts.people;
    assert.match((await assess(f)).decisions[0].reasons.join(), /visual-review-unconfirmed/);
    f.candidate.review.facts.people = "absent"; writeFileSync(path.join(f.rootDir, "image.jpg"), Buffer.from("not an image"));
    assert.equal((await assess(f)).accepted.length, 0);
  } finally { f.cleanup(); }
});

async function addBaseRelease(f: Awaited<ReturnType<typeof fixture>>) {
  const original = path.join(repository, "data/releases/2026-10-15-experience");
  const manifest = JSON.parse(readFileSync(path.join(original, "manifest.json"), "utf8"));
  const baseRows = readReleaseArtworks(path.join(original, "manifest.json"), manifest);
  const base = structuredClone(baseRows.find(record => record.id === "met-10065")!);
  base.version = "base"; base.media.depthMap!.version = "base";
  const target = path.join(f.rootDir, "data/releases/base"); mkdirSync(target, { recursive: true });
  for (const url of [base.media.imageUrlPreview!, base.media.depthMap!.url]) {
    mkdirSync(path.dirname(path.join(target, url)), { recursive: true }); copyFileSync(path.join(original, url), path.join(target, url));
  }
  const artifact = (kind: "metadata" | "search" | "mediaIndex" | "embeddings", filename: string, rows: unknown[]) => {
    manifest.shards[kind] = [{ id: kind, url: `./${filename}`, ...writeJson(path.join(target, filename), rows), recordCount: rows.length }];
  };
  const { retrieval, media, ...meta } = base;
  artifact("metadata", "metadata-01.json", [meta]);
  artifact("search", "search-01.json", [{ id: base.id, source: base.source, sourceArtworkId: base.sourceArtworkId, version: "base", retrieval }]);
  artifact("mediaIndex", "media-01.json", [{ id: base.id, source: base.source, sourceArtworkId: base.sourceArtworkId, version: "base", media }]);
  const fallback = JSON.parse(readFileSync(path.join(original, "embeddings-01.json"), "utf8")).filter((row: any) => row.id === base.id);
  fallback[0].version = "base"; artifact("embeddings", "embeddings-01.json", fallback);
  for (const shard of manifest.shards.backgroundScenes) copyFileSync(path.join(original, shard.url), path.join(target, shard.url));
  manifest.release.corpusVersion = "base";
  const index = JSON.parse(readFileSync(path.join(original, "semantic-index.json"), "utf8"));
  index.releaseVersion = "base"; index.records = index.records.filter((row: any) => row.artworkId === base.id);
  index.sourceFingerprint = semanticSourceFingerprint(manifest);
  Object.assign(manifest.shards.semanticEmbeddings[0], writeJson(path.join(target, "semantic-index.json"), index), { recordCount: 1 });
  writeJson(path.join(target, "manifest.json"), manifest);
  const depth = JSON.parse(readFileSync(path.join(original, "depth-report.json"), "utf8"));
  depth.releaseVersion = "base"; depth.records = depth.records.filter((row: any) => row.artworkId === base.id); depth.count = 1;
  writeJson(path.join(target, "depth-report.json"), depth);
  const ledger = JSON.parse(readFileSync(path.join(repository, "data/curation/visual-reviews/2026-10-15-experience.json"), "utf8"));
  ledger.releaseVersion = "base"; ledger.reviews = ledger.reviews.filter((row: any) => row.artworkId === base.id);
  writeJson(path.join(f.rootDir, "data/curation/visual-reviews/base.json"), ledger);
  mkdirSync(path.join(f.rootDir, "scripts"));
  copyFileSync(path.join(repository, "scripts/read-verified-link-snapshot.py"), path.join(f.rootDir, "scripts/read-verified-link-snapshot.py"));
  writeJson(path.join(f.rootDir, "intake.json"), { schemaVersion: 1, candidates: [f.candidate] });
  writeFileSync(path.join(f.rootDir, "snapshot.csv"), `source_keys,candidate_ids,url,latest_status\nmet,met-900001,${f.candidate.sourceImageUrl},single_success\n`);
  return { manifest, index, target };
}

test("release activation preserves old vectors/evidence and waits for complete depth and semantic output", async () => {
  const f = await fixture();
  try {
    const base = await addBaseRelease(f);
    const before = readFileSync(path.join(base.target, "manifest.json"));
    const options = { rootDir: f.rootDir, baseVersion: "base", version: "new", intakePath: "intake.json",
      snapshotCsv: path.join(f.rootDir, "snapshot.csv"), activate: true,
      encoder: { model: base.index.model, async embedDocuments(texts: string[]) { return texts.map(() => [1, ...Array(383).fill(0)]); }, async embedQueries() { return []; }, async dispose() {} },
      estimator: { async predict() { return { width: 2, height: 2, values: new Float32Array([0, 1, 2, 3]) }; }, async dispose() {} } };
    await assert.rejects(buildVerifiedPartialRelease({ ...options, version: "bad-vector", encoder: { ...options.encoder,
      async embedDocuments() { return [[NaN, ...Array(383).fill(0)]]; } } }), /finite|vector|invalid/i);
    assert.equal(existsSync(path.join(f.rootDir, "data/releases/bad-vector")), false);
    await assert.rejects(buildVerifiedPartialRelease({ ...options, version: "bad-depth", estimator: { ...options.estimator,
      async predict() { throw new Error("test depth failure"); } } }), /test depth failure/);
    assert.equal(existsSync(path.join(f.rootDir, "data/releases/bad-depth")), false);
    assert.equal(existsSync(path.join(f.rootDir, "data/curation/visual-reviews/bad-depth.json")), false);
    const built = await buildVerifiedPartialRelease(options);
    assert.equal(built.activated, true); assert.equal(built.report.admittedCount, 1);
    assert.deepEqual(readFileSync(path.join(base.target, "manifest.json")), before);
    const manifest = JSON.parse(readFileSync(path.join(built.directory!, "manifest.json"), "utf8"));
    const next = readReleaseArtworks(path.join(built.directory!, "manifest.json"), manifest);
    const index = loadSemanticIndex({ manifestPath: path.join(built.directory!, "manifest.json"), manifest,
      artworks: next.map(record => ({ id: record.id, text: artworkToSemanticText(record) })) });
    assert.equal(next.length, 2);
    assert.deepEqual(JSON.parse(readFileSync(path.join(built.directory!, "semantic-index.json"), "utf8")).records[0], base.index.records[0]);
    assert.equal(JSON.parse(readFileSync(path.join(built.directory!, "depth-report.json"), "utf8")).count, 2);
    assert.equal(JSON.parse(readFileSync(path.join(f.rootDir, "data/curation/visual-reviews/new.json"), "utf8")).reviews.length, 2);
    assert.ok(index);
    await assert.rejects(buildVerifiedPartialRelease(options), /already exists/);
  } finally { f.cleanup(); }
});

test("an interrupted staging run resumes verified depth and rejects changed outputs", async () => {
  const f = await fixture();
  try {
    const base = await addBaseRelease(f);
    let predictions = 0;
    const options = { rootDir: f.rootDir, baseVersion: "base", version: "resume", intakePath: "intake.json",
      snapshotCsv: path.join(f.rootDir, "snapshot.csv"), activate: true,
      encoder: { model: base.index.model, async embedDocuments(texts: string[]) { return texts.map(() => [1, ...Array(383).fill(0)]); }, async embedQueries() { return []; }, async dispose() {} },
      estimator: { async predict() { predictions++; return { width: 2, height: 2, values: new Float32Array([0, 1, 2, 3]) }; }, async dispose() {} } };
    await assert.rejects(buildVerifiedPartialRelease({ ...options, onProgress(progress) {
      if (progress.phase === "depth") throw new Error("fixture interrupted after checkpoint");
    } }), /interrupted after checkpoint/);
    assert.equal(predictions, 1);
    assert.equal(existsSync(path.join(f.rootDir, "data/releases/resume")), false);
    const checkpoint = JSON.parse(readFileSync(path.join(f.rootDir, "data/curation/verified-import/resume/depth-progress.jsonl"), "utf8").trim());
    const image = path.join(f.rootDir, "data/curation/verified-import/resume/release", checkpoint.record.url);
    const bytes = readFileSync(image);
    writeFileSync(image, "changed checkpoint output");
    await assert.rejects(buildVerifiedPartialRelease({ ...options, resume: true }), /checkpoint changed/);
    assert.equal(predictions, 1);
    writeFileSync(image, bytes);
    const result = await buildVerifiedPartialRelease({ ...options, resume: true });
    assert.equal(result.activated, true); assert.equal(predictions, 1);
    assert.deepEqual(readFileSync(path.join(result.directory!, checkpoint.record.url)), bytes);
    await assert.rejects(buildVerifiedPartialRelease({ ...options, resume: true }), /already exists/);
  } finally { f.cleanup(); }
});
