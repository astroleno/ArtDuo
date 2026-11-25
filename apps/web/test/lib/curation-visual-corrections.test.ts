import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { parseCurationIntentPlan } from "@artduo/contracts";
import { LOCAL_SEMANTIC_MODEL, semanticFingerprint } from "@artduo/corpus/src/semantic-index";
import { withCurationVisualCorrections } from "../../lib/curation-visual-corrections";
import { exhibitionNarrativeInput } from "../../lib/exhibition-narrative-server";
import { createPublicMediaManifest, mediaSha256, parsePublicMediaManifest, publicMediaId } from "../../lib/public-media-manifest";
import { loadWebReleaseCatalog } from "../../lib/release-catalog";
import { curateExhibition, curationDirectory, readSavedCuration } from "../../lib/semantic-curator";
import { eligibleCurationArtworks, selectForCurationStages } from "../../lib/semantic-selection";
import { depictsEvening, mentionsMorning, parseViewingIntent, prefersRiverBank, reviewedLandscapeFocus } from "../../lib/viewing-intent";

const rootDir = path.resolve(__dirname, "../../../..");
const catalog = loadWebReleaseCatalog({ rootDir, releaseVersion: "2026-11-19-open-gap-739" });
const plans = Object.entries(JSON.parse(readFileSync(path.join(__dirname, "../fixtures/stage-fit-plans.json"), "utf8")))
  .map(([query, plan]) => [query, parseCurationIntentPlan(plan)] as const);
const reviewedIds = ["smk-KKS21313", "smk-KKS21148", "smk-KKS13637"];

test("only the three verified full previews change two previously unknown facts", () => {
  const scoped = withCurationVisualCorrections(catalog);
  const changed = scoped.artworks.filter((artwork) => artwork !== catalog.artworkById.get(artwork.id));
  assert.deepEqual(changed.map(artwork => artwork.id).sort(), [...reviewedIds].sort());
  for (const artwork of changed) {
    const original = catalog.artworkById.get(artwork.id)!;
    assert.equal(original.visualEvidence?.facts.war, "unknown");
    assert.equal(original.visualEvidence?.facts.death, "unknown");
    assert.deepEqual(artwork.visualEvidence, { ...original.visualEvidence,
      facts: { ...original.visualEvidence?.facts, war: "absent", death: "absent" } });
  }
  assert.equal(scoped.artworkById.get("smk-KKS13637")?.visualEvidence?.facts.people, "present");
  assert.equal(withCurationVisualCorrections(scoped), scoped);

  const [id] = reviewedIds;
  const original = catalog.artworkById.get(id)!;
  const evidence = original.visualEvidence!;
  const replaceEvidence = (review: typeof evidence) => withCurationVisualCorrections({ ...catalog,
    artworkById: new Map(catalog.artworkById).set(id, { ...original, visualEvidence: review }) });
  assert.equal(replaceEvidence({ ...evidence, facts: { ...evidence.facts, war: "present" } }).artworkById.get(id)?.visualEvidence?.facts.death, "unknown");
  assert.equal(replaceEvidence({ ...evidence, imageSha256: "sha256:" + "1".repeat(64) }).artworkById.get(id)?.visualEvidence?.facts.death, "unknown");
  const media = catalog.artworkRecordById.get(id)!;
  assert.equal(withCurationVisualCorrections({ ...catalog, artworkRecordById: new Map(catalog.artworkRecordById).set(id,
    { ...media, media: { ...media.media, sourceAssetFingerprint: "sha256:" + "1".repeat(64) } }) }).artworkById.get(id)?.visualEvidence?.facts.death, "unknown");
  const other = { ...catalog, releaseVersion: "other-release" };
  assert.equal(withCurationVisualCorrections(other), other);
});

test("a valid media manifest with a substituted preview hash cannot supply the correction", () => {
  const temporary = mkdtempSync(path.join(os.tmpdir(), "artduo-preview-binding-"));
  try {
    const original = parsePublicMediaManifest(JSON.parse(readFileSync(path.join(catalog.releaseDir, "public-media-manifest.json"), "utf8")));
    const id = reviewedIds[0]!;
    const fakeSha = "2".repeat(64);
    const assets = original.assets.map(asset => asset.id !== publicMediaId("preview", id) ? asset : {
      ...asset, sha256: `sha256:${fakeSha}`, objectKey: asset.objectKey.replace(asset.sha256.slice(7), fakeSha),
    });
    writeFileSync(path.join(temporary, "public-media-manifest.json"), JSON.stringify(createPublicMediaManifest({ ...original, assets })));
    const mismatched = withCurationVisualCorrections({ ...catalog, releaseDir: temporary });
    assert.equal(mismatched.artworkById.get(id)?.visualEvidence?.facts.war, "unknown");
    assert.equal(mismatched.artworkById.get(reviewedIds[1]!)?.visualEvidence?.facts.war, "absent");
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test("an active CDN manifest for another release leaves the archived preview binding available", () => {
  const temporary = mkdtempSync(path.join(os.tmpdir(), "artduo-archived-preview-"));
  const mediaEnv = { ARTDUO_MEDIA_MODE: "cdn", ARTDUO_MEDIA_ORIGIN: "https://example.test", ARTDUO_MEDIA_MANIFEST: "active-public-media.json" };
  const previous = Object.keys(mediaEnv).map(key => [key, process.env[key]] as const);
  try {
    const archiveDir = path.join(temporary, "data", "releases", catalog.releaseVersion);
    const activeRelease = "next-release";
    const activeDir = path.join(temporary, "data", "releases", activeRelease);
    mkdirSync(archiveDir, { recursive: true });
    mkdirSync(activeDir, { recursive: true });
    const archiveManifest = readFileSync(path.join(catalog.releaseDir, "public-media-manifest.json"), "utf8");
    writeFileSync(path.join(archiveDir, "public-media-manifest.json"), archiveManifest);
    const activeSource = "{}";
    writeFileSync(path.join(activeDir, "manifest.json"), activeSource);
    const [asset] = parsePublicMediaManifest(JSON.parse(archiveManifest)).assets;
    writeFileSync(path.join(temporary, "active-public-media.json"), JSON.stringify(createPublicMediaManifest({
      releaseVersion: activeRelease, sourceManifestSha256: mediaSha256(activeSource), assets: [asset!],
    })));
    Object.assign(process.env, mediaEnv);
    const archived = withCurationVisualCorrections({ ...catalog, releaseDir: archiveDir });
    assert.ok(reviewedIds.every(id => archived.artworkById.get(id)?.visualEvidence?.facts.war === "absent"));
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("both forest plans start with observed woodland, and hard exclusions still limit the result", () => {
  const scoped = withCurationVisualCorrections(catalog);
  for (const [query, plan] of plans.filter(([query]) => query.includes("森林版画"))) {
    const baseline = eligibleCurationArtworks(catalog, query, plan);
    assert.equal(eligibleCurationArtworks(scoped, query, plan).length, baseline.length + 3);
    const selection = selectForCurationStages({ catalog, query, plan });
    assert.equal(selection.assignments.length, 3);
    assert.ok(selection.assignments.slice(0, 2).some(assignment => reviewedIds.includes(assignment.artworkId)));
    assert.ok(selection.assignments[0]!.evidence.includes("reviewed-focus:forest"));
    const snowy = scoped.artworkById.get("smk-KKS13637")!;
    const small = { ...scoped, artworks: [snowy] };
    assert.equal(selectForCurationStages({ catalog: small, query: query + "不要人物。", plan }).assignments.length, 0);
    assert.equal(selectForCurationStages({ catalog: small, query, plan }).assignments.length, 1);
  }
});

test("positive riverbanks rank by the image observation and leave water constraints intact", () => {
  const [query, plan] = plans.find(([query]) => query.includes("清晨的河岸"))!;
  assert.equal(prefersRiverBank(query), true);
  assert.equal(mentionsMorning(query), true);
  assert.equal(mentionsMorning("不要清晨的河岸"), false);
  assert.equal(mentionsMorning("想看河岸的清晨与黄昏"), false);
  assert.deepEqual(parseViewingIntent(query).subjects, []);
  assert.equal(prefersRiverBank("Show me a riverbank"), true);
  for (const request of ["想看水边", "想看海岸", "想看湖边", "别看河岸", "不要河岸，想看海", "想看河畔或海边", "想看湖边也想看江岸", "show a riverbank and a beach"]) {
    assert.equal(prefersRiverBank(request), false, request);
  }
  assert.deepEqual(parseViewingIntent("不要河岸，想看海").subjects, ["sea"]);
  for (const request of ["我在河岸边加班，想看静物", "思绪像河岸一样弯曲，想看肖像", "I just walked along the riverbank; show me portraits"]) {
    assert.equal(prefersRiverBank(request), false, request);
  }
  const shanghaiRiver = "想看上海的河畔风景";
  assert.equal(prefersRiverBank(shanghaiRiver), true);
  assert.equal(prefersRiverBank("清晨河畔"), true);
  assert.deepEqual(parseViewingIntent(shanghaiRiver).subjects, ["sea"], "retain the legacy parser for frozen records");
  assert.deepEqual(parseViewingIntent(shanghaiRiver, [], { scopedRiverBank: true }).subjects, []);
  assert.deepEqual(parseViewingIntent("想看上海的河畔和海边", [], { scopedRiverBank: true }).subjects, ["sea"]);
  const result = selectForCurationStages({ catalog, query, plan });
  assert.equal(result.assignments.length, 6);
  const breezyStage = plan.stages.findIndex(stage => stage.label === "等风来");
  const chosen = result.search.results.filter((_, index) => result.assignments[index]!.stageIndex === breezyStage);
  assert.equal(chosen.length, 2);
  assert.ok(chosen.every(({ artwork }) => reviewedLandscapeFocus(artwork, "riverbank")));
  assert.ok(chosen.every(({ artwork }) => !depictsEvening(artwork)));
  const reviewed = chosen[0]!.artwork;
  assert.equal(reviewedLandscapeFocus({ ...reviewed, visualEvidence: undefined, title: "The Banks of the River" }, "riverbank"), false);
  assert.equal(reviewedLandscapeFocus({ ...reviewed, visualEvidence: { ...reviewed.visualEvidence!, observation: "背景似乎能看到河面。" } }, "riverbank"), false);
  const evening = catalog.artworkById.get("rijksmuseum-200116907")!;
  assert.equal(depictsEvening(evening), true);
  assert.equal(reviewedLandscapeFocus(evening, "riverbank"), true);
  const small = { ...catalog, artworks: [evening] };
  const dawn = selectForCurationStages({ catalog: small, query, plan });
  assert.equal(dawn.assignments[0]?.artworkId, evening.id);
  assert.ok(!dawn.assignments[0]?.evidence.includes("reviewed-focus:riverbank"));
  assert.ok(selectForCurationStages({ catalog: small, query: "想看黄昏的河岸", plan }).assignments[0]?.evidence.includes("reviewed-focus:riverbank"));
  assert.ok(selectForCurationStages({ catalog: small, query: "想看河岸的清晨与黄昏", plan }).assignments[0]?.evidence.includes("reviewed-focus:riverbank"));
  assert.ok(selectForCurationStages({ catalog: small, query: shanghaiRiver, plan }).assignments[0]?.evidence.includes("reviewed-focus:riverbank"));
  assert.ok(!selectForCurationStages({ catalog: small, query: "想看水边", plan }).assignments[0]?.evidence.includes("reviewed-focus:riverbank"));
});

test("v19 and newer restore the scoped forest evidence into narration while v18 uses the original review", async () => {
  const temporary = mkdtempSync(path.join(os.tmpdir(), "artduo-forest-replay-"));
  try {
    const [query, plan] = plans.find(([query]) => query.includes("森林版画"))!;
    let reranks = 0;
    const result = await curateExhibition({ rootDir: temporary, catalog, query, intentModel: "fixture",
      encoder: { model: LOCAL_SEMANTIC_MODEL, async warmup() {}, async dispose() {}, async embedDocuments() { return []; },
        async embedQueries(texts) { return texts.map(() => [1, ...Array(383).fill(0)]); } },
      stream: async function* (messages) {
        if (!messages[0]!.content.includes("选画编辑")) { yield JSON.stringify(plan); return; }
        reranks++;
        yield "{}";
      } });
    assert.equal(reranks, 1);
    assert.equal(result.record.selectionVersion, 23);
    const saved = readSavedCuration(catalog, result.curationId, undefined, temporary);
    assert.deepEqual(saved.assignments, result.assignments);
    const input = exhibitionNarrativeInput(catalog, saved);
    assert.deepEqual(input.artworks.map(artwork => artwork.id), saved.assignments.map(assignment => assignment.artworkId));
    assert.ok(input.artworks.some(artwork => reviewedIds.includes(artwork.id) && artwork.visualObservation?.facts?.war === "absent"));

    const prior = { ...saved.record, selectionVersion: 19 };
    const priorId = semanticFingerprint(JSON.stringify(prior));
    writeFileSync(path.join(curationDirectory(temporary), `${priorId}.json`), JSON.stringify(prior));
    const priorRestored = readSavedCuration(catalog, priorId, undefined, temporary);
    assert.deepEqual(priorRestored.assignments, saved.assignments);
    assert.deepEqual(exhibitionNarrativeInput(catalog, priorRestored), input);

    const legacyQuery = "想看三幅森林版画";
    const legacyAssignments = [reviewedIds[0]!].map(artworkId => ({ artworkId, stageIndex: 0, vectorScore: .8, score: .9, evidence: ["fixture"] }));
    const old = { ...saved.record, query: legacyQuery, visualEvidenceVersion: catalog.visualEvidenceVersion,
      assignments: legacyAssignments, selectionVersion: 18 };
    const legacyId = semanticFingerprint(JSON.stringify(old));
    writeFileSync(path.join(curationDirectory(temporary), `${legacyId}.json`), JSON.stringify(old));
    const restored = readSavedCuration(catalog, legacyId, legacyQuery, temporary);
    assert.deepEqual(restored.assignments, legacyAssignments);
    assert.equal(exhibitionNarrativeInput(catalog, restored).artworks[0]?.visualObservation?.facts?.war, "unknown");
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});
