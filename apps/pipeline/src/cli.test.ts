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

test("workspace exposes the image embedding shadow-build command", () => {
  const pipelinePackage = JSON.parse(readFileSync(path.resolve(__dirname, "../package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
  const rootPackage = JSON.parse(readFileSync(path.resolve(__dirname, "../../..", "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };

  assert.equal(pipelinePackage.scripts["build:image-embeddings"], "pnpm run workspace:prepare && tsx src/build-image-embedding-shards.ts");
  assert.equal(rootPackage.scripts["image-embeddings:build"], "pnpm --filter @artduo/pipeline build:image-embeddings");
  assert.equal(existsSync(path.resolve(__dirname, "build-image-embedding-shards.ts")), true);
});
