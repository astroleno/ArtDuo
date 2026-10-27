import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { LOCAL_SEMANTIC_MODEL } from "@artduo/corpus/src/semantic-index";
import { VISUAL_SUBJECTS } from "@artduo/contracts";
import { isGalleryArtwork } from "../../lib/artwork-eligibility";
import { loadArtworkVisualEvidence } from "../../lib/artwork-visual-evidence";
import { loadWebReleaseCatalog, type WebArtwork } from "../../lib/release-catalog";
import { eligibleCurationArtworks, fallbackCurationIntent, selectForCurationStages } from "../../lib/semantic-selection";
import { matchesViewingIntent, parseViewingIntent, viewingIntentDecision } from "../../lib/viewing-intent";

test("absence evidence is bound to the delivered image and is invalidated by replacement", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "artduo-visual-evidence-"));
  const releaseDir = path.join(root, "data/releases/fixture"), ledgerDir = path.join(root, "data/curation/visual-reviews");
  mkdirSync(path.join(releaseDir, "images"), { recursive: true }); mkdirSync(ledgerDir, { recursive: true });
  const image = path.join(releaseDir, "images/work.jpg"), original = Buffer.from("first-delivered-image");
  const artwork = { id: "work", title: "A Quiet Bay", imageUrl: "images/work.jpg", description: "开阔水面伸向远处。", subjectTags: [] } as unknown as WebArtwork;
  const review = { artworkId: "work", imagePath: artwork.imageUrl, imageSha256: `sha256:${createHash("sha256").update(original).digest("hex")}`,
    reviewer: "local-image-review", reviewedAt: "2026-10-20", facts: { water: "present", people: "absent", boats: "absent", flowers: "absent" }, observation: "开阔水面伸向远处，未见人物、船只或花朵。" };
  const ledger = { schemaVersion: 1, releaseVersion: "fixture", reviews: [review] };
  const load = () => loadArtworkVisualEvidence({ releaseDir, releaseVersion: "fixture", artworks: [artwork] });
  try {
    writeFileSync(image, original); writeFileSync(path.join(ledgerDir, "fixture.json"), JSON.stringify(ledger));
    const valid = load();
    assert.equal(matchesViewingIntent({ ...artwork, visualEvidence: valid.byArtworkId.get("work") }, parseViewingIntent("water, no boats, people, or flowers")), true);
    writeFileSync(image, "different-delivered-image");
    const changed = load();
    assert.notEqual(changed.version, valid.version);
    assert.equal(changed.byArtworkId.size, 0); assert.ok(changed.unverifiedArtworkIds.has("work"));
    assert.equal(matchesViewingIntent({ ...artwork, visualEvidenceUnavailable: true }, parseViewingIntent("water, no people")), false);
    rmSync(image); writeFileSync(path.join(root, "outside.jpg"), original); symlinkSync(path.join(root, "outside.jpg"), image);
    assert.equal(load().byArtworkId.size, 0);
    writeFileSync(path.join(ledgerDir, "fixture.json"), "malformed");
    assert.ok(load().unverifiedArtworkIds.has("work"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("reviewed water scenes recover from sparse tags while all explicit exclusions remain strict", () => {
  const catalog = loadWebReleaseCatalog({ rootDir: path.resolve(__dirname, "../../../.."), releaseVersion: "2026-10-15-experience" });
  const query = "I’m not sad or tired. Give me two paintings of water, but no boats, people, or flowers. I want spacious views, not comfort.";
  const plan = fallbackCurationIntent(catalog, query);
  const eligible = eligibleCurationArtworks(catalog, query, plan);
  assert.deepEqual(eligible.map(artwork => artwork.id), ["met-382737"]);
  const base = "water, no boats, people, or flowers";
  assert.deepEqual(eligibleCurationArtworks(catalog, base, plan).map(artwork => artwork.id).sort(), ["met-382544", "met-382737", "met-383409"]);
  for (const artwork of eligible) {
    assert.ok(artwork.visualEvidence?.imageSha256);
    assert.deepEqual(viewingIntentDecision(artwork, parseViewingIntent(query)).reasons, []);
  }
  assert.ok(viewingIntentDecision(catalog.artworkById.get("met-437941")!, parseViewingIntent(query)).reasons.includes("excluded-subject:people:present"));
  assert.ok(viewingIntentDecision(catalog.artworkById.get("artic-16487")!, parseViewingIntent(query)).reasons.includes("excluded-subject:boats:unknown"));
  assert.equal(matchesViewingIntent(catalog.artworkById.get("artic-16568")!, parseViewingIntent(query)), false);
  const monet = "只看莫奈，给我两幅户外风景，排除《睡莲》和《睡莲池》，不要人物。";
  assert.deepEqual(eligibleCurationArtworks(catalog, monet, fallbackCurationIntent(catalog, monet)).map(artwork => artwork.id), ["artic-64818"]);
  assert.equal(matchesViewingIntent({ title: "A Drawing", subjectTags: [], description: "A Drawing. Watercolor on paper." } as unknown as WebArtwork, parseViewingIntent("water")), false);
});

test("unknown remains unknown, and no-people does not secretly mean no-boats", () => {
  const artwork = { title: "A Bay", subjectTags: [], visualEvidence: { facts: { water: "present", people: "absent", boats: "present", flowers: "absent" } } } as unknown as WebArtwork;
  assert.equal(matchesViewingIntent(artwork, parseViewingIntent("water, no people")), true);
  assert.equal(matchesViewingIntent(artwork, parseViewingIntent("water, no boats")), false);
  assert.equal(matchesViewingIntent({ ...artwork, visualEvidence: { ...artwork.visualEvidence!, facts: { water: "present", people: "absent", boats: "unknown" } } }, parseViewingIntent("water, no boats")), false);
});

test("explicit space is verified before ranking and never filled with a framed courtyard", () => {
  const catalog = loadWebReleaseCatalog({ rootDir: path.resolve(__dirname, "../../../.."), releaseVersion: "2026-10-15-experience" });
  const base = "Give me two works of water, no boats, people, or flowers.";
  const query = base + " I want spacious views, not comfort.";
  assert.equal(parseViewingIntent(query).spacious, true);
  assert.equal(parseViewingIntent("I do not want spacious views.").spacious, false);
  const plan = fallbackCurationIntent(catalog, query);
  assert.deepEqual(eligibleCurationArtworks(catalog, query, plan).map(art => art.id), ["met-382737"]);
  assert.equal(eligibleCurationArtworks(catalog, base, plan).length, 3);
  assert.ok(viewingIntentDecision(catalog.artworkById.get("met-382544")!, parseViewingIntent(query)).reasons.includes("required-space:framed"));
  assert.equal(eligibleCurationArtworks(catalog, query + " Only oil paintings.", plan).length, 0);
  const select = (request: string) => selectForCurationStages({ catalog, query: request, plan, semantic: {
    index: { schemaVersion: 1, releaseVersion: catalog.releaseVersion, sourceFingerprint: "fixture", model: { ...LOCAL_SEMANTIC_MODEL, dimensions: 1 },
      records: catalog.artworks.map(art => ({ artworkId: art.id, textFingerprint: "fixture", vector: [1] })) },
    queries: plan.stages.map(() => [1]),
  } });
  const result = select(query);
  assert.deepEqual(result.assignments.map(item => item.artworkId), ["met-382737"]);
  assert.ok(result.assignments.every(item => item.evidence.includes("space:open")));
  assert.ok(select(base).assignments.every(item => !item.evidence.includes("space:open")));
  assert.equal(matchesViewingIntent(catalog.artworkById.get("met-382544")!, parseViewingIntent("water, no religious imagery")), false);
});

test("every current gallery candidate has a complete, current-image visual dossier", () => {
  const catalog = loadWebReleaseCatalog({ rootDir: path.resolve(__dirname, "../../../.."), releaseVersion: "2026-10-15-experience" });
  const artworks = catalog.artworks.filter(isGalleryArtwork);
  assert.equal(artworks.length, 137);
  for (const artwork of artworks) {
    assert.ok(artwork.visualEvidence, artwork.id);
    assert.ok(artwork.visualEvidence.spatialFraming, artwork.id);
    assert.ok(VISUAL_SUBJECTS.every(subject => ["present", "absent", "unknown"].includes(artwork.visualEvidence!.facts[subject]!)), artwork.id);
    assert.equal(artwork.visualEvidenceUnavailable, false, artwork.id);
  }
  assert.equal(catalog.artworkById.get("artic-28560")!.visualEvidence!.facts.people, "present", "incidental portraits still contain people");
  assert.equal(catalog.artworkById.get("met-438816")!.visualEvidence!.facts.people, "unknown", "dark small forms remain unresolved");
});

test("the review interface accepts more than 500 works and rejects incomplete version-two facts", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "artduo-review-batch-"));
  const releaseDir = path.join(root, "data/releases/fixture"), ledgerDir = path.join(root, "data/curation/visual-reviews");
  mkdirSync(path.join(releaseDir, "images"), { recursive: true }); mkdirSync(ledgerDir, { recursive: true });
  const image = Buffer.from("shared-test-preview");
  writeFileSync(path.join(releaseDir, "images/work.jpg"), image);
  const artworks = Array.from({ length: 501 }, (_, index) => ({ id: `work-${index}`, imageUrl: "images/work.jpg" }) as WebArtwork);
  const reviews = artworks.map(artwork => ({ artworkId: artwork.id, imagePath: artwork.imageUrl,
    imageSha256: `sha256:${createHash("sha256").update(image).digest("hex")}`, reviewedAt: "2026-10-21", reviewer: "local-image-review",
    facts: Object.fromEntries(VISUAL_SUBJECTS.map(subject => [subject, "unknown"])), spatialFraming: "unknown", observation: "Test preview has no interpretable pixels." }));
  const filename = path.join(ledgerDir, "fixture.json");
  try {
    writeFileSync(filename, JSON.stringify({ schemaVersion: 2, releaseVersion: "fixture", reviews }));
    assert.equal(loadArtworkVisualEvidence({ releaseDir, releaseVersion: "fixture", artworks }).byArtworkId.size, 501);
    delete reviews[0].facts.people;
    writeFileSync(filename, JSON.stringify({ schemaVersion: 2, releaseVersion: "fixture", reviews }));
    const invalid = loadArtworkVisualEvidence({ releaseDir, releaseVersion: "fixture", artworks });
    assert.equal(invalid.byArtworkId.size, 0);
    assert.equal(invalid.unverifiedArtworkIds.size, 501);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
