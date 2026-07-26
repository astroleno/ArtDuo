import assert from "node:assert/strict";
import { test } from "node:test";

import type { RelationshipGraphShard } from "@artduo/contracts";

import { embedText } from "./query-embedding";
import { rerankVectorResults } from "./rerank";
import {
  createRelationshipGraphIndex,
  selectRelationshipGraphEvidence,
} from "./relationship-graph";
import { searchVectorIndex } from "./vector-search";

function sourceRef(recordId: string, fieldPath: string) {
  return {
    artifact: "metadata" as const,
    shardId: "metadata-01",
    recordId,
    fieldPath,
    releaseVersion: "selector-test",
  };
}

function validGraph(): RelationshipGraphShard {
  return {
    schemaVersion: "relationship-graph.v1",
    releaseVersion: "selector-test",
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
      nodeCount: 4,
      edgeCount: 3,
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
        id: "subject:oracle",
        type: "subject",
        label: "Oracle",
        sourceRefs: [sourceRef("met-1", "metadata.subjectTags[0]")],
      },
      {
        id: "palette:gold",
        type: "palette",
        label: "gold",
        sourceRefs: [sourceRef("met-1", "metadata.colorTags[0]")],
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
        reasonLabel: "Oracle extracted from release subject fields",
        sourceRefs: [
          sourceRef("met-1", "metadata.subjectTags[0]"),
          sourceRef("met-1", "metadata.subjectTags[1]"),
          sourceRef("met-1", "metadata.subjectTags[2]"),
          sourceRef("met-1", "metadata.subjectTags[3]"),
        ],
      },
      {
        id: "artwork:met-1->palette:gold:has_palette",
        source: "artwork:met-1",
        target: "palette:gold",
        relation: "has_palette",
        direction: "directed",
        symmetric: false,
        confidence: "EXTRACTED",
        confidenceScore: 1,
        sourceQuality: "release-field",
        reasonCode: "has_palette:gold",
        reasonLabel: "gold extracted from release palette fields",
        sourceRefs: [sourceRef("met-1", "metadata.colorTags[0]")],
      },
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
        reasonLabel: "mystery extracted from release emotion fields",
        sourceRefs: [sourceRef("met-1", "metadata.moodTags[0]")],
      },
    ],
  };
}

test("relationship graph selector returns public extracted evidence with deterministic bounds", () => {
  const graph = validGraph();
  const index = createRelationshipGraphIndex(graph);
  const evidence = selectRelationshipGraphEvidence(index, "met-1", {
    maxResults: 2,
    maxSourceRefsPerEvidence: 2,
  });

  assert.equal(index.status, "ready");
  assert.deepEqual(evidence.map((item) => item.relation), ["has_emotion", "has_subject"]);
  assert.equal(evidence[0]?.signalLabel, "mystery");
  assert.equal(evidence[1]?.sourceRefs.length, 2);
  assert.equal(evidence.every((item) => item.artworkId === "met-1"), true);

  const subjects = selectRelationshipGraphEvidence(index, "artwork:met-1", {
    relationAllowlist: ["has_subject"],
  });
  assert.deepEqual(subjects.map((item) => item.signalNodeId), ["subject:oracle"]);

  const cappedSubject = selectRelationshipGraphEvidence(index, "met-1", {
    relationAllowlist: ["has_subject"],
    maxFanoutPerNode: 1,
  });
  assert.deepEqual(cappedSubject.map((item) => item.signalNodeId), ["subject:oracle"]);
});

test("relationship graph selector fails closed for missing or invalid sidecars", () => {
  const missing = createRelationshipGraphIndex(undefined);
  assert.equal(missing.status, "unavailable");
  assert.equal(missing.unavailableReason, "missing");
  assert.deepEqual(selectRelationshipGraphEvidence(missing, "met-1"), []);

  const invalid = validGraph() as unknown as { edges: Array<Record<string, unknown>> };
  invalid.edges[0]!.confidence = "INFERRED";
  const invalidIndex = createRelationshipGraphIndex(invalid as unknown as RelationshipGraphShard);

  assert.equal(invalidIndex.status, "unavailable");
  assert.equal(invalidIndex.unavailableReason, "invalid");
  assert.deepEqual(selectRelationshipGraphEvidence(invalidIndex, "met-1"), []);
});

test("relationship graph selector output is public-only and does not leak internal fields", () => {
  const graph = validGraph() as unknown as RelationshipGraphShard & {
    nodes: Array<Record<string, unknown>>;
    provenance?: Record<string, unknown>;
  };
  graph.nodes[0]!.privateNotes = "internal note";
  graph.provenance = {
    fullSourceRefsByNode: {
      "emotion:mystery": ["/Volumes/Secret/internal.json"],
    },
  };

  const index = createRelationshipGraphIndex(graph);
  const serializedEvidence = JSON.stringify(selectRelationshipGraphEvidence(index, "met-1"));

  assert.equal(index.status, "ready");
  assert.equal(serializedEvidence.includes("privateNotes"), false);
  assert.equal(serializedEvidence.includes("provenance"), false);
  assert.equal(serializedEvidence.includes("Volumes"), false);
  assert.equal(serializedEvidence.includes("fullSourceRefsByNode"), false);
});

test("relationship graph selector does not alter vector or rerank ordering", () => {
  const documents = [
    { id: "wonder-1", vector: embedText("wonder awe bright miracle").vector, text: "wonder awe bright miracle", grade: "A" },
    { id: "mystery-1", vector: embedText("mystery oracle shadow secret").vector, text: "mystery oracle shadow secret", grade: "B" },
    { id: "joy-1", vector: embedText("joy cheerful bright celebration").vector, text: "joy cheerful bright celebration", grade: "A" },
  ];
  const query = "enigmatic oracle";
  const beforeVector = searchVectorIndex(embedText(query).vector, documents, { limit: 3 });
  const beforeRerank = rerankVectorResults(query, beforeVector, {
    getText: (item) => item.text,
    getGrade: (item) => item.grade,
  });

  const index = createRelationshipGraphIndex(validGraph());
  const evidence = selectRelationshipGraphEvidence(index, "met-1");
  const afterVector = searchVectorIndex(embedText(query).vector, documents, { limit: 3 });
  const afterRerank = rerankVectorResults(query, afterVector, {
    getText: (item) => item.text,
    getGrade: (item) => item.grade,
  });

  assert.ok(evidence.length > 0);
  assert.deepEqual(afterVector.map((entry) => entry.item.id), beforeVector.map((entry) => entry.item.id));
  assert.deepEqual(afterRerank.map((entry) => entry.item.id), beforeRerank.map((entry) => entry.item.id));
});
