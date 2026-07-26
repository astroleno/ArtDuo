import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { embedText } from "@artduo/corpus";
import type { RelationshipGraphShard } from "@artduo/contracts";

import { buildVectorRetrievalDebugReport } from "./debug-vector-retrieval";

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
      nodeCount: 2,
      edgeCount: 1,
    },
    limits: {
      maxPreParseBytes: 2046976,
      maxShardSizeBytes: 2046976,
      maxGzipSizeBytes: 78848,
      maxNodes: 10,
      maxEdges: 10,
      maxDegreePerNode: 5,
      maxSourceRefsPerNode: 8,
      maxSourceRefsPerEdge: 3,
      maxFieldPathBytes: 128,
      maxStringBytes: 448,
      maxReasonLabelBytes: 160,
    },
    nodes: [
      {
        id: "artwork:met-1",
        type: "artwork",
        label: "Oracle",
        sourceRefs: [sourceRef(releaseVersion, "met-1", "id")],
      },
      {
        id: "emotion:mystery",
        type: "emotion",
        label: "mystery",
        sourceRefs: [sourceRef(releaseVersion, "met-1", "metadata.moodTags[0]")],
      },
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
        reasonLabel: "mystery extracted from release mood fields",
        sourceRefs: [sourceRef(releaseVersion, "met-1", "metadata.moodTags[0]")],
      },
    ],
  };
}

function validInternalRelationshipReport(releaseVersion: string): Record<string, unknown> {
  const fullSourceRefs = [
    sourceRef(releaseVersion, "met-1", "metadata.moodTags[0]"),
    sourceRef(releaseVersion, "met-3", "metadata.moodTags[0]"),
    sourceRef(releaseVersion, "met-4", "metadata.moodTags[0]"),
  ];

  return {
    releaseVersion,
    generatedAt: "2026-05-15T00:00:00.000Z",
    scope: "internal-relationship-graph-report",
    builderVersion: "relationship-graph-builder.v1",
    taxonomyVersion: "relationship-taxonomy.v1",
    publicSidecar: {
      path: `/tmp/${releaseVersion}/relationship-graph-01.json`,
      manifestUpdated: true,
      graphSha256: "sha256:test",
      nodeCount: 2,
      edgeCount: 1,
    },
    provenance: {
      strategy: "public-bounded-sample",
      publicMaxSourceRefsPerSignalNode: 1,
      truncatedSignalNodeCount: 1,
      omittedSourceRefCount: 2,
      fullSourceRefsByNode: {
        "emotion:mystery": fullSourceRefs,
      },
    },
    highFanoutSignalNodes: [
      {
        id: "emotion:mystery",
        type: "emotion",
        label: "mystery",
        degree: 1,
        publicSourceRefCount: 1,
        fullSourceRefCount: 3,
        omittedSourceRefCount: 2,
        fullSourceRefs,
      },
    ],
    safeguards: {
      extractedOnly: true,
      internalReportOutsideReleaseDir: true,
      localPathLeakCheck: true,
      vectorOrRerankTouched: false,
      uiTouched: false,
    },
  };
}

function writeDebugRelease(options: {
  releaseVersion: string;
  releasesRootRelative?: string;
  relationshipGraph?: unknown;
  relationshipReport?: unknown;
  releaseDirRelationshipReport?: unknown;
}): { rootDir: string; releaseDir: string; releasesRoot: string } {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-vector-debug-"));
  const releasesRoot = path.join(rootDir, options.releasesRootRelative ?? path.join("data", "releases"));
  const releaseDir = path.join(releasesRoot, options.releaseVersion);
  mkdirSync(releaseDir, { recursive: true });

  writeFileSync(path.join(releaseDir, "embeddings-01.json"), JSON.stringify([
    {
      id: "met-2",
      source: "met",
      sourceArtworkId: "2",
      version: options.releaseVersion,
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
      id: "met-1",
      source: "met",
      sourceArtworkId: "1",
      version: options.releaseVersion,
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
  ], null, 2));

  const relationshipGraphShards = options.relationshipGraph === undefined
    ? {}
    : {
      relationshipGraph: [
        {
          id: "relationship-graph-01",
          url: "./relationship-graph-01.json",
          checksum: "sha256:test",
          sizeBytes: 1,
          recordCount: 2,
        },
      ],
    };

  if (options.relationshipGraph !== undefined) {
    writeFileSync(path.join(releaseDir, "relationship-graph-01.json"), JSON.stringify(options.relationshipGraph, null, 2));
  }
  if (options.relationshipReport !== undefined) {
    const reportDir = path.join(rootDir, "data", "curation", "reports", "relationship-graph", options.releaseVersion);
    mkdirSync(reportDir, { recursive: true });
    writeFileSync(path.join(reportDir, "relationship-graph-report.json"), JSON.stringify(options.relationshipReport, null, 2));
  }
  if (options.releaseDirRelationshipReport !== undefined) {
    writeFileSync(
      path.join(releaseDir, "relationship-graph-report.json"),
      JSON.stringify(options.releaseDirRelationshipReport, null, 2),
    );
  }

  writeFileSync(path.join(releaseDir, "manifest.json"), JSON.stringify({
    release: {
      corpusVersion: options.releaseVersion,
      backgroundCatalogVersion: options.releaseVersion,
      contractsVersion: "0.1.0",
      createdAt: "2026-04-26T00:00:00.000Z",
    },
    shards: {
      metadata: [{ id: "metadata-01", url: "./metadata-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 2 }],
      search: [{ id: "search-01", url: "./search-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 2 }],
      mediaIndex: [{ id: "media-01", url: "./media-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 2 }],
      backgroundScenes: [{ id: "background-scenes-01", url: "./background-scenes-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 2 }],
      embeddings: [{ id: "embeddings-01", url: "./embeddings-01.json", checksum: "sha256:test", sizeBytes: 1, recordCount: 2 }],
      ...relationshipGraphShards,
    },
  }, null, 2));

  return { rootDir, releaseDir, releasesRoot };
}

test("vector retrieval debug joins public relationship evidence without changing ranking", async () => {
  const releaseVersion = "debug-graph";
  const { rootDir } = writeDebugRelease({
    releaseVersion,
    relationshipGraph: validRelationshipGraph(releaseVersion),
    relationshipReport: validInternalRelationshipReport(releaseVersion),
  });
  const report = await buildVectorRetrievalDebugReport({
    rootDir,
    releaseVersion,
    query: "enigmatic oracle shadowed hall",
    limit: 2,
  });
  const evidence = report.rerankedTopK[0]?.relationshipEvidence ?? [];
  const serializedEvidence = JSON.stringify(evidence);

  assert.deepEqual(report.rerankedTopK.map((entry) => entry.id), ["met-1", "met-2"]);
  assert.equal(report.relationshipGraph?.status, "ready");
  assert.ok(report.relationshipGraphShardPath?.endsWith("relationship-graph-01.json"));
  assert.equal(evidence[0]?.signalNodeId, "emotion:mystery");
  assert.equal(report.internalRelationshipDiagnostics.status, "ready");
  assert.equal(report.internalRelationshipDiagnostics.rerankedEvidenceDiagnostics[0]?.signalNodeId, "emotion:mystery");
  assert.equal(report.internalRelationshipDiagnostics.rerankedEvidenceDiagnostics[0]?.fullSourceRefCount, 3);
  assert.equal(report.internalRelationshipDiagnostics.rerankedEvidenceDiagnostics[0]?.omittedSourceRefCount, 2);
  assert.equal(serializedEvidence.includes("privateNotes"), false);
  assert.equal(serializedEvidence.includes("provenance"), false);
  assert.equal(serializedEvidence.includes("fullSourceRefSample"), false);
  assert.equal(serializedEvidence.includes("fullSourceRefsByNode"), false);
});

test("vector retrieval debug reports missing sidecars as empty relationship evidence", async () => {
  const releaseVersion = "debug-missing-graph";
  const { rootDir } = writeDebugRelease({ releaseVersion });
  const report = await buildVectorRetrievalDebugReport({
    rootDir,
    releaseVersion,
    query: "enigmatic oracle shadowed hall",
    limit: 2,
  });

  assert.deepEqual(report.rerankedTopK.map((entry) => entry.id), ["met-1", "met-2"]);
  assert.equal(report.relationshipGraph?.status, "unavailable");
  assert.equal(report.relationshipGraph?.unavailableReason, "missing");
  assert.deepEqual(report.rerankedTopK[0]?.relationshipEvidence, []);
  assert.ok(report.relationshipGraph?.warnings[0]?.includes("relationshipEvidence is empty"));
  assert.equal(report.internalRelationshipDiagnostics.status, "unavailable");
  assert.equal(report.internalRelationshipDiagnostics.unavailableReason, "missing");
});

test("vector retrieval debug fails closed when the relationship graph sidecar is invalid", async () => {
  const releaseVersion = "debug-invalid-graph";
  const invalidGraph = {
    ...validRelationshipGraph(releaseVersion),
    privateNotes: "do not publish",
  };
  const { rootDir } = writeDebugRelease({
    releaseVersion,
    relationshipGraph: invalidGraph,
  });
  const report = await buildVectorRetrievalDebugReport({
    rootDir,
    releaseVersion,
    query: "enigmatic oracle shadowed hall",
    limit: 2,
  });

  assert.deepEqual(report.rerankedTopK.map((entry) => entry.id), ["met-1", "met-2"]);
  assert.equal(report.relationshipGraph?.status, "unavailable");
  assert.equal(report.relationshipGraph?.unavailableReason, "invalid");
  assert.deepEqual(report.rerankedTopK[0]?.relationshipEvidence, []);
});

test("vector retrieval debug fails closed when the internal relationship report is stale", async () => {
  const releaseVersion = "debug-stale-internal-report";
  const { rootDir } = writeDebugRelease({
    releaseVersion,
    relationshipGraph: validRelationshipGraph(releaseVersion),
    relationshipReport: validInternalRelationshipReport("another-release"),
  });
  const report = await buildVectorRetrievalDebugReport({
    rootDir,
    releaseVersion,
    query: "enigmatic oracle shadowed hall",
    limit: 2,
  });

  assert.equal(report.relationshipGraph?.status, "ready");
  assert.ok((report.rerankedTopK[0]?.relationshipEvidence ?? []).length > 0);
  assert.equal(report.internalRelationshipDiagnostics.status, "unavailable");
  assert.equal(report.internalRelationshipDiagnostics.unavailableReason, "invalid");
  assert.deepEqual(report.internalRelationshipDiagnostics.rerankedEvidenceDiagnostics, []);
});

test("vector retrieval debug ignores relationship reports written under the release directory", async () => {
  const releaseVersion = "debug-release-dir-report";
  const { rootDir, releaseDir } = writeDebugRelease({
    releaseVersion,
    relationshipGraph: validRelationshipGraph(releaseVersion),
    releaseDirRelationshipReport: validInternalRelationshipReport(releaseVersion),
  });
  const report = await buildVectorRetrievalDebugReport({
    rootDir,
    releaseVersion,
    query: "enigmatic oracle shadowed hall",
    limit: 2,
  });

  assert.equal(report.relationshipGraph?.status, "ready");
  assert.equal(report.internalRelationshipDiagnostics.status, "unavailable");
  assert.equal(report.internalRelationshipDiagnostics.unavailableReason, "missing");
  assert.equal(report.internalRelationshipDiagnostics.reportPath.startsWith(releaseDir), false);
  assert.ok(report.internalRelationshipDiagnostics.reportPath.includes("data/curation/reports/relationship-graph"));
});

test("vector retrieval debug derives internal report path from a manifest-only release load", async () => {
  const releaseVersion = "debug-manifest-only";
  const { rootDir, releaseDir } = writeDebugRelease({
    releaseVersion,
    relationshipGraph: validRelationshipGraph(releaseVersion),
    relationshipReport: validInternalRelationshipReport(releaseVersion),
  });
  const report = await buildVectorRetrievalDebugReport({
    manifestPath: path.join(releaseDir, "manifest.json"),
    query: "enigmatic oracle shadowed hall",
    limit: 2,
  });

  assert.equal(report.relationshipGraph?.status, "ready");
  assert.equal(report.internalRelationshipDiagnostics.status, "ready");
  assert.equal(
    report.internalRelationshipDiagnostics.reportPath,
    path.join(rootDir, "data", "curation", "reports", "relationship-graph", releaseVersion, "relationship-graph-report.json"),
  );
});

test("vector retrieval debug derives internal report path from a custom releases root", async () => {
  const releaseVersion = "debug-custom-releases-root";
  const { rootDir, releasesRoot } = writeDebugRelease({
    releaseVersion,
    releasesRootRelative: path.join("data", "custom-releases"),
    relationshipGraph: validRelationshipGraph(releaseVersion),
    relationshipReport: validInternalRelationshipReport(releaseVersion),
  });
  const report = await buildVectorRetrievalDebugReport({
    releasesRoot,
    releaseVersion,
    query: "enigmatic oracle shadowed hall",
    limit: 2,
  });

  assert.equal(report.relationshipGraph?.status, "ready");
  assert.equal(report.internalRelationshipDiagnostics.status, "ready");
  assert.equal(
    report.internalRelationshipDiagnostics.reportPath,
    path.join(rootDir, "data", "curation", "reports", "relationship-graph", releaseVersion, "relationship-graph-report.json"),
  );
});
