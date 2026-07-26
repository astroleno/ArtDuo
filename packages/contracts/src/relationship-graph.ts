import {
  expectArray,
  expectObject,
  expectString,
  parseArray,
  readBoolean,
  readLiteral,
  readNumber,
  readObject,
  readOptionalNumber,
  readOptionalString,
  readString,
} from "./internal/validation";

export const RELATIONSHIP_GRAPH_SCHEMA_VERSION = "relationship-graph.v1";
export const RELATIONSHIP_GRAPH_NODE_TYPES = ["artwork", "emotion", "subject", "palette"] as const;
export const RELATIONSHIP_GRAPH_RELATIONS = ["has_emotion", "has_subject", "has_palette"] as const;
export const RELATIONSHIP_GRAPH_CONFIDENCE_VALUES = ["EXTRACTED"] as const;
export const RELATIONSHIP_GRAPH_SOURCE_QUALITIES = ["release-field"] as const;
export const RELATIONSHIP_GRAPH_SOURCE_ARTIFACTS = [
  "manifest",
  "metadata",
  "search",
  "mediaIndex",
  "backgroundScenes",
] as const;
export const RELATIONSHIP_GRAPH_BUILDER_NAME = "@artduo/pipeline/relationship-graph";

const FORBIDDEN_PUBLIC_KEYS = new Set([
  "absolutePath",
  "debug",
  "diagnostics",
  "internal",
  "localPath",
  "promptText",
  "provenance",
  "rejectedRecords",
  "sensitivity",
  "visibility",
]);

const SHARD_KEYS = [
  "schemaVersion",
  "releaseVersion",
  "generatedAt",
  "build",
  "stats",
  "limits",
  "nodes",
  "edges",
] as const;
const BUILD_KEYS = ["builderName", "builderVersion", "taxonomyVersion", "inputFingerprints"] as const;
const STATS_KEYS = ["nodeCount", "edgeCount"] as const;
const LIMIT_KEYS = [
  "maxPreParseBytes",
  "maxShardSizeBytes",
  "maxGzipSizeBytes",
  "maxNodes",
  "maxEdges",
  "maxDegreePerNode",
  "maxSourceRefsPerNode",
  "maxSourceRefsPerEdge",
  "maxFieldPathBytes",
  "maxStringBytes",
  "maxReasonLabelBytes",
] as const;
const NODE_KEYS = ["id", "type", "label", "sourceRefs"] as const;
const EDGE_KEYS = [
  "id",
  "source",
  "target",
  "relation",
  "direction",
  "symmetric",
  "confidence",
  "confidenceScore",
  "relationshipScore",
  "sourceQuality",
  "reasonCode",
  "reasonLabel",
  "sourceRefs",
] as const;
const MANIFEST_SOURCE_REF_KEYS = ["artifact", "releaseVersion", "fieldPath"] as const;
const SHARD_SOURCE_REF_KEYS = ["artifact", "shardId", "recordId", "fieldPath", "releaseVersion"] as const;
const MANIFEST_FINGERPRINT_KEYS = ["artifact", "checksum", "sizeBytes"] as const;
const SHARD_FINGERPRINT_KEYS = ["artifact", "shardId", "checksum", "recordCount", "sizeBytes"] as const;

const FIELD_PATH_ALLOWLIST: Record<RelationshipGraphSourceArtifact, RegExp[]> = {
  manifest: [
    /^release\.(corpusVersion|backgroundCatalogVersion|contractsVersion|createdAt)$/,
    /^shards\.(metadata|search|mediaIndex|backgroundScenes|embeddings|relationshipGraph)\[\d+\]\.(id|url|checksum|sizeBytes|recordCount)$/,
  ],
  metadata: [
    /^id$/,
    /^source$/,
    /^sourceArtworkId$/,
    /^version$/,
    /^locale$/,
    /^metadata\.(title|artistDisplayName)$/,
    /^metadata\.(moodTags|colorTags|subjectTags|compositionTags)\[\d+\]$/,
    /^presentation\.(grade|gradeLabel)$/,
    /^presentation\.sceneAffinity\.(sceneTypes|paletteModes|spatialModes|transitionTags)\[\d+\]$/,
  ],
  search: [
    /^id$/,
    /^source$/,
    /^sourceArtworkId$/,
    /^version$/,
    /^retrieval\.(emotionLabels|keywordBoosts)\[\d+\]$/,
    /^retrieval\.(energyLevel|valence|pace|spaceSense)$/,
  ],
  mediaIndex: [
    /^id$/,
    /^source$/,
    /^sourceArtworkId$/,
    /^version$/,
    /^media\.(aspectRatioHint|hasMotionAsset|mediaVersion|sourceAssetFingerprint)$/,
  ],
  backgroundScenes: [
    /^id$/,
    /^asset\.(label_cn|label_en|asset_group|metadata_version)$/,
    /^visual_profile\.scene_type$/,
    /^visual_profile\.(styles|materials|lighting|mood|palette|composition)\[\d+\]$/,
    /^curation_profile\.(emotion_ids|artwork_subject_modes|artwork_palette_modes|artwork_composition_modes|artwork_orientation_modes|supported_artwork_grades|preferred_unit_roles)\[\d+\]$/,
    /^stage_profile\.(preferred_artwork_scale|wall_visibility|depth_strategy|dominant_axis)$/,
    /^transition_profile\.(entry_families|exit_families|bridge_tokens)\[\d+\]$/,
  ],
};

export type RelationshipGraphNodeType = (typeof RELATIONSHIP_GRAPH_NODE_TYPES)[number];
export type RelationshipGraphRelation = (typeof RELATIONSHIP_GRAPH_RELATIONS)[number];
export type RelationshipGraphSourceArtifact = (typeof RELATIONSHIP_GRAPH_SOURCE_ARTIFACTS)[number];

export interface ManifestSourceRef {
  artifact: "manifest";
  releaseVersion: string;
  fieldPath: string;
}

export interface ShardSourceRef {
  artifact: "metadata" | "search" | "mediaIndex" | "backgroundScenes";
  shardId: string;
  recordId: string;
  fieldPath: string;
  releaseVersion: string;
}

export type RelationshipGraphSourceRef = ManifestSourceRef | ShardSourceRef;

export interface ManifestFingerprint {
  artifact: "manifest";
  checksum?: string;
  sizeBytes?: number;
}

export interface ShardFingerprint {
  artifact: "metadata" | "search" | "mediaIndex" | "backgroundScenes";
  shardId: string;
  checksum?: string;
  recordCount?: number;
  sizeBytes?: number;
}

export type RelationshipGraphInputFingerprint = ManifestFingerprint | ShardFingerprint;

export interface RelationshipGraphBuildInfo {
  builderName: typeof RELATIONSHIP_GRAPH_BUILDER_NAME;
  builderVersion: string;
  taxonomyVersion: string;
  inputFingerprints: RelationshipGraphInputFingerprint[];
}

export interface RelationshipGraphStats {
  nodeCount: number;
  edgeCount: number;
}

export interface RelationshipGraphLimits {
  maxPreParseBytes: number;
  maxShardSizeBytes: number;
  maxGzipSizeBytes: number;
  maxNodes: number;
  maxEdges: number;
  maxDegreePerNode: number;
  maxSourceRefsPerNode: number;
  maxSourceRefsPerEdge: number;
  maxFieldPathBytes: number;
  maxStringBytes: number;
  maxReasonLabelBytes: number;
}

export interface RelationshipGraphNode {
  id: string;
  type: RelationshipGraphNodeType;
  label: string;
  sourceRefs: RelationshipGraphSourceRef[];
}

export interface RelationshipGraphEdge {
  id: string;
  source: string;
  target: string;
  relation: RelationshipGraphRelation;
  direction: "directed";
  symmetric: false;
  confidence: "EXTRACTED";
  confidenceScore: 1;
  relationshipScore?: number;
  sourceQuality: "release-field";
  reasonCode: string;
  reasonLabel?: string;
  sourceRefs: RelationshipGraphSourceRef[];
}

export interface RelationshipGraphShard {
  schemaVersion: typeof RELATIONSHIP_GRAPH_SCHEMA_VERSION;
  releaseVersion: string;
  generatedAt: string;
  build: RelationshipGraphBuildInfo;
  stats: RelationshipGraphStats;
  limits: RelationshipGraphLimits;
  nodes: RelationshipGraphNode[];
  edges: RelationshipGraphEdge[];
}

export type RelationshipGraphParserLimits = RelationshipGraphLimits;

export const DEFAULT_RELATIONSHIP_GRAPH_LIMITS: RelationshipGraphParserLimits = {
  maxPreParseBytes: 2_046_976,
  maxShardSizeBytes: 2_046_976,
  maxGzipSizeBytes: 78_848,
  maxNodes: 590,
  maxEdges: 1_840,
  maxDegreePerNode: 150,
  maxSourceRefsPerNode: 150,
  maxSourceRefsPerEdge: 3,
  maxFieldPathBytes: 128,
  maxStringBytes: 448,
  maxReasonLabelBytes: 160,
};

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function expectNonNegativeInteger(value: number, path: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${path}: expected non-negative integer`);
  }

  return value;
}

function readNonNegativeInteger(source: Record<string, unknown>, key: string, path: string): number {
  return expectNonNegativeInteger(readNumber(source, key, path), `${path}.${key}`);
}

function readOptionalNonNegativeInteger(source: Record<string, unknown>, key: string, path: string): number | undefined {
  const value = readOptionalNumber(source, key, path);
  return value === undefined ? undefined : expectNonNegativeInteger(value, `${path}.${key}`);
}

function assertOnlyKeys(source: Record<string, unknown>, allowedKeys: readonly string[], path: string): void {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(source)) {
    if (!allowed.has(key)) {
      throw new TypeError(`${path}.${key}: unknown field is not allowed in public relationship graphs`);
    }
  }
}

function assertStringWithinBytes(value: string, limit: number, path: string): void {
  const size = byteLength(value);
  if (size > limit) {
    throw new TypeError(`${path}: expected string <= ${limit} bytes, got ${size}`);
  }
}

function assertFieldPathAllowed(artifact: RelationshipGraphSourceArtifact, fieldPath: string, path: string): void {
  if (!FIELD_PATH_ALLOWLIST[artifact].some((pattern) => pattern.test(fieldPath))) {
    throw new TypeError(`${path}: fieldPath is not public-allowlisted for ${artifact}`);
  }
}

function expectedNodeIdPrefix(type: RelationshipGraphNodeType): string {
  return `${type}:`;
}

function expectedTargetTypeForRelation(relation: RelationshipGraphRelation): RelationshipGraphNodeType {
  if (relation === "has_emotion") {
    return "emotion";
  }
  if (relation === "has_subject") {
    return "subject";
  }
  return "palette";
}

function parseRelationshipScore(value: number | undefined, path: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new TypeError(`${path}.relationshipScore: expected finite number from 0 to 1`);
  }

  return value;
}

function assertNoPublicLeaks(value: unknown, path: string): void {
  if (typeof value === "string") {
    if (value.startsWith("/") || value.startsWith("file://") || /^[A-Za-z]:[\\/]/.test(value)) {
      throw new TypeError(`${path}: local absolute paths are not allowed in public relationship graphs`);
    }
    if (value.includes("graphify-out")) {
      throw new TypeError(`${path}: source-code graph paths are not allowed in public relationship graphs`);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoPublicLeaks(entry, `${path}[${index}]`));
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_PUBLIC_KEYS.has(key)) {
        throw new TypeError(`${path}.${key}: internal/debug fields are not allowed in public relationship graphs`);
      }
      assertNoPublicLeaks(entry, `${path}.${key}`);
    }
  }
}

function parseLimits(value: unknown, path: string): RelationshipGraphLimits {
  const limits = expectObject(value, path);
  assertOnlyKeys(limits, LIMIT_KEYS, path);

  return {
    maxPreParseBytes: readNonNegativeInteger(limits, "maxPreParseBytes", path),
    maxShardSizeBytes: readNonNegativeInteger(limits, "maxShardSizeBytes", path),
    maxGzipSizeBytes: readNonNegativeInteger(limits, "maxGzipSizeBytes", path),
    maxNodes: readNonNegativeInteger(limits, "maxNodes", path),
    maxEdges: readNonNegativeInteger(limits, "maxEdges", path),
    maxDegreePerNode: readNonNegativeInteger(limits, "maxDegreePerNode", path),
    maxSourceRefsPerNode: readNonNegativeInteger(limits, "maxSourceRefsPerNode", path),
    maxSourceRefsPerEdge: readNonNegativeInteger(limits, "maxSourceRefsPerEdge", path),
    maxFieldPathBytes: readNonNegativeInteger(limits, "maxFieldPathBytes", path),
    maxStringBytes: readNonNegativeInteger(limits, "maxStringBytes", path),
    maxReasonLabelBytes: readNonNegativeInteger(limits, "maxReasonLabelBytes", path),
  };
}

function assertLimitsWithinParserCaps(
  artifactLimits: RelationshipGraphLimits,
  parserLimits: RelationshipGraphParserLimits,
  path: string,
): void {
  for (const key of Object.keys(DEFAULT_RELATIONSHIP_GRAPH_LIMITS) as Array<keyof RelationshipGraphLimits>) {
    if (artifactLimits[key] > parserLimits[key]) {
      throw new TypeError(`${path}.${key}: exceeds parser cap ${parserLimits[key]}`);
    }
  }
}

function parseSourceRef(value: unknown, path: string, limits: RelationshipGraphLimits): RelationshipGraphSourceRef {
  const ref = expectObject(value, path);
  const artifact = readLiteral(ref, "artifact", RELATIONSHIP_GRAPH_SOURCE_ARTIFACTS, path);
  assertOnlyKeys(ref, artifact === "manifest" ? MANIFEST_SOURCE_REF_KEYS : SHARD_SOURCE_REF_KEYS, path);
  const releaseVersion = readString(ref, "releaseVersion", path);
  const fieldPath = readString(ref, "fieldPath", path);

  assertStringWithinBytes(fieldPath, limits.maxFieldPathBytes, `${path}.fieldPath`);
  assertStringWithinBytes(releaseVersion, limits.maxStringBytes, `${path}.releaseVersion`);
  assertFieldPathAllowed(artifact, fieldPath, `${path}.fieldPath`);

  if (artifact === "manifest") {
    return {
      artifact,
      releaseVersion,
      fieldPath,
    };
  }

  const shardId = readString(ref, "shardId", path);
  const recordId = readString(ref, "recordId", path);
  assertStringWithinBytes(shardId, limits.maxStringBytes, `${path}.shardId`);
  assertStringWithinBytes(recordId, limits.maxStringBytes, `${path}.recordId`);

  return {
    artifact,
    shardId,
    recordId,
    fieldPath,
    releaseVersion,
  };
}

function parseSourceRefs(value: unknown, path: string, limits: RelationshipGraphLimits): RelationshipGraphSourceRef[] {
  return parseArray(value, (entry, entryPath) => parseSourceRef(entry, entryPath, limits), path);
}

function parseNode(value: unknown, path: string, limits: RelationshipGraphLimits): RelationshipGraphNode {
  const node = expectObject(value, path);
  assertOnlyKeys(node, NODE_KEYS, path);
  const id = readString(node, "id", path);
  const type = readLiteral(node, "type", RELATIONSHIP_GRAPH_NODE_TYPES, path);
  const label = readString(node, "label", path);
  const sourceRefs = parseSourceRefs(expectArray(node.sourceRefs, `${path}.sourceRefs`), `${path}.sourceRefs`, limits);

  assertStringWithinBytes(id, limits.maxStringBytes, `${path}.id`);
  assertStringWithinBytes(label, limits.maxStringBytes, `${path}.label`);
  if (!id.startsWith(expectedNodeIdPrefix(type)) || id.length === expectedNodeIdPrefix(type).length) {
    throw new TypeError(`${path}.id: expected ${expectedNodeIdPrefix(type)} prefix for ${type} node`);
  }
  if (sourceRefs.length > limits.maxSourceRefsPerNode) {
    throw new TypeError(`${path}.sourceRefs: exceeds maxSourceRefsPerNode`);
  }

  return { id, type, label, sourceRefs };
}

function parseEdge(value: unknown, path: string, limits: RelationshipGraphLimits): RelationshipGraphEdge {
  const edge = expectObject(value, path);
  assertOnlyKeys(edge, EDGE_KEYS, path);
  const id = readString(edge, "id", path);
  const source = readString(edge, "source", path);
  const target = readString(edge, "target", path);
  const reasonCode = readString(edge, "reasonCode", path);
  const reasonLabel = readOptionalString(edge, "reasonLabel", path);
  const confidenceScore = readNumber(edge, "confidenceScore", path);
  const symmetric = readBoolean(edge, "symmetric", path);
  const relationshipScore = parseRelationshipScore(readOptionalNumber(edge, "relationshipScore", path), path);
  const sourceRefs = parseSourceRefs(expectArray(edge.sourceRefs, `${path}.sourceRefs`), `${path}.sourceRefs`, limits);

  assertStringWithinBytes(id, limits.maxStringBytes, `${path}.id`);
  assertStringWithinBytes(source, limits.maxStringBytes, `${path}.source`);
  assertStringWithinBytes(target, limits.maxStringBytes, `${path}.target`);
  assertStringWithinBytes(reasonCode, limits.maxStringBytes, `${path}.reasonCode`);
  if (reasonLabel !== undefined) {
    assertStringWithinBytes(reasonLabel, limits.maxReasonLabelBytes, `${path}.reasonLabel`);
  }
  if (source === target) {
    throw new TypeError(`${path}: self-loops are not allowed`);
  }
  if (symmetric !== false) {
    throw new TypeError(`${path}.symmetric: expected false`);
  }
  if (confidenceScore !== 1) {
    throw new TypeError(`${path}.confidenceScore: expected 1 for EXTRACTED edges`);
  }
  if (sourceRefs.length > limits.maxSourceRefsPerEdge) {
    throw new TypeError(`${path}.sourceRefs: exceeds maxSourceRefsPerEdge`);
  }

  return {
    id,
    source,
    target,
    relation: readLiteral(edge, "relation", RELATIONSHIP_GRAPH_RELATIONS, path),
    direction: readLiteral(edge, "direction", ["directed"] as const, path),
    symmetric: false,
    confidence: readLiteral(edge, "confidence", RELATIONSHIP_GRAPH_CONFIDENCE_VALUES, path),
    confidenceScore: 1,
    relationshipScore,
    sourceQuality: readLiteral(edge, "sourceQuality", RELATIONSHIP_GRAPH_SOURCE_QUALITIES, path),
    reasonCode,
    reasonLabel,
    sourceRefs,
  };
}

function parseFingerprint(value: unknown, path: string): RelationshipGraphInputFingerprint {
  const fingerprint = expectObject(value, path);
  const artifact = readLiteral(fingerprint, "artifact", RELATIONSHIP_GRAPH_SOURCE_ARTIFACTS, path);
  assertOnlyKeys(fingerprint, artifact === "manifest" ? MANIFEST_FINGERPRINT_KEYS : SHARD_FINGERPRINT_KEYS, path);

  if (artifact === "manifest") {
    return {
      artifact,
      checksum: readOptionalString(fingerprint, "checksum", path),
      sizeBytes: readOptionalNonNegativeInteger(fingerprint, "sizeBytes", path),
    };
  }

  return {
    artifact,
    shardId: readString(fingerprint, "shardId", path),
    checksum: readOptionalString(fingerprint, "checksum", path),
    recordCount: readOptionalNonNegativeInteger(fingerprint, "recordCount", path),
    sizeBytes: readOptionalNonNegativeInteger(fingerprint, "sizeBytes", path),
  };
}

function parseBuildInfo(value: unknown, path: string): RelationshipGraphBuildInfo {
  const build = expectObject(value, path);
  assertOnlyKeys(build, BUILD_KEYS, path);
  const builderName = readString(build, "builderName", path);

  if (builderName !== RELATIONSHIP_GRAPH_BUILDER_NAME) {
    throw new TypeError(`${path}.builderName: expected ${RELATIONSHIP_GRAPH_BUILDER_NAME}`);
  }

  return {
    builderName: RELATIONSHIP_GRAPH_BUILDER_NAME,
    builderVersion: readString(build, "builderVersion", path),
    taxonomyVersion: readString(build, "taxonomyVersion", path),
    inputFingerprints: parseArray(
      build.inputFingerprints,
      (entry, entryPath) => parseFingerprint(entry, entryPath),
      `${path}.inputFingerprints`,
    ),
  };
}

function parseStats(value: unknown, path: string): RelationshipGraphStats {
  const stats = expectObject(value, path);
  assertOnlyKeys(stats, STATS_KEYS, path);

  return {
    nodeCount: readNonNegativeInteger(stats, "nodeCount", path),
    edgeCount: readNonNegativeInteger(stats, "edgeCount", path),
  };
}

function validateUniqueIds(ids: string[], path: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new TypeError(`${path}: duplicate id ${id}`);
    }
    seen.add(id);
  }
}

function validateEdges(nodes: RelationshipGraphNode[], edges: RelationshipGraphEdge[], limits: RelationshipGraphLimits): void {
  const nodesById = new Map(nodes.map((node) => [node.id, node] as const));
  const degreeByNode = new Map<string, number>(nodes.map((node) => [node.id, 0] as const));

  for (const edge of edges) {
    const sourceNode = nodesById.get(edge.source);
    if (!sourceNode) {
      throw new TypeError(`RelationshipGraphShard.edges.${edge.id}: unknown source node ${edge.source}`);
    }
    const targetNode = nodesById.get(edge.target);
    if (!targetNode) {
      throw new TypeError(`RelationshipGraphShard.edges.${edge.id}: unknown target node ${edge.target}`);
    }
    if (sourceNode.type !== "artwork") {
      throw new TypeError(`RelationshipGraphShard.edges.${edge.id}: source must be an artwork node`);
    }
    const expectedTargetType = expectedTargetTypeForRelation(edge.relation);
    if (targetNode.type !== expectedTargetType) {
      throw new TypeError(`RelationshipGraphShard.edges.${edge.id}: ${edge.relation} must target a ${expectedTargetType} node`);
    }

    degreeByNode.set(edge.source, (degreeByNode.get(edge.source) ?? 0) + 1);
    degreeByNode.set(edge.target, (degreeByNode.get(edge.target) ?? 0) + 1);
  }

  for (const [nodeId, degree] of degreeByNode.entries()) {
    if (degree > limits.maxDegreePerNode) {
      throw new TypeError(`RelationshipGraphShard.nodes.${nodeId}: degree exceeds maxDegreePerNode`);
    }
  }
}

function validateSourceRefReleaseVersions(
  releaseVersion: string,
  nodes: RelationshipGraphNode[],
  edges: RelationshipGraphEdge[],
  path: string,
): void {
  for (const [nodeIndex, node] of nodes.entries()) {
    for (const [sourceRefIndex, sourceRef] of node.sourceRefs.entries()) {
      if (sourceRef.releaseVersion !== releaseVersion) {
        throw new TypeError(`${path}.nodes[${nodeIndex}].sourceRefs[${sourceRefIndex}].releaseVersion: expected ${releaseVersion}`);
      }
    }
  }

  for (const [edgeIndex, edge] of edges.entries()) {
    for (const [sourceRefIndex, sourceRef] of edge.sourceRefs.entries()) {
      if (sourceRef.releaseVersion !== releaseVersion) {
        throw new TypeError(`${path}.edges[${edgeIndex}].sourceRefs[${sourceRefIndex}].releaseVersion: expected ${releaseVersion}`);
      }
    }
  }
}

function validateStringBudgets(value: unknown, limits: RelationshipGraphLimits, path: string): void {
  if (typeof value === "string") {
    assertStringWithinBytes(value, limits.maxStringBytes, path);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => validateStringBudgets(entry, limits, `${path}[${index}]`));
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (key === "reasonLabel" || key === "fieldPath") {
        continue;
      }
      validateStringBudgets(entry, limits, `${path}.${key}`);
    }
  }
}

export function parseRelationshipGraphShard(
  value: unknown,
  path = "RelationshipGraphShard",
  parserLimits: RelationshipGraphParserLimits = DEFAULT_RELATIONSHIP_GRAPH_LIMITS,
): RelationshipGraphShard {
  assertNoPublicLeaks(value, path);

  const rawSizeBytes = byteLength(JSON.stringify(value));
  if (rawSizeBytes > parserLimits.maxShardSizeBytes) {
    throw new TypeError(`${path}: exceeds parser maxShardSizeBytes`);
  }

  const graph = expectObject(value, path);
  assertOnlyKeys(graph, SHARD_KEYS, path);
  const schemaVersion = expectString(graph.schemaVersion, `${path}.schemaVersion`);
  if (schemaVersion !== RELATIONSHIP_GRAPH_SCHEMA_VERSION) {
    throw new TypeError(`${path}.schemaVersion: expected ${RELATIONSHIP_GRAPH_SCHEMA_VERSION}`);
  }

  const limits = parseLimits(readObject(graph, "limits", path), `${path}.limits`);
  assertLimitsWithinParserCaps(limits, parserLimits, `${path}.limits`);
  const releaseVersion = readString(graph, "releaseVersion", path);
  const generatedAt = readString(graph, "generatedAt", path);
  const build = parseBuildInfo(readObject(graph, "build", path), `${path}.build`);
  const stats = parseStats(readObject(graph, "stats", path), `${path}.stats`);
  const nodes = parseArray(graph.nodes, (entry, entryPath) => parseNode(entry, entryPath, limits), `${path}.nodes`);
  const edges = parseArray(graph.edges, (entry, entryPath) => parseEdge(entry, entryPath, limits), `${path}.edges`);

  validateStringBudgets({ releaseVersion, generatedAt, build, stats, limits, nodes, edges }, limits, path);
  validateUniqueIds(nodes.map((node) => node.id), `${path}.nodes`);
  validateUniqueIds(edges.map((edge) => edge.id), `${path}.edges`);

  if (nodes.length !== stats.nodeCount) {
    throw new TypeError(`${path}.stats.nodeCount: expected ${nodes.length}`);
  }
  if (edges.length !== stats.edgeCount) {
    throw new TypeError(`${path}.stats.edgeCount: expected ${edges.length}`);
  }
  if (nodes.length > limits.maxNodes) {
    throw new TypeError(`${path}.nodes: exceeds maxNodes`);
  }
  if (edges.length > limits.maxEdges) {
    throw new TypeError(`${path}.edges: exceeds maxEdges`);
  }

  validateEdges(nodes, edges, limits);
  validateSourceRefReleaseVersions(releaseVersion, nodes, edges, path);

  return {
    schemaVersion: RELATIONSHIP_GRAPH_SCHEMA_VERSION,
    releaseVersion,
    generatedAt,
    build,
    stats,
    limits,
    nodes,
    edges,
  };
}
