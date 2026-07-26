import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_RELATIONSHIP_GRAPH_LIMITS,
  parseRelationshipGraphShard,
  type RelationshipGraphShard,
} from "./relationship-graph";

function validGraph(): RelationshipGraphShard {
  return {
    schemaVersion: "relationship-graph.v1",
    releaseVersion: "2026-04-25-curation-b",
    generatedAt: "2026-05-14T00:00:00.000Z",
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
        {
          artifact: "metadata",
          shardId: "metadata-01",
          checksum: "sha256:metadata",
          recordCount: 1,
          sizeBytes: 100,
        },
      ],
    },
    stats: {
      nodeCount: 2,
      edgeCount: 1,
    },
    limits: {
      ...DEFAULT_RELATIONSHIP_GRAPH_LIMITS,
      maxNodes: 10,
      maxEdges: 10,
      maxDegreePerNode: 5,
      maxSourceRefsPerNode: 5,
      maxSourceRefsPerEdge: 2,
    },
    nodes: [
      {
        id: "artwork:met-1",
        type: "artwork",
        label: "Oracle",
        sourceRefs: [
          {
            artifact: "metadata",
            shardId: "metadata-01",
            recordId: "met-1",
            fieldPath: "id",
            releaseVersion: "2026-04-25-curation-b",
          },
        ],
      },
      {
        id: "emotion:mystery",
        type: "emotion",
        label: "mystery",
        sourceRefs: [
          {
            artifact: "search",
            shardId: "search-01",
            recordId: "met-1",
            fieldPath: "retrieval.emotionLabels[0]",
            releaseVersion: "2026-04-25-curation-b",
          },
        ],
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
        relationshipScore: 1,
        sourceQuality: "release-field",
        reasonCode: "has_emotion:mystery",
        reasonLabel: "mystery extracted from release emotion fields",
        sourceRefs: [
          {
            artifact: "search",
            shardId: "search-01",
            recordId: "met-1",
            fieldPath: "retrieval.emotionLabels[0]",
            releaseVersion: "2026-04-25-curation-b",
          },
        ],
      },
    ],
  };
}

function cloneGraph(): RelationshipGraphShard {
  return structuredClone(validGraph());
}

test("relationship graph parser accepts valid and empty public graphs", () => {
  const graph = parseRelationshipGraphShard(validGraph());

  assert.equal(graph.schemaVersion, "relationship-graph.v1");
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges[0]?.confidence, "EXTRACTED");

  const empty = cloneGraph();
  empty.stats.nodeCount = 0;
  empty.stats.edgeCount = 0;
  empty.nodes = [];
  empty.edges = [];

  const parsedEmpty = parseRelationshipGraphShard(empty);
  assert.equal(parsedEmpty.nodes.length, 0);
  assert.equal(parsedEmpty.edges.length, 0);
});

test("relationship graph parser rejects malformed graph shapes", () => {
  assert.throws(() => parseRelationshipGraphShard([]), /expected object/);
  assert.throws(() => parseRelationshipGraphShard({ ...validGraph(), schemaVersion: "wrong" }), /schemaVersion/);

  const missingBuild = cloneGraph() as unknown as Record<string, unknown>;
  delete missingBuild.build;
  assert.throws(() => parseRelationshipGraphShard(missingBuild), /build/);
});

test("relationship graph parser rejects over-limit graphs", () => {
  const graph = cloneGraph();
  graph.limits.maxNodes = 1;

  assert.throws(() => parseRelationshipGraphShard(graph), /maxNodes/);

  const parserCapped = cloneGraph();
  parserCapped.limits.maxNodes = DEFAULT_RELATIONSHIP_GRAPH_LIMITS.maxNodes + 1;
  assert.throws(() => parseRelationshipGraphShard(parserCapped), /parser cap/);
});

test("relationship graph parser rejects duplicate node and edge ids", () => {
  const duplicateNode = cloneGraph();
  duplicateNode.nodes.push({ ...duplicateNode.nodes[1] });
  duplicateNode.stats.nodeCount = duplicateNode.nodes.length;
  assert.throws(() => parseRelationshipGraphShard(duplicateNode), /duplicate id/);

  const duplicateEdge = cloneGraph();
  duplicateEdge.edges.push({ ...duplicateEdge.edges[0] });
  duplicateEdge.stats.edgeCount = duplicateEdge.edges.length;
  assert.throws(() => parseRelationshipGraphShard(duplicateEdge), /duplicate id/);
});

test("relationship graph parser rejects self-loops and unknown node references", () => {
  const selfLoop = cloneGraph();
  selfLoop.edges[0] = {
    ...selfLoop.edges[0],
    target: "artwork:met-1",
  };
  assert.throws(() => parseRelationshipGraphShard(selfLoop), /self-loops/);

  const unknownRef = cloneGraph();
  unknownRef.edges[0] = {
    ...unknownRef.edges[0],
    target: "emotion:missing",
  };
  assert.throws(() => parseRelationshipGraphShard(unknownRef), /unknown target node/);
});

test("relationship graph parser rejects node id and relation topology mismatches", () => {
  const mismatchedId = cloneGraph();
  mismatchedId.nodes[1] = {
    ...mismatchedId.nodes[1],
    id: "subject:mystery",
  };
  mismatchedId.edges[0] = {
    ...mismatchedId.edges[0],
    target: "subject:mystery",
  };
  assert.throws(() => parseRelationshipGraphShard(mismatchedId), /expected emotion:/);

  const wrongTargetType = cloneGraph();
  wrongTargetType.nodes[1] = {
    ...wrongTargetType.nodes[1],
    id: "subject:mystery",
    type: "subject",
  };
  wrongTargetType.edges[0] = {
    ...wrongTargetType.edges[0],
    target: "subject:mystery",
  };
  assert.throws(() => parseRelationshipGraphShard(wrongTargetType), /has_emotion must target a emotion node/);

  const wrongSourceType = cloneGraph();
  wrongSourceType.edges[0] = {
    ...wrongSourceType.edges[0],
    source: "emotion:mystery",
    target: "artwork:met-1",
  };
  assert.throws(() => parseRelationshipGraphShard(wrongSourceType), /source must be an artwork node/);
});

test("relationship graph parser rejects invalid relationship scores", () => {
  const tooLarge = cloneGraph();
  tooLarge.edges[0] = {
    ...tooLarge.edges[0],
    relationshipScore: 1.01,
  };
  assert.throws(() => parseRelationshipGraphShard(tooLarge), /relationshipScore/);

  const infinite = cloneGraph() as unknown as { edges: Array<Record<string, unknown>> };
  infinite.edges[0].relationshipScore = Infinity;
  assert.throws(() => parseRelationshipGraphShard(infinite), /relationshipScore/);
});

test("relationship graph parser rejects non-allowlisted source ref field paths", () => {
  const fieldPathLeak = cloneGraph();
  fieldPathLeak.nodes[0] = {
    ...fieldPathLeak.nodes[0],
    sourceRefs: [
      {
        artifact: "metadata",
        shardId: "metadata-01",
        recordId: "met-1",
        fieldPath: "metadata.internalNotes",
        releaseVersion: "2026-04-25-curation-b",
      },
    ],
  };

  assert.throws(() => parseRelationshipGraphShard(fieldPathLeak), /fieldPath is not public-allowlisted/);
});

test("relationship graph parser rejects source refs from another release", () => {
  const staleSourceRef = cloneGraph();
  staleSourceRef.nodes[0] = {
    ...staleSourceRef.nodes[0],
    sourceRefs: [
      {
        artifact: "metadata",
        shardId: "metadata-01",
        recordId: "met-1",
        fieldPath: "id",
        releaseVersion: "2026-04-24-curation-a",
      },
    ],
  };

  assert.throws(() => parseRelationshipGraphShard(staleSourceRef), /releaseVersion/);
});

test("relationship graph parser rejects unknown public fields", () => {
  const cases: Array<[string, (graph: RelationshipGraphShard) => void]> = [
    [
      "top-level customField",
      (graph) => {
        (graph as unknown as Record<string, unknown>).customField = "future extension";
      },
    ],
    [
      "build customField",
      (graph) => {
        (graph.build as unknown as Record<string, unknown>).customField = "future extension";
      },
    ],
    [
      "stats customField",
      (graph) => {
        (graph.stats as unknown as Record<string, unknown>).customField = "future extension";
      },
    ],
    [
      "limits customField",
      (graph) => {
        (graph.limits as unknown as Record<string, unknown>).customField = 1;
      },
    ],
    [
      "node privateNotes",
      (graph) => {
        (graph.nodes[0] as unknown as Record<string, unknown>).privateNotes = "release-only note";
      },
    ],
    [
      "edge debugPayload",
      (graph) => {
        (graph.edges[0] as unknown as Record<string, unknown>).debugPayload = { scoreTrace: [1] };
      },
    ],
    [
      "sourceRef customField",
      (graph) => {
        (graph.nodes[0].sourceRefs[0] as unknown as Record<string, unknown>).customField = "future extension";
      },
    ],
    [
      "fingerprint customField",
      (graph) => {
        (graph.build.inputFingerprints[0] as unknown as Record<string, unknown>).customField = "future extension";
      },
    ],
  ];

  for (const [name, mutate] of cases) {
    const graph = cloneGraph();
    mutate(graph);
    assert.throws(() => parseRelationshipGraphShard(graph), /unknown field/, name);
  }
});

test("relationship graph parser rejects internal and non-public data leaks", () => {
  const internalLeak = cloneGraph() as unknown as { nodes: Array<Record<string, unknown>> };
  internalLeak.nodes[0].visibility = "internal";
  assert.throws(() => parseRelationshipGraphShard(internalLeak), /internal\/debug fields/);

  const inferredLeak = cloneGraph() as unknown as { edges: Array<Record<string, unknown>> };
  inferredLeak.edges[0].confidence = "INFERRED";
  assert.throws(() => parseRelationshipGraphShard(inferredLeak), /confidence/);

  const localPathLeak = cloneGraph();
  localPathLeak.build.builderVersion = "/opt/artduo/debug-builder.ts";
  assert.throws(() => parseRelationshipGraphShard(localPathLeak), /local absolute paths/);

  const fileUrlLeak = cloneGraph();
  fileUrlLeak.build.builderVersion = "file:///Users/aitoshuu/debug-builder.ts";
  assert.throws(() => parseRelationshipGraphShard(fileUrlLeak), /local absolute paths/);

  const codeGraphLeak = cloneGraph();
  codeGraphLeak.build.builderVersion = "graphify-out/graph.json";
  assert.throws(() => parseRelationshipGraphShard(codeGraphLeak), /source-code graph paths/);
});
