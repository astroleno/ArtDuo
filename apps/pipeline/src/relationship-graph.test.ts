import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { loadRelationshipGraphShard } from "@artduo/corpus";

import { buildReleaseArtifactToTempDir } from "./release-artifact";
import {
  assertReleaseDirectoryPublishAllowlist,
  buildRelationshipGraph,
} from "./relationship-graph";

function buildFixtureRelease(corpusVersion: string) {
  return buildReleaseArtifactToTempDir({
    rootDir: path.resolve(__dirname, "../../.."),
    corpusPath: path.resolve(__dirname, "../../../packages/contracts/fixtures/artworks.json"),
    corpusVersion,
  });
}

test("relationship graph builder writes public sidecar, internal report, and manifest shard", () => {
  const release = buildFixtureRelease("2026-04-25-relationship-graph-test");
  const reportRoot = mkdtempSync(path.join(os.tmpdir(), "artduo-relationship-graph-report-"));
  const result = buildRelationshipGraph({
    manifestPath: release.manifestPath,
    reportRoot,
    publicSourceRefsPerSignalNode: 1,
  });

  assert.equal(result.releaseVersion, "2026-04-25-relationship-graph-test");
  assert.ok(existsSync(result.graphPath));
  assert.ok(existsSync(result.reportPath));
  assert.equal(path.basename(result.graphPath), "relationship-graph-01.json");
  assert.equal(path.basename(result.reportPath), "relationship-graph-report.json");
  assert.equal(path.dirname(result.reportPath).startsWith(result.outputDir), false);
  assert.equal(result.graph.build.builderVersion, "relationship-graph-builder.v1");
  assert.equal(result.graph.build.taxonomyVersion, "relationship-taxonomy.v1");
  assert.equal(result.graph.edges.every((edge) => edge.confidence === "EXTRACTED"), true);
  assert.equal(result.report.safeguards.vectorOrRerankTouched, false);
  assert.equal(result.report.safeguards.uiTouched, false);

  const manifest = JSON.parse(readFileSync(release.manifestPath, "utf8")) as {
    shards: { relationshipGraph?: Array<{ id: string; recordCount: number }> };
  };
  assert.equal(manifest.shards.relationshipGraph?.[0]?.id, "relationship-graph-01");
  assert.equal(manifest.shards.relationshipGraph?.[0]?.recordCount, result.graph.nodes.length);

  const loaded = loadRelationshipGraphShard({ manifestPath: release.manifestPath });
  assert.ok(loaded);
  assert.equal(loaded.graph.nodes.length, result.graph.nodes.length);
  assert.equal(loaded.shard.recordCount, result.graph.nodes.length);

  const truncatedNodeId = Object.keys(result.report.provenance.fullSourceRefsByNode)[0];
  assert.ok(truncatedNodeId);
  const publicNode = result.graph.nodes.find((node) => node.id === truncatedNodeId);
  assert.ok(publicNode);
  assert.equal(publicNode.sourceRefs.length, 1);
  assert.ok(result.report.provenance.fullSourceRefsByNode[truncatedNodeId]!.length > 1);
  assert.ok(result.report.provenance.omittedSourceRefCount > 0);

  assertReleaseDirectoryPublishAllowlist(result.outputDir, result.manifest);
});

test("relationship graph release allowlist blocks internal reports and local path leaks", () => {
  const release = buildFixtureRelease("2026-04-25-relationship-graph-blocking-test");
  const reportRoot = mkdtempSync(path.join(os.tmpdir(), "artduo-relationship-graph-blocking-"));
  const result = buildRelationshipGraph({
    manifestPath: release.manifestPath,
    reportRoot,
  });

  const graph = JSON.parse(readFileSync(result.graphPath, "utf8")) as { build: { builderVersion: string } };
  graph.build.builderVersion = "/Volumes/Secret/internal.json";
  writeFileSync(result.graphPath, `${JSON.stringify(graph, null, 2)}\n`);
  assert.throws(
    () => assertReleaseDirectoryPublishAllowlist(result.outputDir, result.manifest),
    /local absolute paths/,
  );

  buildRelationshipGraph({
    manifestPath: release.manifestPath,
    reportRoot,
  });

  const nestedDir = path.join(result.outputDir, "nested");
  mkdirSync(nestedDir);
  writeFileSync(path.join(nestedDir, "relationship-graph-01.json"), "{}\n");
  assert.throws(
    () => assertReleaseDirectoryPublishAllowlist(result.outputDir, result.manifest),
    /nested\/relationship-graph-01\.json: not allowed/,
  );
  rmSync(nestedDir, { recursive: true });

  writeFileSync(path.join(result.outputDir, "relationship-graph-report.json"), "{}\n");
  assert.throws(
    () => assertReleaseDirectoryPublishAllowlist(result.outputDir, result.manifest),
    /relationship-graph-report\.json: not allowed/,
  );
});
