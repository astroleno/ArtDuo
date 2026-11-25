import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { HOLDOUT_FIXTURE, HOLDOUT_SHA256, readHoldoutFixture } from "../../scripts/stage-holdout-fixture";
import { measureStageHoldout, type HoldoutStage } from "../../scripts/stage-holdout-metrics";

const fixtures = path.join(__dirname, "../fixtures");

test("the held-out fixture is locked with thirty distinct requests and independently staged labels", () => {
  const bytes = readFileSync(path.join(fixtures, HOLDOUT_FIXTURE));
  const holdout = readHoldoutFixture(bytes);
  assert.equal(holdout.sha256, HOLDOUT_SHA256);
  assert.equal(holdout.cases.length, 30);
  assert.equal(holdout.cases.flatMap(entry => entry.samples).length, 240);
  assert.equal(new Set(holdout.cases.map(entry => entry.stratum)).size, 6);
  assert.ok([1, 2, 3, 6].every(count => holdout.cases.some(entry => entry.plan.artworkCount === count)));
  const labels = holdout.cases.flatMap(entry => entry.samples.map(sample => sample.label));
  assert.deepEqual(["positive", "negative", "unknown"].map(label => labels.filter(value => value === label).length), [83, 68, 89]);
  assert.throws(() => readHoldoutFixture(Buffer.concat([bytes, Buffer.from(" ")])), /preregistered fingerprint/u);
});

const stage = (input: Partial<HoldoutStage> = {}): HoldoutStage => ({
  caseId: "case", stratum: "subject", stageIndex: 0, requested: true, pool: [], reference: [], allowed: new Set(), ...input,
});
const positive = (artworkId: string) => ({ artworkId, label: "positive" as const });
const negative = (artworkId: string) => ({ artworkId, label: "negative" as const });
const unknown = (artworkId: string) => ({ artworkId, label: "unknown" as const });

test("holdout cutoffs retain actual rank, separate missing judgments and expose recall and error denominators", () => {
  const results = measureStageHoldout([
    stage({ reference: [positive("a"), positive("b"), unknown("u")], pool: ["a", "u", "other"], allowed: new Set(["a"]) }),
    stage({ stageIndex: 1, reference: [negative("n"), positive("c")], pool: ["n", "c"] }),
    stage({ stageIndex: 2, reference: [negative("k")], pool: ["k"] }),
    stage({ caseId: "short", stageIndex: 1, requested: false, reference: [positive("p")] }),
  ]);
  const atOne = results.requestedStages.cutoffs[0]!, atThree = results.requestedStages.cutoffs[1]!;
  assert.deepEqual(atOne.microRecall, { numerator: 1, denominator: 3, value: .333333 });
  assert.deepEqual(atThree.microRecall, { numerator: 2, denominator: 3, value: .666667 });
  assert.deepEqual(atThree.macroRecall, { stages: 2, value: .75 });
  assert.deepEqual(atThree.judgedCoverage, { numerator: 4, denominator: 6, value: .666667 });
  assert.deepEqual(atThree.judgedError, { numerator: 2, denominator: 4, value: .5 });
  assert.equal(atThree.unknown, 1);
  assert.equal(atThree.unlisted, 1);
  assert.equal(atThree.shortPools, 2);
  assert.equal(results.requestedStages.zeroPositiveStages, 1);
  assert.equal(results.requestedStages.reference.hardEligiblePositive, 1);
  assert.equal(results.allPlannedStages.cutoffs[1]!.microRecall.denominator, 4);
  assert.equal(results.allPlannedStages.emptyPools, 1);
  assert.equal(results.stages[2]!.cutoffs[0]!.recall.value, null);
  assert.equal(results.stages[3]!.cutoffs[0]!.judgedError.value, null);
});
