import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { parseReleaseManifest } from "@artduo/contracts";

import { buildEmbeddingShards } from "./embedding-shards";
import { buildReleaseArtifact } from "./release-artifact";

test("embedding shard build writes a release-local embedding artifact and updates the manifest", () => {
  const repoRoot = path.resolve(__dirname, "../..", "..");
  const outputRoot = mkdtempSync(path.join(os.tmpdir(), "artduo-embedding-release-"));
  const corpusPath = path.resolve(repoRoot, "packages/contracts/fixtures/artworks.json");

  buildReleaseArtifact({
    rootDir: repoRoot,
    outputRoot,
    corpusPath,
    corpusVersion: "embedding-smoke-test",
  });

  const result = buildEmbeddingShards({
    rootDir: repoRoot,
    outputRoot,
    corpusPath,
    releaseVersion: "embedding-smoke-test",
    dimensions: 64,
  });

  const manifest = parseReleaseManifest(JSON.parse(readFileSync(result.manifestPath, "utf8")));
  const embeddings = JSON.parse(readFileSync(result.embeddingsPath, "utf8")) as Array<Record<string, unknown>>;

  assert.equal(result.records.length, 3);
  assert.equal(result.report.updatedManifest, true);
  assert.equal(manifest.shards.embeddings?.[0]?.recordCount, 3);
  assert.equal(embeddings[0]?.model, "local-hash-embedding-v1");
  assert.equal((embeddings[0]?.vector as number[]).length, 64);
});

test("embedding shard build rejects stale release manifests", () => {
  const repoRoot = path.resolve(__dirname, "../..", "..");
  const outputRoot = mkdtempSync(path.join(os.tmpdir(), "artduo-embedding-stale-"));
  const corpusPath = path.resolve(repoRoot, "packages/contracts/fixtures/artworks.json");
  const release = buildReleaseArtifact({
    rootDir: repoRoot,
    outputRoot,
    corpusPath,
    corpusVersion: "embedding-stale-test",
  });
  const manifest = JSON.parse(readFileSync(release.manifestPath, "utf8")) as {
    shards: {
      metadata: Array<{ recordCount: number }>;
    };
  };

  manifest.shards.metadata[0].recordCount = 99;
  writeFileSync(release.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  assert.throws(() => buildEmbeddingShards({
    rootDir: repoRoot,
    outputRoot,
    corpusPath,
    releaseVersion: "embedding-stale-test",
  }), /Rebuild the release artifact first/);
});
