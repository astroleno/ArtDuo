import type { CurationIntentPlan } from "@artduo/contracts";
import { hasExplicitArtworkOrder } from "../lib/afterglow-selection";

const axes = ["valence", "arousal", "tension", "wonder", "intimacy"] as const;
type Affect = Pick<CurationIntentPlan["stages"][number], (typeof axes)[number]>;
const EPSILON = 1e-9;
const MIN_GAIN = .02;

function compareEdges(from: Affect, to: Affect, fromStage: Affect, toStage: Affect) {
  const delta = to.arousal - from.arousal;
  return {
    direction: Math.abs(delta) <= EPSILON ? 0 : Math.sign(delta),
    error: axes.reduce((sum, axis) => sum + Math.abs((to[axis] - from[axis]) - (toStage[axis] - fromStage[axis])), 0) / axes.length,
  };
}

/** The optional offline sequencing study uses rule readings only. */
export function tryStageOrder<T extends { artworkId: string; stageIndex: number }>(input: {
  query: string;
  plan: CurationIntentPlan;
  assignments: T[];
  ruleReading: (artworkId: string) => Affect | undefined;
  modelOrdered: boolean;
}) {
  const { query, plan, assignments, ruleReading, modelOrdered } = input;
  if (modelOrdered || hasExplicitArtworkOrder(query) || /《[^》]+》/u.test(query)) {
    return { assignments, considered: 0, improved: 0, protectedOrder: true };
  }
  let considered = 0, improved = 0;
  let best: { index: number; gain: number } | undefined;
  for (let index = 1; index < assignments.length - 2; index++) {
    const left = assignments[index - 1]!, first = assignments[index]!, second = assignments[index + 1]!, right = assignments[index + 2]!;
    if (first.stageIndex !== second.stageIndex) continue;
    considered++;
    const before = ruleReading(left.artworkId), a = ruleReading(first.artworkId), b = ruleReading(second.artworkId), after = ruleReading(right.artworkId);
    const leftTarget = plan.stages[left.stageIndex], target = plan.stages[first.stageIndex], rightTarget = plan.stages[right.stageIndex];
    if (!before || !a || !b || !after || !leftTarget || !target || !rightTarget) continue;
    const oldLeft = compareEdges(before, a, leftTarget, target), nextLeft = compareEdges(before, b, leftTarget, target);
    const oldRight = compareEdges(b, after, target, rightTarget), nextRight = compareEdges(a, after, target, rightTarget);
    if (nextLeft.error > oldLeft.error + EPSILON || nextRight.error > oldRight.error + EPSILON
      || left.stageIndex !== first.stageIndex && oldLeft.direction !== nextLeft.direction
      || second.stageIndex !== right.stageIndex && oldRight.direction !== nextRight.direction) continue;
    const gain = oldLeft.error + oldRight.error - nextLeft.error - nextRight.error;
    if (gain + EPSILON < MIN_GAIN) continue;
    improved++;
    if (!best || gain > best.gain + EPSILON) best = { index, gain };
  }
  if (!best) return { assignments, considered, improved, protectedOrder: false };
  const { index, gain } = best;
  const swapped = [...assignments];
  [swapped[index], swapped[index + 1]] = [swapped[index + 1]!, swapped[index]!];
  return { assignments: swapped, considered, improved, protectedOrder: false, swap: { index, gain,
    before: [assignments[index]!.artworkId, assignments[index + 1]!.artworkId] } };
}
