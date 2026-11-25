import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { LOCAL_SEMANTIC_MODEL } from "@artduo/corpus/src/semantic-index";
import { loadSemanticIndex } from "@artduo/corpus/src/semantic-loader";
import { buildSemanticObservationIndex } from "@artduo/corpus/src/semantic-observation-index";
import { loadWebReleaseCatalog } from "../../lib/release-catalog";
import { curateExhibition, readSavedCuration } from "../../lib/semantic-curator";
import { fallbackCurationIntent } from "../../lib/semantic-selection";
import { museumSemanticDocuments, OBSERVATION_SIDECAR_NAME, observationReleaseInput, runtimeObservationIndex } from "../../lib/semantic-observation-release";

test("the optional verified sidecar isolates query and archive identity and reloads only on file changes", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "artduo-observation-runtime-"));
  try {
    const original = loadWebReleaseCatalog({ releaseVersion: "2026-11-19-open-gap-739" });
    const releaseDir = path.join(root, "release");
    mkdirSync(releaseDir);
    for (const name of ["visual-reviews.json", "public-media-manifest.json"]) copyFileSync(path.join(original.releaseDir, name), path.join(releaseDir, name));
    const catalog = { ...original, releaseDir };
    const sidecar = path.join(releaseDir, OBSERVATION_SIDECAR_NAME);
    const index = loadSemanticIndex({ manifestPath: catalog.manifestPath, manifest: catalog.manifest, artworks: museumSemanticDocuments(catalog) })!;
    const vector = [1, ...Array(383).fill(0)];
    const output = await buildSemanticObservationIndex(observationReleaseInput(catalog, index),
      { model: LOCAL_SEMANTIC_MODEL, embedDocuments: async texts => texts.map(() => vector) });
    const query = "想看一幅作品";
    const plan = fallbackCurationIntent(catalog, query);
    let intents = 0;
    const encoder = { model: LOCAL_SEMANTIC_MODEL, async dispose() {}, async embedDocuments() { return []; },
      async embedQueries(texts: string[]) { return texts.map(() => vector); } };
    const input = { catalog, query, rootDir: root, encoder, intentModel: "observation-runtime-fixture",
      stream: async function* (messages: Array<{ content: string }>) {
        if (!messages[0]!.content.includes("选画编辑")) { intents++; yield JSON.stringify(plan); return; }
        const id = /^  候选 .*?"id":"([^"]+)"/mu.exec(messages[1]!.content)?.[1];
        yield JSON.stringify({ stages: [{ stage: 0, artworkIds: [id] }] });
      } };
    assert.equal(runtimeObservationIndex(catalog), undefined);
    const baseline = await curateExhibition(input);
    assert.equal(baseline.record.selectionVersion, 24);
    assert.deepEqual(baseline.record.degraded, []);
    assert.equal(baseline.record.observationChecksum, undefined);
    writeFileSync(sidecar, JSON.stringify(output));
    const loaded = runtimeObservationIndex(catalog)!;
    assert.equal(loaded.checksum, output.checksum);
    assert.equal(runtimeObservationIndex(catalog), loaded);
    const paired = await curateExhibition(input);
    assert.equal(paired.record.selectionVersion, 25);
    assert.equal(paired.record.observationChecksum, output.checksum);
    assert.deepEqual(paired.record.degraded, []);
    assert.notEqual(paired.curationId, baseline.curationId);
    assert.equal((await curateExhibition(input)).curationId, paired.curationId);
    assert.equal(intents, 2);
    writeFileSync(sidecar, JSON.stringify({ ...output, checksum: "f".repeat(64) }));
    assert.equal(runtimeObservationIndex(catalog), undefined);
    assert.equal((await curateExhibition(input)).curationId, baseline.curationId);
    assert.equal(intents, 2);
    assert.deepEqual(readSavedCuration(catalog, paired.curationId, query, root).assignments, paired.assignments);
    writeFileSync(sidecar, JSON.stringify(output));
    const invalid = { ...input, query: "想看一幅作品，慢一点", stream: async function* (messages: Array<{ content: string }>) {
      if (!messages[0]!.content.includes("选画编辑")) { intents++; yield JSON.stringify(plan); return; }
      yield "{}";
    } };
    const degradedInput = { ...invalid, encoder: { ...encoder, embedQueries: async () => { throw new Error("Local encoder fixture unavailable"); } } };
    const hashFallback = await curateExhibition(degradedInput);
    assert.equal(hashFallback.record.selectionVersion, 24);
    assert.equal(hashFallback.record.observationChecksum, undefined);
    assert.equal(hashFallback.record.retrievalModel, "local-hash-embedding-v1");
    assert.deepEqual(hashFallback.record.degraded, ["semantic-unavailable", "stage-choice-invalid"]);
    await curateExhibition(degradedInput);
    assert.equal(intents, 4);
    const observedFirst = await curateExhibition(invalid);
    const observedSecond = await curateExhibition(invalid);
    assert.equal(observedFirst.record.selectionVersion, 25);
    assert.equal(observedSecond.record.observationChecksum, output.checksum);
    assert.equal(intents, 6, "the two hash fallbacks did not cool down the observation key");
    assert.equal((await curateExhibition(invalid)).curationId, observedSecond.curationId);
    assert.equal(intents, 6);
    rmSync(sidecar);
    const museumFirst = await curateExhibition(invalid);
    assert.equal(museumFirst.record.selectionVersion, 24);
    const museumSecond = await curateExhibition(invalid);
    assert.equal(intents, 8, "the museum query has its own cooldown");
    assert.equal((await curateExhibition(invalid)).curationId, museumSecond.curationId);
    writeFileSync(sidecar, JSON.stringify(output));
    assert.equal((await curateExhibition(invalid)).curationId, observedSecond.curationId);
    assert.equal(intents, 8);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
