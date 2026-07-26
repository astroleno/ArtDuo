import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { buildReleaseArtifactToTempDir } from "./release-artifact";
import { runRelationshipGraphPhase0 } from "./relationship-graph-phase0";

test("relationship graph phase0 writes internal reports without release sidecar or manifest changes", () => {
  const corpusPath = path.resolve(__dirname, "../../../packages/contracts/fixtures/artworks.json");
  const release = buildReleaseArtifactToTempDir({
    corpusPath,
    corpusVersion: "2026-04-25-phase0-test",
  });
  const reportRoot = mkdtempSync(path.join(os.tmpdir(), "artduo-relationship-graph-phase0-"));
  const result = runRelationshipGraphPhase0({
    manifestPath: release.manifestPath,
    reportRoot,
    anchorCount: 3,
    negativePairCount: 2,
    topK: 2,
  });

  assert.equal(result.releaseVersion, "2026-04-25-phase0-test");
  assert.equal(result.metadataBaseline.anchorCount, 3);
  assert.equal(result.metadataBaseline.scope, "phase0-metadata-only-baseline");
  assert.equal(result.payloadMeasurement.publicSidecarWritten, false);
  assert.equal(result.phase0Report.safeguards.manifestUpdated, false);
  assert.equal(result.phase0Report.safeguards.runtimeLoaderTouched, false);
  assert.equal(result.phase0Report.safeguards.vectorOrRerankTouched, false);
  assert.ok(result.evaluationFixture.negativeSamples.length > 0);
  assert.equal(
    result.evaluationFixture.negativeSummary.sampleCount,
    result.evaluationFixture.negativeSamples.length,
  );
  assert.equal(result.evaluationFixture.negativeSummary.uniquePairRequirementMet, true);
  assert.ok(
    result.evaluationFixture.negativeSummary.unorderedUniqueCount
      >= result.evaluationFixture.negativeSummary.sampleCount,
  );
  assert.equal(
    new Set(result.evaluationFixture.negativeSamples.map((sample) =>
      [sample.anchorId, sample.candidateId].sort().join("::"))).size,
    result.evaluationFixture.negativeSamples.length,
  );
  assert.ok(result.payloadMeasurement.estimatedPublicGraph.nodeCountsByType.artwork >= 3);
  assert.equal(result.payloadMeasurement.proposedParserLimits.maxReasonLabelBytes, 160);
  assert.ok(result.payloadMeasurement.byteStats.maxReasonLabelBytes <= 160);
  assert.ok(result.payloadMeasurement.browserCatalogLoadDelta.estimatedIncreaseRatio > 0);
  assert.ok(
    result.payloadMeasurement.proposedParserLimits.maxNodes
      >= result.payloadMeasurement.estimatedPublicGraph.nodeCount,
  );
  assert.ok(
    result.payloadMeasurement.proposedParserLimits.maxEdges
      >= result.payloadMeasurement.estimatedPublicGraph.edgeCount,
  );
  assert.ok(existsSync(result.metadataBaselinePath));
  assert.ok(existsSync(result.payloadMeasurementPath));
  assert.ok(existsSync(result.evaluationFixturePath));
  assert.ok(existsSync(result.phase0ReportPath));
  assert.equal(existsSync(path.join(release.outputDir, "relationship-graph-01.json")), false);

  const manifest = JSON.parse(readFileSync(release.manifestPath, "utf8")) as { shards: Record<string, unknown> };
  assert.equal(manifest.shards.relationshipGraph, undefined);
});
