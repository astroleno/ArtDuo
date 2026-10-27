import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { publicImageCachePath } from "@artduo/corpus/src/public-image-cache";
import { acquirePublicImages, assessPublicReviews, choosePublicImage, completePublicFacts, publicCandidateReasons,
  readPublicImageReceipts, type PublicIntakeCandidate, type PublicVisualReview } from "./public-url-intake";

async function fixture() {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-public-intake-"));
  const url = "https://media.getty.edu/iiif/image/test/full/max/0/default.jpg";
  const row: PublicIntakeCandidate = { candidateId: "getty-test", institutionKey: "getty", identity: { sourceObjectId: "test" },
    facts: { titleOriginal: "An Empty Bay", creators: [{ nameOriginal: "Painter" }], dateDisplay: "1890", medium: "Oil on canvas", objectType: "Painting" },
    presentationMode: "flat-image", reasons: [], metadataEvidence: [], sourceEvidence: {}, candidateLineSha256: "a".repeat(64),
    images: [{ url, historicalStatus: "single_success", queue: "source_url", assetKey: "getty-test::slot-0", isPrimary: true,
      licenceEvidenceStatus: "archived-per-media-cc0-matched", evidence: [], objectSource: {} }] };
  const bytes = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: "#658c9b" } }).jpeg().toBuffer();
  const intake = { schemaVersion: 1 as const, candidateCount: 1, candidates: [row], inputFiles: {} };
  const workDir = path.join(rootDir, "work"); let requests = 0;
  const fetchImpl = (async () => { requests++; return new Response(bytes, { headers: { "content-type": "image/jpeg", "content-length": String(bytes.length) } }); }) as typeof fetch;
  return { rootDir, row, bytes, intake, workDir, fetchImpl, requests: () => requests, cleanup: () => rmSync(rootDir, { recursive: true, force: true }) };
}

test("white-space creators, missing facts, unknown licensing and books are held without network requests", async () => {
  const f = await fixture();
  try {
    f.row.facts.creators = [{ nameOriginal: " \n " }]; f.row.facts.dateDisplay = "";
    f.row.reasons = ["metadata-rights-unconfirmed"]; f.row.presentationMode = "paged";
    const reasons = publicCandidateReasons(f.row);
    assert.ok(reasons.includes("missing-creator-name")); assert.ok(reasons.includes("missing-date"));
    assert.ok(reasons.includes("metadata-rights-unconfirmed")); assert.ok(reasons.includes("unsupported-presentation:paged"));
    await acquirePublicImages({ ...f, existingIds: new Set(), delayMs: 0 });
    assert.equal(f.requests(), 0);
  } finally { f.cleanup(); }
});

test("museum primary images take precedence over higher-resolution unverified alternatives", async () => {
  const f = await fixture();
  try {
    const primary = { ...f.row.images[0], url: "https://api.smk.dk/api/v1/download/primary.jpg", iiifImageServiceUrl: "https://iip.smk.dk/iiif/jp2/primary.jp2" };
    f.row.images = [{ ...f.row.images[0], url: "https://iip.smk.dk/iiif/jp2/reverse.jp2/full/full/0/native.jpg", isPrimary: false }, primary];
    assert.equal(choosePublicImage(f.row)?.url, primary.url);
  } finally { f.cleanup(); }
});

test("a publisher or after-reference cannot satisfy the current-creator requirement", async () => {
  const f = await fixture();
  try {
    f.row.facts.creators = [{ nameOriginal: "Publisher", role: "publisher" }, { nameOriginal: "Original designer", role: "after" }];
    assert.ok(publicCandidateReasons(f.row).includes("missing-current-creator"));
    f.row.facts.creators.push({ nameOriginal: "Printmaker", role: "engraver/etcher" });
    assert.ok(!publicCandidateReasons(f.row).includes("missing-current-creator"));
  } finally { f.cleanup(); }
});

test("public acquisition resumes accepted responses without requesting them again; decoded image and review hashes must agree", async () => {
  const f = await fixture();
  try {
    const receipts = await acquirePublicImages({ ...f, existingIds: new Set(), delayMs: 0 });
    assert.equal(receipts.get(f.row.candidateId)?.status, "fetched");
    await acquirePublicImages({ ...f, existingIds: new Set(), delayMs: 0 }); assert.equal(f.requests(), 1);
    const review: PublicVisualReview = { candidateId: f.row.candidateId, sourceImageSha256: receipts.get(f.row.candidateId)!.ref!.sha256,
      reviewedAt: "2026-10-21T00:00:00Z", reviewer: "local-image-review", view: "complete-frontal",
      facts: completePublicFacts(["water", "outdoors"], []), spatialFraming: "open", observation: "水面与浅色天空相接。",
      editorial: { description: "水面与浅色天空相接。", moodTags: ["quiet"], colorTags: ["blue"], compositionTags: [], energyLevel: "low", valence: "mixed", pace: "still" } };
    const assess = () => assessPublicReviews({ ...f, version: "new", existing: [], receipts, reviews: [review], catalogDir: path.join(f.rootDir, "catalogs") });
    const valid = await assess(); assert.equal(valid.accepted.length, 1);
    assert.equal(valid.accepted[0].record.media.imageUrlFull, f.row.images[0].url);
    assert.equal(valid.accepted[0].review.facts.people, "unknown");
    assert.equal(valid.accepted[0].record.metadata.descriptionRaw, undefined);
    const ref = valid.accepted[0].record.media.verifiedRemoteImage!;
    const cacheFile = publicImageCachePath(f.rootDir, ref.sha256);
    rmSync(cacheFile);
    assert.equal((await assess()).accepted.length, 0, "the ordinary intake path still requires verified source bytes");
    const deferred = () => assessPublicReviews({ ...f, version: "new", existing: [], receipts, reviews: [review],
      catalogDir: path.join(f.rootDir, "catalogs"), deferMissingSourceCache: true });
    assert.equal((await deferred()).accepted.length, 1, "publication may restore an intentionally absent temporary cache using the exact URL/hash");
    writeFileSync(cacheFile, "corrupt cached image");
    assert.equal((await deferred()).accepted.length, 0, "an existing cache mismatch cannot be treated as a deferred download");
    review.sourceImageSha256 = "sha256:" + "b".repeat(64);
    assert.equal((await assess()).accepted.length, 0);
    assert.equal(readPublicImageReceipts(path.join(f.workDir, "image-receipts.jsonl")).size, 1);
    assert.ok(readFileSync(path.join(f.workDir, "image-receipts.jsonl"), "utf8").endsWith("\n"));
  } finally { f.cleanup(); }
});

test("complete HTTP transfers containing truncated or low-resolution images never become accepted receipts", async () => {
  for (const kind of ["truncated", "thumbnail"] as const) {
    const f = await fixture();
    try {
      const body = kind === "truncated" ? f.bytes.subarray(0, 200) : await sharp(f.bytes).resize(300, 188).jpeg().toBuffer();
      const fetchImpl = (async () => new Response(body, { headers: { "content-type": "image/jpeg" } })) as typeof fetch;
      const receipts = await acquirePublicImages({ ...f, fetchImpl, existingIds: new Set(), delayMs: 0 });
      assert.equal(receipts.get(f.row.candidateId)?.status, "held");
    } finally { f.cleanup(); }
  }
});

test("unknown subjects remain unknown and conflicting presence/absence cannot be recorded", () => {
  assert.ok(Object.values(completePublicFacts([], [])).every(value => value === "unknown"));
  assert.throws(() => completePublicFacts(["people"], ["people"]));
});

test("an audit-storage failure stops further source work and cannot report a successful batch", async () => {
  const f = await fixture();
  try {
    f.intake.candidates = Array.from({ length: 4 }, (_, i) => ({ ...f.row, candidateId: `getty-test-${i}` }));
    f.intake.candidateCount = 4;
    await assert.rejects(acquirePublicImages({ ...f, existingIds: new Set(), delayMs: 0,
      onProgress: () => { throw new Error("Audit storage unavailable"); } }), /acquisition failed/);
    assert.equal(f.requests(), 1);
    assert.equal(readPublicImageReceipts(path.join(f.workDir, "image-receipts.jsonl")).size, 1);
  } finally { f.cleanup(); }
});

test("a former attribution is not a second author or a substitute for a current attribution", async () => {
  const f = await fixture();
  try {
    const former = { nameOriginal: "Former Painter", role: "earlier ascribed to", attribution: "earlier ascribed to" };
    f.row.facts.creators = [former];
    assert.ok(publicCandidateReasons(f.row).includes("missing-current-creator"));
    const reference = { nameOriginal: "Dürer, Albrecht", role: "copy after", attribution: "copy after" };
    f.row.facts.creators = [reference];
    assert.ok(publicCandidateReasons(f.row).includes("missing-current-creator"));
    f.row.facts.creators = [{ nameOriginal: "Painter" }, former, reference];
    const receipts = await acquirePublicImages({ ...f, existingIds: new Set(), delayMs: 0 });
    const review: PublicVisualReview = { candidateId: f.row.candidateId, sourceImageSha256: receipts.get(f.row.candidateId)!.ref!.sha256,
      reviewedAt: "2026-10-21T00:00:00Z", reviewer: "local-image-review", view: "complete-frontal", facts: completePublicFacts(["water"], []),
      spatialFraming: "open", observation: "水面横向展开。", editorial: { description: "水面横向展开。", moodTags: ["quiet"], colorTags: ["blue"], compositionTags: [], energyLevel: "low", valence: "mixed", pace: "still" } };
    const result = await assessPublicReviews({ ...f, version: "new", receipts, reviews: [review], existing: [], catalogDir: path.join(f.rootDir, "catalogs") });
    assert.equal(result.accepted[0].record.metadata.artistDisplayName, "Painter");
    assert.ok(!result.accepted[0].record.retrieval.searchText.includes("Former Painter"));
    assert.ok(!result.accepted[0].record.retrieval.searchText.includes("Dürer"));
  } finally { f.cleanup(); }
});
