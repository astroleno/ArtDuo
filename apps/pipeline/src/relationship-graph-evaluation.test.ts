import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { embedText } from "@artduo/corpus";
import type { RelationshipGraphShard } from "@artduo/contracts";

import { evaluateRelationshipGraph } from "./relationship-graph-evaluation";

function sourceRef(releaseVersion: string, recordId: string, fieldPath: string) {
  return {
    artifact: "metadata" as const,
    shardId: "metadata-01",
    recordId,
    fieldPath,
    releaseVersion,
  };
}

function validRelationshipGraph(releaseVersion: string): RelationshipGraphShard {
  return {
    schemaVersion: "relationship-graph.v1",
    releaseVersion,
    generatedAt: "2026-05-15T00:00:00.000Z",
    build: {
      builderName: "@artduo/pipeline/relationship-graph",
      builderVersion: "relationship-graph-builder.v1",
      taxonomyVersion: "relationship-taxonomy.v1",
      inputFingerprints: [
        {
          artifact: "manifest",
          checksum: "sha256:manifest",
          sizeBytes: 100,
        },
      ],
    },
    stats: {
      nodeCount: 7,
      edgeCount: 6,
    },
    limits: {
      maxPreParseBytes: 2046976,
      maxShardSizeBytes: 2046976,
      maxGzipSizeBytes: 78848,
      maxNodes: 20,
      maxEdges: 20,
      maxDegreePerNode: 10,
      maxSourceRefsPerNode: 8,
      maxSourceRefsPerEdge: 3,
      maxFieldPathBytes: 128,
      maxStringBytes: 448,
      maxReasonLabelBytes: 160,
    },
    nodes: [
      { id: "artwork:met-1", type: "artwork", label: "Oracle", sourceRefs: [sourceRef(releaseVersion, "met-1", "id")] },
      { id: "artwork:met-2", type: "artwork", label: "Shadow Oracle", sourceRefs: [sourceRef(releaseVersion, "met-2", "id")] },
      { id: "artwork:met-3", type: "artwork", label: "Repose", sourceRefs: [sourceRef(releaseVersion, "met-3", "id")] },
      { id: "artwork:met-4", type: "artwork", label: "Oracle Fragment", sourceRefs: [sourceRef(releaseVersion, "met-4", "id")] },
      { id: "emotion:mystery", type: "emotion", label: "mystery", sourceRefs: [sourceRef(releaseVersion, "met-1", "metadata.moodTags[0]")] },
      { id: "emotion:serenity", type: "emotion", label: "serenity", sourceRefs: [sourceRef(releaseVersion, "met-3", "metadata.moodTags[0]")] },
      { id: "subject:oracle", type: "subject", label: "oracle", sourceRefs: [sourceRef(releaseVersion, "met-1", "metadata.subjectTags[0]")] },
    ],
    edges: [
      {
        id: "artwork:met-1->emotion:mystery:has_emotion",
        source: "artwork:met-1",
        target: "emotion:mystery",
        relation: "has_emotion",
        direction: "directed",
        symmetric: false,
        confidence: "EXTRACTED",
        confidenceScore: 1,
        sourceQuality: "release-field",
        reasonCode: "has_emotion:mystery",
        sourceRefs: [sourceRef(releaseVersion, "met-1", "metadata.moodTags[0]")],
      },
      {
        id: "artwork:met-1->subject:oracle:has_subject",
        source: "artwork:met-1",
        target: "subject:oracle",
        relation: "has_subject",
        direction: "directed",
        symmetric: false,
        confidence: "EXTRACTED",
        confidenceScore: 1,
        sourceQuality: "release-field",
        reasonCode: "has_subject:oracle",
        sourceRefs: [sourceRef(releaseVersion, "met-1", "metadata.subjectTags[0]")],
      },
      {
        id: "artwork:met-2->emotion:mystery:has_emotion",
        source: "artwork:met-2",
        target: "emotion:mystery",
        relation: "has_emotion",
        direction: "directed",
        symmetric: false,
        confidence: "EXTRACTED",
        confidenceScore: 1,
        sourceQuality: "release-field",
        reasonCode: "has_emotion:mystery",
        sourceRefs: [sourceRef(releaseVersion, "met-2", "metadata.moodTags[0]")],
      },
      {
        id: "artwork:met-2->subject:oracle:has_subject",
        source: "artwork:met-2",
        target: "subject:oracle",
        relation: "has_subject",
        direction: "directed",
        symmetric: false,
        confidence: "EXTRACTED",
        confidenceScore: 1,
        sourceQuality: "release-field",
        reasonCode: "has_subject:oracle",
        sourceRefs: [sourceRef(releaseVersion, "met-2", "metadata.subjectTags[0]")],
      },
      {
        id: "artwork:met-3->emotion:serenity:has_emotion",
        source: "artwork:met-3",
        target: "emotion:serenity",
        relation: "has_emotion",
        direction: "directed",
        symmetric: false,
        confidence: "EXTRACTED",
        confidenceScore: 1,
        sourceQuality: "release-field",
        reasonCode: "has_emotion:serenity",
        sourceRefs: [sourceRef(releaseVersion, "met-3", "metadata.moodTags[0]")],
      },
      {
        id: "artwork:met-4->subject:oracle:has_subject",
        source: "artwork:met-4",
        target: "subject:oracle",
        relation: "has_subject",
        direction: "directed",
        symmetric: false,
        confidence: "EXTRACTED",
        confidenceScore: 1,
        sourceQuality: "release-field",
        reasonCode: "has_subject:oracle",
        sourceRefs: [sourceRef(releaseVersion, "met-4", "metadata.subjectTags[0]")],
      },
    ],
  };
}

function writeEvaluationRelease(): {
  rootDir: string;
  releaseDir: string;
  promptsPath: string;
} {
  const releaseVersion = "eval-graph";
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-relationship-eval-"));
  const releaseDir = path.join(rootDir, "data", "releases", releaseVersion);
  const reportDir = path.join(rootDir, "data", "curation", "reports", "relationship-graph", releaseVersion);
  const promptsPath = path.join(rootDir, "benchmarks", "vector-promotion-prompts.json");
  mkdirSync(releaseDir, { recursive: true });
  mkdirSync(reportDir, { recursive: true });
  mkdirSync(path.dirname(promptsPath), { recursive: true });

  writeFileSync(path.join(releaseDir, "embeddings-01.json"), JSON.stringify([
    {
      id: "met-1",
      source: "met",
      sourceArtworkId: "1",
      version: releaseVersion,
      theme: "mystery",
      model: "local-hash-embedding-v1",
      dimensions: 256,
      title: "Oracle",
      grade: "A",
      moodTags: ["mystery"],
      text: "oracle shadow mystery secret",
      tokenCount: 4,
      vector: embedText("oracle shadow mystery secret").vector,
    },
    {
      id: "met-2",
      source: "met",
      sourceArtworkId: "2",
      version: releaseVersion,
      theme: "mystery",
      model: "local-hash-embedding-v1",
      dimensions: 256,
      title: "Shadow Oracle",
      grade: "A",
      moodTags: ["mystery"],
      text: "oracle mystery dark",
      tokenCount: 3,
      vector: embedText("oracle mystery dark").vector,
    },
    {
      id: "met-3",
      source: "met",
      sourceArtworkId: "3",
      version: releaseVersion,
      theme: "serenity",
      model: "local-hash-embedding-v1",
      dimensions: 256,
      title: "Repose",
      grade: "B",
      moodTags: ["serenity"],
      text: "tranquil stillness quiet repose",
      tokenCount: 4,
      vector: embedText("tranquil stillness quiet repose").vector,
    },
    {
      id: "met-4",
      source: "met",
      sourceArtworkId: "4",
      version: releaseVersion,
      theme: "mystery",
      model: "local-hash-embedding-v1",
      dimensions: 256,
      title: "Oracle Fragment",
      grade: "B",
      moodTags: ["mystery"],
      text: "oracle fragment",
      tokenCount: 2,
      vector: embedText("oracle fragment").vector,
    },
  ], null, 2));
  writeFileSync(path.join(releaseDir, "relationship-graph-01.json"), JSON.stringify(validRelationshipGraph(releaseVersion), null, 2));
  writeFileSync(path.join(releaseDir, "manifest.json"), JSON.stringify({
    release: {
      corpusVersion: releaseVersion,
      backgroundCatalogVersion: releaseVersion,
      contractsVersion: "0.1.0",
      createdAt: "2026-05-15T00:00:00.000Z",
    },
    shards: {
      metadata: [{ id: "metadata-01", url: "./metadata-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 4 }],
      search: [{ id: "search-01", url: "./search-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 4 }],
      mediaIndex: [{ id: "media-01", url: "./media-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 4 }],
      backgroundScenes: [{ id: "background-scenes-01", url: "./background-scenes-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 4 }],
      embeddings: [{ id: "embeddings-01", url: "./embeddings-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 4 }],
      relationshipGraph: [{ id: "relationship-graph-01", url: "./relationship-graph-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 7 }],
    },
  }, null, 2));
  const thresholds = {
    anchorSampleMin: 1,
    negativePairMin: 1,
    requiredSidecarPrecisionAt5: 0.7,
    requiredAbsolutePrecisionLiftOverBaseline: 0.1,
    maxNegativeTop5LeakRate: 0.05,
    reasonReviewSampleMin: 2,
    requiredReasonAverageHelpfulness: 2.4,
    requiredReasonScore2PlusRate: 0.7,
  };
  writeFileSync(path.join(reportDir, "metadata-baseline-report.json"), JSON.stringify({
    releaseVersion,
    generatedAt: "2026-05-15T00:00:00.000Z",
    scope: "phase0-metadata-only-baseline",
    selectorVersion: "metadata-related-selector.phase0.v1",
    topK: 2,
    anchorCount: 1,
    anchors: [],
    thresholds,
  }, null, 2));
  writeFileSync(path.join(reportDir, "evaluation-fixture.json"), JSON.stringify({
    releaseVersion,
    generatedAt: "2026-05-15T00:00:00.000Z",
    scope: "phase0-evaluation-fixture",
    selectorVersion: "metadata-related-selector.phase0.v1",
    topK: 2,
    anchors: [
      {
        id: "met-1",
        title: "Oracle",
        expectedBaselineTopK: [
          { id: "met-3", score: 12, reasonCodes: ["same_grade"] },
          { id: "met-2", score: 10, reasonCodes: ["shared_emotion", "shared_subject"] },
        ],
      },
    ],
    negativeSamples: [
      {
        anchorId: "met-1",
        candidateId: "met-3",
        baselineScore: 1,
        superficialReasons: ["same_source"],
      },
    ],
    thresholds,
  }, null, 2));
  writeFileSync(promptsPath, JSON.stringify([
    {
      id: "oracle",
      query: "oracle mystery",
      expectedThemes: ["mystery"],
    },
  ], null, 2));

  return { rootDir, releaseDir, promptsPath };
}

test("relationship graph evaluation compares sidecar value and keeps vector order unchanged", async () => {
  const { rootDir } = writeEvaluationRelease();
  const result = await evaluateRelationshipGraph({ rootDir, releaseVersion: "eval-graph" });

  assert.equal(result.releaseVersion, "eval-graph");
  assert.equal(existsSync(result.reportPath), true);
  assert.equal(result.report.baseline.precisionAtK, 0.5);
  assert.equal(result.report.sidecar.precisionAtK, 1);
  assert.equal(result.report.sidecar.absolutePrecisionLiftOverBaseline, 0.5);
  assert.ok(result.report.sidecar.actualShardSizeBytes > result.report.sidecar.manifestShardSizeBytes);
  assert.equal(result.report.sidecar.payloadWithinLimits, true);
  assert.equal(result.report.negatives.topKLeakRate, 0);
  assert.equal(result.report.reasonHelpfulness.automaticScoreCount, 2);
  assert.equal(result.report.reasonHelpfulness.requiredHumanReviewSampleCount, 2);
  assert.equal(
    Object.values(result.report.reasonHelpfulness.scoreCounts).reduce((total, count) => total + count, 0),
    result.report.reasonHelpfulness.automaticScoreCount,
  );
  assert.equal(result.report.vectorBenchmark.unchangedWithGraphJoin, true);
  assert.equal(result.report.gates.automatedGatePass, true);
  assert.equal(result.report.gates.humanReasonReviewRequired, true);
  assert.equal(result.report.decision, "keep_internal_pending_human_review");
});

test("relationship graph evaluation gates payload by actual shard size", async () => {
  const { rootDir, releaseDir } = writeEvaluationRelease();
  const graphPath = path.join(releaseDir, "relationship-graph-01.json");
  const graph = JSON.parse(readFileSync(graphPath, "utf8")) as RelationshipGraphShard;
  graph.limits.maxShardSizeBytes = 64;
  writeFileSync(graphPath, JSON.stringify(graph, null, 2));

  const result = await evaluateRelationshipGraph({ rootDir, releaseVersion: "eval-graph" });

  assert.ok(result.report.sidecar.actualShardSizeBytes > result.report.sidecar.maxShardSizeBytes);
  assert.equal(result.report.sidecar.payloadWithinLimits, false);
  assert.equal(result.report.gates.payloadPass, false);
  assert.equal(result.report.gates.automatedGatePass, false);
  assert.equal(result.report.decision, "iterate");
});

test("relationship graph evaluation resolves reports for manifest-only loads", async () => {
  const { releaseDir, promptsPath } = writeEvaluationRelease();
  const result = await evaluateRelationshipGraph({
    manifestPath: path.join(releaseDir, "manifest.json"),
    promptsPath,
  });

  assert.equal(result.report.sidecar.selectorStatus, "ready");
  assert.ok(result.report.inputs.metadataBaselinePath.includes("data/curation/reports/relationship-graph/eval-graph"));
  assert.equal(result.report.vectorBenchmark.unchangedWithGraphJoin, true);
});
