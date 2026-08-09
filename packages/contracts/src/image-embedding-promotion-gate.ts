export interface ImageEmbeddingPromotionHoldoutGateEvidence {
  minimumSampleMet: boolean;
  count: number;
  pointEstimate: number;
  lowerConfidence: number;
  allMajorStrataSufficient: boolean;
}

export interface ImageEmbeddingPromotionHumanReviewGateEvidence {
  valid: boolean;
  complete: boolean;
  completedCount: number;
  uncertainRate: number;
  candidateAcceptableRate: number;
  candidateRegressionRate: number;
}

export interface ImageEmbeddingPromotionGateEvidence {
  bindingIntegrity: boolean;
  buildCoverageReady: boolean;
  artworkHoldout: ImageEmbeddingPromotionHoldoutGateEvidence;
  sceneHoldout: ImageEmbeddingPromotionHoldoutGateEvidence;
  reviewPackReady: boolean;
  humanReview: ImageEmbeddingPromotionHumanReviewGateEvidence;
  baselineBindingsReady: boolean;
  visualPolicySelectionReady: boolean;
}

export const IMAGE_EMBEDDING_PROMOTION_THRESHOLDS = {
  artworkPointEstimate: 0.8,
  artworkLowerConfidence: 0.7,
  scenePointEstimate: 0.7,
  sceneLowerConfidence: 0.6,
  humanReviewCount: 30,
  maximumUncertainRate: 0.1,
  minimumCandidateAcceptableRate: 0.8,
  maximumCandidateRegressionRate: 0.1,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseHoldout(value: unknown): ImageEmbeddingPromotionHoldoutGateEvidence | undefined {
  if (!isRecord(value)
    || !exactKeys(value, [
      "minimumSampleMet",
      "count",
      "pointEstimate",
      "lowerConfidence",
      "allMajorStrataSufficient",
    ])
    || typeof value.minimumSampleMet !== "boolean"
    || !Number.isInteger(value.count)
    || (value.count as number) < 0
    || !finiteNumber(value.pointEstimate)
    || !finiteNumber(value.lowerConfidence)
    || typeof value.allMajorStrataSufficient !== "boolean") {
    return undefined;
  }
  return value as unknown as ImageEmbeddingPromotionHoldoutGateEvidence;
}

function parseHumanReview(value: unknown): ImageEmbeddingPromotionHumanReviewGateEvidence | undefined {
  if (!isRecord(value)
    || !exactKeys(value, [
      "valid",
      "complete",
      "completedCount",
      "uncertainRate",
      "candidateAcceptableRate",
      "candidateRegressionRate",
    ])
    || typeof value.valid !== "boolean"
    || typeof value.complete !== "boolean"
    || !Number.isInteger(value.completedCount)
    || (value.completedCount as number) < 0
    || !finiteNumber(value.uncertainRate)
    || !finiteNumber(value.candidateAcceptableRate)
    || !finiteNumber(value.candidateRegressionRate)) {
    return undefined;
  }
  return value as unknown as ImageEmbeddingPromotionHumanReviewGateEvidence;
}

export function parseImageEmbeddingPromotionGateEvidence(
  value: unknown,
): ImageEmbeddingPromotionGateEvidence | undefined {
  if (!isRecord(value)
    || !exactKeys(value, [
      "bindingIntegrity",
      "buildCoverageReady",
      "artworkHoldout",
      "sceneHoldout",
      "reviewPackReady",
      "humanReview",
      "baselineBindingsReady",
      "visualPolicySelectionReady",
    ])) {
    return undefined;
  }
  const artworkHoldout = parseHoldout(value.artworkHoldout);
  const sceneHoldout = parseHoldout(value.sceneHoldout);
  const humanReview = parseHumanReview(value.humanReview);
  if (!artworkHoldout
    || !sceneHoldout
    || !humanReview
    || typeof value.bindingIntegrity !== "boolean"
    || typeof value.buildCoverageReady !== "boolean"
    || typeof value.reviewPackReady !== "boolean"
    || typeof value.baselineBindingsReady !== "boolean"
    || typeof value.visualPolicySelectionReady !== "boolean") {
    return undefined;
  }
  return {
    bindingIntegrity: value.bindingIntegrity,
    buildCoverageReady: value.buildCoverageReady,
    artworkHoldout,
    sceneHoldout,
    reviewPackReady: value.reviewPackReady,
    humanReview,
    baselineBindingsReady: value.baselineBindingsReady,
    visualPolicySelectionReady: value.visualPolicySelectionReady,
  };
}

export function isImageEmbeddingPromotionGateReady(value: unknown): boolean {
  const evidence = parseImageEmbeddingPromotionGateEvidence(value);
  if (!evidence) {
    return false;
  }
  const threshold = IMAGE_EMBEDDING_PROMOTION_THRESHOLDS;
  return evidence.bindingIntegrity
    && evidence.buildCoverageReady
    && evidence.artworkHoldout.minimumSampleMet
    && evidence.artworkHoldout.allMajorStrataSufficient
    && evidence.artworkHoldout.pointEstimate >= threshold.artworkPointEstimate
    && evidence.artworkHoldout.lowerConfidence >= threshold.artworkLowerConfidence
    && evidence.sceneHoldout.minimumSampleMet
    && evidence.sceneHoldout.allMajorStrataSufficient
    && evidence.sceneHoldout.pointEstimate >= threshold.scenePointEstimate
    && evidence.sceneHoldout.lowerConfidence >= threshold.sceneLowerConfidence
    && evidence.reviewPackReady
    && evidence.humanReview.valid
    && evidence.humanReview.complete
    && evidence.humanReview.completedCount >= threshold.humanReviewCount
    && evidence.humanReview.uncertainRate <= threshold.maximumUncertainRate
    && evidence.humanReview.candidateAcceptableRate >= threshold.minimumCandidateAcceptableRate
    && evidence.humanReview.candidateRegressionRate <= threshold.maximumCandidateRegressionRate
    && evidence.baselineBindingsReady
    && evidence.visualPolicySelectionReady;
}
