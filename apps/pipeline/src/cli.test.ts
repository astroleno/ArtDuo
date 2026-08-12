import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import * as cli from "./cli";

test("image embedding CLI reads explicit shadow-build paths and flags", () => {
  const originalArgv = process.argv;
  process.argv = [
    "node",
    "build-image-embedding-shards.ts",
    "--root-dir", "/tmp/image-root",
    "--releases-root", "/tmp/image-releases",
    "--report-root", "/tmp/image-reports",
    "--candidate-root", "/tmp/image-candidates",
    "--source-cache-root", "/tmp/image-cache",
    "--promotion-anchor-set", "/tmp/image-anchor-set.json",
    "--release-version", "image-cli-test",
    "--manifest", "/tmp/image-manifest.json",
    "--image-embedding-model", "Xenova/clip-vit-base-patch32",
    "--image-embedding-model-revision", "pinned-revision",
    "--image-embedding-model-variant", "quantized",
    "--image-embedding-batch-size", "8",
    "--refresh-source-cache", "true",
    "--offline", "false",
  ];

  try {
    const readOptions = (cli as Record<string, unknown>).readImageEmbeddingBuildOptions;
    assert.equal(typeof readOptions, "function", "image embedding build option reader must be exported");
    const options = (readOptions as () => Record<string, unknown>)();

    assert.deepEqual(options, {
      rootDir: path.resolve("/tmp/image-root"),
      releasesRoot: path.resolve("/tmp/image-releases"),
      reportRoot: path.resolve("/tmp/image-reports"),
      candidateRoot: path.resolve("/tmp/image-candidates"),
      sourceCacheRoot: path.resolve("/tmp/image-cache"),
      promotionAnchorPath: path.resolve("/tmp/image-anchor-set.json"),
      releaseVersion: "image-cli-test",
      manifestPath: path.resolve("/tmp/image-manifest.json"),
      model: "Xenova/clip-vit-base-patch32",
      modelRevision: "pinned-revision",
      modelVariant: "quantized",
      batchSize: 8,
      refreshSourceCache: true,
      offline: false,
    });
  } finally {
    process.argv = originalArgv;
  }
});

test("image embedding CLI resolves relative artifact paths from the workspace root", () => {
  const originalArgv = process.argv;
  process.argv = [
    "node",
    "build-image-embedding-shards.ts",
    "--root-dir", "/tmp/image-workspace",
    "--releases-root", "data/releases",
    "--report-root", "data/reports",
    "--candidate-root", "data/candidates",
    "--source-cache", ".cache/image-sources",
    "--promotion-anchor-set", "data/anchors.json",
    "--manifest", "data/releases/release/manifest.json",
  ];

  try {
    const options = cli.readImageEmbeddingBuildOptions();
    assert.equal(options.releasesRoot, "/tmp/image-workspace/data/releases");
    assert.equal(options.reportRoot, "/tmp/image-workspace/data/reports");
    assert.equal(options.candidateRoot, "/tmp/image-workspace/data/candidates");
    assert.equal(options.sourceCacheRoot, "/tmp/image-workspace/.cache/image-sources");
    assert.equal(options.promotionAnchorPath, "/tmp/image-workspace/data/anchors.json");
    assert.equal(options.manifestPath, "/tmp/image-workspace/data/releases/release/manifest.json");
  } finally {
    process.argv = originalArgv;
  }
});

test("workspace exposes the image embedding shadow-build command", () => {
  const pipelinePackage = JSON.parse(readFileSync(path.resolve(__dirname, "../package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
  const rootPackage = JSON.parse(readFileSync(path.resolve(__dirname, "../../..", "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };

  assert.equal(pipelinePackage.scripts["build:image-embeddings"], "pnpm run workspace:prepare && tsx src/build-image-embedding-shards.ts");
  assert.equal(rootPackage.scripts["image-embeddings:build"], "pnpm --filter @artduo/pipeline build:image-embeddings");
  assert.equal(pipelinePackage.scripts["build:image-embedding-evidence"], "pnpm run workspace:prepare && tsx src/build-image-embedding-promotion-evidence.ts");
  assert.equal(rootPackage.scripts["image-embeddings:evidence"], "pnpm --filter @artduo/pipeline build:image-embedding-evidence");
  assert.equal(pipelinePackage.scripts["verify:image-embedding-reproducibility"], "pnpm run workspace:prepare && tsx src/verify-image-embedding-reproducibility.ts");
  assert.equal(rootPackage.scripts["image-embeddings:verify-reproducibility"], "pnpm --filter @artduo/pipeline verify:image-embedding-reproducibility");
  assert.equal(existsSync(path.resolve(__dirname, "build-image-embedding-shards.ts")), true);
  assert.equal(existsSync(path.resolve(__dirname, "build-image-embedding-promotion-evidence.ts")), true);
  assert.equal(existsSync(path.resolve(__dirname, "verify-image-embedding-reproducibility.ts")), true);
});

test("image embedding evaluation CLI resolves every frozen runner artifact path", () => {
  const originalArgv = process.argv;
  process.argv = [
    "node",
    "run-image-embedding-evaluation.ts",
    "--root-dir", "/tmp/image-evaluation-root",
    "--text-benchmark-runner-artifact", "evidence/text-runner.json",
    "--a2a-case-set-runner-artifact", "evidence/a2a-case-set-runner.json",
    "--a2a-replay-runner-artifact", "evidence/a2a-replay-runner.json",
    "--e2e-runner-artifact", "evidence/e2e-runner.json",
    "--fusion-e2e-runner-artifact", "evidence/fusion-runner.json",
    "--fusion-promotion-report", "evidence/task5-promotion.json",
  ];

  try {
    const options = cli.readImageEmbeddingEvaluationOptions() as Record<string, unknown>;
    assert.equal(options.textBenchmarkRunnerArtifactPath, path.resolve("/tmp/image-evaluation-root/evidence/text-runner.json"));
    assert.equal(options.a2aCaseSetRunnerArtifactPath, path.resolve("/tmp/image-evaluation-root/evidence/a2a-case-set-runner.json"));
    assert.equal(options.a2aReplayRunnerArtifactPath, path.resolve("/tmp/image-evaluation-root/evidence/a2a-replay-runner.json"));
    assert.equal(options.e2eRunnerArtifactPath, path.resolve("/tmp/image-evaluation-root/evidence/e2e-runner.json"));
    assert.equal(options.fusionE2eRunnerArtifactPath, path.resolve("/tmp/image-evaluation-root/evidence/fusion-runner.json"));
    assert.equal(options.fusionPromotionReportPath, path.resolve("/tmp/image-evaluation-root/evidence/task5-promotion.json"));
  } finally {
    process.argv = originalArgv;
  }
});

test("promotion evidence CLI accepts exactly addressed raw artifacts and fusion binding", () => {
  const originalArgv = process.argv;
  process.argv = [
    "node",
    "build-image-embedding-promotion-evidence.ts",
    "--root-dir", "/tmp/image-evidence-root",
    "--release-version", "image-evidence-test",
    "--manifest", "data/releases/image-evidence-test/manifest.json",
    "--promotion-anchor-set", "data/curation/promotion-anchor-set.json",
    "--output", "evidence/fusion-envelope.json",
    "--fusion-e2e-runner-artifact-output", "raw/fusion-playwright.json",
    "--fusion-candidate-shard", "candidates/image-embeddings-01.json",
    "--fusion-promotion-report", "reports/task5-promotion.json",
    "--promotion-binding-checksum", "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "--task5-build-report", "reports/task5-build.json",
    "--task5-review-pack", "reports/task5-review-pack.json",
    "--task5-review-verdicts", "reports/task5-review-verdicts.json",
    "--task5-text-benchmark-baseline", "evidence/task5-text.json",
    "--task5-a2a-baseline", "evidence/task5-a2a.json",
    "--task5-e2e-baseline", "evidence/task5-e2e.json",
    "--task5-text-benchmark-runner-artifact", "raw/task5-text.json",
    "--task5-a2a-case-set-runner-artifact", "raw/task5-a2a-case-set.json",
    "--task5-a2a-replay-runner-artifact", "raw/task5-a2a-replay.json",
    "--task5-e2e-runner-artifact", "raw/task5-e2e.json",
  ];

  try {
    const options = cli.readImageEmbeddingPromotionEvidenceBuildOptions() as Record<string, unknown>;
    assert.equal(options.rootDir, path.resolve("/tmp/image-evidence-root"));
    assert.equal(options.manifestPath, path.resolve("/tmp/image-evidence-root/data/releases/image-evidence-test/manifest.json"));
    assert.equal(options.promotionAnchorPath, path.resolve("/tmp/image-evidence-root/data/curation/promotion-anchor-set.json"));
    assert.equal(options.outputPath, path.resolve("/tmp/image-evidence-root/evidence/fusion-envelope.json"));
    assert.equal(options.fusionE2eRunnerArtifactOutputPath, path.resolve("/tmp/image-evidence-root/raw/fusion-playwright.json"));
    assert.equal(options.fusionCandidateShardPath, path.resolve("/tmp/image-evidence-root/candidates/image-embeddings-01.json"));
    assert.equal(options.fusionPromotionReportPath, path.resolve("/tmp/image-evidence-root/reports/task5-promotion.json"));
    assert.equal(options.promotionBindingChecksum, "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    assert.equal(options.task5BuildReportPath, path.resolve("/tmp/image-evidence-root/reports/task5-build.json"));
    assert.equal(options.task5ReviewPackPath, path.resolve("/tmp/image-evidence-root/reports/task5-review-pack.json"));
    assert.equal(options.task5ReviewVerdictsPath, path.resolve("/tmp/image-evidence-root/reports/task5-review-verdicts.json"));
    assert.equal(options.task5TextBenchmarkBaselinePath, path.resolve("/tmp/image-evidence-root/evidence/task5-text.json"));
    assert.equal(options.task5A2aBaselinePath, path.resolve("/tmp/image-evidence-root/evidence/task5-a2a.json"));
    assert.equal(options.task5E2eBaselinePath, path.resolve("/tmp/image-evidence-root/evidence/task5-e2e.json"));
    assert.equal(options.task5TextBenchmarkRunnerArtifactPath, path.resolve("/tmp/image-evidence-root/raw/task5-text.json"));
    assert.equal(options.task5A2aCaseSetRunnerArtifactPath, path.resolve("/tmp/image-evidence-root/raw/task5-a2a-case-set.json"));
    assert.equal(options.task5A2aReplayRunnerArtifactPath, path.resolve("/tmp/image-evidence-root/raw/task5-a2a-replay.json"));
    assert.equal(options.task5E2eRunnerArtifactPath, path.resolve("/tmp/image-evidence-root/raw/task5-e2e.json"));
  } finally {
    process.argv = originalArgv;
  }
});
