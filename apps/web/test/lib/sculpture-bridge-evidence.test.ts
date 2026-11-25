import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { parseCurationIntentPlan, type CurationIntentPlan } from "@artduo/contracts";
import { planSculptureEncounter } from "../../../../packages/ui/src/experience/sculpture-encounter";
import { buildCurationNarrative } from "../../lib/curation-narrative";
import { buildExperienceSnapshot } from "../../lib/experience-adapter";
import { loadWebReleaseCatalog } from "../../lib/release-catalog";
import { sculptureBridgeThemes } from "../../lib/sculpture-bridge-evidence";
import { getSculptureCollection } from "../../lib/sculpture-catalog";
import { fallbackCurationIntent, materializeCurationSelection } from "../../lib/semantic-selection";

const rootDir = path.resolve(__dirname, "../../../..");
const catalog = loadWebReleaseCatalog({ rootDir, releaseVersion: "2026-11-19-open-gap-739" });
const collection = getSculptureCollection({ rootDir, mode: "local" });
const keyboard = "smithsonian_asian-fsg_F1917.234a-b", musicians = "cma-314436";

function buildRoute(query: string, plan: CurationIntentPlan, ids: string[], stages: number[]) {
  const assignments = ids.map((artworkId, index) => ({ artworkId, stageIndex: stages[index]!, vectorScore: .8, score: .9, evidence: [] }));
  const { search, growthForm } = materializeCurationSelection(catalog, query, plan, assignments, "fixture", 1);
  return buildExperienceSnapshot({ catalog, query, search, narrative: { ...buildCurationNarrative(search), growthForm }, route: [],
    curationId: "fixture", selectionVersion: 21 });
}

test("the real keyboard and performance observations alone bind the adjacent decision to Beethoven", () => {
  const query = "想看六件作品";
  const plan = fallbackCurationIntent(catalog, query);
  plan.stages[1] = { ...plan.stages[1]!, arousal: .55 };
  const snapshot = buildRoute(query, plan, ["cma-164466", keyboard, musicians, "artic-71573"], [0, 0, 1, 1]);
  assert.ok(snapshot.units[1]!.sculptureBridgeThemes?.includes("music"));
  assert.ok(snapshot.units[2]!.sculptureBridgeThemes?.includes("music"));
  assert.equal("visualEvidence" in snapshot.units[1]!, false);
  assert.equal("visualEvidence" in snapshot.units[1]!.artwork, false);
  const decision = planSculptureEncounter(snapshot, collection.works, collection.scenes, { roll: 0, selection: .5 });
  assert.deepEqual([decision.status, decision.anchorArtworkId, decision.nextArtworkId, decision.modelId], ["pending", keyboard, musicians, "beethoven"]);
});

test("negation, uncertainty, generic portraits, titles and unbound reviews do not supply a theme", () => {
  const work = catalog.artworkById.get(keyboard)!;
  for (const observation of ["未见乐师演奏，键盘乐器也无法辨认。", "没有小提琴和衣褶。", "疑似衣褶。", "未看到衣纹。",
    "不见小提琴。", "画面无钢琴。", "并非弦乐器。", "未画出手鼓。",
    "A portrait of a person. No clear evidence of a violin, or folds in the cloth.", "坐姿人物凝视画外。"]) {
    assert.deepEqual(sculptureBridgeThemes({ ...work, title: "Music, piano and drapery", moodTags: ["music", "drapery"],
      visualEvidence: { ...work.visualEvidence!, observation } }), [], observation);
  }
  assert.deepEqual(sculptureBridgeThemes({ ...work, visualEvidence: { ...work.visualEvidence!, imagePath: "other-source" } }), []);
  assert.deepEqual(sculptureBridgeThemes({ ...work, visualEvidence: { ...work.visualEvidence!, observation: "袍袖下的衣褶向下聚合。" } }), ["drapery"]);
});

test("the original and refined six-work offer routes have no eligible side hall", () => {
  const fixtures = JSON.parse(readFileSync(path.join(__dirname, "../fixtures/stage-fit-plans.json"), "utf8"));
  const query = Object.keys(fixtures).find(value => value.includes("offer"))!;
  const plan = parseCurationIntentPlan(fixtures[query]);
  const ids = ["cma-164466", "cma-314236", "artic-97292", "artic-71573", "met-436927"];
  for (const last of ["smk-KMS8654", "smk-KMS3827"]) {
    const snapshot = buildRoute(query, plan, [...ids, last], [0, 1, 2, 2, 3, 3]);
    assert.equal(planSculptureEncounter(snapshot, collection.works, collection.scenes, { roll: 0, selection: 0 }).status, "absent");
  }
});
