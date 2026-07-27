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
  artworkCaption: string;
  artworkImageUrl: string;
  baseline: ImageEmbeddingReviewSceneOption;
  candidate: ImageEmbeddingReviewSceneOption;
}

export interface ImageEmbeddingMachineReviewComparison extends ImageEmbeddingReviewComparisonInput {
  reviewId: string;
  randomizationSeed: string;
}

export interface ImageEmbeddingMachineReviewPack {
  schemaVersion: "image-embedding-review-pack.v1";
  releaseVersion: string;
  evaluationVersion: string;
  candidateShardChecksum: string;
  unchangedComparisonCount: number;
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

function metricEvidence(
  observations: MetricClusterObservation[],
  expectedStrata: string[],
  seed: string,
): MetricEvidence {
  const perStrata = expectedStrata.map((stratum) => {
    const inStratum = observations.filter((observation) => observation.stratum === stratum);
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

  return {
    confidenceInterval: bootstrapConfidenceInterval(observations, seed),
    perStrata,
  };
}

function withMetricEvidence<T extends object>(
  metrics: T,
  observations: MetricClusterObservation[],
  expectedStrata: string[],
  seed: string,
): T & MetricEvidence {
  return {
    ...metrics,
    ...metricEvidence(observations, expectedStrata, seed),
  };
}

function holdoutMetricReadiness(
  uniqueArtworkCount: number,
  perStrata: PerStratumMetricBreakdown[],
): HoldoutMetricReadiness {
  return {
    uniqueArtworkCount,
    minimumArtworkCount: MINIMUM_HOLDOUT_ARTWORK_COUNT,
    minimumSampleMet: uniqueArtworkCount >= MINIMUM_HOLDOUT_ARTWORK_COUNT,
    allStrataSufficient: perStrata.length > 0 && perStrata.every((stratum) => stratum.status === "ready"),
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
  const changedByStratum = new Map<string, ImageEmbeddingReviewComparisonInput[]>();
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
    const entries = changedByStratum.get(comparison.stratum) ?? [];
    entries.push(comparison);
    changedByStratum.set(comparison.stratum, entries);
  }

  const strata = [...changedByStratum.keys()].sort();
  for (const stratum of strata) {
    const entries = changedByStratum.get(stratum);
    entries?.sort((left, right) => reviewPackComparisonOrder(
      left,
      right,
      input.releaseVersion,
      input.evaluationVersion,
    ));
  }

  const selected: ImageEmbeddingReviewComparisonInput[] = [];
  let madeProgress = true;
  while (selected.length < minimumComparisonCount && madeProgress) {
    madeProgress = false;
    for (const stratum of strata) {
      const next = changedByStratum.get(stratum)?.shift();
      if (next) {
        selected.push(next);
        madeProgress = true;
      }
      if (selected.length >= minimumComparisonCount) {
        break;
      }
    }
  }

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
    schemaVersion: "image-embedding-review-pack.v1",
    releaseVersion: input.releaseVersion,
    evaluationVersion: input.evaluationVersion,
    candidateShardChecksum: input.candidateShardChecksum,
    unchangedComparisonCount,
    comparisons,
  };
  const pack: ImageEmbeddingMachineReviewPack = {
    ...payload,
    reviewPackChecksum: reviewPackChecksumPayload(payload),
  };

  return {
    minimumSampleMet: pack.comparisons.length >= minimumComparisonCount,
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
  const packError = validateMachineReviewPack(pack);
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

function validateMachineReviewPack(pack: ImageEmbeddingMachineReviewPack): string | undefined {
  const candidate = pack as unknown;
  if (!isRecord(candidate)
    || candidate.schemaVersion !== "image-embedding-review-pack.v1"
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
  }
  return undefined;
}

export function evaluateImageEmbeddingHumanReview(
  pack: ImageEmbeddingMachineReviewPack,
  sidecar: unknown,
): ImageEmbeddingHumanReviewEvaluation {
  const packError = validateMachineReviewPack(pack);
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

function artworkWeakLabelTokens(artwork: ImageEmbeddingEvaluationArtwork): Set<string> {
  const tokens = new Set<string>([
    ...normalizedValues(artwork.colorTags, "color"),
    ...normalizedValues(artwork.compositionTags, "composition"),
    ...normalizedValues(artwork.subjectTags, "subject"),
  ]);
  const aspectRatioHint = artwork.aspectRatioHint?.trim().toLowerCase();
  if (aspectRatioHint) {
    tokens.add(`aspect:${aspectRatioHint}`);
  }
  return tokens;
}

function intersectionSize(left: Set<string>, right: Set<string>): number {
  let count = 0;
  for (const value of left) {
    if (right.has(value)) {
      count += 1;
    }
  }
  return count;
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
  const tokensByArtwork = new Map(artworks.map((artwork) => [artwork.id, artworkWeakLabelTokens(artwork)]));
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
      const sharedCount = intersectionSize(tokensByArtwork.get(left.id) ?? new Set(), tokensByArtwork.get(right.id) ?? new Set());
      if (sharedCount >= 2) {
        pairs.push({ leftId: left.id, rightId: right.id, label: "positive" });
      } else if (sharedCount === 0) {
        pairs.push({ leftId: left.id, rightId: right.id, label: "negative" });
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
  const trainPairwiseMetrics = withMetricEvidence(
    trainPairwise.metrics,
    trainPairwise.observations.map((observation) => ({
      artworkId: observation.artworkId,
      stratum: observation.stratum,
      numerator: observation.correctComparisonCount,
      denominator: observation.comparisonCount,
    })),
    trainStrata,
    `${input.releaseVersion}:${input.evaluationVersion}:artwork-pairwise:train`,
  );
  const holdoutPairwiseMetrics = withMetricEvidence(
    holdoutPairwise.metrics,
    holdoutPairwise.observations.map((observation) => ({
      artworkId: observation.artworkId,
      stratum: observation.stratum,
      numerator: observation.correctComparisonCount,
      denominator: observation.comparisonCount,
    })),
    holdoutStrata,
    `${input.releaseVersion}:${input.evaluationVersion}:artwork-pairwise:holdout`,
  );
  const trainSceneTop3Metrics = withMetricEvidence(
    trainSceneTop3.metrics,
    trainSceneTop3.observations.map((observation) => ({
      artworkId: observation.artworkId,
      stratum: observation.stratum,
      numerator: observation.hitCount,
      denominator: 1,
    })),
    trainStrata,
    `${input.releaseVersion}:${input.evaluationVersion}:scene-top3:train`,
  );
  const holdoutSceneTop3Metrics = withMetricEvidence(
    holdoutSceneTop3.metrics,
    holdoutSceneTop3.observations.map((observation) => ({
      artworkId: observation.artworkId,
      stratum: observation.stratum,
      numerator: observation.hitCount,
      denominator: 1,
    })),
    holdoutStrata,
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
      ),
      sceneTop3: holdoutMetricReadiness(
        holdoutSceneTop3Metrics.evaluatedArtworkCount,
        holdoutSceneTop3Metrics.perStrata,
      ),
    },
  };
}
