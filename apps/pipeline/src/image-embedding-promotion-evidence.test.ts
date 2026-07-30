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

const textPromptIds = Array.from({ length: 24 }, (_, index) => `prompt-${String(index + 1).padStart(2, "0")}`);
const a2aPassIds = Array.from({ length: 55 }, (_, index) => `a2a-pass-${String(index + 1).padStart(2, "0")}`);
const a2aFailIds = Array.from({ length: 40 }, (_, index) => `a2a-fail-${String(index + 1).padStart(2, "0")}`);
const a2aBlockedIds = Array.from({ length: 5 }, (_, index) => `a2a-blocked-${String(index + 1).padStart(2, "0")}`);
const a2aReplayIds = Array.from({ length: 50 }, (_, index) => `a2a-replay-${String(index + 1).padStart(2, "0")}`);
const e2eIds = Array.from({ length: 14 }, (_, index) => `e2e-${String(index + 1).padStart(2, "0")}`);
const fusionIds = Array.from({ length: 5 }, (_, index) => `fusion-${String(index + 1).padStart(2, "0")}`);

const evidenceSuites = {
  textBenchmark: {
    suiteChecksum: checksum("text-suite"),
    caseIds: textPromptIds,
  },
  a2a: {
    caseSet: {
      suiteChecksum: checksum("a2a-case-set-suite"),
      baseline: { passIds: a2aPassIds, failIds: a2aFailIds, blockedIds: a2aBlockedIds },
    },
    replay: {
      suiteChecksum: checksum("a2a-replay-suite"),
      caseIds: a2aReplayIds,
    },
  },
  e2e: {
    suiteChecksum: checksum("e2e-suite"),
    baseline: { passIds: e2eIds, failIds: [], skippedIds: [] },
  },
  fusionE2e: {
    suiteChecksum: checksum("fusion-suite"),
    caseIds: fusionIds,
  },
};

const runnerArtifactChecksums = {
  textBenchmark: checksum("text-runner-artifact"),
  a2aCaseSet: checksum("a2a-case-set-runner-artifact"),
  a2aReplay: checksum("a2a-replay-runner-artifact"),
  e2e: checksum("e2e-runner-artifact"),
  fusionE2e: checksum("fusion-runner-artifact"),
};

const context = {
  releaseVersion: "promotion-evidence-test",
  baseManifestChecksum: checksum("manifest"),
  commitSha: "a".repeat(40),
  evidenceSuites,
  runnerArtifactChecksums,
};
const binding = {
  releaseVersion: context.releaseVersion,
  baseManifestChecksum: context.baseManifestChecksum,
  commitSha: context.commitSha,
};

function passingTextEvidence(): object {
  return {
    schemaVersion: "image-embedding-text-benchmark-evidence.v2",
    ...binding,
    suiteChecksum: evidenceSuites.textBenchmark.suiteChecksum,
    runnerArtifactChecksum: runnerArtifactChecksums.textBenchmark,
    vectorBenchmark: {
      promptCount: 24,
      rerankTop1HitRate: 23 / 24,
      rerankTop5HitRate: 1,
      results: textPromptIds.map((id, index) => ({
        id,
        rerankTop1Hit: index !== 0,
        rerankTop5Hit: true,
      })),
    },
  };
}

function passingA2aEvidence(): object {
  return {
    schemaVersion: "image-embedding-a2a-evidence.v2",
    ...binding,
    caseSet: {
      suiteChecksum: evidenceSuites.a2a.caseSet.suiteChecksum,
      runnerArtifactChecksum: runnerArtifactChecksums.a2aCaseSet,
      baseline: evidenceSuites.a2a.caseSet.baseline,
      candidate: evidenceSuites.a2a.caseSet.baseline,
    },
    replay: {
      suiteChecksum: evidenceSuites.a2a.replay.suiteChecksum,
      runnerArtifactChecksum: runnerArtifactChecksums.a2aReplay,
      caseIds: a2aReplayIds,
      averageTotal: 0.975,
      hardResistanceViolationIds: [],
    },
  };
}

function passingE2eEvidence(): object {
  return {
    schemaVersion: "image-embedding-e2e-evidence.v2",
    ...binding,
    suiteChecksum: evidenceSuites.e2e.suiteChecksum,
    runnerArtifactChecksum: runnerArtifactChecksums.e2e,
    preflight: { command: "pnpm preflight:check", exitCode: 0 },
    caseSets: {
      baseline: { passIds: e2eIds, failIds: [], skippedIds: [] },
      candidate: { passIds: e2eIds, failIds: [], skippedIds: [] },
    },
  };
}

function passingFusionEvidence(): object {
  return {
    schemaVersion: "image-embedding-fusion-e2e-evidence.v2",
    ...binding,
    suiteChecksum: evidenceSuites.fusionE2e.suiteChecksum,
    runnerArtifactChecksum: runnerArtifactChecksums.fusionE2e,
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

test("promotion evidence accepts independently bound frozen suites that meet every threshold", () => {
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
    caseSet: { candidate: { passIds: string[]; failIds: string[]; blockedIds: string[] } };
  };
  regressedA2a.caseSet.candidate = {
    passIds: a2aPassIds.slice(1),
    failIds: [...a2aFailIds, a2aPassIds[0]!],
    blockedIds: a2aBlockedIds,
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

test("promotion evidence rejects forged IDs and a detached runner artifact despite matching counts", () => {
  const forgedText = passingTextEvidence() as {
    vectorBenchmark: { results: Array<{ id: string; rerankTop1Hit: boolean; rerankTop5Hit: boolean }> };
  };
  forgedText.vectorBenchmark.results = Array.from({ length: 24 }, (_, index) => ({
    id: `forged-prompt-${String(index + 1).padStart(2, "0")}`,
    rerankTop1Hit: index !== 0,
    rerankTop5Hit: true,
  }));
  assert.equal(validateImageEmbeddingTextBenchmarkEvidence(forgedText, context).valid, false);

  const wrongA2aReplay = passingA2aEvidence() as {
    replay: { caseIds: string[] };
  };
  wrongA2aReplay.replay.caseIds = Array.from({ length: 50 }, (_, index) => `forged-a2a-${index + 1}`);
  assert.equal(validateImageEmbeddingA2aEvidence(wrongA2aReplay, context).valid, false);

  const forgedE2e = passingE2eEvidence() as {
    caseSets: {
      baseline: { passIds: string[]; failIds: string[]; skippedIds: string[] };
      candidate: { passIds: string[]; failIds: string[]; skippedIds: string[] };
    };
  };
  const forgedE2eIds = Array.from({ length: 14 }, (_, index) => `forged-e2e-${index + 1}`);
  forgedE2e.caseSets.baseline = { passIds: forgedE2eIds, failIds: [], skippedIds: [] };
  forgedE2e.caseSets.candidate = { passIds: forgedE2eIds, failIds: [], skippedIds: [] };
  assert.equal(validateImageEmbeddingE2eEvidence(forgedE2e, context).valid, false);

  const detachedArtifact = passingFusionEvidence() as { runnerArtifactChecksum: string };
  detachedArtifact.runnerArtifactChecksum = checksum("different-runner-artifact");
  assert.equal(validateImageEmbeddingFusionE2eEvidence(detachedArtifact, {
    ...context,
    promotionBindingChecksum: checksum("promotion-binding"),
  }).valid, false);
});

test("promotion evidence binds the current raw runner artifact without pinning it to the frozen suite", () => {
  const currentRunnerArtifactChecksum = checksum("candidate-text-runner-artifact");
  const evidence = passingTextEvidence() as { runnerArtifactChecksum: string };
  evidence.runnerArtifactChecksum = currentRunnerArtifactChecksum;

  assert.equal(validateImageEmbeddingTextBenchmarkEvidence(evidence, {
    ...context,
    runnerArtifactChecksums: {
      ...context.runnerArtifactChecksums,
      textBenchmark: currentRunnerArtifactChecksum,
    },
  }).valid, true);
});
