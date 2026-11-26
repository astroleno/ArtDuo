import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { CURATION_RECIPE_VERSION, NARRATIVE_TEXT_LIMITS } from "@artduo/contracts";
import { fallbackExhibitionNarrative } from "../../../api/src/services/curation/exhibition-narrative";
import { curationDirectory, readSavedCuration, type CuratedExhibition, type CurationRecord } from "../../lib/semantic-curator";
import { semanticFingerprint } from "@artduo/corpus/src/semantic-index";
import { buildExperienceSnapshot } from "../../lib/experience-adapter";
import { curationNarrativeView, exhibitionNarrativeInput, getExhibitionNarrative, readNarrativePieces } from "../../lib/exhibition-narrative-server";
import { loadWebReleaseCatalog } from "../../lib/release-catalog";
import { fallbackCurationIntent, materializeCurationSelection, selectForCurationStages } from "../../lib/semantic-selection";

const bedroomGuide = () => [
  { kind: "preface", text: "木床、桌与两把椅子，把蓝色卧室分成几个紧凑的角落。", evidenceIds: ["artic-28560"] },
  { kind: "note", artworkId: "artic-28560", text: "蓝色卧室里，木床与两把椅子相邻。", evidenceIds: ["artic-28560"] },
  { kind: "closing", text: "回到床与椅子围出的近处空间。", evidenceIds: ["artic-28560"] },
];

test("a saved opt-in etching guide changes audience wording in both prompts and all delivered pieces", async () => {
  const temporary = mkdtempSync(path.join(os.tmpdir(), "artduo-etching-guide-"));
  try {
    const source = loadWebReleaseCatalog({ releaseVersion: "2026-11-19-open-gap-739" });
    const catalog = { ...source, releaseDir: path.join(temporary, "data/releases/2026-11-19-open-gap-739") };
    const query = "我想看六幅版材未注明的蚀刻";
    const publicWording = "馆方没有注明印版材质的蚀刻版画";
    const compactWording = "印版未注明的蚀刻";
    const internalWording = "版材未注明的蚀刻";
    const plan = fallbackCurationIntent(catalog, query);
    plan.desiredExperience = `比较${internalWording}`;
    plan.stages[0] = { ...plan.stages[0]!, query: `${internalWording}的线条`, signals: [internalWording] };
    const selection = selectForCurationStages({ catalog, query, plan });
    assert.equal(selection.assignments.length, 6);
    const record: CurationRecord = { schemaVersion: 1, recipeVersion: CURATION_RECIPE_VERSION, releaseVersion: catalog.releaseVersion,
      query, plan, assignments: selection.assignments, retrievalModel: selection.search.model, dimensions: selection.search.dimensions,
      selectionVersion: 24, unrecordedPlatePolicy: true, intentModel: "fixture",
      indexChecksum: catalog.manifest.shards.semanticEmbeddings?.[0]?.checksum ?? "hash-only", degraded: [] };
    const id = semanticFingerprint(JSON.stringify(record)), state = curationDirectory(temporary);
    mkdirSync(state, { recursive: true });
    const recordPath = path.join(state, `${id}.json`);
    writeFileSync(recordPath, JSON.stringify(record));
    const saved = readSavedCuration(catalog, id, query, temporary);
    assert.equal(exhibitionNarrativeInput(catalog, saved).query, query);
    assert.deepEqual(saved.record.assignments, record.assignments);
    const view = curationNarrativeView(catalog, saved);
    const snapshotInputs = { query, catalog, search: saved.search, narrative: view.narrative, route: [], curationId: id,
      selectionVersion: record.selectionVersion, narrativePieces: view.pieces, closingObservations: view.closingObservations };
    const snapshot = buildExperienceSnapshot({ ...snapshotInputs, unrecordedPlatePolicy: saved.record.unrecordedPlatePolicy });
    assert.equal(snapshot.query, query);
    assert.equal(snapshot.presentationQuery, `我想看六幅${publicWording}`);
    assert.equal(snapshot.exhibitionId, buildExperienceSnapshot(snapshotInputs).exhibitionId);
    assert.equal(buildExperienceSnapshot(snapshotInputs).presentationQuery, undefined);
    const visibleQuery = `我想看６幅${internalWording}，不要有人`;
    const snapshotWithOriginal = buildExperienceSnapshot({ ...snapshotInputs, query: visibleQuery, unrecordedPlatePolicy: true });
    assert.equal(snapshotWithOriginal.query, visibleQuery);
    assert.equal(snapshotWithOriginal.presentationQuery, `我想看６幅${publicWording}，不要有人`);
    assert.equal(snapshotWithOriginal.exhibitionId, snapshot.exhibitionId);
    assert.deepEqual(snapshot.units.map(unit => unit.artwork.id), record.assignments.map(item => item.artworkId));
    const ids = saved.assignments.map(item => item.artworkId);
    const outputs = [{ kind: "preface" as const, text: `从${internalWording}里看线条。`, evidenceIds: [ids[0]] },
      ...ids.map(artworkId => ({ kind: "note" as const, artworkId, text: `细看${internalWording}。`, evidenceIds: [artworkId] })),
      { kind: "closing" as const, text: `回到${internalWording}的线条。`, evidenceIds: [ids.at(-1)] }];
    const atLimit = new Set([0, 2, outputs.length - 1]);
    for (const index of atLimit) {
      const output = outputs[index]!;
      output.text = output.text.replace("。", "，" + "墨".repeat(NARRATIVE_TEXT_LIMITS[output.kind] - Array.from(output.text).length - 1) + "。");
    }
    const intendedTexts = outputs.map((output, index) => output.text.replace(internalWording, atLimit.has(index) ? compactWording : publicWording));
    const prompts: string[] = [];
    let now = Date.now();
    const first = getExhibitionNarrative(catalog, saved, { now: () => now, stream: async function* (messages) {
      prompts.push(messages[1]!.content);
      const invalid = { ...outputs[1], text: "你已经痊愈了。 " };
      yield [outputs[0], invalid, ...outputs.slice(2)].map(output => JSON.stringify(output)).join("\n");
    } });
    await first.complete;
    assert.equal(first.pieces[1]!.source, "fallback");
    assert.equal(first.pieces.filter(piece => piece.source === "grounded").length, 7);
    now += 60_001;
    const repair = getExhibitionNarrative(catalog, saved, { now: () => now, stream: async function* (messages) {
      prompts.push(messages[1]!.content);
      yield JSON.stringify(outputs[1]);
    } });
    await repair.complete;
    assert.equal(prompts.length, 2);
    for (const prompt of prompts) {
      assert.ok(prompt.includes(`user_request="我想看六幅${publicWording}"`));
      assert.ok(prompt.includes(`"desiredExperience":"比较${publicWording}"`));
      assert.ok(prompt.includes(`${publicWording}的线条`));
      assert.doesNotMatch(prompt, /版材未注明的蚀刻/u);
      assert.ok(ids.every(artworkId => prompt.includes(artworkId)));
    }
    assert.match(prompts[1]!, /prior_rejections=/u);
    assert.deepEqual(repair.pieces.map(piece => piece.evidenceIds), outputs.map(piece => piece.evidenceIds));
    assert.ok(repair.pieces.every(piece => piece.source === "grounded" && Array.from(piece.text).length <= NARRATIVE_TEXT_LIMITS[piece.kind]));
    assert.deepEqual(repair.pieces.map(piece => piece.text), intendedTexts);
    const cachePath = path.join(state, readdirSync(state).find(name => name.includes(".narrative-v5-"))!);
    const cleanCache = readFileSync(cachePath, "utf8");
    for (const old of [false, true]) {
      if (old) writeFileSync(cachePath, cleanCache.replaceAll(publicWording, internalWording).replaceAll(compactWording, internalWording));
      const cached = getExhibitionNarrative(catalog, saved, { stream: async function* () { assert.fail("a complete guide cannot call the provider"); } });
      await cached.complete;
      assert.ok(cached.pieces.every(piece => piece.source === "grounded"));
      assert.deepEqual(cached.pieces.map(piece => piece.text), intendedTexts);
      assert.deepEqual(readNarrativePieces(catalog, saved)?.map(piece => piece.text), intendedTexts);
      assert.equal(curationNarrativeView(catalog, saved).narrative.closing, intendedTexts.at(-1));
    }
    assert.equal(readFileSync(recordPath, "utf8"), JSON.stringify(record));
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test("alternate endings for the ball and red room use only their own image review", () => {
  const temporary = mkdtempSync(path.join(os.tmpdir(), "artduo-ending-observation-"));
  try {
    const source = loadWebReleaseCatalog({ rootDir: path.resolve(__dirname, "../../../.."), releaseVersion: "2026-11-19-open-gap-739" });
    const catalog = { ...source, releaseDir: path.join(temporary, "data/releases/2026-11-19-open-gap-739") };
    const ids = ["met-436927", "smk-KMS8654"];
    const query = "挑两件作品", plan = fallbackCurationIntent(catalog, query);
    const assignments = ids.map((artworkId, stageIndex) => ({ artworkId, stageIndex, score: .8, vectorScore: .7, evidence: [] }));
    const selection = materializeCurationSelection(catalog, query, plan, assignments, "fixture", 1);
    const fixture: CuratedExhibition = { ...selection, curationId: "f".repeat(64), record: {
      schemaVersion: 1, recipeVersion: CURATION_RECIPE_VERSION, releaseVersion: catalog.releaseVersion, query, plan,
      assignments, selectionVersion: 20, retrievalModel: selection.search.model, dimensions: selection.search.dimensions,
      intentModel: "fixture", indexChecksum: "fixture", degraded: [],
    } };
    const observations = curationNarrativeView(catalog, fixture).closingObservations;
    assert.deepEqual(observations.map(ending => ending.artworkId), ids);
    for (const ending of observations) {
      const reviewed = catalog.artworkById.get(ending.artworkId)!.visualEvidence!.observation;
      assert.ok(reviewed.includes(ending.text.replace(/。$/u, "")));
    }
    const unavailable = { ...fixture, search: { ...fixture.search, results: fixture.search.results.map((result, index) => index ? result :
      { ...result, artwork: { ...result.artwork, visualEvidence: undefined, description: "观察材料未核实。" } }) } };
    assert.deepEqual(curationNarrativeView(catalog, unavailable).closingObservations.map(ending => ending.artworkId), [ids[1]]);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

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
    const failedFilename = readdirSync(curationDirectory(temporary)).find(file => file.includes("narrative-v5"))!;
    const failedPath = path.join(curationDirectory(temporary), failedFilename);
    const oldFallback = JSON.parse(readFileSync(failedPath, "utf8"));
    oldFallback.pieces[0].text = "当前预览未见可辨认人物，不足以确认是否为船。";
    writeFileSync(failedPath, JSON.stringify(oldFallback));
    const replayed = curationNarrativeView(catalog, curation);
    assert.equal(replayed.pieces[0]!.text, fallbackExhibitionNarrative(exhibitionNarrativeInput(catalog, curation))[0]!.text);
    assert.doesNotMatch(replayed.pieces[0]!.text, /当前预览|不足以确认/u, "cached failure text is selected again without another model request");
    assert.equal(unexpectedRequests, 0);
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
