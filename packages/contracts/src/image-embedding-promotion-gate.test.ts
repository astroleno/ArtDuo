import assert from "node:assert/strict";
import { test } from "node:test";

import * as contracts from "./index";

const passingGateEvidence = {
  bindingIntegrity: true,
  buildCoverageReady: true,
  artworkHoldout: {
    minimumSampleMet: true,
    count: 60,
    pointEstimate: 0.9,
    lowerConfidence: 0.8,
    allMajorStrataSufficient: true,
  },
  sceneHoldout: {
    minimumSampleMet: true,
    count: 60,
    pointEstimate: 0.8,
    lowerConfidence: 0.7,
    allMajorStrataSufficient: true,
  },
  reviewPackReady: true,
  humanReview: {
    valid: true,
    complete: true,
    completedCount: 30,
    uncertainRate: 0.05,
    candidateAcceptableRate: 0.9,
    candidateRegressionRate: 0.05,
  },
  baselineBindingsReady: true,
  visualPolicySelectionReady: true,
};

test("promotion gate accepts sufficient major strata even when long-tail diagnostic strata are insufficient", () => {
  const validator = (contracts as Record<string, unknown>).isImageEmbeddingPromotionGateReady;
  assert.equal(typeof validator, "function");

  const weakLabelDiagnostics = {
    artwork: { allMajorStrataSufficient: true, allStrataSufficient: false },
    scene: { allMajorStrataSufficient: true, allStrataSufficient: false },
  };
  const evidence = structuredClone(passingGateEvidence);
  evidence.artworkHoldout.allMajorStrataSufficient = weakLabelDiagnostics.artwork.allMajorStrataSufficient;
  evidence.sceneHoldout.allMajorStrataSufficient = weakLabelDiagnostics.scene.allMajorStrataSufficient;

  assert.equal((validator as (value: unknown) => boolean)(evidence), true);
  assert.equal(weakLabelDiagnostics.artwork.allStrataSufficient, false);
  assert.equal(weakLabelDiagnostics.scene.allStrataSufficient, false);
});

test("promotion gate rejects an unknown or weakened gate schema", () => {
  const validator = (contracts as Record<string, unknown>).isImageEmbeddingPromotionGateReady;
  assert.equal(typeof validator, "function");
  const legacy = structuredClone(passingGateEvidence) as Record<string, unknown>;
  const artwork = legacy.artworkHoldout as Record<string, unknown>;
  delete artwork.allMajorStrataSufficient;
  artwork.allStrataSufficient = true;

  assert.equal((validator as (value: unknown) => boolean)(legacy), false);
});
