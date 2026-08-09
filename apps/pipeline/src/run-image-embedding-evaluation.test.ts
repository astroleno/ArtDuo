import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import type { ImageEmbeddingShardRecord } from "@artduo/contracts";

import { calculateImageEmbeddingReviewPackChecksum } from "./image-embedding-evaluation";
import { buildImageEmbeddingPromotionEvidence } from "./build-image-embedding-promotion-evidence";
import { buildImageEmbeddingEvidenceSuiteDescriptor } from "./image-embedding-promotion-evidence";
import {
  FROZEN_METADATA_SCORE_UPPER_BOUND,
  normalizeMetadataScore,
  runImageEmbeddingEvaluation,
} from "./run-image-embedding-evaluation";

const RELEASE_VERSION = "image-evaluation-runner-test";
const TEXT_PROMPT_IDS = Array.from({ length: 24 }, (_, index) => `prompt-${String(index + 1).padStart(2, "0")}`);
const A2A_PASS_IDS = Array.from({ length: 55 }, (_, index) => `a2a-pass-${String(index + 1).padStart(2, "0")}`);
const A2A_FAIL_IDS = Array.from({ length: 40 }, (_, index) => `a2a-fail-${String(index + 1).padStart(2, "0")}`);
const A2A_BLOCKED_IDS = Array.from({ length: 5 }, (_, index) => `a2a-blocked-${String(index + 1).padStart(2, "0")}`);
const A2A_REPLAY_IDS = Array.from({ length: 50 }, (_, index) => `a2a-replay-${String(index + 1).padStart(2, "0")}`);
const E2E_IDS = Array.from({ length: 14 }, (_, index) => `e2e-${String(index + 1).padStart(2, "0")}`);
const FUSION_IDS = Array.from({ length: 5 }, (_, index) => `fusion-${String(index + 1).padStart(2, "0")}`);
const SUITE_SOURCE_CONTENT = "frozen suite source\n";
const TEXT_RUNNER = {
  manifestPath: `data/releases/${RELEASE_VERSION}/manifest.json`,
  promptsPath: "evidence-suite-source.txt",
  requestedProviderMode: "local-hash",
  configuredProviderMode: "local-hash",
  provider: "local-hash",
  model: "local-hash-embedding-v1",
  dimensions: 256,
  limit: 10,
};
const FUSION_RUNNER = {
  suiteId: "fixture-image-embedding-fusion-e2e.v1",
  configPath: "evidence-suite-source.txt",
  projectName: "image-scene-fusion",
  specPath: "evidence-suite-source.txt",
};

function frozenEvidenceSuites() {
  const sourceFiles = [{ path: "evidence-suite-source.txt", checksum: checksum(SUITE_SOURCE_CONTENT) }];
  return {
    textBenchmark: buildImageEmbeddingEvidenceSuiteDescriptor({
      suiteType: "text-benchmark",
      suitePayload: { caseIds: TEXT_PROMPT_IDS, runner: TEXT_RUNNER },
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

function writePlaywrightRunnerArtifact(filePath: string, caseIds: string[], failedIds: string[] = []): void {
  writeFileSync(filePath, `${JSON.stringify({
    suites: [{
      title: "image-embedding",
      specs: caseIds.map((id) => ({
        title: id,
        tests: [{ results: [{ status: failedIds.includes(id) ? "failed" : "passed" }] }],
      })),
    }],
  }, null, 2)}\n`);
}

function writeFusionPlaywrightRunnerArtifact(
  filePath: string,
  caseIds: string[],
  binding: {
    releaseVersion: string;
    baseManifestChecksum: string;
    candidateShardChecksum: string;
    promotionReportChecksum: string;
    promotionBindingChecksum: string;
  },
  failedIds: string[] = [],
): void {
  writeFileSync(filePath, `${JSON.stringify({
    config: {
      configFile: `/fixture/${FUSION_RUNNER.configPath}`,
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
      specs: caseIds.map((id) => ({
        title: id,
        file: path.basename(FUSION_RUNNER.specPath),
        tests: [{
          projectId: FUSION_RUNNER.projectName,
          projectName: FUSION_RUNNER.projectName,
          results: [{ status: failedIds.includes(id) ? "failed" : "passed" }],
        }],
      })),
    }],
  }, null, 2)}\n`);
}

function initializeGitFixture(rootDir: string): string {
  const git = (args: string[]): string => execFileSync("git", ["-C", rootDir, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  git(["init"]);
  git(["config", "user.email", "test@example.test"]);
  git(["config", "user.name", "ArtDuo Test"]);
  git(["add", "--all"]);
  git(["commit", "-m", "fixture"]);
  return git(["rev-parse", "HEAD"]);
}

function writeJson(filePath: string, value: unknown): {
  id: string;
  url: string;
  checksum: string;
  sizeBytes: number;
  recordCount: number;
} {
  const serialized = JSON.stringify(value, null, 2);
  const content = `${serialized}\n`;
  writeFileSync(filePath, content);
  return {
    id: path.basename(filePath, ".json"),
    url: `./${path.basename(filePath)}`,
    checksum: checksum(serialized),
    sizeBytes: Buffer.byteLength(content),
    recordCount: Array.isArray(value) ? value.length : 1,
  };
}

function imageRecord(
  entityType: "artwork" | "background-scene",
  entityId: string,
  vector: number[],
): ImageEmbeddingShardRecord {
  return {
    id: `${entityType}:${entityId}`,
    entityType,
    entityId,
    releaseVersion: RELEASE_VERSION,
    model: "test-image-model",
    modelRevision: "test-revision",
    modelVariant: "quantized",
    modelArtifactChecksum: checksum("model"),
    provider: "@xenova/transformers",
    providerVersion: "2.17.2",
    dimensions: vector.length,
    preprocessingVersion: "test-preprocessing.v1",
    preprocessingFingerprint: checksum("preprocessing"),
    vectorPrecision: 8,
    source: {
      shardId: entityType === "artwork" ? "media-01" : "background-scenes-01",
      recordId: entityId,
      fieldPath: entityType === "artwork" ? "media.imageUrlPreview" : "asset.local_public_path",
      fingerprint: checksum(`source:${entityType}:${entityId}`),
    },
    vector,
  };
}

function createFixture(): {
  rootDir: string;
  manifestPath: string;
  candidatePath: string;
  buildReportPath: string;
  outputPath: string;
  reviewPackPath: string;
  reviewerViewPath: string;
} {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-image-evaluation-runner-"));
  const releaseDir = path.join(rootDir, "data", "releases", RELEASE_VERSION);
  const reportDir = path.join(rootDir, "data", "curation", "reports", "image-embeddings", RELEASE_VERSION);
  const candidateDir = path.join(reportDir, "candidates");
  mkdirSync(releaseDir, { recursive: true });
  mkdirSync(candidateDir, { recursive: true });

  const artworkIds = Array.from({ length: 30 }, (_, index) => `artwork-${String(index + 1).padStart(2, "0")}`);
  const sceneIds = Array.from({ length: 12 }, (_, index) => `scene-${String(index + 1).padStart(2, "0")}`);
  const metadata = artworkIds.map((id, index) => ({
    id,
    metadata: {
      title: `Artwork ${index + 1}`,
      department: "Paintings",
      moodTags: ["contemplation"],
      colorTags: ["ochre"],
      compositionTags: [`composition-${index + 1}`],
      subjectTags: [`subject-${index + 1}`],
    },
    presentation: { sceneAffinity: { paletteModes: [], sceneTypes: [] } },
  }));
  const search = artworkIds.map((id) => ({
    id,
    retrieval: { searchText: id, emotionLabels: [], keywordBoosts: [] },
  }));
  const media = artworkIds.map((id) => ({
    id,
    media: {
      imageUrlPreview: `https://images.example.test/${id}.jpg`,
      aspectRatioHint: "landscape",
    },
  }));
  const scenes = sceneIds.map((id, index) => ({
    id,
    asset: {
      original_filename: `${id}.jpg`,
      local_public_path: `https://images.example.test/${id}.jpg`,
      label_cn: id,
    },
    image_info: {},
    visual_profile: {
      scene_type: "gallery_interior",
      styles: [],
      materials: [],
      lighting: [],
      mood: [],
      palette: [],
      composition: [],
    },
    curation_profile: { emotion_ids: [], artwork_palette_modes: [] },
    ui_profile: { overlay_readability: "high", safe_text_zones: [], mobile_crop_tolerance: "good", visual_busyness: 0.1 },
    stage_profile: { primary_mount_zone: { shape: "rect", rect: { x: 0, y: 0, width: 1, height: 1 } } },
    transition_profile: { tempo: "slow", intensity: "soft", families: [] },
    retrieval_profile: { search_text: id, search_terms: [] },
  }));

  const metadataShard = writeJson(path.join(releaseDir, "metadata-01.json"), metadata);
  const searchShard = writeJson(path.join(releaseDir, "search-01.json"), search);
  const mediaShard = writeJson(path.join(releaseDir, "media-01.json"), media);
  const sceneShard = writeJson(path.join(releaseDir, "background-scenes-01.json"), scenes);
  const manifestPath = path.join(releaseDir, "manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify({
    release: {
      corpusVersion: RELEASE_VERSION,
      backgroundCatalogVersion: RELEASE_VERSION,
      contractsVersion: "0.1.0",
      createdAt: "2026-07-27T00:00:00.000Z",
    },
    shards: {
      metadata: [metadataShard],
      search: [searchShard],
      mediaIndex: [mediaShard],
      backgroundScenes: [sceneShard],
    },
  }, null, 2)}\n`);

  writeFileSync(path.join(rootDir, "evidence-suite-source.txt"), SUITE_SOURCE_CONTENT);
  const suiteManifestPath = path.join(reportDir, "promotion-evidence-suite-manifest.v1.json");
  writeFileSync(suiteManifestPath, `${JSON.stringify({
    schemaVersion: "image-embedding-evidence-suite-manifest.v1",
    releaseVersion: RELEASE_VERSION,
    suites: frozenEvidenceSuites(),
  }, null, 2)}\n`);
  const promotionAnchorPath = path.join(reportDir, "promotion-anchor-set.json");
  writeFileSync(promotionAnchorPath, `${JSON.stringify({
    schemaVersion: "image-embedding-promotion-anchor-set.v1",
    releaseVersion: RELEASE_VERSION,
    anchors: artworkIds.map((artworkId) => ({ artworkId })),
    evidenceSuiteManifest: {
      schemaVersion: "image-embedding-evidence-suite-manifest.v1",
      path: "./promotion-evidence-suite-manifest.v1.json",
      checksum: checksum(readFileSync(suiteManifestPath)),
    },
  }, null, 2)}\n`);
  const candidateRecords = [
    ...artworkIds.map((id) => imageRecord("artwork", id, [1, 0])),
    ...sceneIds.map((id, index) => imageRecord("background-scene", id, index === 1 ? [1, 0] : [-1, 0])),
  ];
  const candidatePath = path.join(candidateDir, "image-embeddings-01.json");
  const candidateShard = writeJson(candidatePath, candidateRecords);
  const buildReportPath = path.join(reportDir, "image-embedding-report.json");
  writeFileSync(buildReportPath, `${JSON.stringify({
    releaseVersion: RELEASE_VERSION,
    baseManifestChecksum: checksum(readFileSync(manifestPath)),
    promotionAnchorSetChecksum: checksum(readFileSync(promotionAnchorPath)),
    model: "test-image-model",
    modelRevision: "test-revision",
    modelVariant: "quantized",
    modelArtifactChecksum: checksum("model"),
    providerVersion: "2.17.2",
    dimensions: 2,
    preprocessingVersion: "test-preprocessing.v1",
    preprocessingFingerprint: checksum("preprocessing"),
    vectorPrecision: 8,
    generatedAt: "2026-07-27T00:00:00.000Z",
    artwork: { eligible: 30, embedded: 30, gradeAEligible: 0, gradeAEmbedded: 0, criticalEligible: 30, criticalEmbedded: 30 },
    backgroundScene: { eligible: 12, embedded: 12 },
    failures: [],
    gates: { vectorsValid: true, sourceRefsValid: true, artworkCoverage: 1, criticalArtworkCoverage: 1, backgroundSceneCoverage: 1, coverageReady: true },
    candidateShard,
  }, null, 2)}\n`);

  return {
    rootDir,
    manifestPath,
    candidatePath,
    buildReportPath,
    outputPath: path.join(reportDir, "evaluation.pre-review.json"),
    reviewPackPath: path.join(reportDir, "review-pack.json"),
    reviewerViewPath: path.join(reportDir, "reviewer-view.html"),
  };
}

function writePassingPromotionEvidence(fixture: ReturnType<typeof createFixture>): {
  textBenchmarkBaselinePath: string;
  a2aBaselinePath: string;
  e2eBaselinePath: string;
  textBenchmarkRunnerArtifactPath: string;
  a2aCaseSetRunnerArtifactPath: string;
  a2aReplayRunnerArtifactPath: string;
  e2eRunnerArtifactPath: string;
} {
  const suites = frozenEvidenceSuites();
  const binding = {
    releaseVersion: RELEASE_VERSION,
    commitSha: "a".repeat(40),
    baseManifestChecksum: checksum(readFileSync(fixture.manifestPath)),
  };
  const textBenchmarkRunnerArtifactPath = path.join(fixture.rootDir, "text-runner-artifact.json");
  const a2aCaseSetRunnerArtifactPath = path.join(fixture.rootDir, "a2a-case-set-runner-artifact.json");
  const a2aReplayRunnerArtifactPath = path.join(fixture.rootDir, "a2a-replay-runner-artifact.json");
  const e2eRunnerArtifactPath = path.join(fixture.rootDir, "e2e-runner-artifact.json");
  const textResults = TEXT_PROMPT_IDS.map((id, index) => ({
    id,
    rerankTop1Hit: index !== 0,
    rerankTop5Hit: true,
  }));
  writeFileSync(textBenchmarkRunnerArtifactPath, `${JSON.stringify({
    releaseVersion: RELEASE_VERSION,
    ...TEXT_RUNNER,
    manifestChecksum: checksum(readFileSync(fixture.manifestPath)),
    promptsChecksum: checksum(SUITE_SOURCE_CONTENT),
    promptCount: textResults.length,
    rerankTop1HitRate: 23 / 24,
    rerankTop5HitRate: 1,
    results: textResults,
  }, null, 2)}\n`);
  writeFileSync(a2aCaseSetRunnerArtifactPath, `${JSON.stringify({
    counts: { pass: A2A_PASS_IDS.length, fail: A2A_FAIL_IDS.length, blocked: A2A_BLOCKED_IDS.length },
    results: [
      ...A2A_PASS_IDS.map((id) => ({ id, status: "pass" })),
      ...A2A_FAIL_IDS.map((id) => ({ id, status: "fail" })),
      ...A2A_BLOCKED_IDS.map((id) => ({ id, status: "blocked" })),
    ],
  }, null, 2)}\n`);
  writeFileSync(a2aReplayRunnerArtifactPath, `${JSON.stringify(A2A_REPLAY_IDS.map((id) => ({
    id,
    scores: { total: 0.975 },
    output: { curveMetrics: { hardResistanceViolations: 0 } },
  })), null, 2)}\n`);
  writePlaywrightRunnerArtifact(e2eRunnerArtifactPath, E2E_IDS);
  const textBenchmarkBaselinePath = path.join(fixture.rootDir, "text-baseline.json");
  writeFileSync(textBenchmarkBaselinePath, `${JSON.stringify({
    schemaVersion: "image-embedding-text-benchmark-evidence.v2",
    ...binding,
    suiteChecksum: suites.textBenchmark.suiteChecksum,
    runnerArtifactChecksum: checksum(readFileSync(textBenchmarkRunnerArtifactPath)),
    runnerBinding: {
      ...TEXT_RUNNER,
      manifestChecksum: checksum(readFileSync(fixture.manifestPath)),
      promptsChecksum: checksum(SUITE_SOURCE_CONTENT),
    },
    vectorBenchmark: {
      promptCount: 24,
      rerankTop1HitRate: 23 / 24,
      rerankTop5HitRate: 1,
      results: TEXT_PROMPT_IDS.map((id, index) => ({
        id,
        rerankTop1Hit: index !== 0,
        rerankTop5Hit: true,
      })),
    },
  }, null, 2)}\n`);

  const a2aBaselinePath = path.join(fixture.rootDir, "a2a-baseline.json");
  writeFileSync(a2aBaselinePath, `${JSON.stringify({
    schemaVersion: "image-embedding-a2a-evidence.v2",
    ...binding,
    caseSet: {
      suiteChecksum: suites.a2a.caseSet.suiteChecksum,
      runnerArtifactChecksum: checksum(readFileSync(a2aCaseSetRunnerArtifactPath)),
      baseline: suites.a2a.caseSet.baseline,
      candidate: suites.a2a.caseSet.baseline,
    },
    replay: {
      suiteChecksum: suites.a2a.replay.suiteChecksum,
      runnerArtifactChecksum: checksum(readFileSync(a2aReplayRunnerArtifactPath)),
      caseIds: A2A_REPLAY_IDS,
      averageTotal: 0.975,
      hardResistanceViolationIds: [],
    },
  }, null, 2)}\n`);

  const e2eBaselinePath = path.join(fixture.rootDir, "e2e-baseline.json");
  writeFileSync(e2eBaselinePath, `${JSON.stringify({
    schemaVersion: "image-embedding-e2e-evidence.v2",
    ...binding,
    suiteChecksum: suites.e2e.suiteChecksum,
    runnerArtifactChecksum: checksum(readFileSync(e2eRunnerArtifactPath)),
    preflight: { command: "pnpm preflight:check", exitCode: 0 },
    caseSets: {
      baseline: suites.e2e.baseline,
      candidate: suites.e2e.baseline,
    },
  }, null, 2)}\n`);

  return {
    textBenchmarkBaselinePath,
    a2aBaselinePath,
    e2eBaselinePath,
    textBenchmarkRunnerArtifactPath,
    a2aCaseSetRunnerArtifactPath,
    a2aReplayRunnerArtifactPath,
    e2eRunnerArtifactPath,
  };
}

test("metadata score normalization preserves the order of valid 14 and 15 point frozen scores", () => {
  assert.equal(FROZEN_METADATA_SCORE_UPPER_BOUND, 37);
  assert.ok(normalizeMetadataScore(14) < normalizeMetadataScore(15));
  assert.ok(normalizeMetadataScore(15) < 1);
});

test("image embedding runner binds candidate/build inputs and emits a fail-closed pre-review report", async () => {
  const fixture = createFixture();
  const baseManifest = readFileSync(fixture.manifestPath, "utf8");

  const result = await runImageEmbeddingEvaluation({
    rootDir: fixture.rootDir,
    releaseVersion: RELEASE_VERSION,
    manifestPath: fixture.manifestPath,
    candidateShardPath: fixture.candidatePath,
    buildReportPath: fixture.buildReportPath,
    outputPath: fixture.outputPath,
    emitReviewPack: true,
    reviewPackPath: fixture.reviewPackPath,
    reviewerViewOutputPath: fixture.reviewerViewPath,
  });

  assert.equal(result.report.weakLabels.labelSource, "structured-weak-label-v1");
  assert.equal(result.report.reviewPack?.comparisons.length, 30);
  assert.equal(result.report.humanReview.humanReviewComplete, false);
  assert.equal(result.report.promotionBinding.promotionReady, false);
  const promotionBindingPayload = (result.report as unknown as { promotionBindingPayload?: unknown }).promotionBindingPayload;
  assert.ok(promotionBindingPayload, "the Task 5 report must retain the canonical promotion decision payload");
  const gateEvidence = (promotionBindingPayload as {
    gateEvidence: {
      artworkHoldout: Record<string, unknown>;
      sceneHoldout: Record<string, unknown>;
    };
  }).gateEvidence;
  assert.equal(
    gateEvidence.artworkHoldout.allMajorStrataSufficient,
    result.report.weakLabels.holdoutReadiness.artworkPairwise.allMajorStrataSufficient,
  );
  assert.equal(
    gateEvidence.sceneHoldout.allMajorStrataSufficient,
    result.report.weakLabels.holdoutReadiness.sceneTop3.allMajorStrataSufficient,
  );
  assert.equal(Object.hasOwn(gateEvidence.artworkHoldout, "allStrataSufficient"), false);
  assert.equal(Object.hasOwn(gateEvidence.sceneHoldout, "allStrataSufficient"), false);
  assert.equal(
    result.report.promotionBinding.promotionBindingChecksum,
    checksum(canonicalJson(promotionBindingPayload)),
  );
  assert.equal(result.report.promotionBinding.candidateShardChecksum, checksum(JSON.stringify(JSON.parse(readFileSync(fixture.candidatePath, "utf8")), null, 2)));
  assert.equal(existsSync(fixture.outputPath), true);
  assert.equal(existsSync(fixture.reviewPackPath), true);
  assert.equal(existsSync(fixture.reviewerViewPath), true);
  assert.equal(readFileSync(fixture.manifestPath, "utf8"), baseManifest);
});

test("image embedding runner fails closed when a bound build input is changed", async () => {
  for (const mutate of [
    (report: Record<string, unknown>) => { report.baseManifestChecksum = checksum("wrong-manifest"); },
    (report: Record<string, unknown>) => {
      (report.candidateShard as Record<string, unknown>).checksum = checksum("wrong-candidate");
    },
    (report: Record<string, unknown>) => { report.modelRevision = "wrong-revision"; },
  ]) {
    const fixture = createFixture();
    const report = JSON.parse(readFileSync(fixture.buildReportPath, "utf8")) as Record<string, unknown>;
    mutate(report);
    writeFileSync(fixture.buildReportPath, `${JSON.stringify(report, null, 2)}\n`);

    const result = await runImageEmbeddingEvaluation({
      rootDir: fixture.rootDir,
      releaseVersion: RELEASE_VERSION,
      manifestPath: fixture.manifestPath,
      candidateShardPath: fixture.candidatePath,
      buildReportPath: fixture.buildReportPath,
      outputPath: fixture.outputPath,
    });

    assert.equal(result.report.gates.bindingIntegrity, false);
    assert.equal(result.report.promotionBinding.promotionReady, false);
  }
});

test("image embedding runner rejects arbitrary baseline and fusion evidence files", async () => {
  const fixture = createFixture();
  const textBaselinePath = path.join(fixture.rootDir, "text-baseline.json");
  const a2aBaselinePath = path.join(fixture.rootDir, "a2a-baseline.json");
  const e2eBaselinePath = path.join(fixture.rootDir, "e2e-baseline.json");
  const fusionE2ePath = path.join(fixture.rootDir, "fusion-e2e.json");
  for (const filePath of [textBaselinePath, a2aBaselinePath, e2eBaselinePath, fusionE2ePath]) {
    writeFileSync(filePath, "{}\n");
  }

  const result = await runImageEmbeddingEvaluation({
    rootDir: fixture.rootDir,
    releaseVersion: RELEASE_VERSION,
    manifestPath: fixture.manifestPath,
    candidateShardPath: fixture.candidatePath,
    buildReportPath: fixture.buildReportPath,
    outputPath: fixture.outputPath,
    textBenchmarkBaselinePath: textBaselinePath,
    a2aBaselinePath,
    e2eBaselinePath,
    fusionE2eReportPath: fusionE2ePath,
    preflightCheck: () => ({ command: "pnpm preflight:check", exitCode: 0 }),
  });

  assert.equal(result.report.gates.baselineBindingsReady, false);
  assert.equal(result.report.gates.bindingIntegrity, false);
  assert.equal(result.report.promotionBinding.fusionVerificationReady, false);
});

test("image embedding runner accepts only exact frozen evidence bound to original runner artifacts", async () => {
  const fixture = createFixture();
  const evidence = writePassingPromotionEvidence(fixture);

  const valid = await runImageEmbeddingEvaluation({
    rootDir: fixture.rootDir,
    releaseVersion: RELEASE_VERSION,
    manifestPath: fixture.manifestPath,
    candidateShardPath: fixture.candidatePath,
    buildReportPath: fixture.buildReportPath,
    outputPath: fixture.outputPath,
    expectedEvidenceCommitSha: "a".repeat(40),
    expectedExecutionCommitSha: "a".repeat(40),
    preflightCheck: () => ({ command: "pnpm preflight:check", exitCode: 0 }),
    ...evidence,
  });
  assert.equal(valid.report.gates.baselineBindingsReady, true, JSON.stringify(valid.report.gates.bindingFailures));
  assert.equal(valid.report.gates.bindingIntegrity, true, JSON.stringify(valid.report.gates.bindingFailures));
  assert.equal(valid.report.baselineBindings.baselineEvidenceCommitSha, "a".repeat(40));
  assert.equal(valid.report.promotionBinding.fusionE2eSuiteChecksum, frozenEvidenceSuites().fusionE2e.suiteChecksum);
  assert.equal(valid.report.promotionBinding.fusionE2eRunnerArtifactChecksum, "missing");

  const originalTextRunnerArtifact = readFileSync(evidence.textBenchmarkRunnerArtifactPath);
  writeFileSync(evidence.textBenchmarkRunnerArtifactPath, "tampered-runner-artifact");
  const detachedArtifact = await runImageEmbeddingEvaluation({
    rootDir: fixture.rootDir,
    releaseVersion: RELEASE_VERSION,
    manifestPath: fixture.manifestPath,
    candidateShardPath: fixture.candidatePath,
    buildReportPath: fixture.buildReportPath,
    outputPath: fixture.outputPath,
    expectedEvidenceCommitSha: "a".repeat(40),
    expectedExecutionCommitSha: "a".repeat(40),
    preflightCheck: () => ({ command: "pnpm preflight:check", exitCode: 0 }),
    ...evidence,
  });
  assert.equal(detachedArtifact.report.gates.baselineBindingsReady, false);
  assert.equal(detachedArtifact.report.gates.bindingIntegrity, false);

  writeFileSync(evidence.textBenchmarkRunnerArtifactPath, originalTextRunnerArtifact);

  const invalidTextEvidence = JSON.parse(readFileSync(evidence.textBenchmarkBaselinePath, "utf8")) as {
    baseManifestChecksum: string;
  };
  invalidTextEvidence.baseManifestChecksum = checksum("wrong-manifest");
  writeFileSync(evidence.textBenchmarkBaselinePath, `${JSON.stringify(invalidTextEvidence, null, 2)}\n`);
  const invalid = await runImageEmbeddingEvaluation({
    rootDir: fixture.rootDir,
    releaseVersion: RELEASE_VERSION,
    manifestPath: fixture.manifestPath,
    candidateShardPath: fixture.candidatePath,
    buildReportPath: fixture.buildReportPath,
    outputPath: fixture.outputPath,
    expectedEvidenceCommitSha: "a".repeat(40),
    expectedExecutionCommitSha: "a".repeat(40),
    preflightCheck: () => ({ command: "pnpm preflight:check", exitCode: 0 }),
    ...evidence,
  });
  assert.equal(invalid.report.gates.baselineBindingsReady, false);
  assert.equal(invalid.report.gates.bindingIntegrity, false);
});

test("Task 5 baseline evidence remains valid after its report is committed on a later clean HEAD", async () => {
  const fixture = createFixture();
  const evidenceCommitSha = initializeGitFixture(fixture.rootDir);
  const evidence = writePassingPromotionEvidence(fixture);
  const commonEvidenceBuildOptions = {
    rootDir: fixture.rootDir,
    releaseVersion: RELEASE_VERSION,
    manifestPath: fixture.manifestPath,
  };
  buildImageEmbeddingPromotionEvidence({
    ...commonEvidenceBuildOptions,
    outputPath: evidence.textBenchmarkBaselinePath,
    textBenchmarkRunnerArtifactPath: evidence.textBenchmarkRunnerArtifactPath,
  });
  buildImageEmbeddingPromotionEvidence({
    ...commonEvidenceBuildOptions,
    outputPath: evidence.a2aBaselinePath,
    a2aCaseSetRunnerArtifactPath: evidence.a2aCaseSetRunnerArtifactPath,
    a2aReplayRunnerArtifactPath: evidence.a2aReplayRunnerArtifactPath,
  });
  buildImageEmbeddingPromotionEvidence({
    ...commonEvidenceBuildOptions,
    outputPath: evidence.e2eBaselinePath,
    e2eRunnerArtifactPath: evidence.e2eRunnerArtifactPath,
    preflightCheck: () => ({ command: "pnpm preflight:check", exitCode: 0 }),
  });
  const task5 = await runImageEmbeddingEvaluation({
    rootDir: fixture.rootDir,
    releaseVersion: RELEASE_VERSION,
    manifestPath: fixture.manifestPath,
    candidateShardPath: fixture.candidatePath,
    buildReportPath: fixture.buildReportPath,
    outputPath: fixture.outputPath,
    preflightCheck: () => ({ command: "pnpm preflight:check", exitCode: 0 }),
    ...evidence,
  });
  assert.equal(task5.report.gates.baselineBindingsReady, true, JSON.stringify(task5.report.gates.bindingFailures));

  execFileSync("git", ["-C", fixture.rootDir, "add", fixture.outputPath]);
  execFileSync("git", ["-C", fixture.rootDir, "commit", "-m", "record task5 report"]);
  const executionCommitSha = execFileSync("git", ["-C", fixture.rootDir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  assert.notEqual(executionCommitSha, evidenceCommitSha);

  const reconstructed = await runImageEmbeddingEvaluation({
    rootDir: fixture.rootDir,
    releaseVersion: RELEASE_VERSION,
    manifestPath: fixture.manifestPath,
    candidateShardPath: fixture.candidatePath,
    buildReportPath: fixture.buildReportPath,
    outputPath: fixture.outputPath,
    preflightCheck: () => ({ command: "pnpm preflight:check", exitCode: 0 }),
    ...evidence,
  });
  assert.equal(reconstructed.report.gates.baselineBindingsReady, true, JSON.stringify(reconstructed.report.gates.bindingFailures));
  assert.equal(reconstructed.report.baselineBindings.baselineEvidenceCommitSha, evidenceCommitSha);
  assert.equal(reconstructed.report.promotionBindingPayload.baselineEvidenceCommitSha, evidenceCommitSha);
});

test("Task 5 rejects baseline envelopes that do not share one frozen evidence commit", async () => {
  const fixture = createFixture();
  const evidence = writePassingPromotionEvidence(fixture);
  const a2a = JSON.parse(readFileSync(evidence.a2aBaselinePath, "utf8")) as { commitSha: string };
  a2a.commitSha = "b".repeat(40);
  writeFileSync(evidence.a2aBaselinePath, `${JSON.stringify(a2a, null, 2)}\n`);

  const result = await runImageEmbeddingEvaluation({
    rootDir: fixture.rootDir,
    releaseVersion: RELEASE_VERSION,
    manifestPath: fixture.manifestPath,
    candidateShardPath: fixture.candidatePath,
    buildReportPath: fixture.buildReportPath,
    outputPath: fixture.outputPath,
    expectedExecutionCommitSha: "c".repeat(40),
    preflightCheck: () => ({ command: "pnpm preflight:check", exitCode: 0 }),
    ...evidence,
  });
  assert.equal(result.report.gates.baselineBindingsReady, false);
  assert.ok(result.report.gates.bindingFailures.some((reason) => /do not share one frozen commit SHA/u.test(reason)));
});

test("Task 6 fusion producer refuses to run before the bound Task 5 report is promotion-ready", async () => {
  const fixture = createFixture();
  initializeGitFixture(fixture.rootDir);
  const evidence = writePassingPromotionEvidence(fixture);
  const commonEvidenceBuildOptions = {
    rootDir: fixture.rootDir,
    releaseVersion: RELEASE_VERSION,
    manifestPath: fixture.manifestPath,
  };
  buildImageEmbeddingPromotionEvidence({
    ...commonEvidenceBuildOptions,
    outputPath: evidence.textBenchmarkBaselinePath,
    textBenchmarkRunnerArtifactPath: evidence.textBenchmarkRunnerArtifactPath,
  });
  buildImageEmbeddingPromotionEvidence({
    ...commonEvidenceBuildOptions,
    outputPath: evidence.a2aBaselinePath,
    a2aCaseSetRunnerArtifactPath: evidence.a2aCaseSetRunnerArtifactPath,
    a2aReplayRunnerArtifactPath: evidence.a2aReplayRunnerArtifactPath,
  });
  buildImageEmbeddingPromotionEvidence({
    ...commonEvidenceBuildOptions,
    outputPath: evidence.e2eBaselinePath,
    e2eRunnerArtifactPath: evidence.e2eRunnerArtifactPath,
    preflightCheck: () => ({ command: "pnpm preflight:check", exitCode: 0 }),
  });
  const task5 = await runImageEmbeddingEvaluation({
    rootDir: fixture.rootDir,
    releaseVersion: RELEASE_VERSION,
    manifestPath: fixture.manifestPath,
    candidateShardPath: fixture.candidatePath,
    buildReportPath: fixture.buildReportPath,
    outputPath: fixture.outputPath,
    preflightCheck: () => ({ command: "pnpm preflight:check", exitCode: 0 }),
    ...evidence,
  });
  assert.equal(task5.report.gates.baselineBindingsReady, true, JSON.stringify(task5.report.gates.bindingFailures));
  assert.equal(task5.report.promotionBinding.promotionReady, false);
  const fusionE2eRunnerArtifactPath = path.join(fixture.rootDir, "fusion-playwright.json");
  const fusionE2eReportPath = path.join(fixture.rootDir, "fusion-evidence.json");
  let fusionRuns = 0;
  assert.throws(() => buildImageEmbeddingPromotionEvidence({
    ...commonEvidenceBuildOptions,
    outputPath: fusionE2eReportPath,
    fusionE2eRunnerArtifactOutputPath: fusionE2eRunnerArtifactPath,
    fusionCandidateShardPath: fixture.candidatePath,
    fusionPromotionReportPath: fixture.outputPath,
    promotionBindingChecksum: task5.report.promotionBinding.promotionBindingChecksum,
    fusionE2eCheck: (input) => {
      fusionRuns += 1;
      writeFusionPlaywrightRunnerArtifact(input.artifactPath, FUSION_IDS, input.binding);
      return { command: "pnpm test:e2e:fusion", exitCode: 0 };
    },
    preflightCheck: () => ({ command: "pnpm preflight:check", exitCode: 0 }),
  }), /promotion-ready decision/u);
  assert.equal(fusionRuns, 0);
});

test("image embedding runner fails closed when staged or unstaged tracked files differ from HEAD", async () => {
  for (const staged of [false, true]) {
    const fixture = createFixture();
    const trackedSourcePath = path.join(fixture.rootDir, "evidence-source.txt");
    writeFileSync(trackedSourcePath, "clean\n");
    initializeGitFixture(fixture.rootDir);
    writeFileSync(trackedSourcePath, staged ? "staged\n" : "dirty\n");
    if (staged) {
      execFileSync("git", ["-C", fixture.rootDir, "add", trackedSourcePath]);
    }

    const result = await runImageEmbeddingEvaluation({
      rootDir: fixture.rootDir,
      releaseVersion: RELEASE_VERSION,
      manifestPath: fixture.manifestPath,
      candidateShardPath: fixture.candidatePath,
      buildReportPath: fixture.buildReportPath,
      outputPath: fixture.outputPath,
    });

    assert.equal(result.report.gates.bindingIntegrity, false);
    assert.ok(result.report.gates.bindingFailures.some((reason) => /tracked worktree.*HEAD/i.test(reason)));
  }
});

test("image embedding runner rejects a self-checksummed external review pack that differs from this run", async () => {
  const fixture = createFixture();
  await runImageEmbeddingEvaluation({
    rootDir: fixture.rootDir,
    releaseVersion: RELEASE_VERSION,
    manifestPath: fixture.manifestPath,
    candidateShardPath: fixture.candidatePath,
    buildReportPath: fixture.buildReportPath,
    outputPath: fixture.outputPath,
    emitReviewPack: true,
    reviewPackPath: fixture.reviewPackPath,
  });
  const externalPack = JSON.parse(readFileSync(fixture.reviewPackPath, "utf8")) as {
    comparisons: Array<{ baseline: { score: number } }>;
    reviewPackChecksum: string;
  };
  externalPack.comparisons[0]!.baseline.score += 0.01;
  externalPack.reviewPackChecksum = calculateImageEmbeddingReviewPackChecksum(externalPack as never);
  writeFileSync(fixture.reviewPackPath, `${JSON.stringify(externalPack, null, 2)}\n`);

  const result = await runImageEmbeddingEvaluation({
    rootDir: fixture.rootDir,
    releaseVersion: RELEASE_VERSION,
    manifestPath: fixture.manifestPath,
    candidateShardPath: fixture.candidatePath,
    buildReportPath: fixture.buildReportPath,
    outputPath: fixture.outputPath,
    reviewPackPath: fixture.reviewPackPath,
  });

  assert.equal(result.report.gates.bindingIntegrity, false);
  assert.equal(result.report.promotionBinding.promotionReady, false);
});
