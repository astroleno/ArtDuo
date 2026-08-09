import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { buildImageEmbeddingPromotionEvidence } from "./build-image-embedding-promotion-evidence";
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

function checksum(value: string | Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
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
      suitePayload: { caseIds: TEXT_IDS },
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
      suitePayload: { caseIds: FUSION_IDS },
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
} {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-image-evidence-producer-"));
  const releaseDir = path.join(rootDir, "data", "releases", RELEASE_VERSION);
  const reportDir = path.join(rootDir, "data", "curation", "reports", "image-embeddings", RELEASE_VERSION);
  mkdirSync(releaseDir, { recursive: true });
  mkdirSync(reportDir, { recursive: true });
  const manifestPath = path.join(releaseDir, "manifest.json");
  writeJson(manifestPath, { release: { corpusVersion: RELEASE_VERSION } });
  const suiteSourcePath = path.join(rootDir, "evidence-suite-source.txt");
  writeFileSync(suiteSourcePath, "frozen suite source\n");
  const suites = frozenEvidenceSuites([{ path: "evidence-suite-source.txt", checksum: checksum(readFileSync(suiteSourcePath)) }]);
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
  initializeGitFixture(rootDir);

  const textRunnerPath = path.join(rootDir, "text-runner.json");
  writeJson(textRunnerPath, {
    releaseVersion: RELEASE_VERSION,
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
  return { rootDir, manifestPath, anchorPath, textRunnerPath, fusionRunnerPath };
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
    vectorBenchmark: { results: Array<{ id: string; rerankTop1Hit: boolean }> };
  };
  assert.equal(result.kind, "text-benchmark");
  assert.equal(envelope.schemaVersion, "image-embedding-text-benchmark-evidence.v2");
  assert.equal(envelope.runnerArtifactChecksum, checksum(readFileSync(fixture.textRunnerPath)));
  assert.equal(envelope.vectorBenchmark.results.filter((row) => row.rerankTop1Hit).length, 23);
});

test("promotion evidence producer normalizes raw Playwright fusion output instead of treating it as an envelope", () => {
  const fixture = createFixture();
  const outputPath = path.join(fixture.rootDir, "fusion-evidence.json");
  const promotionBindingChecksum = checksum("task-5-promotion-binding");

  const result = buildImageEmbeddingPromotionEvidence({
    rootDir: fixture.rootDir,
    releaseVersion: RELEASE_VERSION,
    manifestPath: fixture.manifestPath,
    promotionAnchorPath: fixture.anchorPath,
    outputPath,
    fusionE2eRunnerArtifactPath: fixture.fusionRunnerPath,
    promotionBindingChecksum,
    preflightCheck: () => ({ command: "pnpm preflight:check", exitCode: 0 }),
  });

  const envelope = JSON.parse(readFileSync(outputPath, "utf8")) as {
    schemaVersion: string;
    runnerArtifactChecksum: string;
    promotionBindingChecksum: string;
    targetedE2e: { passedCaseIds: string[]; failedCaseIds: string[] };
  };
  assert.equal(result.kind, "fusion-e2e");
  assert.equal(envelope.schemaVersion, "image-embedding-fusion-e2e-evidence.v2");
  assert.equal(envelope.runnerArtifactChecksum, checksum(readFileSync(fixture.fusionRunnerPath)));
  assert.equal(envelope.promotionBindingChecksum, promotionBindingChecksum);
  assert.deepEqual(envelope.targetedE2e.passedCaseIds, FUSION_IDS);
  assert.deepEqual(envelope.targetedE2e.failedCaseIds, []);
});
