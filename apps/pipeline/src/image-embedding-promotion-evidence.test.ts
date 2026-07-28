import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import {
  validateImageEmbeddingA2aEvidence,
  validateImageEmbeddingE2eEvidence,
  validateImageEmbeddingFusionE2eEvidence,
  validateImageEmbeddingTextBenchmarkEvidence,
} from "./image-embedding-promotion-evidence";

function checksum(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

const context = {
  releaseVersion: "promotion-evidence-test",
  baseManifestChecksum: checksum("manifest"),
  commitSha: "a".repeat(40),
};
const binding = {
  releaseVersion: context.releaseVersion,
  baseManifestChecksum: context.baseManifestChecksum,
  commitSha: context.commitSha,
};

const a2aIds = Array.from({ length: 50 }, (_, index) => `a2a-${String(index + 1).padStart(2, "0")}`);
const e2eIds = Array.from({ length: 14 }, (_, index) => `e2e-${String(index + 1).padStart(2, "0")}`);
const fusionIds = Array.from({ length: 5 }, (_, index) => `fusion-${String(index + 1).padStart(2, "0")}`);

function passingTextEvidence(): object {
  return {
    schemaVersion: "image-embedding-text-benchmark-evidence.v1",
    ...binding,
    vectorBenchmark: {
      promptCount: 24,
      rerankTop1HitRate: 23 / 24,
      rerankTop5HitRate: 1,
      results: Array.from({ length: 24 }, (_, index) => ({
        id: `prompt-${String(index + 1).padStart(2, "0")}`,
        rerankTop1Hit: index !== 0,
        rerankTop5Hit: true,
      })),
    },
  };
}

function passingA2aEvidence(): object {
  return {
    schemaVersion: "image-embedding-a2a-evidence.v1",
    ...binding,
    caseSets: {
      baseline: { passIds: a2aIds, failIds: [], blockedIds: [] },
      candidate: { passIds: a2aIds, failIds: [], blockedIds: [] },
    },
    replay: {
      caseCount: 50,
      averageTotal: 0.975,
      hardResistanceViolationIds: [],
    },
  };
}

function passingE2eEvidence(): object {
  return {
    schemaVersion: "image-embedding-e2e-evidence.v1",
    ...binding,
    preflight: { command: "pnpm preflight:check", exitCode: 0 },
    caseSets: {
      baseline: { passIds: e2eIds, failIds: [], skippedIds: [] },
      candidate: { passIds: e2eIds, failIds: [], skippedIds: [] },
    },
  };
}

function passingFusionEvidence(): object {
  return {
    schemaVersion: "image-embedding-fusion-e2e-evidence.v1",
    ...binding,
    promotionBindingChecksum: checksum("promotion-binding"),
    preflight: { command: "pnpm preflight:check", exitCode: 0 },
    targetedE2e: {
      expectedCaseIds: fusionIds,
      passedCaseIds: fusionIds,
      failedCaseIds: [],
      skippedCaseIds: [],
    },
  };
}

test("promotion evidence accepts only bound evidence that meets every frozen threshold", () => {
  assert.equal(validateImageEmbeddingTextBenchmarkEvidence(passingTextEvidence(), context).valid, true);
  const roundedTextSummary = passingTextEvidence() as {
    vectorBenchmark: { rerankTop1HitRate: number };
  };
  roundedTextSummary.vectorBenchmark.rerankTop1HitRate = 0.958333;
  assert.equal(validateImageEmbeddingTextBenchmarkEvidence(roundedTextSummary, context).valid, true);
  assert.equal(validateImageEmbeddingA2aEvidence(passingA2aEvidence(), context).valid, true);
  assert.equal(validateImageEmbeddingE2eEvidence(passingE2eEvidence(), context).valid, true);
  assert.equal(validateImageEmbeddingFusionE2eEvidence(passingFusionEvidence(), {
    ...context,
    promotionBindingChecksum: checksum("promotion-binding"),
  }).valid, true);
});

test("promotion evidence fails closed for unknown schemas, regressions, and failed fusion cases", () => {
  assert.equal(validateImageEmbeddingTextBenchmarkEvidence({}, context).valid, false);
  assert.equal(validateImageEmbeddingA2aEvidence({}, context).valid, false);
  assert.equal(validateImageEmbeddingE2eEvidence({}, context).valid, false);
  assert.equal(validateImageEmbeddingFusionE2eEvidence({}, {
    ...context,
    promotionBindingChecksum: checksum("promotion-binding"),
  }).valid, false);

  const lowText = passingTextEvidence() as {
    vectorBenchmark: { rerankTop1HitRate: number };
  };
  lowText.vectorBenchmark.rerankTop1HitRate = 0;
  assert.equal(validateImageEmbeddingTextBenchmarkEvidence(lowText, context).valid, false);

  const wrongCommitText = passingTextEvidence() as { commitSha: string };
  wrongCommitText.commitSha = "b".repeat(40);
  assert.equal(validateImageEmbeddingTextBenchmarkEvidence(wrongCommitText, context).valid, false);

  const regressedA2a = passingA2aEvidence() as {
    caseSets: { candidate: { passIds: string[]; failIds: string[]; blockedIds: string[] } };
  };
  regressedA2a.caseSets.candidate = {
    passIds: a2aIds.slice(1),
    failIds: [a2aIds[0]!],
    blockedIds: [],
  };
  assert.equal(validateImageEmbeddingA2aEvidence(regressedA2a, context).valid, false);

  const skippedE2e = passingE2eEvidence() as {
    caseSets: { candidate: { passIds: string[]; failIds: string[]; skippedIds: string[] } };
  };
  skippedE2e.caseSets.candidate = {
    passIds: e2eIds.slice(1),
    failIds: [],
    skippedIds: [e2eIds[0]!],
  };
  assert.equal(validateImageEmbeddingE2eEvidence(skippedE2e, context).valid, false);

  const incompleteE2e = passingE2eEvidence() as {
    caseSets: {
      baseline: { passIds: string[]; failIds: string[]; skippedIds: string[] };
      candidate: { passIds: string[]; failIds: string[]; skippedIds: string[] };
    };
  };
  incompleteE2e.caseSets.baseline = { passIds: [], failIds: [], skippedIds: [] };
  incompleteE2e.caseSets.candidate = { passIds: [], failIds: [], skippedIds: [] };
  assert.equal(validateImageEmbeddingE2eEvidence(incompleteE2e, context).valid, false);

  const failedFusion = passingFusionEvidence() as {
    targetedE2e: { passedCaseIds: string[]; failedCaseIds: string[] };
  };
  failedFusion.targetedE2e = {
    ...failedFusion.targetedE2e,
    passedCaseIds: fusionIds.slice(1),
    failedCaseIds: [fusionIds[0]!],
  };
  assert.equal(validateImageEmbeddingFusionE2eEvidence(failedFusion, {
    ...context,
    promotionBindingChecksum: checksum("different-promotion-binding"),
  }).valid, false);
});
