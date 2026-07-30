import { createHash } from "node:crypto";

import { cosineSimilarity } from "@artduo/corpus";
import type { ImageEmbeddingShardRecord } from "@artduo/contracts";

export interface ImageEmbeddingEvaluationArtwork {
  id: string;
  department?: string;
  moodTags: string[];
  colorTags: string[];
  compositionTags: string[];
  subjectTags: string[];
  aspectRatioHint?: string;
  emotionLabels?: string[];
  sceneAffinity?: {
    paletteModes?: string[];
    sceneTypes?: string[];
  };
}

export interface ImageEmbeddingEvaluationScene {
  id: string;
  emotionIds: string[];
  artworkPaletteModes: string[];
  sceneType?: string;
  palette: string[];
}

export interface ImageEmbeddingWeakLabelEvaluationInput {
  releaseVersion: string;
  evaluationVersion: string;
  artworks: ImageEmbeddingEvaluationArtwork[];
  scenes: ImageEmbeddingEvaluationScene[];
  records: ImageEmbeddingShardRecord[];
}

interface ArtworkPair {
  leftId: string;
  rightId: string;
  label: "positive" | "negative";
}

const BOOTSTRAP_RESAMPLE_COUNT = 1_000;
const MINIMUM_HOLDOUT_ARTWORK_COUNT = 30;
const MINIMUM_STRATUM_ARTWORK_COUNT = 5;
const MINIMUM_MAJOR_STRATUM_ELIGIBLE_ARTWORK_COUNT = 14;

interface BootstrapConfidenceInterval {
  lower: number;
  upper: number;
  resampleCount: number;
}

interface PerStratumMetricBreakdown {
  stratum: string;
  uniqueArtworkCount: number;
  comparisonCount: number;
  pointEstimate: number;
  status: "ready" | "insufficient-sample";
}

interface MetricEvidence {
  confidenceInterval: BootstrapConfidenceInterval;
  perStrata: PerStratumMetricBreakdown[];
  majorStrata: PerStratumMetricBreakdown[];
}

interface SplitPairwiseMetricsBase {
  pairwiseAccuracy: number;
  positivePairCount: number;
  negativePairCount: number;
  uniqueArtworkCount: number;
  eligibleArtworkCount: number;
  availableArtworkVectorCount: number;
  missingArtworkVectorCount: number;
  candidateComparisonCount: number;
  unscoredComparisonCount: number;
  comparisonCount: number;
}

interface SplitPairwiseMetrics extends SplitPairwiseMetricsBase, MetricEvidence {}

interface ArtworkPairwiseObservation {
  artworkId: string;
  stratum: string;
  majorStrata: string[];
  comparisonCount: number;
  correctComparisonCount: number;
}

interface PairwiseMetricResult {
  metrics: SplitPairwiseMetricsBase;
  observations: ArtworkPairwiseObservation[];
}

interface SceneTop3MetricsBase {
  hitRate: number;
  hitCount: number;
  eligibleArtworkCount: number;
  evaluatedArtworkCount: number;
  missingArtworkVectorCount: number;
  missingPositiveSceneVectorCount: number;
}

interface SceneTop3Metrics extends SceneTop3MetricsBase, MetricEvidence {}

interface SceneTop3Observation {
  artworkId: string;
  stratum: string;
  majorStrata: string[];
  hitCount: number;
}

interface SceneTop3MetricResult {
  metrics: SceneTop3MetricsBase;
  observations: SceneTop3Observation[];
}

interface SceneVectorCoverage {
  eligibleSceneCount: number;
  availableSceneVectorCount: number;
  missingSceneVectorCount: number;
}

interface HoldoutMetricReadiness {
  uniqueArtworkCount: number;
  minimumArtworkCount: number;
  minimumSampleMet: boolean;
  allStrataSufficient: boolean;
  allMajorStrataSufficient: boolean;
}

export interface ImageEmbeddingWeakLabelEvaluation {
  labelSource: "structured-weak-label-v1";
  trainArtworkIds: string[];
  holdoutArtworkIds: string[];
  artworkPairwise: {
    train: SplitPairwiseMetrics;
    holdout: SplitPairwiseMetrics;
  };
  sceneTop3: {
    coverage: SceneVectorCoverage;
    train: SceneTop3Metrics;
    holdout: SceneTop3Metrics;
  };
  holdoutReadiness: {
    artworkPairwise: HoldoutMetricReadiness;
    sceneTop3: HoldoutMetricReadiness;
  };
}

export type HumanComparisonVerdict =
  | "left-better"
  | "right-better"
  | "tie"
  | "both-unacceptable"
  | "uncertain";

export type HumanAcceptability = "acceptable" | "unacceptable" | "uncertain";

export interface ImageEmbeddingReviewSceneOption {
  sceneId: string;
  score: number;
  fingerprint: string;
  imageUrl: string;
}

export interface ImageEmbeddingReviewComparisonInput {
  artworkId: string;
  stratum: string;
  mood: string;
  department: string;
  artworkCaption: string;
  artworkImageUrl: string;
  baseline: ImageEmbeddingReviewSceneOption;
  candidate: ImageEmbeddingReviewSceneOption;
}

export interface ImageEmbeddingMachineReviewComparison extends ImageEmbeddingReviewComparisonInput {
  reviewId: string;
  randomizationSeed: string;
}

export interface ImageEmbeddingReviewSamplingStratum {
  stratum: string;
  availableCount: number;
  targetCount: number;
  selectedCount: number;
  uncoveredReason?: "selection-capacity" | "marginal-quota-conflict";
}

export interface ImageEmbeddingReviewSampling {
  algorithm: "marginal-proportional-v1";
  requestedComparisonCount: number;
  selectedComparisonCount: number;
  moods: ImageEmbeddingReviewSamplingStratum[];
  departments: ImageEmbeddingReviewSamplingStratum[];
}

export interface ImageEmbeddingMachineReviewPack {
  schemaVersion: "image-embedding-review-pack.v2";
  releaseVersion: string;
  evaluationVersion: string;
  candidateShardChecksum: string;
  unchangedComparisonCount: number;
  sampling: ImageEmbeddingReviewSampling;
  comparisons: ImageEmbeddingMachineReviewComparison[];
  reviewPackChecksum: string;
}

export interface ImageEmbeddingReviewPackBuildResult {
  minimumSampleMet: boolean;
  pack: ImageEmbeddingMachineReviewPack;
}

export interface ImageEmbeddingReviewVerdict {
  reviewId: string;
  comparisonVerdict: HumanComparisonVerdict;
  leftAcceptability: HumanAcceptability;
  rightAcceptability: HumanAcceptability;
  reason: string;
}

export interface ImageEmbeddingReviewVerdictSidecar {
  reviewPackChecksum: string;
  verdicts: ImageEmbeddingReviewVerdict[];
}

export interface ImageEmbeddingHumanReviewEvaluation {
  valid: boolean;
  humanReviewComplete: boolean;
  reasons: string[];
  completedCount: number;
  requiredCount: number;
  uncertainCount: number;
  uncertainRate: number;
  candidateAcceptableCount: number;
  candidateAcceptableRate: number;
  candidateRegressionCount: number;
  candidateRegressionRate: number;
  candidateBetterCount: number;
  tieCount: number;
  baselineBetterCount: number;
  bothUnacceptableCount: number;
  reviewVerdictsChecksum?: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

interface MetricClusterObservation {
  artworkId: string;
  stratum: string;
  majorStrata: string[];
  numerator: number;
  denominator: number;
}

function roundMetric(value: number): number {
  return Number(value.toFixed(6));
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function createDeterministicRandom(seed: string): () => number {
  let state = Number.parseInt(sha256(seed).slice(0, 8), 16) >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) {
    return 0;
  }
  const index = Math.min(values.length - 1, Math.max(0, Math.floor((values.length - 1) * fraction)));
  return values[index] ?? 0;
}

function bootstrapConfidenceInterval(
  observations: MetricClusterObservation[],
  seed: string,
): BootstrapConfidenceInterval {
  if (observations.length === 0) {
    return { lower: 0, upper: 0, resampleCount: BOOTSTRAP_RESAMPLE_COUNT };
  }

  const random = createDeterministicRandom(seed);
  const samples: number[] = [];
  for (let sampleIndex = 0; sampleIndex < BOOTSTRAP_RESAMPLE_COUNT; sampleIndex += 1) {
    let numerator = 0;
    let denominator = 0;
    for (let clusterIndex = 0; clusterIndex < observations.length; clusterIndex += 1) {
      const observation = observations[Math.floor(random() * observations.length)];
      if (!observation) {
        continue;
      }
      numerator += observation.numerator;
      denominator += observation.denominator;
    }
    samples.push(ratio(numerator, denominator));
  }
  samples.sort((left, right) => left - right);

  return {
    lower: roundMetric(percentile(samples, 0.025)),
    upper: roundMetric(percentile(samples, 0.975)),
    resampleCount: BOOTSTRAP_RESAMPLE_COUNT,
  };
}

function metricBreakdown(
  observations: MetricClusterObservation[],
  expectedStrata: string[],
  includesStratum: (observation: MetricClusterObservation, stratum: string) => boolean,
): PerStratumMetricBreakdown[] {
  return expectedStrata.map((stratum) => {
    const inStratum = observations.filter((observation) => includesStratum(observation, stratum));
    const numerator = inStratum.reduce((total, observation) => total + observation.numerator, 0);
    const denominator = inStratum.reduce((total, observation) => total + observation.denominator, 0);
    const uniqueArtworkCount = new Set(inStratum.map((observation) => observation.artworkId)).size;

    return {
      stratum,
      uniqueArtworkCount,
      comparisonCount: denominator,
      pointEstimate: roundMetric(ratio(numerator, denominator)),
      status: uniqueArtworkCount >= MINIMUM_STRATUM_ARTWORK_COUNT
        ? "ready" as const
        : "insufficient-sample" as const,
    };
  });
}

function metricEvidence(
  observations: MetricClusterObservation[],
  expectedStrata: string[],
  expectedMajorStrata: string[],
  seed: string,
): MetricEvidence {
  return {
    confidenceInterval: bootstrapConfidenceInterval(observations, seed),
    perStrata: metricBreakdown(observations, expectedStrata, (observation, stratum) => observation.stratum === stratum),
    majorStrata: metricBreakdown(observations, expectedMajorStrata, (observation, stratum) => observation.majorStrata.includes(stratum)),
  };
}

function withMetricEvidence<T extends object>(
  metrics: T,
  observations: MetricClusterObservation[],
  expectedStrata: string[],
  expectedMajorStrata: string[],
  seed: string,
): T & MetricEvidence {
  return {
    ...metrics,
    ...metricEvidence(observations, expectedStrata, expectedMajorStrata, seed),
  };
}

function holdoutMetricReadiness(
  uniqueArtworkCount: number,
  perStrata: PerStratumMetricBreakdown[],
  majorStrata: PerStratumMetricBreakdown[],
): HoldoutMetricReadiness {
  return {
    uniqueArtworkCount,
    minimumArtworkCount: MINIMUM_HOLDOUT_ARTWORK_COUNT,
    minimumSampleMet: uniqueArtworkCount >= MINIMUM_HOLDOUT_ARTWORK_COUNT,
    allStrataSufficient: perStrata.length > 0 && perStrata.every((stratum) => stratum.status === "ready"),
    allMajorStrataSufficient: majorStrata.length > 0 && majorStrata.every((stratum) => stratum.status === "ready"),
  };
}

function sha256Checksum(value: string): `sha256:${string}` {
  return `sha256:${sha256(value)}`;
}

function canonicalJson(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical JSON does not permit non-finite numbers.");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
  }
  throw new TypeError("Canonical JSON only permits JSON values.");
}

function reviewComparisonSeed(input: {
  releaseVersion: string;
  evaluationVersion: string;
  artworkId: string;
  baseline: ImageEmbeddingReviewSceneOption;
  candidate: ImageEmbeddingReviewSceneOption;
}): string {
  return sha256Checksum(canonicalJson({
    releaseVersion: input.releaseVersion,
    evaluationVersion: input.evaluationVersion,
    artworkId: input.artworkId,
    baseline: {
      sceneId: input.baseline.sceneId,
      fingerprint: input.baseline.fingerprint,
    },
    candidate: {
      sceneId: input.candidate.sceneId,
      fingerprint: input.candidate.fingerprint,
    },
  }));
}

function reviewComparisonId(input: {
  releaseVersion: string;
  evaluationVersion: string;
  artworkId: string;
  baseline: ImageEmbeddingReviewSceneOption;
  candidate: ImageEmbeddingReviewSceneOption;
}): string {
  return `review-${sha256(canonicalJson({
    releaseVersion: input.releaseVersion,
    evaluationVersion: input.evaluationVersion,
    artworkId: input.artworkId,
    baselineSceneId: input.baseline.sceneId,
    candidateSceneId: input.candidate.sceneId,
  })).slice(0, 20)}`;
}

function reviewPackChecksumPayload(pack: Omit<ImageEmbeddingMachineReviewPack, "reviewPackChecksum">): string {
  return sha256Checksum(canonicalJson(pack));
}

export function calculateImageEmbeddingReviewPackChecksum(pack: ImageEmbeddingMachineReviewPack): string {
  const { reviewPackChecksum: _ignored, ...payload } = pack;
  return reviewPackChecksumPayload(payload);
}

function candidateAppearsOnLeft(comparison: ImageEmbeddingMachineReviewComparison): boolean {
  return Number.parseInt(sha256(comparison.randomizationSeed).slice(0, 2), 16) % 2 === 0;
}

function reviewPackComparisonOrder(
  left: ImageEmbeddingReviewComparisonInput,
  right: ImageEmbeddingReviewComparisonInput,
  releaseVersion: string,
  evaluationVersion: string,
): number {
  const leftKey = sha256(`${releaseVersion}${left.artworkId}${evaluationVersion}`);
  const rightKey = sha256(`${releaseVersion}${right.artworkId}${evaluationVersion}`);
  return leftKey.localeCompare(rightKey) || left.artworkId.localeCompare(right.artworkId);
}

function assertReviewComparisonInput(input: ImageEmbeddingReviewComparisonInput): void {
  if (
    !input.artworkId.trim()
    || !input.stratum.trim()
    || !input.mood.trim()
    || !input.department.trim()
    || input.stratum !== `${input.mood}|${input.department}`
    || !input.artworkCaption.trim()
    || !input.artworkImageUrl.trim()
    || !input.baseline.sceneId.trim()
    || !input.candidate.sceneId.trim()
    || input.baseline.sceneId === input.candidate.sceneId
    || !input.baseline.fingerprint.trim()
    || !input.candidate.fingerprint.trim()
    || !input.baseline.imageUrl.trim()
    || !input.candidate.imageUrl.trim()
    || !Number.isFinite(input.baseline.score)
    || !Number.isFinite(input.candidate.score)
  ) {
    throw new TypeError("Review pack comparison must contain complete changed baseline and candidate data.");
  }
}

interface MarginalQuota {
  stratum: string;
  availableCount: number;
  targetCount: number;
}

function stableStratumOrder(left: string, right: string, seed: string): number {
  const leftKey = sha256(`${seed}:${left}`);
  const rightKey = sha256(`${seed}:${right}`);
  return leftKey.localeCompare(rightKey) || left.localeCompare(right);
}

function buildMarginalQuotas(
  comparisons: ImageEmbeddingReviewComparisonInput[],
  dimension: "mood" | "department",
  requestedComparisonCount: number,
  seed: string,
): Map<string, MarginalQuota> {
  const availableByStratum = new Map<string, number>();
  for (const comparison of comparisons) {
    const stratum = comparison[dimension];
    availableByStratum.set(stratum, (availableByStratum.get(stratum) ?? 0) + 1);
  }
  const quotas = [...availableByStratum.entries()].map(([stratum, availableCount]) => ({
    stratum,
    availableCount,
    targetCount: 0,
    remainder: 0,
  }));
  const targetTotal = Math.min(requestedComparisonCount, comparisons.length);
  const availableTotal = comparisons.length;
  if (targetTotal === 0 || availableTotal === 0) {
    return new Map(quotas.map(({ stratum, availableCount, targetCount }) => [stratum, {
      stratum,
      availableCount,
      targetCount,
    }]));
  }

  for (const quota of quotas) {
    const rawTarget = targetTotal * quota.availableCount / availableTotal;
    quota.targetCount = Math.floor(rawTarget);
    quota.remainder = rawTarget - quota.targetCount;
  }
  let unallocated = targetTotal - quotas.reduce((total, quota) => total + quota.targetCount, 0);
  const priority = [...quotas].sort((left, right) =>
    right.remainder - left.remainder
    || stableStratumOrder(left.stratum, right.stratum, seed));
  for (const quota of priority) {
    if (unallocated === 0) {
      break;
    }
    quota.targetCount += 1;
    unallocated -= 1;
  }

  if (quotas.length <= targetTotal) {
    for (const quota of quotas) {
      if (quota.targetCount === 0) {
        quota.targetCount = 1;
      }
    }
    let excess = quotas.reduce((total, quota) => total + quota.targetCount, 0) - targetTotal;
    const removable = [...quotas].sort((left, right) =>
      left.remainder - right.remainder
      || stableStratumOrder(left.stratum, right.stratum, seed));
    for (const quota of removable) {
      while (excess > 0 && quota.targetCount > 1) {
        quota.targetCount -= 1;
        excess -= 1;
      }
    }
  }

  return new Map(quotas.map(({ stratum, availableCount, targetCount }) => [stratum, {
    stratum,
    availableCount,
    targetCount,
  }]));
}

function selectedMarginalCount(
  selected: ImageEmbeddingReviewComparisonInput[],
  dimension: "mood" | "department",
  stratum: string,
): number {
  return selected.filter((comparison) => comparison[dimension] === stratum).length;
}

interface FlowEdge {
  to: number;
  reverse: number;
  capacity: number;
}

interface ComparisonFlowEdge {
  comparison: ImageEmbeddingReviewComparisonInput;
  from: number;
  edgeIndex: number;
}

function addFlowEdge(graph: FlowEdge[][], from: number, to: number, capacity: number): number {
  const forwardIndex = graph[from]!.length;
  const reverseIndex = graph[to]!.length;
  graph[from]!.push({ to, reverse: reverseIndex, capacity });
  graph[to]!.push({ to: from, reverse: forwardIndex, capacity: 0 });
  return forwardIndex;
}

function maximumFlow(graph: FlowEdge[][], source: number, sink: number, maximum: number): number {
  let flow = 0;
  while (flow < maximum) {
    const previous = Array.from({ length: graph.length }, () => ({ node: -1, edge: -1 }));
    const queue = [source];
    previous[source] = { node: source, edge: -1 };
    for (let cursor = 0; cursor < queue.length && previous[sink]!.node === -1; cursor += 1) {
      const node = queue[cursor]!;
      for (let edgeIndex = 0; edgeIndex < graph[node]!.length; edgeIndex += 1) {
        const edge = graph[node]![edgeIndex]!;
        if (edge.capacity <= 0 || previous[edge.to]!.node !== -1) {
          continue;
        }
        previous[edge.to] = { node, edge: edgeIndex };
        queue.push(edge.to);
        if (edge.to === sink) {
          break;
        }
      }
    }
    if (previous[sink]!.node === -1) {
      break;
    }

    let increment = maximum - flow;
    for (let node = sink; node !== source;) {
      const step = previous[node]!;
      const edge = graph[step.node]![step.edge]!;
      increment = Math.min(increment, edge.capacity);
      node = step.node;
    }
    for (let node = sink; node !== source;) {
      const step = previous[node]!;
      const edge = graph[step.node]![step.edge]!;
      edge.capacity -= increment;
      graph[edge.to]![edge.reverse]!.capacity += increment;
      node = step.node;
    }
    flow += increment;
  }
  return flow;
}

function selectMarginalComparisons(input: {
  comparisons: ImageEmbeddingReviewComparisonInput[];
  requestedComparisonCount: number;
  releaseVersion: string;
  evaluationVersion: string;
  moodQuotas: Map<string, MarginalQuota>;
  departmentQuotas: Map<string, MarginalQuota>;
}): { selected: ImageEmbeddingReviewComparisonInput[]; quotaSatisfied: boolean } {
  const maximumCount = Math.min(input.requestedComparisonCount, input.comparisons.length);
  const ordered = [...input.comparisons].sort((left, right) => reviewPackComparisonOrder(
    left,
    right,
    input.releaseVersion,
    input.evaluationVersion,
  ));
  const moodTargetCount = [...input.moodQuotas.values()].reduce((total, quota) => total + quota.targetCount, 0);
  const departmentTargetCount = [...input.departmentQuotas.values()].reduce((total, quota) => total + quota.targetCount, 0);
  if (moodTargetCount !== maximumCount || departmentTargetCount !== maximumCount) {
    return { selected: [], quotaSatisfied: false };
  }

  const moodStrata = [...input.moodQuotas.keys()].sort((left, right) => stableStratumOrder(
    left,
    right,
    `${input.releaseVersion}:${input.evaluationVersion}:review-mood-flow`,
  ));
  const departmentStrata = [...input.departmentQuotas.keys()].sort((left, right) => stableStratumOrder(
    left,
    right,
    `${input.releaseVersion}:${input.evaluationVersion}:review-department-flow`,
  ));
  const source = 0;
  const sink = 1;
  const moodNodes = new Map(moodStrata.map((stratum, index) => [stratum, index + 2]));
  const departmentNodes = new Map(departmentStrata.map((stratum, index) => [stratum, index + 2 + moodStrata.length]));
  const graph: FlowEdge[][] = Array.from({ length: 2 + moodStrata.length + departmentStrata.length }, () => []);
  for (const mood of moodStrata) {
    addFlowEdge(graph, source, moodNodes.get(mood)!, input.moodQuotas.get(mood)!.targetCount);
  }
  for (const department of departmentStrata) {
    addFlowEdge(graph, departmentNodes.get(department)!, sink, input.departmentQuotas.get(department)!.targetCount);
  }
  const comparisonEdges: ComparisonFlowEdge[] = [];
  for (const comparison of ordered) {
    const from = moodNodes.get(comparison.mood);
    const to = departmentNodes.get(comparison.department);
    if (from === undefined || to === undefined) {
      return { selected: [], quotaSatisfied: false };
    }
    comparisonEdges.push({
      comparison,
      from,
      edgeIndex: addFlowEdge(graph, from, to, 1),
    });
  }
  const selectedFlow = maximumFlow(graph, source, sink, maximumCount);
  const selected = comparisonEdges
    .filter(({ from, edgeIndex }) => graph[from]![edgeIndex]!.capacity === 0)
    .map(({ comparison }) => comparison)
    .sort((left, right) => reviewPackComparisonOrder(
      left,
      right,
      input.releaseVersion,
      input.evaluationVersion,
    ));
  const quotaSatisfied = selectedFlow === maximumCount
    && selected.length === maximumCount
    && [...input.moodQuotas.values()].every((quota) =>
      selectedMarginalCount(selected, "mood", quota.stratum) === quota.targetCount)
    && [...input.departmentQuotas.values()].every((quota) =>
      selectedMarginalCount(selected, "department", quota.stratum) === quota.targetCount);
  return { selected, quotaSatisfied };
}

function samplingBreakdown(
  quotas: Map<string, MarginalQuota>,
  selected: ImageEmbeddingReviewComparisonInput[],
  dimension: "mood" | "department",
): ImageEmbeddingReviewSamplingStratum[] {
  return [...quotas.values()]
    .sort((left, right) => left.stratum.localeCompare(right.stratum))
    .map((quota) => {
      const selectedCount = selectedMarginalCount(selected, dimension, quota.stratum);
      return {
        stratum: quota.stratum,
        availableCount: quota.availableCount,
        targetCount: quota.targetCount,
        selectedCount,
        uncoveredReason: selectedCount === 0
          ? quota.targetCount === 0 ? "selection-capacity" as const : "marginal-quota-conflict" as const
          : undefined,
      };
    });
}

export function buildImageEmbeddingReviewPack(input: {
  releaseVersion: string;
  evaluationVersion: string;
  candidateShardChecksum: string;
  comparisons: ImageEmbeddingReviewComparisonInput[];
  minimumComparisonCount?: number;
}): ImageEmbeddingReviewPackBuildResult {
  const minimumComparisonCount = input.minimumComparisonCount ?? 30;
  if (!Number.isInteger(minimumComparisonCount) || minimumComparisonCount < 30) {
    throw new TypeError("Review packs require at least 30 changed comparisons.");
  }
  if (!input.releaseVersion.trim() || !input.evaluationVersion.trim() || !input.candidateShardChecksum.trim()) {
    throw new TypeError("Review pack requires release, evaluation, and candidate shard bindings.");
  }

  const seenArtworkIds = new Set<string>();
  const changedComparisons: ImageEmbeddingReviewComparisonInput[] = [];
  let unchangedComparisonCount = 0;
  for (const comparison of input.comparisons) {
    if (comparison.baseline.sceneId === comparison.candidate.sceneId) {
      unchangedComparisonCount += 1;
      continue;
    }
    assertReviewComparisonInput(comparison);
    if (seenArtworkIds.has(comparison.artworkId)) {
      throw new TypeError(`Review pack contains duplicate artwork ${comparison.artworkId}.`);
    }
    seenArtworkIds.add(comparison.artworkId);
    changedComparisons.push(comparison);
  }
  const quotaSeed = `${input.releaseVersion}:${input.evaluationVersion}:review-marginal-quota`;
  const moodQuotas = buildMarginalQuotas(changedComparisons, "mood", minimumComparisonCount, `${quotaSeed}:mood`);
  const departmentQuotas = buildMarginalQuotas(changedComparisons, "department", minimumComparisonCount, `${quotaSeed}:department`);
  const selection = selectMarginalComparisons({
    comparisons: changedComparisons,
    requestedComparisonCount: minimumComparisonCount,
    releaseVersion: input.releaseVersion,
    evaluationVersion: input.evaluationVersion,
    moodQuotas,
    departmentQuotas,
  });
  const selected = selection.selected;

  const comparisons = selected.map((comparison) => {
    const stableInput = {
      releaseVersion: input.releaseVersion,
      evaluationVersion: input.evaluationVersion,
      artworkId: comparison.artworkId,
      baseline: comparison.baseline,
      candidate: comparison.candidate,
    };
    return {
      ...comparison,
      reviewId: reviewComparisonId(stableInput),
      randomizationSeed: reviewComparisonSeed(stableInput),
    };
  });
  const payload: Omit<ImageEmbeddingMachineReviewPack, "reviewPackChecksum"> = {
    schemaVersion: "image-embedding-review-pack.v2",
    releaseVersion: input.releaseVersion,
    evaluationVersion: input.evaluationVersion,
    candidateShardChecksum: input.candidateShardChecksum,
    unchangedComparisonCount,
    sampling: {
      algorithm: "marginal-proportional-v1",
      requestedComparisonCount: minimumComparisonCount,
      selectedComparisonCount: comparisons.length,
      moods: samplingBreakdown(moodQuotas, selected, "mood"),
      departments: samplingBreakdown(departmentQuotas, selected, "department"),
    },
    comparisons,
  };
  const pack: ImageEmbeddingMachineReviewPack = {
    ...payload,
    reviewPackChecksum: reviewPackChecksumPayload(payload),
  };

  return {
    minimumSampleMet: pack.comparisons.length >= minimumComparisonCount && selection.quotaSatisfied,
    pack,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export function renderImageEmbeddingReviewerView(pack: ImageEmbeddingMachineReviewPack): string {
  const packError = validateImageEmbeddingMachineReviewPack(pack);
  if (packError) {
    throw new TypeError(`Reviewer view requires an intact machine review pack: ${packError}`);
  }

  const cards = pack.comparisons.map((comparison, index) => {
    const candidateOnLeft = candidateAppearsOnLeft(comparison);
    const left = candidateOnLeft ? comparison.candidate : comparison.baseline;
    const right = candidateOnLeft ? comparison.baseline : comparison.candidate;
    return [
      `<section data-review="${escapeHtml(comparison.reviewId)}">`,
      `<h2>Comparison ${index + 1}</h2>`,
      `<p>${escapeHtml(comparison.artworkCaption)}</p>`,
      `<img src="${escapeHtml(comparison.artworkImageUrl)}" alt="Artwork" loading="lazy">`,
      "<div>",
      `<figure><img src="${escapeHtml(left.imageUrl)}" alt="Option A" loading="lazy"><figcaption>Option A</figcaption></figure>`,
      `<figure><img src="${escapeHtml(right.imageUrl)}" alt="Option B" loading="lazy"><figcaption>Option B</figcaption></figure>`,
      "</div>",
      "</section>",
    ].join("");
  });

  return [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8"><title>Blind visual review</title></head><body>',
    "<main><h1>Blind visual review</h1>",
    ...cards,
    "</main></body></html>",
  ].join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key))
    && keys.every((key) => Object.hasOwn(value, key));
}

function hasRequiredAndOnlyKeys(
  value: Record<string, unknown>,
  requiredKeys: string[],
  optionalKeys: string[] = [],
): boolean {
  return Object.keys(value).every((key) => [...requiredKeys, ...optionalKeys].includes(key))
    && requiredKeys.every((key) => Object.hasOwn(value, key));
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function validateReviewSamplingDimension(
  value: unknown,
  comparisons: ImageEmbeddingMachineReviewComparison[],
  dimension: "mood" | "department",
  requireExactTargets: boolean,
): string | undefined {
  if (!Array.isArray(value)) {
    return `Machine review pack ${dimension} sampling is invalid.`;
  }
  const selectedCounts = new Map<string, number>();
  for (const comparison of comparisons) {
    const stratum = comparison[dimension];
    selectedCounts.set(stratum, (selectedCounts.get(stratum) ?? 0) + 1);
  }
  const seen = new Set<string>();
  for (const entry of value) {
    const availableCount = isRecord(entry) ? entry.availableCount : undefined;
    const targetCount = isRecord(entry) ? entry.targetCount : undefined;
    const selectedCount = isRecord(entry) ? entry.selectedCount : undefined;
    if (!isRecord(entry)
      || !hasRequiredAndOnlyKeys(entry, ["stratum", "availableCount", "targetCount", "selectedCount"], ["uncoveredReason"])
      || typeof entry.stratum !== "string"
      || !entry.stratum.trim()
      || !isNonnegativeInteger(availableCount)
      || !isNonnegativeInteger(targetCount)
      || !isNonnegativeInteger(selectedCount)
      || availableCount <= 0
      || targetCount > availableCount
      || selectedCount > availableCount
      || seen.has(entry.stratum)) {
      return `Machine review pack ${dimension} sampling contains invalid strata.`;
    }
    const actualSelectedCount = selectedCounts.get(entry.stratum) ?? 0;
    if (selectedCount !== actualSelectedCount) {
      return `Machine review pack ${dimension} sampling does not match selected comparisons.`;
    }
    if (requireExactTargets && selectedCount !== targetCount) {
      return `Machine review pack ${dimension} sampling does not satisfy its exact marginal quota.`;
    }
    if (selectedCount === 0) {
      if (entry.uncoveredReason !== "selection-capacity" && entry.uncoveredReason !== "marginal-quota-conflict") {
        return `Machine review pack ${dimension} sampling omits an uncovered reason.`;
      }
      if ((entry.uncoveredReason === "selection-capacity") !== (targetCount === 0)) {
        return `Machine review pack ${dimension} sampling has an inconsistent uncovered reason.`;
      }
    } else if (entry.uncoveredReason !== undefined) {
      return `Machine review pack ${dimension} sampling marks a covered stratum as uncovered.`;
    }
    seen.add(entry.stratum);
  }
  if ([...selectedCounts.keys()].some((stratum) => !seen.has(stratum))) {
    return `Machine review pack ${dimension} sampling omits a selected stratum.`;
  }
  return undefined;
}

function validateReviewSampling(
  value: unknown,
  comparisons: ImageEmbeddingMachineReviewComparison[],
): string | undefined {
  const requestedComparisonCount = isRecord(value) ? value.requestedComparisonCount : undefined;
  const selectedComparisonCount = isRecord(value) ? value.selectedComparisonCount : undefined;
  if (!isRecord(value)
    || !hasOnlyKeys(value, ["algorithm", "requestedComparisonCount", "selectedComparisonCount", "moods", "departments"])
    || value.algorithm !== "marginal-proportional-v1"
    || !isNonnegativeInteger(requestedComparisonCount)
    || requestedComparisonCount < 30
    || !isNonnegativeInteger(selectedComparisonCount)
    || selectedComparisonCount !== comparisons.length
    || selectedComparisonCount > requestedComparisonCount) {
    return "Machine review pack sampling has an invalid schema.";
  }
  const requireExactTargets = selectedComparisonCount === requestedComparisonCount;
  return validateReviewSamplingDimension(value.moods, comparisons, "mood", requireExactTargets)
    ?? validateReviewSamplingDimension(value.departments, comparisons, "department", requireExactTargets);
}

function emptyHumanReviewEvaluation(
  valid: boolean,
  humanReviewComplete: boolean,
  reasons: string[],
  requiredCount: number,
): ImageEmbeddingHumanReviewEvaluation {
  return {
    valid,
    humanReviewComplete,
    reasons,
    completedCount: 0,
    requiredCount,
    uncertainCount: 0,
    uncertainRate: 0,
    candidateAcceptableCount: 0,
    candidateAcceptableRate: 0,
    candidateRegressionCount: 0,
    candidateRegressionRate: 0,
    candidateBetterCount: 0,
    tieCount: 0,
    baselineBetterCount: 0,
    bothUnacceptableCount: 0,
  };
}

export function validateImageEmbeddingMachineReviewPack(pack: ImageEmbeddingMachineReviewPack): string | undefined {
  const candidate = pack as unknown;
  if (!isRecord(candidate)
    || !hasOnlyKeys(candidate, [
      "schemaVersion",
      "releaseVersion",
      "evaluationVersion",
      "candidateShardChecksum",
      "unchangedComparisonCount",
      "sampling",
      "comparisons",
      "reviewPackChecksum",
    ])
    || candidate.schemaVersion !== "image-embedding-review-pack.v2"
    || typeof candidate.releaseVersion !== "string"
    || typeof candidate.evaluationVersion !== "string"
    || typeof candidate.candidateShardChecksum !== "string"
    || typeof candidate.reviewPackChecksum !== "string"
    || typeof candidate.unchangedComparisonCount !== "number"
    || !Number.isInteger(candidate.unchangedComparisonCount)
    || candidate.unchangedComparisonCount < 0
    || !Array.isArray(candidate.comparisons)
  ) {
    return "Machine review pack has an invalid schema.";
  }
  if (
    !candidate.releaseVersion.trim()
    || !candidate.evaluationVersion.trim()
    || !candidate.candidateShardChecksum.trim()
    || calculateImageEmbeddingReviewPackChecksum(pack) !== pack.reviewPackChecksum
  ) {
    return "Machine review pack checksum or binding is invalid.";
  }

  const reviewIds = new Set<string>();
  const artworkIds = new Set<string>();
  const comparisons: ImageEmbeddingMachineReviewComparison[] = [];
  for (const comparison of pack.comparisons) {
    if (!isRecord(comparison)) {
      return "Machine review pack contains malformed comparison data.";
    }
    try {
      assertReviewComparisonInput(comparison as unknown as ImageEmbeddingReviewComparisonInput);
    } catch {
      return "Machine review pack contains incomplete comparison data.";
    }
    if (typeof comparison.reviewId !== "string" || typeof comparison.randomizationSeed !== "string") {
      return "Machine review pack contains malformed comparison identity data.";
    }
    const stableInput = {
      releaseVersion: pack.releaseVersion,
      evaluationVersion: pack.evaluationVersion,
      artworkId: comparison.artworkId,
      baseline: comparison.baseline as unknown as ImageEmbeddingReviewSceneOption,
      candidate: comparison.candidate as unknown as ImageEmbeddingReviewSceneOption,
    };
    if (
      reviewIds.has(comparison.reviewId)
      || artworkIds.has(comparison.artworkId)
      || comparison.reviewId !== reviewComparisonId(stableInput)
      || comparison.randomizationSeed !== reviewComparisonSeed(stableInput)
    ) {
      return "Machine review pack contains invalid identity or randomization bindings.";
    }
    reviewIds.add(comparison.reviewId);
    artworkIds.add(comparison.artworkId);
    comparisons.push(comparison);
  }
  return validateReviewSampling(candidate.sampling, comparisons);
}

export function evaluateImageEmbeddingHumanReview(
  pack: ImageEmbeddingMachineReviewPack,
  sidecar: unknown,
): ImageEmbeddingHumanReviewEvaluation {
  const packError = validateImageEmbeddingMachineReviewPack(pack);
  if (packError) {
    return emptyHumanReviewEvaluation(false, false, [packError], pack.comparisons.length);
  }
  if (sidecar === undefined || sidecar === null) {
    return emptyHumanReviewEvaluation(true, false, ["No human review verdict sidecar was supplied."], pack.comparisons.length);
  }
  if (!isRecord(sidecar) || !hasOnlyKeys(sidecar, ["reviewPackChecksum", "verdicts"])) {
    return emptyHumanReviewEvaluation(false, false, ["Verdict sidecar has an invalid schema."], pack.comparisons.length);
  }
  if (sidecar.reviewPackChecksum !== pack.reviewPackChecksum || !Array.isArray(sidecar.verdicts)) {
    return emptyHumanReviewEvaluation(false, false, ["Verdict sidecar does not bind to this review pack."], pack.comparisons.length);
  }
  if (sidecar.verdicts.length !== pack.comparisons.length) {
    return emptyHumanReviewEvaluation(false, false, ["Verdict sidecar is incomplete."], pack.comparisons.length);
  }

  const allowedVerdicts = new Set<HumanComparisonVerdict>([
    "left-better",
    "right-better",
    "tie",
    "both-unacceptable",
    "uncertain",
  ]);
  const allowedAcceptability = new Set<HumanAcceptability>(["acceptable", "unacceptable", "uncertain"]);
  const comparisonByReviewId = new Map(pack.comparisons.map((comparison) => [comparison.reviewId, comparison]));
  const seenReviewIds = new Set<string>();
  let uncertainCount = 0;
  let candidateAcceptableCount = 0;
  let candidateRegressionCount = 0;
  let candidateBetterCount = 0;
  let tieCount = 0;
  let baselineBetterCount = 0;
  let bothUnacceptableCount = 0;

  for (const value of sidecar.verdicts) {
    if (!isRecord(value) || !hasOnlyKeys(value, [
      "reviewId",
      "comparisonVerdict",
      "leftAcceptability",
      "rightAcceptability",
      "reason",
    ])) {
      return emptyHumanReviewEvaluation(false, false, ["Verdict sidecar contains unsupported fields."], pack.comparisons.length);
    }
    const reviewId = value.reviewId;
    const comparisonVerdict = value.comparisonVerdict;
    const leftAcceptability = value.leftAcceptability;
    const rightAcceptability = value.rightAcceptability;
    const reason = value.reason;
    if (
      typeof reviewId !== "string"
      || seenReviewIds.has(reviewId)
      || typeof comparisonVerdict !== "string"
      || !allowedVerdicts.has(comparisonVerdict as HumanComparisonVerdict)
      || typeof leftAcceptability !== "string"
      || !allowedAcceptability.has(leftAcceptability as HumanAcceptability)
      || typeof rightAcceptability !== "string"
      || !allowedAcceptability.has(rightAcceptability as HumanAcceptability)
      || typeof reason !== "string"
      || !reason.trim()
    ) {
      return emptyHumanReviewEvaluation(false, false, ["Verdict sidecar contains invalid, duplicate, or empty entries."], pack.comparisons.length);
    }
    const comparison = comparisonByReviewId.get(reviewId);
    if (!comparison) {
      return emptyHumanReviewEvaluation(false, false, ["Verdict sidecar contains an unknown review ID."], pack.comparisons.length);
    }
    seenReviewIds.add(reviewId);

    const candidateOnLeft = candidateAppearsOnLeft(comparison);
    const candidateAcceptability = candidateOnLeft ? leftAcceptability : rightAcceptability;
    const baselineBetter = candidateOnLeft
      ? comparisonVerdict === "right-better"
      : comparisonVerdict === "left-better";
    const candidateBetter = candidateOnLeft
      ? comparisonVerdict === "left-better"
      : comparisonVerdict === "right-better";
    if (candidateAcceptability === "acceptable") {
      candidateAcceptableCount += 1;
    }
    if (baselineBetter && candidateAcceptability !== "acceptable") {
      candidateRegressionCount += 1;
    }
    if (candidateBetter) {
      candidateBetterCount += 1;
    } else if (baselineBetter) {
      baselineBetterCount += 1;
    } else if (comparisonVerdict === "tie") {
      tieCount += 1;
    } else if (comparisonVerdict === "both-unacceptable") {
      bothUnacceptableCount += 1;
    } else if (comparisonVerdict === "uncertain") {
      uncertainCount += 1;
    }
  }

  if (seenReviewIds.size !== pack.comparisons.length) {
    return emptyHumanReviewEvaluation(false, false, ["Verdict sidecar is missing review IDs."], pack.comparisons.length);
  }

  const requiredCount = pack.comparisons.length;
  return {
    valid: true,
    humanReviewComplete: true,
    reasons: [],
    completedCount: requiredCount,
    requiredCount,
    uncertainCount,
    uncertainRate: ratio(uncertainCount, requiredCount),
    candidateAcceptableCount,
    candidateAcceptableRate: ratio(candidateAcceptableCount, requiredCount),
    candidateRegressionCount,
    candidateRegressionRate: ratio(candidateRegressionCount, requiredCount),
    candidateBetterCount,
    tieCount,
    baselineBetterCount,
    bothUnacceptableCount,
    reviewVerdictsChecksum: sha256Checksum(canonicalJson(sidecar)),
  };
}

function normalizedValues(values: string[], prefix: string): Set<string> {
  return new Set(values.flatMap((value) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized || normalized === "unknown-palette") {
      return [];
    }
    return [`${prefix}:${normalized}`];
  }));
}

function artworkWeakLabelFields(artwork: ImageEmbeddingEvaluationArtwork): Set<string>[] {
  const aspectRatioHint = artwork.aspectRatioHint?.trim().toLowerCase();
  return [
    normalizedValues(artwork.colorTags, "color"),
    normalizedValues(artwork.compositionTags, "composition"),
    normalizedValues(artwork.subjectTags, "subject"),
    new Set(aspectRatioHint ? [`aspect:${aspectRatioHint}`] : []),
  ];
}

function fieldsShareValue(left: Set<string>, right: Set<string>): boolean {
  for (const value of left) {
    if (right.has(value)) {
      return true;
    }
  }
  return false;
}

export function classifyImageEmbeddingArtworkWeakLabelPair(
  left: ImageEmbeddingEvaluationArtwork,
  right: ImageEmbeddingEvaluationArtwork,
): "positive" | "negative" | undefined {
  if (left.id === right.id) {
    return undefined;
  }
  const leftFields = artworkWeakLabelFields(left);
  const rightFields = artworkWeakLabelFields(right);
  const sharedFieldCount = leftFields.reduce((count, field, index) =>
    count + (fieldsShareValue(field, rightFields[index] ?? new Set()) ? 1 : 0), 0);
  if (sharedFieldCount >= 2) {
    return "positive";
  }
  return sharedFieldCount === 0 ? "negative" : undefined;
}

function caseInsensitiveIntersectionSize(left: string[], right: string[]): number {
  const rightValues = new Set(right.map((value) => value.toLowerCase()));
  return left.filter((value) => rightValues.has(value.toLowerCase())).length;
}

/**
 * Frozen copy of the current production `selectBackgroundScene` metadata score.
 * Keep this separate from visual evaluation so weak labels cannot drift by adding
 * composition, orientation, or any other convenient signal.
 */
export function scoreFrozenBackgroundSceneWeakLabel(
  artwork: ImageEmbeddingEvaluationArtwork,
  scene: ImageEmbeddingEvaluationScene,
): number {
  return (
    caseInsensitiveIntersectionSize(artwork.moodTags, scene.emotionIds) * 4
    + caseInsensitiveIntersectionSize(artwork.emotionLabels ?? [], scene.emotionIds) * 4
    + caseInsensitiveIntersectionSize(artwork.sceneAffinity?.paletteModes ?? [], scene.artworkPaletteModes) * 2
    + (scene.sceneType && (artwork.sceneAffinity?.sceneTypes ?? []).includes(scene.sceneType) ? 2 : 0)
    + caseInsensitiveIntersectionSize(artwork.colorTags, scene.palette)
  );
}

function selectFrozenBackgroundSceneWeakLabel(
  artwork: ImageEmbeddingEvaluationArtwork,
  scenes: ImageEmbeddingEvaluationScene[],
): ImageEmbeddingEvaluationScene | undefined {
  return scenes
    .map((scene) => ({ scene, score: scoreFrozenBackgroundSceneWeakLabel(artwork, scene) }))
    .sort((left, right) => right.score - left.score || left.scene.id.localeCompare(right.scene.id))
    .at(0)?.scene;
}

function recordsAreComparable(
  left: ImageEmbeddingShardRecord,
  right: ImageEmbeddingShardRecord,
): boolean {
  return left.dimensions === right.dimensions
    && left.model === right.model
    && left.modelRevision === right.modelRevision
    && left.modelVariant === right.modelVariant
    && left.modelArtifactChecksum === right.modelArtifactChecksum
    && left.preprocessingFingerprint === right.preprocessingFingerprint;
}

function evaluateSceneTop3(
  artworks: ImageEmbeddingEvaluationArtwork[],
  scenes: ImageEmbeddingEvaluationScene[],
  eligibleArtworkIds: Set<string>,
  artworkRecordsByEntityId: Map<string, ImageEmbeddingShardRecord>,
  sceneRecordsByEntityId: Map<string, ImageEmbeddingShardRecord>,
): SceneTop3MetricResult {
  let hitCount = 0;
  let evaluatedArtworkCount = 0;
  let missingArtworkVectorCount = 0;
  let missingPositiveSceneVectorCount = 0;
  const observations: SceneTop3Observation[] = [];

  for (const artwork of artworks) {
    if (!eligibleArtworkIds.has(artwork.id)) {
      continue;
    }

    const artworkRecord = artworkRecordsByEntityId.get(artwork.id);
    if (!artworkRecord) {
      missingArtworkVectorCount += 1;
      continue;
    }

    const positiveScene = selectFrozenBackgroundSceneWeakLabel(artwork, scenes);
    const positiveSceneRecord = positiveScene
      ? sceneRecordsByEntityId.get(positiveScene.id)
      : undefined;
    if (!positiveScene || !positiveSceneRecord || !recordsAreComparable(artworkRecord, positiveSceneRecord)) {
      missingPositiveSceneVectorCount += 1;
      continue;
    }

    const weakLabelScenes = scenes.filter((scene) =>
      scene.id === positiveScene.id || scoreFrozenBackgroundSceneWeakLabel(artwork, scene) === 0);
    const rankedSceneIds = weakLabelScenes.flatMap((scene) => {
      const sceneRecord = sceneRecordsByEntityId.get(scene.id);
      if (!sceneRecord || !recordsAreComparable(artworkRecord, sceneRecord)) {
        return [];
      }
      return [{ id: scene.id, score: cosineSimilarity(artworkRecord.vector, sceneRecord.vector) }];
    }).sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));

    evaluatedArtworkCount += 1;
    const hit = rankedSceneIds.slice(0, 3).some((scene) => scene.id === positiveScene.id);
    if (hit) {
      hitCount += 1;
    }
    observations.push({
      artworkId: artwork.id,
      stratum: artworkStratum(artwork),
      majorStrata: artworkMajorStrata(artwork),
      hitCount: hit ? 1 : 0,
    });
  }

  return {
    metrics: {
      hitRate: evaluatedArtworkCount > 0 ? hitCount / evaluatedArtworkCount : 0,
      hitCount,
      eligibleArtworkCount: eligibleArtworkIds.size,
      evaluatedArtworkCount,
      missingArtworkVectorCount,
      missingPositiveSceneVectorCount,
    },
    observations,
  };
}

function buildArtworkPairs(artworks: ImageEmbeddingEvaluationArtwork[]): ArtworkPair[] {
  const pairs: ArtworkPair[] = [];
  for (let leftIndex = 0; leftIndex < artworks.length; leftIndex += 1) {
    const left = artworks[leftIndex];
    if (!left) {
      continue;
    }
    for (let rightIndex = leftIndex + 1; rightIndex < artworks.length; rightIndex += 1) {
      const right = artworks[rightIndex];
      if (!right) {
        continue;
      }
      const label = classifyImageEmbeddingArtworkWeakLabelPair(left, right);
      if (label) {
        pairs.push({ leftId: left.id, rightId: right.id, label });
      }
    }
  }
  return pairs;
}

function artworkStratum(artwork: ImageEmbeddingEvaluationArtwork): string {
  const mood = artwork.moodTags.find((value) => value.trim() !== "")?.trim().toLowerCase() ?? "unknown";
  const department = artwork.department?.trim().toLowerCase() || "unknown";
  return `${mood}|${department}`;
}

function artworkMajorStrata(artwork: ImageEmbeddingEvaluationArtwork): string[] {
  const [mood, department] = artworkStratum(artwork).split("|");
  return [`mood:${mood}`, `department:${department}`];
}

function splitArtworkIds(input: {
  releaseVersion: string;
  evaluationVersion: string;
  artworks: ImageEmbeddingEvaluationArtwork[];
}): { trainArtworkIds: Set<string>; holdoutArtworkIds: Set<string> } {
  const byStratum = new Map<string, ImageEmbeddingEvaluationArtwork[]>();
  for (const artwork of input.artworks) {
    const entries = byStratum.get(artworkStratum(artwork)) ?? [];
    entries.push(artwork);
    byStratum.set(artworkStratum(artwork), entries);
  }
  const trainArtworkIds = new Set<string>();
  const holdoutArtworkIds = new Set<string>();
  for (const artworks of byStratum.values()) {
    artworks.sort((left, right) => {
      const leftKey = sha256(`${input.releaseVersion}${left.id}${input.evaluationVersion}`);
      const rightKey = sha256(`${input.releaseVersion}${right.id}${input.evaluationVersion}`);
      return leftKey.localeCompare(rightKey) || left.id.localeCompare(right.id);
    });
    const trainArtworkCount = Math.floor(artworks.length * 0.7);
    for (const [index, artwork] of artworks.entries()) {
      const target = index < trainArtworkCount ? trainArtworkIds : holdoutArtworkIds;
      target.add(artwork.id);
    }
  }
  return { trainArtworkIds, holdoutArtworkIds };
}

function pairwiseMetrics(
  pairs: ArtworkPair[],
  eligibleArtworkIds: Set<string>,
  recordsByEntityId: Map<string, ImageEmbeddingShardRecord>,
  artworksById: Map<string, ImageEmbeddingEvaluationArtwork>,
): PairwiseMetricResult {
  const pairsByArtworkId = new Map<string, ArtworkPair[]>();
  for (const pair of pairs) {
    if (!eligibleArtworkIds.has(pair.leftId) || !eligibleArtworkIds.has(pair.rightId)) {
      continue;
    }
    const leftPairs = pairsByArtworkId.get(pair.leftId) ?? [];
    leftPairs.push(pair);
    pairsByArtworkId.set(pair.leftId, leftPairs);
    const rightPairs = pairsByArtworkId.get(pair.rightId) ?? [];
    rightPairs.push(pair);
    pairsByArtworkId.set(pair.rightId, rightPairs);
  }

  let candidateComparisonCount = 0;
  let unscoredComparisonCount = 0;
  let comparisonCount = 0;
  let correctComparisonCount = 0;
  const positivePairKeys = new Set<string>();
  const negativePairKeys = new Set<string>();
  const observations: ArtworkPairwiseObservation[] = [];

  for (const artworkId of [...eligibleArtworkIds].sort()) {
    const anchorRecord = recordsByEntityId.get(artworkId);
    const anchoredPairs = pairsByArtworkId.get(artworkId) ?? [];
    const positiveIds = anchoredPairs
      .filter((pair) => pair.label === "positive")
      .map((pair) => pair.leftId === artworkId ? pair.rightId : pair.leftId);
    const negativeIds = anchoredPairs
      .filter((pair) => pair.label === "negative")
      .map((pair) => pair.leftId === artworkId ? pair.rightId : pair.leftId);
    let artworkComparisonCount = 0;
    let artworkCorrectComparisonCount = 0;

    for (const positiveId of positiveIds) {
      for (const negativeId of negativeIds) {
        candidateComparisonCount += 1;
        const positiveRecord = recordsByEntityId.get(positiveId);
        const negativeRecord = recordsByEntityId.get(negativeId);
        if (
          !anchorRecord
          || !positiveRecord
          || !negativeRecord
          || !recordsAreComparable(anchorRecord, positiveRecord)
          || !recordsAreComparable(anchorRecord, negativeRecord)
        ) {
          unscoredComparisonCount += 1;
          continue;
        }

        const correct = cosineSimilarity(anchorRecord.vector, positiveRecord.vector)
          > cosineSimilarity(anchorRecord.vector, negativeRecord.vector);
        comparisonCount += 1;
        artworkComparisonCount += 1;
        positivePairKeys.add(`${artworkId}\u0000${positiveId}`);
        negativePairKeys.add(`${artworkId}\u0000${negativeId}`);
        if (correct) {
          correctComparisonCount += 1;
          artworkCorrectComparisonCount += 1;
        }
      }
    }

    if (artworkComparisonCount > 0) {
      observations.push({
        artworkId,
        stratum: artworkStratum(artworksById.get(artworkId) ?? {
          id: artworkId,
          moodTags: [],
          colorTags: [],
          compositionTags: [],
          subjectTags: [],
        }),
        majorStrata: artworkMajorStrata(artworksById.get(artworkId) ?? {
          id: artworkId,
          moodTags: [],
          colorTags: [],
          compositionTags: [],
          subjectTags: [],
        }),
        comparisonCount: artworkComparisonCount,
        correctComparisonCount: artworkCorrectComparisonCount,
      });
    }
  }

  const availableArtworkVectorCount = [...eligibleArtworkIds]
    .filter((artworkId) => recordsByEntityId.has(artworkId))
    .length;

  return {
    metrics: {
      pairwiseAccuracy: comparisonCount > 0 ? correctComparisonCount / comparisonCount : 0,
      positivePairCount: positivePairKeys.size,
      negativePairCount: negativePairKeys.size,
      uniqueArtworkCount: observations.length,
      eligibleArtworkCount: eligibleArtworkIds.size,
      availableArtworkVectorCount,
      missingArtworkVectorCount: eligibleArtworkIds.size - availableArtworkVectorCount,
      candidateComparisonCount,
      unscoredComparisonCount,
      comparisonCount,
    },
    observations,
  };
}

function expectedStrata(
  artworkIds: Set<string>,
  artworksById: Map<string, ImageEmbeddingEvaluationArtwork>,
): string[] {
  return [...new Set(
    [...artworkIds].map((artworkId) => artworkStratum(artworksById.get(artworkId) ?? {
      id: artworkId,
      moodTags: [],
      colorTags: [],
      compositionTags: [],
      subjectTags: [],
    })),
  )].sort();
}

function expectedMajorStrata(artworks: ImageEmbeddingEvaluationArtwork[]): string[] {
  const counts = new Map<string, number>();
  for (const artwork of artworks) {
    for (const stratum of artworkMajorStrata(artwork)) {
      counts.set(stratum, (counts.get(stratum) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= MINIMUM_MAJOR_STRATUM_ELIGIBLE_ARTWORK_COUNT)
    .map(([stratum]) => stratum)
    .sort();
}

export function evaluateImageEmbeddingWeakLabels(
  input: ImageEmbeddingWeakLabelEvaluationInput,
): ImageEmbeddingWeakLabelEvaluation {
  const pairs = buildArtworkPairs(input.artworks);
  const split = splitArtworkIds({
    releaseVersion: input.releaseVersion,
    evaluationVersion: input.evaluationVersion,
    artworks: input.artworks,
  });
  const recordsByEntityId = new Map(
    input.records
      .filter((record) => record.entityType === "artwork")
      .map((record) => [record.entityId, record]),
  );
  const artworksById = new Map(input.artworks.map((artwork) => [artwork.id, artwork]));
  const sceneRecordsByEntityId = new Map(
    input.records
      .filter((record) => record.entityType === "background-scene")
      .map((record) => [record.entityId, record]),
  );
  const availableSceneVectorCount = input.scenes.filter((scene) => sceneRecordsByEntityId.has(scene.id)).length;

  const trainPairwise = pairwiseMetrics(pairs, split.trainArtworkIds, recordsByEntityId, artworksById);
  const holdoutPairwise = pairwiseMetrics(pairs, split.holdoutArtworkIds, recordsByEntityId, artworksById);
  const trainSceneTop3 = evaluateSceneTop3(
    input.artworks,
    input.scenes,
    split.trainArtworkIds,
    recordsByEntityId,
    sceneRecordsByEntityId,
  );
  const holdoutSceneTop3 = evaluateSceneTop3(
    input.artworks,
    input.scenes,
    split.holdoutArtworkIds,
    recordsByEntityId,
    sceneRecordsByEntityId,
  );
  const trainStrata = expectedStrata(split.trainArtworkIds, artworksById);
  const holdoutStrata = expectedStrata(split.holdoutArtworkIds, artworksById);
  const majorStrata = expectedMajorStrata(input.artworks);
  const trainPairwiseMetrics = withMetricEvidence(
    trainPairwise.metrics,
    trainPairwise.observations.map((observation) => ({
      artworkId: observation.artworkId,
      stratum: observation.stratum,
      majorStrata: observation.majorStrata,
      numerator: observation.correctComparisonCount,
      denominator: observation.comparisonCount,
    })),
    trainStrata,
    majorStrata,
    `${input.releaseVersion}:${input.evaluationVersion}:artwork-pairwise:train`,
  );
  const holdoutPairwiseMetrics = withMetricEvidence(
    holdoutPairwise.metrics,
    holdoutPairwise.observations.map((observation) => ({
      artworkId: observation.artworkId,
      stratum: observation.stratum,
      majorStrata: observation.majorStrata,
      numerator: observation.correctComparisonCount,
      denominator: observation.comparisonCount,
    })),
    holdoutStrata,
    majorStrata,
    `${input.releaseVersion}:${input.evaluationVersion}:artwork-pairwise:holdout`,
  );
  const trainSceneTop3Metrics = withMetricEvidence(
    trainSceneTop3.metrics,
    trainSceneTop3.observations.map((observation) => ({
      artworkId: observation.artworkId,
      stratum: observation.stratum,
      majorStrata: observation.majorStrata,
      numerator: observation.hitCount,
      denominator: 1,
    })),
    trainStrata,
    majorStrata,
    `${input.releaseVersion}:${input.evaluationVersion}:scene-top3:train`,
  );
  const holdoutSceneTop3Metrics = withMetricEvidence(
    holdoutSceneTop3.metrics,
    holdoutSceneTop3.observations.map((observation) => ({
      artworkId: observation.artworkId,
      stratum: observation.stratum,
      majorStrata: observation.majorStrata,
      numerator: observation.hitCount,
      denominator: 1,
    })),
    holdoutStrata,
    majorStrata,
    `${input.releaseVersion}:${input.evaluationVersion}:scene-top3:holdout`,
  );

  return {
    labelSource: "structured-weak-label-v1",
    trainArtworkIds: [...split.trainArtworkIds].sort(),
    holdoutArtworkIds: [...split.holdoutArtworkIds].sort(),
    artworkPairwise: {
      train: trainPairwiseMetrics,
      holdout: holdoutPairwiseMetrics,
    },
    sceneTop3: {
      coverage: {
        eligibleSceneCount: input.scenes.length,
        availableSceneVectorCount,
        missingSceneVectorCount: input.scenes.length - availableSceneVectorCount,
      },
      train: trainSceneTop3Metrics,
      holdout: holdoutSceneTop3Metrics,
    },
    holdoutReadiness: {
      artworkPairwise: holdoutMetricReadiness(
        holdoutPairwiseMetrics.uniqueArtworkCount,
        holdoutPairwiseMetrics.perStrata,
        holdoutPairwiseMetrics.majorStrata,
      ),
      sceneTop3: holdoutMetricReadiness(
        holdoutSceneTop3Metrics.evaluatedArtworkCount,
        holdoutSceneTop3Metrics.perStrata,
        holdoutSceneTop3Metrics.majorStrata,
      ),
    },
  };
}
