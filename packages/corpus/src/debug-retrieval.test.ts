import assert from "node:assert/strict";
import { test } from "node:test";

import type { EmbeddingShardRecord, RelationshipGraphShard } from "@artduo/contracts";

import { createFallbackEmbeddingProvider, type TextEmbeddingProvider } from "./embedding-provider";
import { runRetrievalDebug, runRetrievalDebugWithProvider } from "./debug-retrieval";
import { embedText } from "./query-embedding";
import { createRelationshipGraphIndex, createUnavailableRelationshipGraphIndex } from "./relationship-graph";

function sourceRef(recordId: string, fieldPath: string) {
  return {
    artifact: "metadata" as const,
    shardId: "metadata-01",
    recordId,
    fieldPath,
    releaseVersion: "test",
  };
}

function validGraph(): RelationshipGraphShard {
  return {
    schemaVersion: "relationship-graph.v1",
    releaseVersion: "test",
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
      maxSourceRefsPerEdge: 4,
      maxFieldPathBytes: 128,
      maxStringBytes: 448,
      maxReasonLabelBytes: 160,
    },
    nodes: [
      {
        id: "artwork:met-1",
        type: "artwork",
        label: "Oracle",
        sourceRefs: [sourceRef("met-1", "id")],
      },
      {
        id: "emotion:mystery",
        type: "emotion",
        label: "mystery",
        sourceRefs: [sourceRef("met-1", "metadata.moodTags[0]")],
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
        sourceRefs: [sourceRef("met-1", "metadata.moodTags[0]")],
      },
    ],
  };
}

test("debug retrieval returns vector top-k, rerank, and keyword baseline", () => {
  const records: EmbeddingShardRecord[] = [
    {
      id: "met-1",
      source: "met",
      sourceArtworkId: "1",
      version: "test",
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
      version: "test",
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
  ];

  const result = runRetrievalDebug("enigmatic oracle shadowed hall", records, { limit: 2 });

  assert.equal(result.vectorTopK[0]?.theme, "mystery");
  assert.equal(result.rerankedTopK[0]?.theme, "mystery");
  assert.equal(result.lexicalTopK[0]?.theme, "mystery");
  assert.equal(result.recordCount, 2);
  assert.equal("relationshipGraph" in result, false);
  assert.equal("relationshipEvidence" in result.vectorTopK[0]!, false);
});

test("debug retrieval can embed queries through a fallback provider", async () => {
  const records: EmbeddingShardRecord[] = [
    {
      id: "met-1",
      source: "met",
      sourceArtworkId: "1",
      version: "test",
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
  ];
  const failingRemote: TextEmbeddingProvider = {
    mode: "remote-openai-compatible",
    model: "broken-remote",
    async embedText(): Promise<never> {
      throw new Error("network down");
    },
    async embedTexts(): Promise<never> {
      throw new Error("network down");
    },
  };

  const result = await runRetrievalDebugWithProvider("enigmatic oracle shadowed hall", records, {
    embeddingProvider: createFallbackEmbeddingProvider(failingRemote, {
      mode: "local-hash",
      model: "local-hash-embedding-v1",
      async embedText(query) {
        return {
          provider: "local-hash",
          ...embedText(query),
        };
      },
      async embedTexts(values) {
        return values.map((value) => ({
          provider: "local-hash" as const,
          ...embedText(value),
        }));
      },
    }),
  });

  assert.equal(result.provider, "local-hash");
  assert.equal(result.rerankedTopK[0]?.theme, "mystery");
});

test("debug retrieval can join public relationship evidence without changing rank order", () => {
  const records: EmbeddingShardRecord[] = [
    {
      id: "met-2",
      source: "met",
      sourceArtworkId: "2",
      version: "test",
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
      version: "test",
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
  ];
  const baseline = runRetrievalDebug("enigmatic oracle shadowed hall", records, { limit: 2 });
  const result = runRetrievalDebug("enigmatic oracle shadowed hall", records, {
    limit: 2,
    relationshipGraphIndex: createRelationshipGraphIndex(validGraph()),
  });
  const serializedEvidence = JSON.stringify(result.rerankedTopK[0]?.relationshipEvidence ?? []);

  assert.deepEqual(result.vectorTopK.map((entry) => entry.id), baseline.vectorTopK.map((entry) => entry.id));
  assert.deepEqual(result.rerankedTopK.map((entry) => entry.id), baseline.rerankedTopK.map((entry) => entry.id));
  assert.equal(result.relationshipGraph?.status, "ready");
  assert.equal(result.rerankedTopK[0]?.relationshipEvidence?.[0]?.signalNodeId, "emotion:mystery");
  assert.equal(serializedEvidence.includes("privateNotes"), false);
  assert.equal(serializedEvidence.includes("provenance"), false);
  assert.equal(serializedEvidence.includes("fullSourceRefsByNode"), false);
});

test("debug retrieval fails closed with empty evidence for unavailable relationship graph", () => {
  const records: EmbeddingShardRecord[] = [
    {
      id: "met-1",
      source: "met",
      sourceArtworkId: "1",
      version: "test",
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
  ];
  const result = runRetrievalDebug("enigmatic oracle shadowed hall", records, {
    relationshipGraphIndex: createUnavailableRelationshipGraphIndex("invalid", "Relationship graph sidecar failed to load."),
  });

  assert.equal(result.relationshipGraph?.status, "unavailable");
  assert.equal(result.relationshipGraph?.unavailableReason, "invalid");
  assert.deepEqual(result.rerankedTopK[0]?.relationshipEvidence, []);
  assert.ok(result.relationshipGraph?.warnings[0]?.includes("relationshipEvidence is empty"));
});
