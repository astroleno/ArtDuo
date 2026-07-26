import type {
  RelationshipGraphEdge,
  RelationshipGraphNode,
  RelationshipGraphRelation,
  RelationshipGraphShard,
  RelationshipGraphSourceRef,
} from "@artduo/contracts";

export const RELATIONSHIP_GRAPH_SELECTOR_VERSION = "relationship-graph-selector.v1";

const RELATION_PRIORITY: Record<RelationshipGraphRelation, number> = {
  has_emotion: 0,
  has_subject: 1,
  has_palette: 2,
};

const DEFAULT_MAX_RESULTS = 10;
const DEFAULT_MAX_FANOUT_PER_NODE = 32;
const DEFAULT_MAX_SOURCE_REFS_PER_EVIDENCE = 3;

export interface RelationshipGraphSelectorOptions {
  relationAllowlist?: readonly RelationshipGraphRelation[];
  maxResults?: number;
  maxFanoutPerNode?: number;
  maxDepth?: number;
  maxSourceRefsPerEvidence?: number;
}

export interface RelationshipGraphEvidenceItem {
  artworkId: string;
  artworkNodeId: string;
  edgeId: string;
  relation: RelationshipGraphRelation;
  signalNodeId: string;
  signalType: Exclude<RelationshipGraphNode["type"], "artwork">;
  signalLabel: string;
  reasonCode: string;
  reasonLabel?: string;
  sourceRefs: RelationshipGraphSourceRef[];
}

export type RelationshipGraphIndexStatus = "ready" | "unavailable";
export type RelationshipGraphUnavailableReason = "missing" | "invalid";

export interface RelationshipGraphIndex {
  selectorVersion: typeof RELATIONSHIP_GRAPH_SELECTOR_VERSION;
  status: RelationshipGraphIndexStatus;
  releaseVersion?: string;
  unavailableReason?: RelationshipGraphUnavailableReason;
  unavailableMessage?: string;
  nodeCount: number;
  edgeCount: number;
  nodesById: ReadonlyMap<string, RelationshipGraphNode>;
  edgesByArtworkId: ReadonlyMap<string, readonly RelationshipGraphEdge[]>;
}

function emptyIndex(reason: RelationshipGraphUnavailableReason, message?: string): RelationshipGraphIndex {
  return {
    selectorVersion: RELATIONSHIP_GRAPH_SELECTOR_VERSION,
    status: "unavailable",
    unavailableReason: reason,
    unavailableMessage: message,
    nodeCount: 0,
    edgeCount: 0,
    nodesById: new Map(),
    edgesByArtworkId: new Map(),
  };
}

export function createUnavailableRelationshipGraphIndex(
  reason: RelationshipGraphUnavailableReason,
  message?: string,
): RelationshipGraphIndex {
  return emptyIndex(reason, message);
}

function artworkNodeIdFor(artworkId: string): string {
  return artworkId.startsWith("artwork:") ? artworkId : `artwork:${artworkId}`;
}

function normalizePositiveInteger(value: number | undefined, defaultValue: number): number {
  if (value === undefined) {
    return defaultValue;
  }
  if (!Number.isFinite(value) || value < 1) {
    return defaultValue;
  }

  return Math.floor(value);
}

function compareEdges(left: RelationshipGraphEdge, right: RelationshipGraphEdge, nodesById: ReadonlyMap<string, RelationshipGraphNode>): number {
  const relationDelta = RELATION_PRIORITY[left.relation] - RELATION_PRIORITY[right.relation];
  if (relationDelta !== 0) {
    return relationDelta;
  }

  const leftTarget = nodesById.get(left.target);
  const rightTarget = nodesById.get(right.target);
  const labelDelta = (leftTarget?.label ?? "").localeCompare(rightTarget?.label ?? "");
  if (labelDelta !== 0) {
    return labelDelta;
  }

  const targetDelta = left.target.localeCompare(right.target);
  if (targetDelta !== 0) {
    return targetDelta;
  }

  return left.id.localeCompare(right.id);
}

function validatePublicGraphForIndex(graph: RelationshipGraphShard): string | undefined {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node] as const));

  for (const node of graph.nodes) {
    if (node.type === "artwork") {
      if (!node.id.startsWith("artwork:")) {
        return `${node.id}: artwork node id must use artwork: prefix`;
      }
      continue;
    }

    if (!node.id.startsWith(`${node.type}:`)) {
      return `${node.id}: signal node id must match its type prefix`;
    }
  }

  for (const edge of graph.edges) {
    if (edge.confidence !== "EXTRACTED" || edge.confidenceScore !== 1 || edge.sourceQuality !== "release-field") {
      return `${edge.id}: only EXTRACTED release-field edges are selectable`;
    }

    const source = nodesById.get(edge.source);
    const target = nodesById.get(edge.target);
    if (!source || !target) {
      return `${edge.id}: edge references unknown nodes`;
    }
    if (source.type !== "artwork") {
      return `${edge.id}: source must be an artwork node`;
    }
    if (target.type === "artwork") {
      return `${edge.id}: target must be a signal node`;
    }
    if (
      (edge.relation === "has_emotion" && target.type !== "emotion")
      || (edge.relation === "has_subject" && target.type !== "subject")
      || (edge.relation === "has_palette" && target.type !== "palette")
    ) {
      return `${edge.id}: relation target type mismatch`;
    }
  }

  return undefined;
}

export function createRelationshipGraphIndex(graph: RelationshipGraphShard | undefined): RelationshipGraphIndex {
  if (!graph) {
    return emptyIndex("missing", "Relationship graph sidecar is absent.");
  }

  const invalidReason = validatePublicGraphForIndex(graph);
  if (invalidReason) {
    return emptyIndex("invalid", invalidReason);
  }

  const nodesById = new Map(graph.nodes.map((node) => [node.id, node] as const));
  const edgesByArtworkId = new Map<string, RelationshipGraphEdge[]>();

  for (const edge of graph.edges) {
    const edges = edgesByArtworkId.get(edge.source) ?? [];
    edges.push(edge);
    edgesByArtworkId.set(edge.source, edges);
  }

  for (const [artworkNodeId, edges] of edgesByArtworkId.entries()) {
    edgesByArtworkId.set(artworkNodeId, [...edges].sort((left, right) => compareEdges(left, right, nodesById)));
  }

  return {
    selectorVersion: RELATIONSHIP_GRAPH_SELECTOR_VERSION,
    status: "ready",
    releaseVersion: graph.releaseVersion,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    nodesById,
    edgesByArtworkId,
  };
}

export function selectRelationshipGraphEvidence(
  index: RelationshipGraphIndex,
  artworkId: string,
  options: RelationshipGraphSelectorOptions = {},
): RelationshipGraphEvidenceItem[] {
  if (index.status !== "ready") {
    return [];
  }

  const maxDepth = normalizePositiveInteger(options.maxDepth, 1);
  if (maxDepth !== 1) {
    return [];
  }

  const artworkNodeId = artworkNodeIdFor(artworkId);
  const maxResults = normalizePositiveInteger(options.maxResults, DEFAULT_MAX_RESULTS);
  const maxFanoutPerNode = normalizePositiveInteger(options.maxFanoutPerNode, DEFAULT_MAX_FANOUT_PER_NODE);
  const maxSourceRefsPerEvidence = normalizePositiveInteger(
    options.maxSourceRefsPerEvidence,
    DEFAULT_MAX_SOURCE_REFS_PER_EVIDENCE,
  );
  const allowedRelations = options.relationAllowlist
    ? new Set(options.relationAllowlist)
    : undefined;

  return [...(index.edgesByArtworkId.get(artworkNodeId) ?? [])]
    .filter((edge) => !allowedRelations || allowedRelations.has(edge.relation))
    .slice(0, maxFanoutPerNode)
    .flatMap((edge) => {
      const signal = index.nodesById.get(edge.target);
      if (!signal || signal.type === "artwork") {
        return [];
      }

      return [{
        artworkId: artworkNodeId.slice("artwork:".length),
        artworkNodeId,
        edgeId: edge.id,
        relation: edge.relation,
        signalNodeId: signal.id,
        signalType: signal.type,
        signalLabel: signal.label,
        reasonCode: edge.reasonCode,
        reasonLabel: edge.reasonLabel,
        sourceRefs: edge.sourceRefs.slice(0, maxSourceRefsPerEvidence),
      }];
    })
    .slice(0, maxResults);
}
