import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

import { loadReleaseManifest, resolveShardPath, type LoadedReleaseManifest } from "@artduo/corpus";
import {
  DEFAULT_RELATIONSHIP_GRAPH_LIMITS,
  RELATIONSHIP_GRAPH_BUILDER_NAME,
  parseReleaseManifest,
  parseRelationshipGraphShard,
  type ArtworkMediaRefs,
  type ArtworkMetadata,
  type ArtworkPresentation,
  type ArtworkRetrieval,
  type RelationshipGraphEdge,
  type RelationshipGraphInputFingerprint,
  type RelationshipGraphLimits,
  type RelationshipGraphNode,
  type RelationshipGraphNodeType,
  type RelationshipGraphRelation,
  type RelationshipGraphShard,
  type RelationshipGraphSourceArtifact,
  type RelationshipGraphSourceRef,
  type ReleaseManifest,
  type ShardInfo,
} from "@artduo/contracts";

const RELATIONSHIP_GRAPH_SHARD_ID = "relationship-graph-01";
const RELATIONSHIP_GRAPH_SHARD_FILE = `${RELATIONSHIP_GRAPH_SHARD_ID}.json`;
const RELATIONSHIP_GRAPH_REPORT_FILE = "relationship-graph-report.json";
const BUILDER_VERSION = "relationship-graph-builder.v1";
const TAXONOMY_VERSION = "relationship-taxonomy.v1";
const REPORT_SCOPE = "relationship-graph-builder-pr3";
const DEFAULT_PUBLIC_SOURCE_REFS_PER_SIGNAL_NODE = 8;

type PublicSignalType = Extract<RelationshipGraphNodeType, "emotion" | "subject" | "palette">;
type PublicArtifact = Exclude<RelationshipGraphSourceArtifact, "manifest">;
type ShardSourceRef = Extract<RelationshipGraphSourceRef, { shardId: string }>;

export interface RelationshipGraphBuildOptions {
  rootDir?: string;
  releasesRoot?: string;
  releaseVersion?: string;
  manifestPath?: string;
  reportRoot?: string;
  outputPath?: string;
  updateManifest?: boolean;
  publicSourceRefsPerSignalNode?: number;
}

export interface RelationshipGraphBuildResult {
  releaseVersion: string;
  outputDir: string;
  manifestPath: string;
  graphPath: string;
  reportPath: string;
  shard: ShardInfo;
  graph: RelationshipGraphShard;
  report: RelationshipGraphBuildReport;
  manifest: ReleaseManifest;
}

interface MetadataShardRecord {
  id: string;
  source: string;
  sourceArtworkId: string;
  version: string;
  locale?: string;
  metadata: ArtworkMetadata;
  presentation: ArtworkPresentation;
}

interface SearchShardRecord {
  id: string;
  source: string;
  sourceArtworkId: string;
  version: string;
  retrieval: ArtworkRetrieval;
}

interface MediaIndexRecord {
  id: string;
  source: string;
  sourceArtworkId: string;
  version: string;
  media: ArtworkMediaRefs;
}

interface ShardRecord<T> {
  shard: ShardInfo;
  shardPath: string;
  records: T[];
}

interface IndexedRecord<T> {
  record: T;
  shard: ShardInfo;
}

interface ReleaseArtwork {
  id: string;
  title: string;
  source: string;
  sourceArtworkId: string;
  version: string;
  metadata: ArtworkMetadata;
  presentation: ArtworkPresentation;
  retrieval?: ArtworkRetrieval;
  media?: ArtworkMediaRefs;
  metadataShard: ShardInfo;
  searchShard?: ShardInfo;
  mediaShard?: ShardInfo;
}

interface SignalSource {
  type: PublicSignalType;
  label: string;
  slug: string;
  sourceRef: ShardSourceRef;
}

interface LoadedGraphInputs {
  artworks: ReleaseArtwork[];
  releaseInputs: RelationshipGraphBuildReport["releaseInputs"];
}

interface ProvenanceSummary {
  publicMaxSourceRefsPerSignalNode: number;
  truncatedSignalNodeCount: number;
  omittedSourceRefCount: number;
  fullSourceRefsByNode: Record<string, ShardSourceRef[]>;
}

interface GraphByteStats {
  maxStringBytes: number;
  maxStringPath: string;
  maxReasonLabelBytes: number;
  maxFieldPathBytes: number;
}

interface DegreeSummary {
  count: number;
  average: number;
  max: number;
  p50: number;
  p90: number;
  p95: number;
}

export interface RelationshipGraphBuildReport {
  releaseVersion: string;
  generatedAt: string;
  scope: typeof REPORT_SCOPE;
  builderVersion: string;
  taxonomyVersion: string;
  releaseInputs: {
    manifest: {
      path: string;
      checksum: string;
      sizeBytes: number;
    };
    shards: Array<{
      artifact: PublicArtifact;
      id: string;
      url: string;
      checksum: string;
      sizeBytes: number;
      recordCount: number;
    }>;
  };
  publicSidecar: {
    path: string;
    shard: ShardInfo;
    manifestUpdated: boolean;
    schemaVersion: RelationshipGraphShard["schemaVersion"];
    graphSha256: string;
    jsonSizeBytes: number;
    gzipSizeBytes: number;
    nodeCount: number;
    edgeCount: number;
    nodeCountsByType: Record<string, number>;
    edgeCountsByRelation: Record<string, number>;
  };
  provenance: ProvenanceSummary & {
    strategy: "public-bounded-sample";
  };
  degreeDistribution: Record<string, DegreeSummary>;
  byteStats: GraphByteStats;
  highFanoutSignalNodes: Array<{
    id: string;
    type: PublicSignalType;
    label: string;
    degree: number;
    publicSourceRefCount: number;
    fullSourceRefCount: number;
    omittedSourceRefCount: number;
    fullSourceRefs: ShardSourceRef[];
  }>;
  safeguards: {
    extractedOnly: true;
    internalReportOutsideReleaseDir: true;
    localPathLeakCheck: true;
    vectorOrRerankTouched: false;
    uiTouched: false;
  };
  notes: string[];
}

function resolveRootDir(rootDir?: string): string {
  return rootDir ? path.resolve(rootDir) : path.resolve(process.cwd(), "../..");
}

function resolveReportRoot(rootDir: string, reportRoot?: string): string {
  return reportRoot ? path.resolve(reportRoot) : path.join(rootDir, "data", "curation", "reports");
}

function readJsonArray<T>(filePath: string): T[] {
  const value = JSON.parse(readFileSync(filePath, "utf8")) as unknown;

  if (!Array.isArray(value)) {
    throw new TypeError(`${filePath}: expected array shard`);
  }

  return value as T[];
}

function readJsonObject(filePath: string): Record<string, unknown> {
  const value = JSON.parse(readFileSync(filePath, "utf8")) as unknown;

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${filePath}: expected JSON object`);
  }

  return value as Record<string, unknown>;
}

function readJsonValue(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function sha256Text(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function writeJsonFile(filePath: string, data: unknown): string {
  const serialized = JSON.stringify(data, null, 2);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${serialized}\n`);
  return serialized;
}

function writeRelationshipGraphShard(filePath: string, graph: RelationshipGraphShard): ShardInfo {
  const serialized = writeJsonFile(filePath, graph);

  return {
    id: RELATIONSHIP_GRAPH_SHARD_ID,
    url: `./${path.basename(filePath)}`,
    checksum: sha256Text(serialized),
    sizeBytes: byteLength(`${serialized}\n`),
    recordCount: graph.nodes.length,
  };
}

function compactLabel(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const compacted = String(value).normalize("NFKC").replace(/\s+/g, " ").trim();
  return compacted || undefined;
}

function slugifyLabel(value: unknown): string | undefined {
  const label = compactLabel(value);

  if (!label) {
    return undefined;
  }

  const slug = label
    .normalize("NFKC")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || undefined;
}

function truncateUtf8(value: string, maxBytes: number): string {
  let output = "";
  let size = 0;

  for (const char of value) {
    const charSize = byteLength(char);
    if (size + charSize > maxBytes) {
      break;
    }

    output += char;
    size += charSize;
  }

  return output;
}

function roundNumber(value: number, digits = 4): number {
  return Number(value.toFixed(digits));
}

function roundUp(value: number, quantum: number): number {
  return Math.ceil(value / quantum) * quantum;
}

function withBuffer(value: number, quantum: number, floor = 0): number {
  return Math.max(floor, roundUp(Math.ceil(value * 1.3), quantum));
}

function countBy<T extends string>(values: T[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }

  return counts;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))] ?? 0;
}

function summarizeDegrees(values: number[]): DegreeSummary {
  const total = values.reduce((sum, value) => sum + value, 0);

  return {
    count: values.length,
    average: values.length > 0 ? roundNumber(total / values.length) : 0,
    max: Math.max(0, ...values),
    p50: percentile(values, 50),
    p90: percentile(values, 90),
    p95: percentile(values, 95),
  };
}

function readShardRecords<T>(
  loaded: LoadedReleaseManifest,
  artifact: PublicArtifact,
  shards: ShardInfo[],
): Array<ShardRecord<T> & { artifact: PublicArtifact }> {
  return shards.map((shard) => {
    const shardPath = resolveShardPath(loaded.manifestPath, shard);

    return {
      artifact,
      shard,
      shardPath,
      records: readJsonArray<T>(shardPath),
    };
  });
}

function indexShardRecords<T extends { id: string }>(shards: Array<ShardRecord<T>>): Map<string, IndexedRecord<T>> {
  const index = new Map<string, IndexedRecord<T>>();

  for (const shardRecords of shards) {
    for (const record of shardRecords.records) {
      index.set(record.id, {
        record,
        shard: shardRecords.shard,
      });
    }
  }

  return index;
}

function loadGraphInputs(loaded: LoadedReleaseManifest): LoadedGraphInputs {
  const metadataShards = readShardRecords<MetadataShardRecord>(loaded, "metadata", loaded.manifest.shards.metadata);
  const searchShards = readShardRecords<SearchShardRecord>(loaded, "search", loaded.manifest.shards.search);
  const mediaShards = readShardRecords<MediaIndexRecord>(loaded, "mediaIndex", loaded.manifest.shards.mediaIndex);

  const searchIndex = indexShardRecords(searchShards);
  const mediaIndex = indexShardRecords(mediaShards);
  const artworks = metadataShards.flatMap((shardRecords) =>
    shardRecords.records.map((metadataRecord) => {
      const searchRecord = searchIndex.get(metadataRecord.id);
      const mediaRecord = mediaIndex.get(metadataRecord.id);

      return {
        id: metadataRecord.id,
        title: metadataRecord.metadata.title,
        source: metadataRecord.source,
        sourceArtworkId: metadataRecord.sourceArtworkId,
        version: metadataRecord.version,
        metadata: metadataRecord.metadata,
        presentation: metadataRecord.presentation,
        retrieval: searchRecord?.record.retrieval,
        media: mediaRecord?.record.media,
        metadataShard: shardRecords.shard,
        searchShard: searchRecord?.shard,
        mediaShard: mediaRecord?.shard,
      };
    }),
  ).sort((left, right) => left.id.localeCompare(right.id));

  const manifestRaw = readFileSync(loaded.manifestPath, "utf8");
  const releaseInputs: RelationshipGraphBuildReport["releaseInputs"] = {
    manifest: {
      path: loaded.manifestPath,
      checksum: sha256Text(manifestRaw),
      sizeBytes: byteLength(manifestRaw),
    },
    shards: [
      ...loaded.manifest.shards.metadata.map((shard) => ({ artifact: "metadata" as const, shard })),
      ...loaded.manifest.shards.search.map((shard) => ({ artifact: "search" as const, shard })),
      ...loaded.manifest.shards.mediaIndex.map((shard) => ({ artifact: "mediaIndex" as const, shard })),
      ...loaded.manifest.shards.backgroundScenes.map((shard) => ({ artifact: "backgroundScenes" as const, shard })),
    ].map(({ artifact, shard }) => ({
      artifact,
      id: shard.id,
      url: shard.url,
      checksum: shard.checksum,
      sizeBytes: shard.sizeBytes,
      recordCount: shard.recordCount,
    })),
  };

  return { artworks, releaseInputs };
}

function makeSourceRef(
  artifact: PublicArtifact,
  shard: ShardInfo,
  recordId: string,
  fieldPath: string,
  releaseVersion: string,
): ShardSourceRef {
  return {
    artifact,
    shardId: shard.id,
    recordId,
    fieldPath,
    releaseVersion,
  } as ShardSourceRef;
}

function collectIndexedSignals(
  type: PublicSignalType,
  values: string[] | undefined,
  artifact: PublicArtifact,
  shard: ShardInfo | undefined,
  recordId: string,
  fieldBase: string,
  releaseVersion: string,
): SignalSource[] {
  if (!shard) {
    return [];
  }

  return (values ?? []).flatMap((value, index) => {
    const label = compactLabel(value);
    const slug = slugifyLabel(label);

    if (!label || !slug) {
      return [];
    }

    return [{
      type,
      label,
      slug,
      sourceRef: makeSourceRef(artifact, shard, recordId, `${fieldBase}[${index}]`, releaseVersion),
    }];
  });
}

function collectPublicSignalSources(artwork: ReleaseArtwork, releaseVersion: string): SignalSource[] {
  return [
    ...collectIndexedSignals(
      "emotion",
      artwork.metadata.moodTags,
      "metadata",
      artwork.metadataShard,
      artwork.id,
      "metadata.moodTags",
      releaseVersion,
    ),
    ...collectIndexedSignals(
      "emotion",
      artwork.retrieval?.emotionLabels,
      "search",
      artwork.searchShard,
      artwork.id,
      "retrieval.emotionLabels",
      releaseVersion,
    ),
    ...collectIndexedSignals(
      "subject",
      artwork.metadata.subjectTags,
      "metadata",
      artwork.metadataShard,
      artwork.id,
      "metadata.subjectTags",
      releaseVersion,
    ),
    ...collectIndexedSignals(
      "palette",
      artwork.metadata.colorTags,
      "metadata",
      artwork.metadataShard,
      artwork.id,
      "metadata.colorTags",
      releaseVersion,
    ),
  ];
}

function sourceRefKey(sourceRef: ShardSourceRef): string {
  return `${sourceRef.artifact}:${sourceRef.shardId}:${sourceRef.recordId}:${sourceRef.fieldPath}`;
}

function uniqueSortedSourceRefs(sourceRefs: ShardSourceRef[]): ShardSourceRef[] {
  const refsByKey = new Map<string, ShardSourceRef>();

  for (const sourceRef of sourceRefs) {
    refsByKey.set(sourceRefKey(sourceRef), sourceRef);
  }

  return [...refsByKey.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, sourceRef]) => sourceRef);
}

function relationFor(type: PublicSignalType): RelationshipGraphRelation {
  if (type === "emotion") {
    return "has_emotion";
  }
  if (type === "subject") {
    return "has_subject";
  }
  return "has_palette";
}

function buildInputFingerprints(
  manifest: ReleaseManifest,
  releaseInputs: RelationshipGraphBuildReport["releaseInputs"],
): RelationshipGraphInputFingerprint[] {
  const byArtifact: Array<{ artifact: PublicArtifact; shards: ShardInfo[] }> = [
    { artifact: "metadata", shards: manifest.shards.metadata },
    { artifact: "search", shards: manifest.shards.search },
    { artifact: "mediaIndex", shards: manifest.shards.mediaIndex },
    { artifact: "backgroundScenes", shards: manifest.shards.backgroundScenes },
  ];

  return [
    {
      artifact: "manifest",
      checksum: releaseInputs.manifest.checksum,
      sizeBytes: releaseInputs.manifest.sizeBytes,
    },
    ...byArtifact.flatMap(({ artifact, shards }) =>
      shards.map((shard) => ({
        artifact,
        shardId: shard.id,
        checksum: shard.checksum,
        recordCount: shard.recordCount,
        sizeBytes: shard.sizeBytes,
      }))),
  ];
}

function buildFullExtractedGraph(
  loaded: LoadedReleaseManifest,
  artworks: ReleaseArtwork[],
  releaseInputs: RelationshipGraphBuildReport["releaseInputs"],
  generatedAt: string,
): RelationshipGraphShard {
  const nodes = new Map<string, RelationshipGraphNode>();
  const nodeSourceRefs = new Map<string, ShardSourceRef[]>();
  const edges = new Map<string, RelationshipGraphEdge>();
  const releaseVersion = loaded.releaseVersion;

  function addNodeSourceRefs(nodeId: string, sourceRefs: ShardSourceRef[]): void {
    const existing = nodeSourceRefs.get(nodeId) ?? [];
    nodeSourceRefs.set(nodeId, uniqueSortedSourceRefs([...existing, ...sourceRefs]));
  }

  for (const artwork of artworks) {
    const artworkNodeId = `artwork:${artwork.id}`;
    const artworkSourceRef = makeSourceRef("metadata", artwork.metadataShard, artwork.id, "id", releaseVersion);
    nodes.set(artworkNodeId, {
      id: artworkNodeId,
      type: "artwork",
      label: artwork.title,
      sourceRefs: [artworkSourceRef],
    });
    addNodeSourceRefs(artworkNodeId, [artworkSourceRef]);

    const groupedSignals = new Map<string, SignalSource[]>();
    for (const signal of collectPublicSignalSources(artwork, releaseVersion)) {
      const key = `${signal.type}:${signal.slug}`;
      const existing = groupedSignals.get(key) ?? [];
      existing.push(signal);
      groupedSignals.set(key, existing);
    }

    for (const [signalKey, signalSources] of groupedSignals.entries()) {
      const [type, slug] = signalKey.split(":") as [PublicSignalType, string];
      const firstSignal = signalSources[0] as SignalSource;
      const signalNodeId = `${type}:${slug}`;
      const signalSourceRefs = uniqueSortedSourceRefs(signalSources.map((signal) => signal.sourceRef));

      if (!nodes.has(signalNodeId)) {
        nodes.set(signalNodeId, {
          id: signalNodeId,
          type,
          label: firstSignal.label,
          sourceRefs: [],
        });
      }
      addNodeSourceRefs(signalNodeId, signalSourceRefs);

      const relation = relationFor(type);
      const edgeId = `${artworkNodeId}->${signalNodeId}:${relation}`;
      edges.set(edgeId, {
        id: edgeId,
        source: artworkNodeId,
        target: signalNodeId,
        relation,
        direction: "directed",
        symmetric: false,
        confidence: "EXTRACTED",
        confidenceScore: 1,
        sourceQuality: "release-field",
        reasonCode: `${relation}:${slug}`,
        reasonLabel: truncateUtf8(
          `${firstSignal.label} extracted from release ${type} fields`,
          DEFAULT_RELATIONSHIP_GRAPH_LIMITS.maxReasonLabelBytes,
        ),
        sourceRefs: signalSourceRefs,
      });
    }
  }

  const orderedNodes = [...nodes.values()]
    .map((node) => ({
      ...node,
      sourceRefs: nodeSourceRefs.get(node.id) ?? [],
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const orderedEdges = [...edges.values()]
    .map((edge) => ({
      ...edge,
      sourceRefs: uniqueSortedSourceRefs(edge.sourceRefs as ShardSourceRef[]),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    schemaVersion: "relationship-graph.v1",
    releaseVersion,
    generatedAt,
    build: {
      builderName: RELATIONSHIP_GRAPH_BUILDER_NAME,
      builderVersion: BUILDER_VERSION,
      taxonomyVersion: TAXONOMY_VERSION,
      inputFingerprints: buildInputFingerprints(loaded.manifest, releaseInputs),
    },
    stats: {
      nodeCount: orderedNodes.length,
      edgeCount: orderedEdges.length,
    },
    limits: DEFAULT_RELATIONSHIP_GRAPH_LIMITS,
    nodes: orderedNodes,
    edges: orderedEdges,
  };
}

function buildPublicGraphWithBoundedProvenance(
  fullGraph: RelationshipGraphShard,
  publicMaxSourceRefsPerSignalNode: number,
): { graph: RelationshipGraphShard; provenance: ProvenanceSummary } {
  if (!Number.isInteger(publicMaxSourceRefsPerSignalNode) || publicMaxSourceRefsPerSignalNode < 1) {
    throw new TypeError("publicSourceRefsPerSignalNode must be a positive integer");
  }

  const fullSourceRefsByNode: Record<string, ShardSourceRef[]> = {};
  let truncatedSignalNodeCount = 0;
  let omittedSourceRefCount = 0;
  const nodes = fullGraph.nodes.map((node) => {
    const fullSourceRefs = uniqueSortedSourceRefs(node.sourceRefs as ShardSourceRef[]);
    if (node.type === "artwork" || fullSourceRefs.length <= publicMaxSourceRefsPerSignalNode) {
      return {
        ...node,
        sourceRefs: fullSourceRefs,
      };
    }

    truncatedSignalNodeCount += 1;
    omittedSourceRefCount += fullSourceRefs.length - publicMaxSourceRefsPerSignalNode;
    fullSourceRefsByNode[node.id] = fullSourceRefs;

    return {
      ...node,
      sourceRefs: fullSourceRefs.slice(0, publicMaxSourceRefsPerSignalNode),
    };
  });

  return {
    graph: {
      ...fullGraph,
      nodes,
    },
    provenance: {
      publicMaxSourceRefsPerSignalNode,
      truncatedSignalNodeCount,
      omittedSourceRefCount,
      fullSourceRefsByNode,
    },
  };
}

function collectDegreeStats(graph: RelationshipGraphShard): {
  degrees: Map<string, number>;
  degreeDistribution: Record<string, DegreeSummary>;
} {
  const nodeTypeById = new Map(graph.nodes.map((node) => [node.id, node.type] as const));
  const degrees = new Map<string, number>(graph.nodes.map((node) => [node.id, 0] as const));

  for (const edge of graph.edges) {
    degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1);
    degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1);
  }

  const byType = new Map<string, number[]>();
  for (const [nodeId, degree] of degrees.entries()) {
    const type = nodeTypeById.get(nodeId) ?? "unknown";
    const values = byType.get(type) ?? [];
    values.push(degree);
    byType.set(type, values);
  }

  const allValues = [...degrees.values()];
  return {
    degrees,
    degreeDistribution: {
      all: summarizeDegrees(allValues),
      ...Object.fromEntries([...byType.entries()].map(([type, values]) => [type, summarizeDegrees(values)])),
    },
  };
}

function collectByteStats(value: unknown): GraphByteStats {
  const stats: GraphByteStats = {
    maxStringBytes: 0,
    maxStringPath: "",
    maxReasonLabelBytes: 0,
    maxFieldPathBytes: 0,
  };

  function visit(current: unknown, currentPath: string): void {
    if (typeof current === "string") {
      const currentBytes = byteLength(current);
      if (currentBytes > stats.maxStringBytes) {
        stats.maxStringBytes = currentBytes;
        stats.maxStringPath = currentPath;
      }
      if (currentPath.endsWith(".reasonLabel")) {
        stats.maxReasonLabelBytes = Math.max(stats.maxReasonLabelBytes, currentBytes);
      }
      if (currentPath.endsWith(".fieldPath")) {
        stats.maxFieldPathBytes = Math.max(stats.maxFieldPathBytes, currentBytes);
      }
      return;
    }

    if (Array.isArray(current)) {
      current.forEach((entry, index) => visit(entry, `${currentPath}[${index}]`));
      return;
    }

    if (current && typeof current === "object") {
      for (const [key, entry] of Object.entries(current as Record<string, unknown>)) {
        visit(entry, currentPath ? `${currentPath}.${key}` : key);
      }
    }
  }

  visit(value, "");
  return stats;
}

function maxSourceRefsPerNode(graph: RelationshipGraphShard): number {
  return Math.max(0, ...graph.nodes.map((node) => node.sourceRefs.length));
}

function maxSourceRefsPerEdge(graph: RelationshipGraphShard): number {
  return Math.max(0, ...graph.edges.map((edge) => edge.sourceRefs.length));
}

function boundedLimit(value: number, quantum: number, floor: number, cap: number): number {
  return Math.min(cap, withBuffer(value, quantum, floor));
}

function computeLimits(graph: RelationshipGraphShard, jsonSizeBytes: number, gzipSizeBytes: number): RelationshipGraphLimits {
  const degreeStats = collectDegreeStats(graph);
  const byteStats = collectByteStats(graph);

  return {
    maxPreParseBytes: boundedLimit(jsonSizeBytes, 1024, 1024, DEFAULT_RELATIONSHIP_GRAPH_LIMITS.maxPreParseBytes),
    maxShardSizeBytes: boundedLimit(jsonSizeBytes, 1024, 1024, DEFAULT_RELATIONSHIP_GRAPH_LIMITS.maxShardSizeBytes),
    maxGzipSizeBytes: boundedLimit(gzipSizeBytes, 1024, 1024, DEFAULT_RELATIONSHIP_GRAPH_LIMITS.maxGzipSizeBytes),
    maxNodes: boundedLimit(graph.nodes.length, 10, 10, DEFAULT_RELATIONSHIP_GRAPH_LIMITS.maxNodes),
    maxEdges: boundedLimit(graph.edges.length, 10, 10, DEFAULT_RELATIONSHIP_GRAPH_LIMITS.maxEdges),
    maxDegreePerNode: boundedLimit(Math.max(0, ...degreeStats.degrees.values()), 5, 5, DEFAULT_RELATIONSHIP_GRAPH_LIMITS.maxDegreePerNode),
    maxSourceRefsPerNode: boundedLimit(maxSourceRefsPerNode(graph), 10, 10, DEFAULT_RELATIONSHIP_GRAPH_LIMITS.maxSourceRefsPerNode),
    maxSourceRefsPerEdge: boundedLimit(maxSourceRefsPerEdge(graph), 1, 1, DEFAULT_RELATIONSHIP_GRAPH_LIMITS.maxSourceRefsPerEdge),
    maxFieldPathBytes: boundedLimit(byteStats.maxFieldPathBytes, 16, 128, DEFAULT_RELATIONSHIP_GRAPH_LIMITS.maxFieldPathBytes),
    maxStringBytes: boundedLimit(byteStats.maxStringBytes, 64, 256, DEFAULT_RELATIONSHIP_GRAPH_LIMITS.maxStringBytes),
    maxReasonLabelBytes: DEFAULT_RELATIONSHIP_GRAPH_LIMITS.maxReasonLabelBytes,
  };
}

function finalizeGraphLimits(graph: RelationshipGraphShard): RelationshipGraphShard {
  let current = {
    ...graph,
    limits: DEFAULT_RELATIONSHIP_GRAPH_LIMITS,
  };

  for (let index = 0; index < 3; index += 1) {
    const serialized = JSON.stringify(current, null, 2);
    current = {
      ...current,
      limits: computeLimits(current, byteLength(`${serialized}\n`), gzipSync(`${serialized}\n`).byteLength),
    };
  }

  return current;
}

function updateRelationshipGraphManifest(
  manifestPath: string,
  manifest: ReleaseManifest,
  shard: ShardInfo,
): ReleaseManifest {
  const updated: ReleaseManifest = {
    ...manifest,
    shards: {
      ...manifest.shards,
      relationshipGraph: [{ ...shard, id: RELATIONSHIP_GRAPH_SHARD_ID }],
    },
  };

  parseReleaseManifest(updated, manifestPath);
  writeJsonFile(manifestPath, updated);
  return updated;
}

function buildHighFanoutReportRows(
  publicGraph: RelationshipGraphShard,
  fullGraph: RelationshipGraphShard,
  provenance: ProvenanceSummary,
): RelationshipGraphBuildReport["highFanoutSignalNodes"] {
  const degreeStats = collectDegreeStats(publicGraph);
  const publicNodeById = new Map(publicGraph.nodes.map((node) => [node.id, node] as const));
  const fullNodeById = new Map(fullGraph.nodes.map((node) => [node.id, node] as const));
  const nodeIds = new Set([
    ...Object.keys(provenance.fullSourceRefsByNode),
    ...fullGraph.nodes
      .filter((node) => node.type !== "artwork")
      .sort((left, right) =>
        (degreeStats.degrees.get(right.id) ?? 0) - (degreeStats.degrees.get(left.id) ?? 0)
        || left.id.localeCompare(right.id))
      .slice(0, 10)
      .map((node) => node.id),
  ]);

  return [...nodeIds].flatMap((nodeId) => {
    const publicNode = publicNodeById.get(nodeId);
    const fullNode = fullNodeById.get(nodeId);
    if (!publicNode || !fullNode || publicNode.type === "artwork") {
      return [];
    }

    const fullSourceRefs = uniqueSortedSourceRefs(fullNode.sourceRefs as ShardSourceRef[]);
    return [{
      id: publicNode.id,
      type: publicNode.type as PublicSignalType,
      label: publicNode.label,
      degree: degreeStats.degrees.get(publicNode.id) ?? 0,
      publicSourceRefCount: publicNode.sourceRefs.length,
      fullSourceRefCount: fullSourceRefs.length,
      omittedSourceRefCount: Math.max(0, fullSourceRefs.length - publicNode.sourceRefs.length),
      fullSourceRefs,
    }];
  }).sort((left, right) =>
    right.omittedSourceRefCount - left.omittedSourceRefCount
    || right.degree - left.degree
    || left.id.localeCompare(right.id));
}

function buildReport(
  loaded: LoadedReleaseManifest,
  fullGraph: RelationshipGraphShard,
  publicGraph: RelationshipGraphShard,
  provenance: ProvenanceSummary,
  releaseInputs: RelationshipGraphBuildReport["releaseInputs"],
  graphPath: string,
  reportPath: string,
  shard: ShardInfo,
  manifestUpdated: boolean,
): RelationshipGraphBuildReport {
  const serialized = `${JSON.stringify(publicGraph, null, 2)}\n`;
  const degreeStats = collectDegreeStats(publicGraph);

  return {
    releaseVersion: loaded.releaseVersion,
    generatedAt: publicGraph.generatedAt,
    scope: REPORT_SCOPE,
    builderVersion: BUILDER_VERSION,
    taxonomyVersion: TAXONOMY_VERSION,
    releaseInputs,
    publicSidecar: {
      path: graphPath,
      shard,
      manifestUpdated,
      schemaVersion: publicGraph.schemaVersion,
      graphSha256: sha256Text(JSON.stringify(publicGraph, null, 2)),
      jsonSizeBytes: byteLength(serialized),
      gzipSizeBytes: gzipSync(serialized).byteLength,
      nodeCount: publicGraph.nodes.length,
      edgeCount: publicGraph.edges.length,
      nodeCountsByType: countBy(publicGraph.nodes.map((node) => node.type)),
      edgeCountsByRelation: countBy(publicGraph.edges.map((edge) => edge.relation)),
    },
    provenance: {
      strategy: "public-bounded-sample",
      ...provenance,
    },
    degreeDistribution: degreeStats.degreeDistribution,
    byteStats: collectByteStats(publicGraph),
    highFanoutSignalNodes: buildHighFanoutReportRows(publicGraph, fullGraph, provenance),
    safeguards: {
      extractedOnly: true,
      internalReportOutsideReleaseDir: true,
      localPathLeakCheck: true,
      vectorOrRerankTouched: false,
      uiTouched: false,
    },
    notes: [
      "Public relationship graph contains only release-field EXTRACTED artwork-to-signal edges.",
      "Signal node sourceRefs are bounded public samples; complete high-fanout provenance is retained in this internal report.",
      "Scene relationships, inferred edges, prompt/citation registries, selector wiring, UI wiring, vector search, and rerank are out of scope for PR3.",
    ],
  };
}

function assertReportOutsideReleaseDir(reportPath: string, releaseDir: string): void {
  const relative = path.relative(releaseDir, reportPath);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    throw new Error(`Relationship graph report must not be written under release dir: ${reportPath}`);
  }
}

function assertGraphPathInsideReleaseDir(graphPath: string, releaseDir: string): void {
  const relative = path.relative(releaseDir, graphPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Relationship graph public shard must be written under release dir: ${graphPath}`);
  }
}

export function buildRelationshipGraph(options: RelationshipGraphBuildOptions = {}): RelationshipGraphBuildResult {
  const rootDir = resolveRootDir(options.rootDir);
  const loaded = loadReleaseManifest({
    rootDir,
    releasesRoot: options.releasesRoot,
    releaseVersion: options.releaseVersion,
    manifestPath: options.manifestPath,
  });
  const outputDir = loaded.releaseDir;
  const graphPath = options.outputPath
    ? path.resolve(options.outputPath)
    : path.join(outputDir, RELATIONSHIP_GRAPH_SHARD_FILE);
  const reportRoot = resolveReportRoot(rootDir, options.reportRoot);
  const reportPath = path.join(reportRoot, "relationship-graph", loaded.releaseVersion, RELATIONSHIP_GRAPH_REPORT_FILE);
  const updateManifest = options.updateManifest ?? true;
  const publicSourceRefsPerSignalNode = options.publicSourceRefsPerSignalNode
    ?? DEFAULT_PUBLIC_SOURCE_REFS_PER_SIGNAL_NODE;

  assertReportOutsideReleaseDir(reportPath, loaded.releaseDir);
  assertGraphPathInsideReleaseDir(graphPath, loaded.releaseDir);

  const generatedAt = new Date().toISOString();
  const { artworks, releaseInputs } = loadGraphInputs(loaded);
  const fullGraph = buildFullExtractedGraph(loaded, artworks, releaseInputs, generatedAt);
  const bounded = buildPublicGraphWithBoundedProvenance(fullGraph, publicSourceRefsPerSignalNode);
  const publicGraph = finalizeGraphLimits(bounded.graph);
  const parsedPublicGraph = parseRelationshipGraphShard(publicGraph, graphPath);
  const shard = writeRelationshipGraphShard(graphPath, parsedPublicGraph);
  const manifest = updateManifest
    ? updateRelationshipGraphManifest(loaded.manifestPath, loaded.manifest, shard)
    : loaded.manifest;
  const report = buildReport(
    loaded,
    fullGraph,
    parsedPublicGraph,
    bounded.provenance,
    releaseInputs,
    graphPath,
    reportPath,
    shard,
    updateManifest,
  );

  writeJsonFile(reportPath, report);

  return {
    releaseVersion: loaded.releaseVersion,
    outputDir,
    manifestPath: loaded.manifestPath,
    graphPath,
    reportPath,
    shard,
    graph: parsedPublicGraph,
    report,
    manifest,
  };
}

function normalizeReleaseRelativePath(value: string, pathLabel: string): string {
  if (value.startsWith("file://") || path.isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value)) {
    throw new Error(`${pathLabel}: release shard urls must be relative paths`);
  }

  const normalized = path.normalize(value).replace(/^[.][\\/]/, "");
  if (!normalized || normalized === "." || normalized === ".." || normalized.startsWith(`..${path.sep}`)) {
    throw new Error(`${pathLabel}: release shard urls must stay inside the release directory`);
  }

  return normalized;
}

function collectManifestShardPaths(manifest: ReleaseManifest): Set<string> {
  const shardGroups = [
    manifest.shards.metadata,
    manifest.shards.search,
    manifest.shards.mediaIndex,
    manifest.shards.backgroundScenes,
    manifest.shards.embeddings ?? [],
    manifest.shards.relationshipGraph ?? [],
  ];
  return new Set(shardGroups.flatMap((shards) =>
    shards.map((shard) => normalizeReleaseRelativePath(shard.url, `ShardInfo(${shard.id}).url`))));
}

function walkFiles(dirPath: string): string[] {
  if (!existsSync(dirPath)) {
    return [];
  }

  const files: string[] = [];
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(entryPath));
      continue;
    }
    if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

function isAllowedPublicRootPath(value: string): boolean {
  if (!value.startsWith("/artduo-gallery/") || value.includes("\\")) {
    return false;
  }

  return path.posix.normalize(value) === value;
}

function assertNoBlockedPublicData(value: unknown, dataPath: string): void {
  if (typeof value === "string") {
    if (
      value.startsWith("file://")
      || /^[A-Za-z]:[\\/]/.test(value)
      || (value.startsWith("/") && !isAllowedPublicRootPath(value))
    ) {
      throw new Error(`${dataPath}: local absolute paths are not allowed in public release artifacts`);
    }
    if (value.includes("graphify-out")) {
      throw new Error(`${dataPath}: source-code graph paths are not allowed in public release artifacts`);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoBlockedPublicData(entry, `${dataPath}[${index}]`));
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (/^(absolutePath|debug|debugPayload|diagnostics|internal|localPath|privateNotes|promptText|provenance|rejectedRecords|visibility)$/.test(key)) {
        throw new Error(`${dataPath}.${key}: internal/debug fields are not allowed in public release artifacts`);
      }
      assertNoBlockedPublicData(entry, `${dataPath}.${key}`);
    }
  }
}

export interface ReleasePublishAllowlistOptions {
  allowLegacyEmbeddingReport?: boolean;
}

export function assertReleaseDirectoryPublishAllowlist(
  releaseDir: string,
  manifest: ReleaseManifest,
  options: ReleasePublishAllowlistOptions = {},
): void {
  const allowed = new Set(["manifest.json", ...collectManifestShardPaths(manifest)]);
  if (options.allowLegacyEmbeddingReport) {
    allowed.add("embedding-report.json");
  }

  for (const filePath of walkFiles(releaseDir)) {
    const relativePath = normalizeReleaseRelativePath(path.relative(releaseDir, filePath), filePath);
    const baseName = path.basename(filePath);
    if (!allowed.has(relativePath)) {
      throw new Error(`${relativePath}: not allowed in public release directory`);
    }
    if (options.allowLegacyEmbeddingReport && baseName === "embedding-report.json") {
      continue;
    }
    if (baseName.endsWith(".json")) {
      assertNoBlockedPublicData(readJsonValue(filePath), relativePath);
    }
  }
}
