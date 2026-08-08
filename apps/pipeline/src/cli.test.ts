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
  assert.equal(existsSync(path.resolve(__dirname, "build-image-embedding-shards.ts")), true);
  assert.equal(existsSync(path.resolve(__dirname, "build-image-embedding-promotion-evidence.ts")), true);
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
  ];

  try {
    const options = cli.readImageEmbeddingEvaluationOptions() as Record<string, unknown>;
    assert.equal(options.textBenchmarkRunnerArtifactPath, path.resolve("/tmp/image-evaluation-root/evidence/text-runner.json"));
    assert.equal(options.a2aCaseSetRunnerArtifactPath, path.resolve("/tmp/image-evaluation-root/evidence/a2a-case-set-runner.json"));
    assert.equal(options.a2aReplayRunnerArtifactPath, path.resolve("/tmp/image-evaluation-root/evidence/a2a-replay-runner.json"));
    assert.equal(options.e2eRunnerArtifactPath, path.resolve("/tmp/image-evaluation-root/evidence/e2e-runner.json"));
    assert.equal(options.fusionE2eRunnerArtifactPath, path.resolve("/tmp/image-evaluation-root/evidence/fusion-runner.json"));
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
    "--fusion-e2e-runner-artifact", "raw/fusion-playwright.json",
    "--promotion-binding-checksum", "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  ];

  try {
    const options = cli.readImageEmbeddingPromotionEvidenceBuildOptions() as Record<string, unknown>;
    assert.equal(options.rootDir, path.resolve("/tmp/image-evidence-root"));
    assert.equal(options.manifestPath, path.resolve("/tmp/image-evidence-root/data/releases/image-evidence-test/manifest.json"));
    assert.equal(options.promotionAnchorPath, path.resolve("/tmp/image-evidence-root/data/curation/promotion-anchor-set.json"));
    assert.equal(options.outputPath, path.resolve("/tmp/image-evidence-root/evidence/fusion-envelope.json"));
    assert.equal(options.fusionE2eRunnerArtifactPath, path.resolve("/tmp/image-evidence-root/raw/fusion-playwright.json"));
    assert.equal(options.promotionBindingChecksum, "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  } finally {
    process.argv = originalArgv;
  }
});
