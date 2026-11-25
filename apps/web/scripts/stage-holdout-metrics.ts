export const CUTOFFS = [1, 3, 6] as const;
export type HoldoutLabel = "positive" | "negative" | "unknown";
export interface HoldoutStage {
  caseId: string;
  stratum: string;
  stageIndex: number;
  requested: boolean;
  reference: Array<{ artworkId: string; label: HoldoutLabel }>;
  pool: string[];
  allowed: ReadonlySet<string>;
}

const ratio = (n: number, d: number) => d ? Number((n / d).toFixed(6)) : null;

function evaluate(stage: HoldoutStage) {
  const reference = new Map(stage.reference.map(row => [row.artworkId, row.label]));
  const positives = [...reference].filter(([, label]) => label === "positive").map(([id]) => id);
  const negative = [...reference.values()].filter(label => label === "negative").length;
  const unknown = [...reference.values()].filter(label => label === "unknown").length;
  const pool = [...new Set(stage.pool)];
  return {
    caseId: stage.caseId, stratum: stage.stratum, stageIndex: stage.stageIndex, requested: stage.requested,
    reference: { positive: positives.length, negative, unknown, hardEligiblePositive: positives.filter(id => stage.allowed.has(id)).length },
    pool,
    cutoffs: CUTOFFS.map(k => {
      const top = pool.slice(0, k);
      const hits = { positive: 0, negative: 0, unknown: 0, unlisted: 0 };
      for (const id of top) hits[reference.get(id) ?? "unlisted"]++;
      const judged = hits.positive + hits.negative;
      return {
        k, retrieved: top.length, short: top.length < k, ...hits,
        recall: { numerator: hits.positive, denominator: positives.length, value: ratio(hits.positive, positives.length) },
        judgedCoverage: { numerator: judged, denominator: top.length, value: ratio(judged, top.length) },
        judgedError: { numerator: hits.negative, denominator: judged, value: ratio(hits.negative, judged) },
      };
    }),
  };
}

type Evaluation = ReturnType<typeof evaluate>;
function aggregate(stages: Evaluation[]) {
  return {
    stages: stages.length,
    zeroPositiveStages: stages.filter(stage => stage.reference.positive === 0).length,
    emptyPools: stages.filter(stage => stage.pool.length === 0).length,
    activePools: stages.filter(stage => stage.pool.length > 0).length,
    activePoolsWithPositive: stages.filter(stage => stage.pool.length > 0 && stage.reference.positive > 0).length,
    reference: stages.reduce((sum, { reference }) => ({
      positive: sum.positive + reference.positive, negative: sum.negative + reference.negative,
      unknown: sum.unknown + reference.unknown, hardEligiblePositive: sum.hardEligiblePositive + reference.hardEligiblePositive,
    }), { positive: 0, negative: 0, unknown: 0, hardEligiblePositive: 0 }),
    cutoffs: CUTOFFS.map((k, index) => {
      const rows = stages.map(stage => stage.cutoffs[index]!);
      const sum = (field: "positive" | "negative" | "unknown" | "unlisted" | "retrieved") =>
        rows.reduce((total, row) => total + row[field], 0);
      const withPositive = rows.filter(row => row.recall.denominator > 0);
      const recallDenominator = rows.reduce((total, row) => total + row.recall.denominator, 0);
      const positive = sum("positive"), negative = sum("negative"), retrieved = sum("retrieved");
      const judged = positive + negative;
      return {
        k, shortPools: rows.filter(row => row.short).length,
        retrieved, positive, negative, unknown: sum("unknown"), unlisted: sum("unlisted"),
        macroRecall: { stages: withPositive.length, value: ratio(withPositive.reduce((total, row) => total + row.recall.numerator / row.recall.denominator, 0), withPositive.length) },
        microRecall: { numerator: positive, denominator: recallDenominator, value: ratio(positive, recallDenominator) },
        judgedCoverage: { numerator: judged, denominator: retrieved, value: ratio(judged, retrieved) },
        judgedError: { numerator: negative, denominator: judged, value: ratio(negative, judged) },
      };
    }),
  };
}

/** Unknown observations and works outside the reference never count as judged negatives. */
export function measureStageHoldout(input: HoldoutStage[]) {
  const stages = input.map(evaluate);
  const requested = stages.filter(stage => stage.requested);
  const strata = [...new Set(requested.map(stage => stage.stratum))];
  return {
    allPlannedStages: aggregate(stages),
    requestedStages: aggregate(requested),
    intentionallyUnusedStages: stages.filter(stage => !stage.requested).map(({ caseId, stageIndex, pool }) => ({ caseId, stageIndex, poolSize: pool.length })),
    byStratum: Object.fromEntries(strata.map(stratum => [stratum, aggregate(requested.filter(stage => stage.stratum === stratum))])),
    stages,
  };
}
