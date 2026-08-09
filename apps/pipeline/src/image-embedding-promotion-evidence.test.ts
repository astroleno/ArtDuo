import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import {
  parseImageEmbeddingA2aCaseSetRunnerArtifact,
  parseImageEmbeddingA2aReplayRunnerArtifact,
  parseImageEmbeddingPlaywrightRunnerArtifact,
  parseImageEmbeddingTextBenchmarkRunnerArtifact,
} from "./image-embedding-evidence-artifacts";
import {
  buildImageEmbeddingEvidenceSuiteDescriptor,
  imageEmbeddingEvidencePreflightEnvironment,
  parseImageEmbeddingEvidenceSuiteBindings,
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
const frozenPromptChecksum = checksum("frozen-vector-prompts");
const sourceFiles = [
  { path: "benchmarks/vector-promotion-prompts.json", checksum: frozenPromptChecksum },
  { path: "test/evidence-suite-source.ts", checksum: checksum("suite-source") },
];
const textRunnerBinding = {
  manifestPath: "data/releases/promotion-evidence-test/manifest.json",
  promptsPath: "benchmarks/vector-promotion-prompts.json",
  requestedProviderMode: "local-hash",
  configuredProviderMode: "local-hash",
  provider: "local-hash",
  model: "local-hash-embedding-v1",
  dimensions: 256,
  limit: 10,
};

const evidenceSuites = {
  textBenchmark: buildImageEmbeddingEvidenceSuiteDescriptor({
    suiteType: "text-benchmark",
    suitePayload: { caseIds: textPromptIds, runner: textRunnerBinding },
    sourceFiles,
  }),
  a2a: {
    caseSet: buildImageEmbeddingEvidenceSuiteDescriptor({
      suiteType: "a2a-case-set",
      suitePayload: { baseline: { passIds: a2aPassIds, failIds: a2aFailIds, blockedIds: a2aBlockedIds } },
      sourceFiles,
    }),
    replay: buildImageEmbeddingEvidenceSuiteDescriptor({
      suiteType: "a2a-replay",
      suitePayload: { caseIds: a2aReplayIds },
      sourceFiles,
    }),
  },
  e2e: buildImageEmbeddingEvidenceSuiteDescriptor({
    suiteType: "e2e",
    suitePayload: { baseline: { passIds: e2eIds, failIds: [], skippedIds: [] } },
    sourceFiles,
  }),
  fusionE2e: buildImageEmbeddingEvidenceSuiteDescriptor({
    suiteType: "fusion-e2e",
    suitePayload: { caseIds: fusionIds },
    sourceFiles,
  }),
};

const runnerArtifactChecksums = {
  textBenchmark: checksum("text-runner-artifact"),
  a2aCaseSet: checksum("a2a-case-set-runner-artifact"),
  a2aReplay: checksum("a2a-replay-runner-artifact"),
  e2e: checksum("e2e-runner-artifact"),
  fusionE2e: checksum("fusion-runner-artifact"),
};

function playwrightRunnerArtifact(caseIds: string[], failedIds: string[] = []): object {
  return {
    suites: [{
      title: "image-embedding",
      specs: caseIds.map((id) => ({
        title: id,
        tests: [{
          results: [{ status: failedIds.includes(id) ? "failed" : "passed" }],
        }],
      })),
    }],
  };
}

const rawRunnerArtifacts = {
  textBenchmark: {
    releaseVersion: "promotion-evidence-test",
    manifestPath: textRunnerBinding.manifestPath,
    manifestChecksum: checksum("manifest"),
    promptsPath: textRunnerBinding.promptsPath,
    promptsChecksum: frozenPromptChecksum,
    requestedProviderMode: textRunnerBinding.requestedProviderMode,
    configuredProviderMode: textRunnerBinding.configuredProviderMode,
    provider: textRunnerBinding.provider,
    model: textRunnerBinding.model,
    dimensions: textRunnerBinding.dimensions,
    limit: textRunnerBinding.limit,
    promptCount: 24,
    rerankTop1HitRate: 23 / 24,
    rerankTop5HitRate: 1,
    results: textPromptIds.map((id, index) => ({
      id,
      rerankTop1Hit: index !== 0,
      rerankTop5Hit: true,
    })),
  },
  a2aCaseSet: {
    counts: { pass: 55, fail: 40, blocked: 5 },
    results: [
      ...a2aPassIds.map((id) => ({ id, status: "pass" })),
      ...a2aFailIds.map((id) => ({ id, status: "fail" })),
      ...a2aBlockedIds.map((id) => ({ id, status: "blocked" })),
    ],
  },
  a2aReplay: a2aReplayIds.map((id) => ({
    id,
    scores: { total: 0.975 },
    output: { curveMetrics: { hardResistanceViolations: 0 } },
  })),
  e2e: playwrightRunnerArtifact(e2eIds),
  fusionE2e: playwrightRunnerArtifact(fusionIds),
};

const runnerArtifacts = {
  textBenchmark: parseImageEmbeddingTextBenchmarkRunnerArtifact(rawRunnerArtifacts.textBenchmark).artifact!,
  a2aCaseSet: parseImageEmbeddingA2aCaseSetRunnerArtifact(rawRunnerArtifacts.a2aCaseSet).artifact!,
  a2aReplay: parseImageEmbeddingA2aReplayRunnerArtifact(rawRunnerArtifacts.a2aReplay).artifact!,
  e2e: parseImageEmbeddingPlaywrightRunnerArtifact(rawRunnerArtifacts.e2e).artifact!,
  fusionE2e: parseImageEmbeddingPlaywrightRunnerArtifact(rawRunnerArtifacts.fusionE2e).artifact!,
};

const context = {
  releaseVersion: "promotion-evidence-test",
  baseManifestChecksum: checksum("manifest"),
  commitSha: "a".repeat(40),
  evidenceSuites,
  runnerArtifactChecksums,
  runnerArtifacts,
  preflight: { command: "pnpm preflight:check", exitCode: 0 },
};

test("evidence preflight forces an isolated CI browser server", () => {
  const environment = imageEmbeddingEvidencePreflightEnvironment(
    { CI: "0", CUSTOM_FLAG: "kept", ARTDUO_WEB_E2E_PORT: "3211" },
    "43121",
  );

  assert.equal(environment.CI, "1");
  assert.equal(environment.CUSTOM_FLAG, "kept");
  assert.equal(environment.ARTDUO_WEB_E2E_PORT, "43121");
});

test("frozen suite parser recomputes the canonical checksum after case content changes", () => {
  const changed = structuredClone(evidenceSuites);
  changed.e2e.baseline.passIds[0] = "weakened-e2e-case";

  const parsed = parseImageEmbeddingEvidenceSuiteBindings(changed);
  assert.equal(parsed.bindings, undefined);
  assert.ok(parsed.reasons.some((reason) => /checksum does not match its canonical manifest/i.test(reason)));
});

test("text benchmark parser preserves the frozen input and runtime binding", () => {
  const parsed = parseImageEmbeddingTextBenchmarkRunnerArtifact(rawRunnerArtifacts.textBenchmark);

  assert.deepEqual(parsed.reasons, []);
  assert.deepEqual(parsed.artifact?.runnerBinding, {
    ...textRunnerBinding,
    manifestChecksum: checksum("manifest"),
    promptsChecksum: frozenPromptChecksum,
  });
});
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
    runnerBinding: {
      ...textRunnerBinding,
      manifestChecksum: checksum("manifest"),
      promptsChecksum: frozenPromptChecksum,
    },
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

test("promotion evidence rejects a forged text pass envelope when the raw benchmark contains another miss", () => {
  const rawText = {
    ...rawRunnerArtifacts.textBenchmark,
    results: rawRunnerArtifacts.textBenchmark.results.map((result, index) =>
      index === 1 ? { ...result, rerankTop1Hit: false } : result),
  };
  const textBenchmark = parseImageEmbeddingTextBenchmarkRunnerArtifact(rawText).artifact!;

  assert.equal(validateImageEmbeddingTextBenchmarkEvidence(passingTextEvidence(), {
    ...context,
    runnerArtifacts: { ...runnerArtifacts, textBenchmark },
  }).valid, false);
});

test("promotion evidence rejects a text benchmark produced from substituted inputs or runtime settings", () => {
  const mutations: Array<[string, unknown]> = [
    ["promptsPath", "benchmarks/easier-prompts.json"],
    ["promptsChecksum", checksum("replacement-prompts")],
    ["manifestPath", "data/releases/another/manifest.json"],
    ["manifestChecksum", checksum("replacement-manifest")],
    ["provider", "remote-provider"],
    ["model", "different-model"],
    ["dimensions", 128],
    ["limit", 100],
  ];

  for (const [field, value] of mutations) {
    const rawText = structuredClone(rawRunnerArtifacts.textBenchmark) as Record<string, unknown>;
    rawText[field] = value;
    const textBenchmark = parseImageEmbeddingTextBenchmarkRunnerArtifact(rawText).artifact!;
    const result = validateImageEmbeddingTextBenchmarkEvidence(passingTextEvidence(), {
      ...context,
      runnerArtifacts: { ...runnerArtifacts, textBenchmark },
    });
    assert.equal(result.valid, false, `${field} substitution must fail closed`);
  }
});

test("promotion evidence rejects a forged A2A pass envelope when the raw harness regresses a pass", () => {
  const rawCaseSet = {
    ...rawRunnerArtifacts.a2aCaseSet,
    results: rawRunnerArtifacts.a2aCaseSet.results.map((result) =>
      result.id === a2aPassIds[0] ? { ...result, status: "fail" } : result),
  };
  rawCaseSet.counts = { pass: 54, fail: 41, blocked: 5 };
  const a2aCaseSet = parseImageEmbeddingA2aCaseSetRunnerArtifact(rawCaseSet).artifact!;

  assert.equal(validateImageEmbeddingA2aEvidence(passingA2aEvidence(), {
    ...context,
    runnerArtifacts: { ...runnerArtifacts, a2aCaseSet },
  }).valid, false);
});

test("promotion evidence rejects a forged A2A replay envelope when the raw replay score differs", () => {
  const rawReplay = rawRunnerArtifacts.a2aReplay.map((result, index) =>
    index === 0 ? { ...result, scores: { total: 0.5 } } : result);
  const a2aReplay = parseImageEmbeddingA2aReplayRunnerArtifact(rawReplay).artifact!;

  assert.equal(validateImageEmbeddingA2aEvidence(passingA2aEvidence(), {
    ...context,
    runnerArtifacts: { ...runnerArtifacts, a2aReplay },
  }).valid, false);
});

test("promotion evidence rejects forged E2E and fusion passes when raw Playwright outcomes fail", () => {
  const e2e = parseImageEmbeddingPlaywrightRunnerArtifact(playwrightRunnerArtifact(e2eIds, [e2eIds[0]!])).artifact!;
  assert.equal(validateImageEmbeddingE2eEvidence(passingE2eEvidence(), {
    ...context,
    runnerArtifacts: { ...runnerArtifacts, e2e },
  }).valid, false);
  const fusionE2e = parseImageEmbeddingPlaywrightRunnerArtifact(playwrightRunnerArtifact(fusionIds, [fusionIds[0]!])).artifact!;
  assert.equal(validateImageEmbeddingFusionE2eEvidence(passingFusionEvidence(), {
    ...context,
    runnerArtifacts: { ...runnerArtifacts, fusionE2e },
    promotionBindingChecksum: checksum("promotion-binding"),
  }).valid, false);
});
