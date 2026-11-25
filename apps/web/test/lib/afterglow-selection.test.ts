import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { parseCurationIntentPlan } from "@artduo/contracts";
import { LOCAL_SEMANTIC_MODEL, semanticFingerprint } from "@artduo/corpus/src/semantic-index";
import { refineAfterglow } from "../../lib/afterglow-selection";
import { artworkOffering, stageFit } from "../../lib/artwork-offering";
import { loadWebReleaseCatalog, type WebArtwork } from "../../lib/release-catalog";
import { curateExhibition, curationDirectory, readSavedCuration } from "../../lib/semantic-curator";
import { selectForCurationStages } from "../../lib/semantic-selection";

const rootDir = path.resolve(__dirname, "../../../..");
const catalog = loadWebReleaseCatalog({ rootDir, releaseVersion: "2026-11-19-open-gap-739" });
const plans = JSON.parse(readFileSync(path.join(__dirname, "../fixtures/stage-fit-plans.json"), "utf8"));
const query = Object.keys(plans).find(value => value.includes("offer"))!;
const plan = parseCurationIntentPlan(plans[query]);
const seed = selectForCurationStages({ catalog, query, plan });
const args = { catalog, query, plan, assignments: seed.assignments, pools: seed.stagePools! };
const bridge = "met-436927", original = "smk-KMS8654", alternative = "smk-KMS3827";
const originalWork = catalog.artworkById.get(original)!;
const alternativeWork = catalog.artworkById.get(alternative)!;
const stageIndex = plan.stages.length - 1;
const shortlist = args.pools[stageIndex]!;

test("the actual offer alternative improves all three required comparisons while arousal rises", () => {
  assert.equal(args.assignments.length, 6);
  assert.equal(shortlist.length, 6);
  assert.deepEqual(args.assignments.slice(-2).map(item => item.artworkId), [bridge, original]);
  const refined = refineAfterglow(args)!;
  assert.deepEqual(refined.slice(0, -1), args.assignments.slice(0, -1));
  assert.equal(refined.at(-1)?.artworkId, alternative);
  assert.equal(refined.at(-1)?.stageIndex, stageIndex);
  assert.ok(refined.at(-1)?.evidence.includes("rule:afterglow-fit"));
  const start = artworkOffering(originalWork), next = artworkOffering(alternativeWork);
  const previous = artworkOffering(catalog.artworkById.get(bridge)!);
  const target = plan.stages[stageIndex]!;
  assert.ok(next.arousal > start.arousal);
  assert.ok(Math.abs(start.arousal - target.arousal) - Math.abs(next.arousal - target.arousal) >= .04);
  assert.ok(stageFit(next, target) - stageFit(start, target) >= .07);
  assert.ok(stageFit(previous, next) - stageFit(previous, start) >= -.05);
});

test("constraints, material, attribution, evidence and a fixed shortlist can leave the original ending intact", () => {
  for (const requested of ["请只看安娜的作品《The Artist's Mother Ane Hedvig Brøndum in the Red Room》", "观看顺序不要改", "只比较几张画的构图", "Ancher, Anna", "想看 Ancher, Anna 的作品"]) {
    assert.equal(refineAfterglow({ ...args, query: requested }), undefined, requested);
  }
  for (const requested of ["先看室外，再看室内", "请按创作年代排列", "按画幅从大到小排序", "show the outdoor paintings before the interiors",
    "show the outdoor paintings after the interiors", "arrange these works by year", "我想看 Anna Ancher 的画"]) {
    assert.equal(refineAfterglow({ ...args, query: requested }), undefined, requested);
  }
  assert.equal(refineAfterglow({ ...args, query: "先难过，再留点希望" })?.at(-1)?.artworkId, alternative);
  const replaceWork = (work: WebArtwork) => ({ ...catalog, artworkById: new Map(catalog.artworkById).set(work.id, work) });
  const revise = (patch: Partial<WebArtwork>) => refineAfterglow({ ...args, catalog: replaceWork({ ...alternativeWork, ...patch }) });
  assert.equal(refineAfterglow({ ...args, assignments: args.assignments.slice(-3) }), undefined);
  assert.equal(refineAfterglow({ ...args, assignments: args.assignments.filter(item => item.artworkId !== bridge) }), undefined);
  assert.equal(revise({ visualEvidence: { ...alternativeWork.visualEvidence!, imagePath: "/different-image" } }), undefined);
  assert.equal(revise({ visualEvidence: { ...alternativeWork.visualEvidence!, spatialFraming: "open" } }), undefined);
  assert.equal(revise({ visualEvidenceUnavailable: true }), undefined);
  assert.equal(revise({ medium: "Watercolor on paper" }), undefined);
  assert.equal(revise({ artistDisplayName: "Anonymous" }), undefined);
  assert.equal(revise({ artistDisplayName: "Attributed to Ancher, Anna" }), undefined);
  assert.equal(revise({ artistDisplayName: undefined, department: "Danish Art" }), undefined);
  assert.equal(revise({ ...originalWork, id: alternative, visualEvidence: alternativeWork.visualEvidence, imageUrl: alternativeWork.imageUrl }), undefined);
  assert.equal(refineAfterglow({ ...args, catalog: replaceWork({ ...originalWork, visualEvidence: undefined }) }), undefined);
  assert.equal(refineAfterglow({ ...args, catalog: replaceWork({ ...originalWork, id: bridge }) }), undefined, "a worse connection to the actual previous work cannot win");
  const withShortlist = (last: typeof shortlist) => refineAfterglow({ ...args, pools: args.pools.map((pool, index) => index === stageIndex ? last : pool) });
  assert.equal(withShortlist(shortlist.filter(candidate => candidate.artworkId !== alternative)), undefined);
  assert.equal(withShortlist([...shortlist, { ...shortlist.at(-1)!, artworkId: "outside-cap" }]), undefined);
  assert.equal(withShortlist(shortlist.map(row => row.artworkId !== alternative ? row : { ...row, score: args.assignments.at(-1)!.score - .051 })), undefined);
  assert.equal(withShortlist(shortlist.map(row => row.artworkId !== alternative ? row : { ...row, evidence: ["stage-space:open"] })), undefined);
});

test("a rule fallback and an accepted model each refine only the selected route once; v20 stays frozen", async () => {
  for (const mode of ["rules", "model"] as const) {
    const temporary = mkdtempSync(path.join(os.tmpdir(), "artduo-afterglow-"));
    try {
      const rows = plan.stages.map((_, stage) => ({ stage, artworkIds: args.assignments.filter(item => item.stageIndex === stage).map(item => item.artworkId) }));
      // The validated model is free to order the earlier two-work stage.
      if (mode === "model") rows[stageIndex - 1]!.artworkIds.reverse();
      let calls = 0;
      const result = await curateExhibition({ catalog, query, rootDir: temporary, intentModel: "fixture",
        encoder: { model: LOCAL_SEMANTIC_MODEL, async warmup() { throw new Error("use the local hash fixture"); },
          async embedQueries() { throw new Error("unexpected semantic queries"); }, async embedDocuments() { return []; }, async dispose() {} },
        stream: async function* (messages) {
          if (!messages[0]!.content.includes("选画编辑")) { yield JSON.stringify(plan); return; }
          calls++;
          yield JSON.stringify(mode === "model" ? { stages: rows } : {});
        },
      });
      assert.equal(calls, 1);
      assert.equal(result.record.selectionVersion, 21);
      assert.deepEqual(result.assignments.map(item => item.artworkId), [...rows.flatMap(row => row.artworkIds).slice(0, -1), alternative]);
      assert.equal(result.assignments[0]!.evidence.includes("model:stage-fit"), mode === "model");
      assert.equal(result.assignments.filter(item => item.evidence.includes("rule:afterglow-fit")).length, 1);
      assert.deepEqual(readSavedCuration(catalog, result.curationId, result.record.query, temporary).assignments, result.assignments);

      const record = { ...result.record, assignments: seed.assignments, selectionVersion: 20 };
      const oldId = semanticFingerprint(JSON.stringify(record));
      writeFileSync(path.join(curationDirectory(temporary), `${oldId}.json`), JSON.stringify(record));
      assert.deepEqual(readSavedCuration(catalog, oldId, result.record.query, temporary).assignments, seed.assignments);
      assert.equal(calls, 1);
    } finally { rmSync(temporary, { recursive: true, force: true }); }
  }
});
