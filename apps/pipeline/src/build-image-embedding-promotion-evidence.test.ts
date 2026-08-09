import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  buildImageEmbeddingPromotionEvidence,
  imageEmbeddingFusionE2eEnvironment,
} from "./build-image-embedding-promotion-evidence";
import {
  buildImageEmbeddingEvidenceSuiteDescriptor,
  type ImageEmbeddingEvidenceSuiteSourceFile,
} from "./image-embedding-promotion-evidence";

const RELEASE_VERSION = "image-embedding-evidence-producer-test";
const TEXT_IDS = Array.from({ length: 24 }, (_, index) => `prompt-${String(index + 1).padStart(2, "0")}`);
const A2A_PASS_IDS = Array.from({ length: 55 }, (_, index) => `a2a-pass-${String(index + 1).padStart(2, "0")}`);
const A2A_FAIL_IDS = Array.from({ length: 40 }, (_, index) => `a2a-fail-${String(index + 1).padStart(2, "0")}`);
const A2A_BLOCKED_IDS = Array.from({ length: 5 }, (_, index) => `a2a-blocked-${String(index + 1).padStart(2, "0")}`);
const A2A_REPLAY_IDS = Array.from({ length: 50 }, (_, index) => `a2a-replay-${String(index + 1).padStart(2, "0")}`);
const E2E_IDS = Array.from({ length: 14 }, (_, index) => `e2e-${String(index + 1).padStart(2, "0")}`);
const FUSION_IDS = Array.from({ length: 5 }, (_, index) => `fusion-${String(index + 1).padStart(2, "0")}`);
const TEXT_RUNNER = {
  manifestPath: `data/releases/${RELEASE_VERSION}/manifest.json`,
  promptsPath: "benchmarks/vector-promotion-prompts.json",
  requestedProviderMode: "local-hash",
  configuredProviderMode: "local-hash",
  provider: "local-hash",
  model: "local-hash-embedding-v1",
  dimensions: 256,
  limit: 10,
};
const FUSION_RUNNER = {
  suiteId: "image-embedding-fusion-e2e.v1",
  configPath: "apps/web/playwright.image-scene-fusion.config.ts",
  projectName: "image-scene-fusion",
  specPath: "apps/web/e2e/image-scene-fusion.spec.ts",
};

function checksum(value: string | Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  throw new TypeError("Unsupported canonical JSON value.");
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function initializeGitFixture(rootDir: string): void {
  const git = (args: string[]) => execFileSync("git", ["-C", rootDir, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  git(["init"]);
  git(["config", "user.email", "test@example.test"]);
  git(["config", "user.name", "ArtDuo Test"]);
  git(["add", "--all"]);
  git(["commit", "-m", "fixture"]);
}

function frozenEvidenceSuites(sourceFiles: ImageEmbeddingEvidenceSuiteSourceFile[]) {
  return {
    textBenchmark: buildImageEmbeddingEvidenceSuiteDescriptor({
      suiteType: "text-benchmark",
      suitePayload: { caseIds: TEXT_IDS, runner: TEXT_RUNNER },
      sourceFiles,
    }),
    a2a: {
      caseSet: buildImageEmbeddingEvidenceSuiteDescriptor({
        suiteType: "a2a-case-set",
        suitePayload: { baseline: { passIds: A2A_PASS_IDS, failIds: A2A_FAIL_IDS, blockedIds: A2A_BLOCKED_IDS } },
        sourceFiles,
      }),
      replay: buildImageEmbeddingEvidenceSuiteDescriptor({
        suiteType: "a2a-replay",
        suitePayload: { caseIds: A2A_REPLAY_IDS },
        sourceFiles,
      }),
    },
    e2e: buildImageEmbeddingEvidenceSuiteDescriptor({
      suiteType: "e2e",
      suitePayload: { baseline: { passIds: E2E_IDS, failIds: [], skippedIds: [] } },
      sourceFiles,
    }),
    fusionE2e: buildImageEmbeddingEvidenceSuiteDescriptor({
      suiteType: "fusion-e2e",
      suitePayload: { caseIds: FUSION_IDS, runner: FUSION_RUNNER },
      sourceFiles,
    }),
  };
}

function createFixture(): {
  rootDir: string;
  manifestPath: string;
  anchorPath: string;
  textRunnerPath: string;
  fusionRunnerPath: string;
  candidateShardPath: string;
  promotionReportPath: string;
  promotionBindingChecksum: `sha256:${string}`;
} {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-image-evidence-producer-"));
  const releaseDir = path.join(rootDir, "data", "releases", RELEASE_VERSION);
  const reportDir = path.join(rootDir, "data", "curation", "reports", "image-embeddings", RELEASE_VERSION);
  mkdirSync(releaseDir, { recursive: true });
  mkdirSync(reportDir, { recursive: true });
  const manifestPath = path.join(releaseDir, "manifest.json");
  writeJson(manifestPath, { release: { corpusVersion: RELEASE_VERSION } });
  const promptsPath = path.join(rootDir, TEXT_RUNNER.promptsPath);
  mkdirSync(path.dirname(promptsPath), { recursive: true });
  writeJson(promptsPath, TEXT_IDS.map((id) => ({ id })));
  const fusionConfigPath = path.join(rootDir, FUSION_RUNNER.configPath);
  const fusionSpecPath = path.join(rootDir, FUSION_RUNNER.specPath);
  mkdirSync(path.dirname(fusionConfigPath), { recursive: true });
  mkdirSync(path.dirname(fusionSpecPath), { recursive: true });
  writeFileSync(fusionConfigPath, "export default { project: 'image-scene-fusion' };\n");
  writeFileSync(fusionSpecPath, "test('frozen fusion suite', () => {});\n");
  const suiteSourcePath = path.join(rootDir, "evidence-suite-source.txt");
  writeFileSync(suiteSourcePath, "frozen suite source\n");
  const suites = frozenEvidenceSuites([
    { path: FUSION_RUNNER.specPath, checksum: checksum(readFileSync(fusionSpecPath)) },
    { path: FUSION_RUNNER.configPath, checksum: checksum(readFileSync(fusionConfigPath)) },
    { path: TEXT_RUNNER.promptsPath, checksum: checksum(readFileSync(promptsPath)) },
    { path: "evidence-suite-source.txt", checksum: checksum(readFileSync(suiteSourcePath)) },
  ]);
  const suiteManifestPath = path.join(reportDir, "promotion-evidence-suite-manifest.v1.json");
  writeJson(suiteManifestPath, {
    schemaVersion: "image-embedding-evidence-suite-manifest.v1",
    releaseVersion: RELEASE_VERSION,
    suites,
  });
  const anchorPath = path.join(reportDir, "promotion-anchor-set.json");
  writeJson(anchorPath, {
    schemaVersion: "image-embedding-promotion-anchor-set.v1",
    releaseVersion: RELEASE_VERSION,
    evidenceSuiteManifest: {
      schemaVersion: "image-embedding-evidence-suite-manifest.v1",
      path: "./promotion-evidence-suite-manifest.v1.json",
      checksum: checksum(readFileSync(suiteManifestPath)),
    },
  });
  const candidateShardPath = path.join(reportDir, "candidates", "image-embeddings-01.json");
  mkdirSync(path.dirname(candidateShardPath), { recursive: true });
  const candidate = [{ id: "artwork:fixture", entityType: "artwork", entityId: "fixture" }];
  writeJson(candidateShardPath, candidate);
  const promotionBindingPayload = {
    releaseVersion: RELEASE_VERSION,
    evaluationVersion: "image-embedding-evaluation.v1",
    baseManifestChecksum: checksum(readFileSync(manifestPath)),
    candidateShardChecksum: checksum(JSON.stringify(candidate, null, 2)),
    gateEvidence: {
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
    },
  };
  const promotionBindingChecksum = checksum(canonicalJson(promotionBindingPayload));
  const promotionReportPath = path.join(reportDir, "image-embedding-evaluation.json");
  writeJson(promotionReportPath, {
    schemaVersion: "image-embedding-evaluation-report.v1",
    releaseVersion: RELEASE_VERSION,
    promotionBindingPayload,
    promotionBinding: {
      ...promotionBindingPayload,
      promotionBindingChecksum,
      promotionReady: true,
      fusionVerificationReady: false,
    },
  });
  initializeGitFixture(rootDir);

  const textRunnerPath = path.join(rootDir, "text-runner.json");
  writeJson(textRunnerPath, {
    releaseVersion: RELEASE_VERSION,
    ...TEXT_RUNNER,
    manifestChecksum: checksum(readFileSync(manifestPath)),
    promptsChecksum: checksum(readFileSync(promptsPath)),
    promptCount: TEXT_IDS.length,
    rerankTop1HitRate: 23 / 24,
    rerankTop5HitRate: 1,
    results: TEXT_IDS.map((id, index) => ({ id, rerankTop1Hit: index !== 0, rerankTop5Hit: true })),
  });
  const fusionRunnerPath = path.join(rootDir, "fusion-runner.json");
  writeJson(fusionRunnerPath, {
    suites: [{
      title: "fusion",
      specs: FUSION_IDS.map((id) => ({ title: id, tests: [{ results: [{ status: "passed" }] }] })),
    }],
  });
  return {
    rootDir,
    manifestPath,
    anchorPath,
    textRunnerPath,
    fusionRunnerPath,
    candidateShardPath,
    promotionReportPath,
    promotionBindingChecksum,
  };
}

function writeFusionRunnerArtifact(filePath: string, binding: {
  releaseVersion: string;
  baseManifestChecksum: string;
  candidateShardChecksum: string;
  promotionReportChecksum: string;
  promotionBindingChecksum: string;
}): void {
  writeJson(filePath, {
    config: {
      configFile: path.join("/repo", FUSION_RUNNER.configPath),
      metadata: {
        imageEmbeddingEvidenceSuiteId: FUSION_RUNNER.suiteId,
        imageEmbeddingEvidenceConfigPath: FUSION_RUNNER.configPath,
        imageEmbeddingEvidenceProjectName: FUSION_RUNNER.projectName,
        imageEmbeddingEvidenceSpecPath: FUSION_RUNNER.specPath,
        imageEmbeddingEvidenceReleaseVersion: binding.releaseVersion,
        imageEmbeddingEvidenceBaseManifestChecksum: binding.baseManifestChecksum,
        imageEmbeddingEvidenceCandidateShardChecksum: binding.candidateShardChecksum,
        imageEmbeddingEvidencePromotionReportChecksum: binding.promotionReportChecksum,
        imageEmbeddingEvidencePromotionBindingChecksum: binding.promotionBindingChecksum,
      },
      projects: [{ id: FUSION_RUNNER.projectName, name: FUSION_RUNNER.projectName }],
    },
    suites: [{
      title: path.basename(FUSION_RUNNER.specPath),
      file: path.basename(FUSION_RUNNER.specPath),
      specs: FUSION_IDS.map((id) => ({
        title: id,
        file: path.basename(FUSION_RUNNER.specPath),
        tests: [{
          projectId: FUSION_RUNNER.projectName,
          projectName: FUSION_RUNNER.projectName,
          results: [{ status: "passed" }],
        }],
      })),
    }],
  });
}

function task5Reconstruction(filePath: string): {
  promotionBindingPayload: Record<string, unknown>;
  promotionBindingChecksum: string;
  promotionReady: boolean;
} {
  const report = JSON.parse(readFileSync(filePath, "utf8")) as {
    promotionBindingPayload: Record<string, unknown>;
    promotionBinding: { promotionBindingChecksum: string; promotionReady: boolean };
  };
  return {
    promotionBindingPayload: report.promotionBindingPayload,
    promotionBindingChecksum: report.promotionBinding.promotionBindingChecksum,
    promotionReady: report.promotionBinding.promotionReady,
  };
}

test("promotion evidence producer emits a text envelope recomputed from the raw benchmark", () => {
  const fixture = createFixture();
  const outputPath = path.join(fixture.rootDir, "text-evidence.json");

  const result = buildImageEmbeddingPromotionEvidence({
    rootDir: fixture.rootDir,
    releaseVersion: RELEASE_VERSION,
    manifestPath: fixture.manifestPath,
    promotionAnchorPath: fixture.anchorPath,
    outputPath,
    textBenchmarkRunnerArtifactPath: fixture.textRunnerPath,
  });

  const envelope = JSON.parse(readFileSync(outputPath, "utf8")) as {
    schemaVersion: string;
    runnerArtifactChecksum: string;
    runnerBinding: { promptsChecksum: string; manifestChecksum: string };
    vectorBenchmark: { results: Array<{ id: string; rerankTop1Hit: boolean }> };
  };
  assert.equal(result.kind, "text-benchmark");
  assert.equal(envelope.schemaVersion, "image-embedding-text-benchmark-evidence.v2");
  assert.equal(envelope.runnerArtifactChecksum, checksum(readFileSync(fixture.textRunnerPath)));
  assert.equal(envelope.runnerBinding.promptsChecksum, checksum(readFileSync(path.join(fixture.rootDir, TEXT_RUNNER.promptsPath))));
  assert.equal(envelope.runnerBinding.manifestChecksum, checksum(readFileSync(fixture.manifestPath)));
  assert.equal(envelope.vectorBenchmark.results.filter((row) => row.rerankTop1Hit).length, 23);
});

test("promotion evidence producer normalizes raw Playwright fusion output instead of treating it as an envelope", () => {
  const fixture = createFixture();
  const outputPath = path.join(fixture.rootDir, "fusion-evidence.json");
  const fusionRunnerOutputPath = path.join(fixture.rootDir, "fresh-fusion-runner.json");
  const promotionBindingChecksum = fixture.promotionBindingChecksum;
  let fixedSuiteRuns = 0;

  const result = buildImageEmbeddingPromotionEvidence({
    rootDir: fixture.rootDir,
    releaseVersion: RELEASE_VERSION,
    manifestPath: fixture.manifestPath,
    promotionAnchorPath: fixture.anchorPath,
    outputPath,
    fusionE2eRunnerArtifactOutputPath: fusionRunnerOutputPath,
    fusionCandidateShardPath: fixture.candidateShardPath,
    fusionPromotionReportPath: fixture.promotionReportPath,
    promotionBindingChecksum,
    task5EvaluationCheck: () => task5Reconstruction(fixture.promotionReportPath),
    fusionE2eCheck: (input) => {
      fixedSuiteRuns += 1;
      assert.notEqual(input.artifactPath, fusionRunnerOutputPath, "the runner must write into producer-owned temporary storage");
      assert.equal(input.baseManifestPath, fixture.manifestPath);
      assert.equal(input.candidateShardPath, fixture.candidateShardPath);
      assert.equal(input.promotionReportPath, fixture.promotionReportPath);
      writeFusionRunnerArtifact(input.artifactPath, input.binding);
      return { command: "pnpm test:e2e:fusion", exitCode: 0 };
    },
    preflightCheck: () => ({ command: "pnpm preflight:check", exitCode: 0 }),
  });

  const envelope = JSON.parse(readFileSync(outputPath, "utf8")) as {
    schemaVersion: string;
    runnerArtifactChecksum: string;
    promotionBindingChecksum: string;
    targetedE2e: { passedCaseIds: string[]; failedCaseIds: string[] };
  };
  assert.equal(result.kind, "fusion-e2e");
  assert.equal(fixedSuiteRuns, 1);
  assert.equal(envelope.schemaVersion, "image-embedding-fusion-e2e-evidence.v2");
  assert.equal(envelope.runnerArtifactChecksum, checksum(readFileSync(fusionRunnerOutputPath)));
  assert.equal(envelope.promotionBindingChecksum, promotionBindingChecksum);
  assert.deepEqual(envelope.targetedE2e.passedCaseIds, FUSION_IDS);
  assert.deepEqual(envelope.targetedE2e.failedCaseIds, []);
});

test("promotion evidence producer refuses an existing fusion runner output without changing its bytes", () => {
  const fixture = createFixture();
  const outputPath = path.join(fixture.rootDir, "fusion-evidence.json");
  const originalBytes = readFileSync(fixture.fusionRunnerPath);
  let fixedSuiteRuns = 0;

  assert.throws(() => buildImageEmbeddingPromotionEvidence({
    rootDir: fixture.rootDir,
    releaseVersion: RELEASE_VERSION,
    manifestPath: fixture.manifestPath,
    promotionAnchorPath: fixture.anchorPath,
    outputPath,
    fusionE2eRunnerArtifactOutputPath: fixture.fusionRunnerPath,
    fusionCandidateShardPath: fixture.candidateShardPath,
    fusionPromotionReportPath: fixture.promotionReportPath,
    promotionBindingChecksum: fixture.promotionBindingChecksum,
    fusionE2eCheck: (input) => {
      fixedSuiteRuns += 1;
      writeFusionRunnerArtifact(input.artifactPath, input.binding);
      return { command: "pnpm test:e2e:fusion", exitCode: 0 };
    },
    preflightCheck: () => ({ command: "pnpm preflight:check", exitCode: 0 }),
  }), /already exists/u);

  assert.equal(fixedSuiteRuns, 0);
  assert.deepEqual(readFileSync(fixture.fusionRunnerPath), originalBytes);
});

test("fusion runner environment discards inherited input overrides and carries only producer-locked Task 5 bindings", () => {
  const fixture = createFixture();
  const binding = {
    releaseVersion: RELEASE_VERSION,
    baseManifestChecksum: checksum(readFileSync(fixture.manifestPath)),
    candidateShardChecksum: checksum(JSON.stringify(JSON.parse(readFileSync(fixture.candidateShardPath, "utf8")), null, 2)),
    promotionReportChecksum: checksum(readFileSync(fixture.promotionReportPath)),
    promotionBindingChecksum: fixture.promotionBindingChecksum,
  };
  const environment = imageEmbeddingFusionE2eEnvironment({
    artifactPath: "/tmp/locked-playwright.json",
    baseManifestPath: fixture.manifestPath,
    candidateShardPath: fixture.candidateShardPath,
    promotionReportPath: fixture.promotionReportPath,
    binding,
  }, {
    ARTDUO_FUSION_E2E_BASE_MANIFEST: "/tmp/forged-base.json",
    ARTDUO_FUSION_E2E_CANDIDATE_SHARD: "/tmp/forged-candidate.json",
    ARTDUO_FUSION_E2E_PROMOTION_REPORT: "/tmp/forged-report.json",
    ARTDUO_FUSION_E2E_RELEASE_VERSION: "forged-release",
  });

  assert.equal(environment.ARTDUO_FUSION_E2E_BASE_MANIFEST, undefined);
  assert.equal(environment.ARTDUO_FUSION_E2E_CANDIDATE_SHARD, undefined);
  assert.equal(environment.ARTDUO_FUSION_E2E_PROMOTION_REPORT, undefined);
  assert.equal(environment.ARTDUO_FUSION_E2E_RELEASE_VERSION, undefined);
  assert.equal(environment.ARTDUO_FUSION_E2E_LOCKED_BASE_MANIFEST, fixture.manifestPath);
  assert.equal(environment.ARTDUO_FUSION_E2E_LOCKED_CANDIDATE_SHARD, fixture.candidateShardPath);
  assert.equal(environment.ARTDUO_FUSION_E2E_LOCKED_PROMOTION_REPORT, fixture.promotionReportPath);
  assert.equal(environment.ARTDUO_FUSION_E2E_LOCKED_PROMOTION_BINDING_CHECKSUM, fixture.promotionBindingChecksum);
});

test("promotion evidence producer rejects promotionReady=true when the canonical Task 5 gates are not ready", () => {
  const fixture = createFixture();
  const report = JSON.parse(readFileSync(fixture.promotionReportPath, "utf8")) as {
    promotionBindingPayload: { gateEvidence: { reviewPackReady: boolean } };
    promotionBinding: { promotionBindingChecksum: string; promotionReady: boolean };
  };
  report.promotionBindingPayload.gateEvidence.reviewPackReady = false;
  const promotionBindingChecksum = checksum(canonicalJson(report.promotionBindingPayload));
  report.promotionBinding.promotionBindingChecksum = promotionBindingChecksum;
  report.promotionBinding.promotionReady = true;
  writeJson(fixture.promotionReportPath, report);
  initializeGitFixture(fixture.rootDir);
  let fusionRuns = 0;

  assert.throws(() => buildImageEmbeddingPromotionEvidence({
    rootDir: fixture.rootDir,
    releaseVersion: RELEASE_VERSION,
    manifestPath: fixture.manifestPath,
    promotionAnchorPath: fixture.anchorPath,
    outputPath: path.join(fixture.rootDir, "fusion-evidence.json"),
    fusionE2eRunnerArtifactOutputPath: path.join(fixture.rootDir, "fresh-fusion-runner.json"),
    fusionCandidateShardPath: fixture.candidateShardPath,
    fusionPromotionReportPath: fixture.promotionReportPath,
    promotionBindingChecksum,
    fusionE2eCheck: (input) => {
      fusionRuns += 1;
      writeFusionRunnerArtifact(input.artifactPath, input.binding);
      return { command: "pnpm test:e2e:fusion", exitCode: 0 };
    },
    preflightCheck: () => ({ command: "pnpm preflight:check", exitCode: 0 }),
  }), /canonical Task 5 gates/u);
  assert.equal(fusionRuns, 0);
});

test("promotion evidence producer rejects a self-hashed payload that disagrees with the independently reconstructed Task 5 evaluation", () => {
  const fixture = createFixture();
  const reconstructed = task5Reconstruction(fixture.promotionReportPath);
  const reconstructedPayload = structuredClone(reconstructed.promotionBindingPayload) as {
    gateEvidence: { reviewPackReady: boolean };
  };
  reconstructedPayload.gateEvidence.reviewPackReady = false;
  const reconstructedChecksum = checksum(canonicalJson(reconstructedPayload));
  let fusionRuns = 0;

  assert.throws(() => buildImageEmbeddingPromotionEvidence({
    rootDir: fixture.rootDir,
    releaseVersion: RELEASE_VERSION,
    manifestPath: fixture.manifestPath,
    promotionAnchorPath: fixture.anchorPath,
    outputPath: path.join(fixture.rootDir, "fusion-evidence.json"),
    fusionE2eRunnerArtifactOutputPath: path.join(fixture.rootDir, "fresh-fusion-runner.json"),
    fusionCandidateShardPath: fixture.candidateShardPath,
    fusionPromotionReportPath: fixture.promotionReportPath,
    promotionBindingChecksum: fixture.promotionBindingChecksum,
    task5EvaluationCheck: () => ({
      promotionBindingPayload: reconstructedPayload,
      promotionBindingChecksum: reconstructedChecksum,
      promotionReady: false,
    }),
    fusionE2eCheck: (input) => {
      fusionRuns += 1;
      writeFusionRunnerArtifact(input.artifactPath, input.binding);
      return { command: "pnpm test:e2e:fusion", exitCode: 0 };
    },
    preflightCheck: () => ({ command: "pnpm preflight:check", exitCode: 0 }),
  }), /independently reconstructed Task 5 evaluation/u);
  assert.equal(fusionRuns, 0);
});

test("production fusion evidence refuses to trust a Task 5 report without every reconstruction input", () => {
  const fixture = createFixture();
  let fusionRuns = 0;

  assert.throws(() => buildImageEmbeddingPromotionEvidence({
    rootDir: fixture.rootDir,
    releaseVersion: RELEASE_VERSION,
    manifestPath: fixture.manifestPath,
    promotionAnchorPath: fixture.anchorPath,
    outputPath: path.join(fixture.rootDir, "fusion-evidence.json"),
    fusionE2eRunnerArtifactOutputPath: path.join(fixture.rootDir, "fresh-fusion-runner.json"),
    fusionCandidateShardPath: fixture.candidateShardPath,
    fusionPromotionReportPath: fixture.promotionReportPath,
    promotionBindingChecksum: fixture.promotionBindingChecksum,
    fusionE2eCheck: (input) => {
      fusionRuns += 1;
      writeFusionRunnerArtifact(input.artifactPath, input.binding);
      return { command: "pnpm test:e2e:fusion", exitCode: 0 };
    },
    preflightCheck: () => ({ command: "pnpm preflight:check", exitCode: 0 }),
  }), /explicit Task 5 reconstruction inputs/u);
  assert.equal(fusionRuns, 0);
});
