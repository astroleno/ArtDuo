import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { CURATION_RECIPE_VERSION } from "@artduo/contracts";
import { fallbackExhibitionNarrative } from "../../../api/src/services/curation/exhibition-narrative";
import { curationDirectory, type CuratedExhibition } from "../../lib/semantic-curator";
import { exhibitionNarrativeInput, getExhibitionNarrative, readNarrativePieces } from "../../lib/exhibition-narrative-server";
import { loadWebReleaseCatalog } from "../../lib/release-catalog";
import { fallbackCurationIntent, selectForCurationStages } from "../../lib/semantic-selection";

const bedroomGuide = () => [
  { kind: "preface", text: "木床、桌与两把椅子，把蓝色卧室分成几个紧凑的角落。", evidenceIds: ["artic-28560"] },
  { kind: "note", artworkId: "artic-28560", text: "蓝色卧室里，木床与两把椅子相邻。", evidenceIds: ["artic-28560"] },
  { kind: "closing", text: "回到床与椅子围出的近处空间。", evidenceIds: ["artic-28560"] },
];

test("temporary narrative failure keeps the fallback usable and permits later recovery", async () => {
  const temporary = mkdtempSync(path.join(os.tmpdir(), "artduo-narrative-recovery-"));
  const source = loadWebReleaseCatalog({ rootDir: path.resolve(__dirname, "../../../.."), releaseVersion: "2026-10-15-experience" });
  const catalog = { ...source, releaseDir: path.join(temporary, "data/releases/2026-10-15-experience") };
  const query = "The Bedroom", plan = fallbackCurationIntent(catalog, query);
  const selection = selectForCurationStages({ catalog, query, plan });
  const curation: CuratedExhibition = { ...selection, curationId: "a".repeat(64), record: {
    schemaVersion: 1, recipeVersion: CURATION_RECIPE_VERSION, releaseVersion: catalog.releaseVersion, query, plan,
    assignments: selection.assignments, retrievalModel: selection.search.model, dimensions: selection.search.dimensions,
    intentModel: "fixture", indexChecksum: "fixture", degraded: [],
  } };
  mkdirSync(curationDirectory(temporary), { recursive: true });
  try {
    let clock = Date.now();
    const first = getExhibitionNarrative(catalog, curation, { now: () => clock, stream: async function* () { throw new Error("temporary interruption"); } });
    await first.complete;
    assert.equal(first.pieces.length, 3);
    assert.ok(first.pieces.every((piece) => piece.source === "fallback"));
    assert.equal(readdirSync(curationDirectory(temporary)).some(file => file.includes("narrative")), true);
    let unexpectedRequests = 0;
    const cooled = getExhibitionNarrative(catalog, curation, { now: () => clock, stream: async function* () { unexpectedRequests++; } });
    await cooled.complete;
    assert.equal(unexpectedRequests, 0, "refreshing a failed guide respects its retry window");
    assert.equal(readNarrativePieces(catalog, curation), undefined, "fallback remains distinct from model success");
    clock += 60_001;
    const second = getExhibitionNarrative(catalog, curation, { now: () => clock, stream: async function* () {
      yield bedroomGuide().map((piece) => JSON.stringify(piece)).join("\n");
    } });
    await second.complete;
    assert.ok(second.pieces.every((piece) => piece.source === "grounded"));
    assert.equal(readNarrativePieces(catalog, curation)?.length, 3);
    const filename = readdirSync(curationDirectory(temporary)).find(file => file.includes("narrative-v5"))!;
    writeFileSync(path.join(curationDirectory(temporary), filename), "invalid earlier cache");
    const recovered = getExhibitionNarrative(catalog, curation, { stream: async function* () {
      yield bedroomGuide().map(piece => JSON.stringify(piece)).join("\n");
    } });
    await recovered.complete;
    assert.ok(recovered.pieces.every(piece => piece.source === "grounded"));
    assert.equal(readNarrativePieces(catalog, curation)?.length, 3, "a repaired narrative must replace an invalid cache atomically");
    const currentArtwork = source.artworkById.get("artic-28560")!;
    const correctedArtwork = { ...currentArtwork, artistDisplayName: "Verified artist", displayCredits: { artistDisplayName: "Verified artist", publishers: ["Verified publisher"] } };
    const correctedCatalog = { ...catalog, artworkById: new Map(catalog.artworkById).set(correctedArtwork.id, correctedArtwork) };
    assert.deepEqual(readNarrativePieces(correctedCatalog, curation), readNarrativePieces(catalog, curation), "a role-only correction revalidates the exact frozen text without a new provider request");
    const original = source.artworkById.get("artic-28560")!;
    const changed = { ...original, visualEvidence: { ...original.visualEvidence!, observation: "木床与两把椅子构成卧室近景。" } };
    const revisedCatalog = { ...catalog, artworkById: new Map(catalog.artworkById).set(changed.id, changed) };
    assert.equal(readNarrativePieces(revisedCatalog, curation), undefined, "changed visual observations cannot reuse older prose");
    const changedCorrected = { ...correctedArtwork, visualEvidence: changed.visualEvidence };
    assert.equal(readNarrativePieces({ ...correctedCatalog, artworkById: new Map(correctedCatalog.artworkById).set(changedCorrected.id, changedCorrected) }, curation), undefined, "role compatibility cannot hide a change in the actual visual evidence");
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test("a partial guide survives restart and repairs only its missing pieces after cooldown", async () => {
  const temporary = mkdtempSync(path.join(os.tmpdir(), "artduo-narrative-partial-"));
  const source = loadWebReleaseCatalog({ rootDir: path.resolve(__dirname, "../../../.."), releaseVersion: "2026-10-15-experience" });
  const catalog = { ...source, releaseDir: path.join(temporary, "data/releases/2026-10-15-experience") };
  const query = "The Bedroom", plan = fallbackCurationIntent(catalog, query);
  const selection = selectForCurationStages({ catalog, query, plan });
  const curation: CuratedExhibition = { ...selection, curationId: "b".repeat(64), record: {
    schemaVersion: 1, recipeVersion: CURATION_RECIPE_VERSION, releaseVersion: catalog.releaseVersion, query, plan,
    assignments: selection.assignments, retrievalModel: selection.search.model, dimensions: selection.search.dimensions,
    intentModel: "fixture", indexChecksum: "fixture", degraded: [], narrativeVersion: "gallery-guide-v2",
  } };
  try {
    const pieces = bedroomGuide();
    let clock = Date.now(), requests = 0;
    const first = getExhibitionNarrative(catalog, curation, { now: () => clock, stream: async function* () {
      requests++; yield JSON.stringify(pieces[0]) + "\n"; throw new Error("stream interrupted");
    } });
    assert.equal(getExhibitionNarrative(catalog, curation), first, "concurrent readers share one generation");
    await first.complete;
    assert.deepEqual(first.pieces.map(piece => piece.source), ["grounded", "fallback", "fallback"]);
    const preserved = first.pieces[0];
    const cooled = getExhibitionNarrative(catalog, curation, { now: () => clock });
    assert.deepEqual(cooled.pieces[0], preserved);
    clock += 60_001;
    const repaired = getExhibitionNarrative(catalog, curation, { now: () => clock, stream: async function* (messages) {
      requests++;
      const repairLine = messages[1]!.content.split("\n").find(line => line.startsWith("本次只补全"))!;
      assert.ok(repairLine.includes("note:artic-28560") && repairLine.includes("closing"));
      assert.ok(!repairLine.includes("preface"));
      yield pieces.slice(1).map(piece => JSON.stringify(piece)).join("\n");
    } });
    await repaired.complete;
    assert.equal(requests, 2);
    assert.deepEqual(repaired.pieces[0], preserved);
    assert.ok(repaired.pieces.every(piece => piece.source === "grounded"));
    assert.deepEqual(readNarrativePieces(catalog, curation), repaired.pieces);
    const file = path.join(curationDirectory(temporary), readdirSync(curationDirectory(temporary)).find(name => name.includes("narrative-v5"))!);
    const saved = JSON.parse(readFileSync(file, "utf8"));
    saved.pieces[1].evidenceIds = ["another-exhibition-artwork"];
    writeFileSync(file, JSON.stringify(saved));
    const revalidated = getExhibitionNarrative(catalog, curation, { stream: async function* (messages) {
      const repairLine = messages[1]!.content.split("\n").find(line => line.startsWith("本次只补全"))!;
      assert.ok(repairLine.includes("note:artic-28560") && !repairLine.includes("preface") && !repairLine.includes("closing"));
      yield JSON.stringify(pieces[1]);
    } });
    await revalidated.complete;
    assert.deepEqual(revalidated.pieces[0], repaired.pieces[0]);
    assert.deepEqual(revalidated.pieces[2], repaired.pieces[2]);
    assert.ok(revalidated.pieces.every(piece => piece.source === "grounded"));
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});
