import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

import { loadReleaseManifest, resolveShardPath, type LoadedReleaseManifest } from "@artduo/corpus";
import type {
  ArtworkGrade,
  ArtworkMediaRefs,
  ArtworkMetadata,
  ArtworkPresentation,
  ArtworkRetrieval,
  ReleaseManifest,
  ShardInfo,
} from "@artduo/contracts";

const SELECTOR_VERSION = "metadata-related-selector.phase0.v1";
const MEASUREMENT_VERSION = "relationship-graph-payload-measurement.phase0.v1";
const TAXONOMY_VERSION = "relationship-taxonomy.phase0-unaliased.v1";
const GRAPH_BUILDER_VERSION = "relationship-graph-estimator.phase0.v1";
const MAX_REASON_LABEL_BYTES = 160;

export interface RelationshipGraphPhase0Options {
  rootDir?: string;
  releasesRoot?: string;
  releaseVersion?: string;
  manifestPath?: string;
  reportRoot?: string;
  anchorCount?: number;
  negativePairCount?: number;
  topK?: number;
}

export interface RelationshipGraphPhase0Result {
  releaseVersion: string;
  reportDir: string;
  metadataBaselinePath: string;
  payloadMeasurementPath: string;
  evaluationFixturePath: string;
  phase0ReportPath: string;
  metadataBaseline: MetadataBaselineReport;
  payloadMeasurement: PayloadMeasurementReport;
  evaluationFixture: EvaluationFixture;
  phase0Report: Phase0Report;
}

type PublicSignalType = "emotion" | "subject" | "palette";
type SelectorSignalType = PublicSignalType | "composition" | "sceneType" | "scenePalette" | "spatialMode" | "transition";
type PublicArtifact = "metadata" | "search" | "mediaIndex" | "backgroundScenes";

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

interface Phase0Artwork {
  id: string;
  title: string;
  artistDisplayName?: string;
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

interface FeatureBundle {
  emotion: Map<string, string>;
  subject: Map<string, string>;
  palette: Map<string, string>;
  composition: Map<string, string>;
  sceneType: Map<string, string>;
  scenePalette: Map<string, string>;
  spatialMode: Map<string, string>;
  transition: Map<string, string>;
}

export interface RelatedCandidate {
  id: string;
  title: string;
  score: number;
  grade: ArtworkGrade;
  shared: Record<SelectorSignalType, string[]>;
  reasonCodes: string[];
}

interface SelectedAnchor {
  id: string;
  title: string;
  primaryEmotion?: string;
  grade: ArtworkGrade;
  topCandidates: RelatedCandidate[];
}

export interface MetadataBaselineReport {
  releaseVersion: string;
  generatedAt: string;
  scope: "phase0-metadata-only-baseline";
  selectorVersion: string;
  topK: number;
  anchorTargetCount: number;
  anchorCount: number;
  candidatePoolCount: number;
  anchors: SelectedAnchor[];
  summary: {
    averageTopScore: number;
    zeroCandidateAnchors: number;
    relationReasonCounts: Record<string, number>;
  };
  thresholds: Phase0Thresholds;
  notes: string[];
}

interface NegativeSample {
  anchorId: string;
  candidateId: string;
  anchorTitle: string;
  candidateTitle: string;
  baselineScore: number;
  appearsInAnchorTopK: boolean;
  superficialReasons: string[];
}

export interface EvaluationFixture {
  releaseVersion: string;
  generatedAt: string;
  scope: "phase0-evaluation-fixture";
  selectorVersion: string;
  topK: number;
  anchors: Array<{
    id: string;
    title: string;
    primaryEmotion?: string;
    grade: ArtworkGrade;
    expectedBaselineTopK: Array<{
      id: string;
      score: number;
      reasonCodes: string[];
    }>;
  }>;
  negativeSamples: NegativeSample[];
  negativeSummary: {
    requestedPairCount: number;
    sampleCount: number;
    unorderedUniqueCount: number;
    uniquePairRequirementMet: boolean;
    topKLeakCount: number;
    topKLeakRate: number;
    maxAllowedLeakRate: number;
  };
  thresholds: Phase0Thresholds;
}

interface SourceRefByteStats {
  maxFieldPathBytes: number;
  maxRecordIdBytes: number;
  maxShardIdBytes: number;
  maxSerializedSourceRefBytes: number;
}

interface StringByteStats {
  maxStringBytes: number;
  maxStringPath: string;
  maxReasonLabelBytes: number;
  sourceRefs: SourceRefByteStats;
}

interface DegreeSummary {
  count: number;
  average: number;
  max: number;
  p50: number;
  p90: number;
  p95: number;
}

interface RelationshipGraphLimitsProposal {
  bufferRatio: number;
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

export interface PayloadMeasurementReport {
  releaseVersion: string;
  generatedAt: string;
  scope: "phase0-payload-measurement-only";
  measurementVersion: string;
  publicSidecarWritten: false;
  releaseInputs: {
    manifest: {
      path: string;
      sizeBytes: number;
      checksum: string;
    };
    shards: Array<{
      artifact: PublicArtifact;
      id: string;
      url: string;
      sizeBytes: number;
      recordCount: number;
      checksum: string;
    }>;
  };
  estimatedPublicGraph: {
    schemaVersion: "relationship-graph.v1";
    builderVersion: string;
    taxonomyVersion: string;
    jsonSizeBytes: number;
    gzipSizeBytes: number;
    nodeCount: number;
    edgeCount: number;
    nodeCountsByType: Record<string, number>;
    edgeCountsByRelation: Record<string, number>;
    graphSha256: string;
  };
  degreeDistribution: Record<string, DegreeSummary>;
  topHighDegreeSignalNodes: Array<{
    id: string;
    type: PublicSignalType;
    label: string;
    degree: number;
    sourceRefCount: number;
  }>;
  byteStats: StringByteStats;
  browserCatalogLoadDelta: {
    currentManifestAndShardBytes: number;
    estimatedAdditionalBytes: number;
    estimatedAdditionalGzipBytes: number;
    estimatedIncreaseRatio: number;
  };
  proposedParserLimits: RelationshipGraphLimitsProposal;
  notes: string[];
}

export interface Phase0Report {
  releaseVersion: string;
  generatedAt: string;
  scope: "relationship-graph-phase0-pr1";
  artifacts: {
    metadataBaseline: string;
    payloadMeasurement: string;
    evaluationFixture: string;
  };
  decisionGate: {
    continuation: "pending-phase1-contract";
    discardPath: string;
    blockedUntil: string[];
  };
  safeguards: {
    publicSidecarWritten: false;
    manifestUpdated: false;
    runtimeLoaderTouched: false;
    vectorOrRerankTouched: false;
  };
}

interface Phase0Thresholds {
  anchorSampleMin: number;
  negativePairMin: number;
  requiredSidecarPrecisionAt5: number;
  requiredAbsolutePrecisionLiftOverBaseline: number;
  maxNegativeTop5LeakRate: number;
  reasonReviewSampleMin: number;
  requiredReasonAverageHelpfulness: number;
  requiredReasonScore2PlusRate: number;
}

interface ShardSourceRef {
  artifact: PublicArtifact;
  shardId: string;
  recordId: string;
  fieldPath: string;
  releaseVersion: string;
}

interface ManifestFingerprint {
  artifact: "manifest";
  checksum: string;
  sizeBytes: number;
}

interface ShardFingerprint {
  artifact: PublicArtifact;
  shardId: string;
  checksum: string;
  recordCount: number;
  sizeBytes: number;
}

interface RelationshipGraphNode {
  id: string;
  type: "artwork" | PublicSignalType;
  label: string;
  sourceRefs: ShardSourceRef[];
}

interface RelationshipGraphEdge {
  id: string;
  source: string;
  target: string;
  relation: "has_emotion" | "has_subject" | "has_palette";
  direction: "directed";
  symmetric: false;
  confidence: "EXTRACTED";
  confidenceScore: 1;
  sourceQuality: "release-field";
  reasonCode: string;
  reasonLabel: string;
  sourceRefs: ShardSourceRef[];
}

interface EstimatedRelationshipGraph {
  schemaVersion: "relationship-graph.v1";
  releaseVersion: string;
  generatedAt: string;
  build: {
    builderName: "@artduo/pipeline/relationship-graph";
    builderVersion: string;
    taxonomyVersion: string;
    inputFingerprints: Array<ManifestFingerprint | ShardFingerprint>;
  };
  stats: {
    nodeCount: number;
    edgeCount: number;
  };
  limits: Omit<RelationshipGraphLimitsProposal, "bufferRatio">;
  nodes: RelationshipGraphNode[];
  edges: RelationshipGraphEdge[];
}

const PHASE0_THRESHOLDS: Phase0Thresholds = {
  anchorSampleMin: 30,
  negativePairMin: 60,
  requiredSidecarPrecisionAt5: 0.7,
  requiredAbsolutePrecisionLiftOverBaseline: 0.1,
  maxNegativeTop5LeakRate: 0.05,
  reasonReviewSampleMin: 50,
  requiredReasonAverageHelpfulness: 2.4,
  requiredReasonScore2PlusRate: 0.7,
};

function resolveRootDir(rootDir?: string): string {
  return rootDir ? path.resolve(rootDir) : path.resolve(process.cwd(), "../..");
}

function resolveReportRoot(rootDir: string, reportRoot?: string): string {
  return reportRoot ? path.resolve(reportRoot) : path.join(rootDir, "data", "curation", "reports");
}

function writeJsonFile(filePath: string, data: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function readJsonArray<T>(filePath: string): T[] {
  const value = JSON.parse(readFileSync(filePath, "utf8")) as unknown;

  if (!Array.isArray(value)) {
    throw new TypeError(`${filePath}: expected array shard`);
  }

  return value as T[];
}

function sha256Text(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
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

function addFeature(target: Map<string, string>, value: unknown): void {
  const label = compactLabel(value);
  const slug = slugifyLabel(label);

  if (!label || !slug || target.has(slug)) {
    return;
  }

  target.set(slug, label);
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

function loadPhase0Artworks(loaded: LoadedReleaseManifest): {
  artworks: Phase0Artwork[];
  releaseInputs: PayloadMeasurementReport["releaseInputs"];
} {
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
        artistDisplayName: metadataRecord.metadata.artistDisplayName,
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
  const releaseInputs: PayloadMeasurementReport["releaseInputs"] = {
    manifest: {
      path: loaded.manifestPath,
      sizeBytes: byteLength(manifestRaw),
      checksum: sha256Text(manifestRaw),
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
      sizeBytes: shard.sizeBytes,
      recordCount: shard.recordCount,
      checksum: shard.checksum,
    })),
  };

  return { artworks, releaseInputs };
}

function featureBundleFor(artwork: Phase0Artwork): FeatureBundle {
  const features: FeatureBundle = {
    emotion: new Map(),
    subject: new Map(),
    palette: new Map(),
    composition: new Map(),
    sceneType: new Map(),
    scenePalette: new Map(),
    spatialMode: new Map(),
    transition: new Map(),
  };

  for (const value of artwork.retrieval?.emotionLabels ?? []) {
    addFeature(features.emotion, value);
  }
  for (const value of artwork.metadata.moodTags) {
    addFeature(features.emotion, value);
  }
  for (const value of artwork.metadata.subjectTags) {
    addFeature(features.subject, value);
  }
  for (const value of artwork.metadata.colorTags) {
    addFeature(features.palette, value);
  }
  for (const value of artwork.metadata.compositionTags) {
    addFeature(features.composition, value);
  }
  for (const value of artwork.presentation.sceneAffinity?.sceneTypes ?? []) {
    addFeature(features.sceneType, value);
  }
  for (const value of artwork.presentation.sceneAffinity?.paletteModes ?? []) {
    addFeature(features.scenePalette, value);
  }
  for (const value of artwork.presentation.sceneAffinity?.spatialModes ?? []) {
    addFeature(features.spatialMode, value);
  }
  for (const value of artwork.presentation.sceneAffinity?.transitionTags ?? []) {
    addFeature(features.transition, value);
  }

  return features;
}

function intersectFeatureLabels(left: Map<string, string>, right: Map<string, string>): string[] {
  return [...left.entries()]
    .filter(([slug]) => right.has(slug))
    .map(([, label]) => label)
    .sort((a, b) => a.localeCompare(b));
}

function countSharedCore(left: FeatureBundle, right: FeatureBundle): number {
  return intersectFeatureLabels(left.emotion, right.emotion).length
    + intersectFeatureLabels(left.subject, right.subject).length
    + intersectFeatureLabels(left.palette, right.palette).length;
}

function gradeRank(grade: ArtworkGrade): number {
  if (grade === "A") {
    return 3;
  }
  if (grade === "B") {
    return 2;
  }
  return 1;
}

function gradeCompatibility(left: ArtworkGrade, right: ArtworkGrade): number {
  if (left === right) {
    return 0.6;
  }

  return Math.abs(gradeRank(left) - gradeRank(right)) === 1 ? 0.2 : 0;
}

function scoreRelatedCandidate(anchor: Phase0Artwork, candidate: Phase0Artwork): RelatedCandidate {
  const anchorFeatures = featureBundleFor(anchor);
  const candidateFeatures = featureBundleFor(candidate);
  const shared: Record<SelectorSignalType, string[]> = {
    emotion: intersectFeatureLabels(anchorFeatures.emotion, candidateFeatures.emotion),
    subject: intersectFeatureLabels(anchorFeatures.subject, candidateFeatures.subject),
    palette: intersectFeatureLabels(anchorFeatures.palette, candidateFeatures.palette),
    composition: intersectFeatureLabels(anchorFeatures.composition, candidateFeatures.composition),
    sceneType: intersectFeatureLabels(anchorFeatures.sceneType, candidateFeatures.sceneType),
    scenePalette: intersectFeatureLabels(anchorFeatures.scenePalette, candidateFeatures.scenePalette),
    spatialMode: intersectFeatureLabels(anchorFeatures.spatialMode, candidateFeatures.spatialMode),
    transition: intersectFeatureLabels(anchorFeatures.transition, candidateFeatures.transition),
  };
  const sameEnergy = anchor.retrieval?.energyLevel && anchor.retrieval.energyLevel === candidate.retrieval?.energyLevel ? 0.25 : 0;
  const sameValence = anchor.retrieval?.valence && anchor.retrieval.valence === candidate.retrieval?.valence ? 0.25 : 0;
  const samePace = anchor.retrieval?.pace && anchor.retrieval.pace === candidate.retrieval?.pace ? 0.15 : 0;
  const score = (shared.emotion.length * 5)
    + (shared.subject.length * 2.4)
    + (shared.palette.length * 1.2)
    + (shared.composition.length * 0.9)
    + (shared.sceneType.length * 0.8)
    + (shared.scenePalette.length * 0.45)
    + (shared.spatialMode.length * 0.35)
    + (shared.transition.length * 0.15)
    + gradeCompatibility(anchor.presentation.grade, candidate.presentation.grade)
    + sameEnergy
    + sameValence
    + samePace;
  const reasonCodes = (Object.entries(shared) as Array<[SelectorSignalType, string[]]>)
    .filter(([, values]) => values.length > 0)
    .map(([type]) => `shared_${type}`);

  if (sameEnergy > 0) {
    reasonCodes.push("same_energy");
  }
  if (sameValence > 0) {
    reasonCodes.push("same_valence");
  }
  if (samePace > 0) {
    reasonCodes.push("same_pace");
  }
  if (anchor.presentation.grade === candidate.presentation.grade) {
    reasonCodes.push("same_grade");
  }

  return {
    id: candidate.id,
    title: candidate.title,
    score: roundNumber(score),
    grade: candidate.presentation.grade,
    shared,
    reasonCodes,
  };
}

export function selectMetadataRelated(
  artworks: Phase0Artwork[],
  anchorId: string,
  limit = 5,
): RelatedCandidate[] {
  const anchor = artworks.find((artwork) => artwork.id === anchorId);

  if (!anchor) {
    throw new Error(`Missing anchor artwork ${anchorId}`);
  }

  return artworks
    .filter((candidate) => candidate.id !== anchor.id)
    .map((candidate) => scoreRelatedCandidate(anchor, candidate))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (gradeRank(right.grade) !== gradeRank(left.grade)) {
        return gradeRank(right.grade) - gradeRank(left.grade);
      }

      return left.id.localeCompare(right.id);
    })
    .slice(0, limit);
}

function primaryEmotion(artwork: Phase0Artwork): string | undefined {
  return artwork.retrieval?.emotionLabels[0] ?? artwork.metadata.moodTags[0];
}

function primarySubject(artwork: Phase0Artwork): string | undefined {
  return artwork.metadata.subjectTags[0];
}

function chooseAnchors(artworks: Phase0Artwork[], targetCount: number): Phase0Artwork[] {
  const target = Math.min(targetCount, artworks.length);
  const grouped = new Map<string, Phase0Artwork[]>();

  for (const artwork of artworks) {
    const key = `${primaryEmotion(artwork) ?? "unknown"}:${artwork.presentation.grade}`;
    const group = grouped.get(key) ?? [];
    group.push(artwork);
    grouped.set(key, group);
  }

  const groups = [...grouped.values()]
    .map((group) => group.sort((left, right) => left.id.localeCompare(right.id)))
    .sort((left, right) => {
      const leftKey = `${primaryEmotion(left[0] as Phase0Artwork) ?? ""}:${(left[0] as Phase0Artwork).presentation.grade}`;
      const rightKey = `${primaryEmotion(right[0] as Phase0Artwork) ?? ""}:${(right[0] as Phase0Artwork).presentation.grade}`;
      return leftKey.localeCompare(rightKey);
    });
  const selected = new Map<string, Phase0Artwork>();
  let groupIndex = 0;

  while (selected.size < target && groups.some((group) => group.length > 0)) {
    const group = groups[groupIndex % groups.length];
    const next = group?.shift();
    if (next) {
      selected.set(next.id, next);
    }
    groupIndex += 1;
  }

  const usedSubjects = new Set([...selected.values()].map((artwork) => primarySubject(artwork)).filter(Boolean));
  for (const artwork of artworks) {
    if (selected.size >= target) {
      break;
    }
    const subject = primarySubject(artwork);
    if (subject && !usedSubjects.has(subject)) {
      selected.set(artwork.id, artwork);
      usedSubjects.add(subject);
    }
  }

  for (const artwork of artworks) {
    if (selected.size >= target) {
      break;
    }
    selected.set(artwork.id, artwork);
  }

  return [...selected.values()];
}

function buildMetadataBaselineReport(
  releaseVersion: string,
  artworks: Phase0Artwork[],
  generatedAt: string,
  topK: number,
  anchorTargetCount: number,
): MetadataBaselineReport {
  const anchors = chooseAnchors(artworks, anchorTargetCount).map((anchor) => ({
    id: anchor.id,
    title: anchor.title,
    primaryEmotion: primaryEmotion(anchor),
    grade: anchor.presentation.grade,
    topCandidates: selectMetadataRelated(artworks, anchor.id, topK),
  }));
  const relationReasonCounts: Record<string, number> = {};
  let topScoreTotal = 0;
  let topScoreCount = 0;

  for (const anchor of anchors) {
    for (const candidate of anchor.topCandidates) {
      topScoreTotal += candidate.score;
      topScoreCount += 1;
      for (const reasonCode of candidate.reasonCodes) {
        relationReasonCounts[reasonCode] = (relationReasonCounts[reasonCode] ?? 0) + 1;
      }
    }
  }

  return {
    releaseVersion,
    generatedAt,
    scope: "phase0-metadata-only-baseline",
    selectorVersion: SELECTOR_VERSION,
    topK,
    anchorTargetCount,
    anchorCount: anchors.length,
    candidatePoolCount: artworks.length,
    anchors,
    summary: {
      averageTopScore: topScoreCount > 0 ? roundNumber(topScoreTotal / topScoreCount) : 0,
      zeroCandidateAnchors: anchors.filter((anchor) => anchor.topCandidates.length === 0).length,
      relationReasonCounts,
    },
    thresholds: PHASE0_THRESHOLDS,
    notes: [
      "Metadata-only baseline uses release metadata/search fields only; no graph artifact, vectors, or rerank path are consulted.",
      "Scene-affinity fields contribute to baseline scoring only. They are not measured as public graph edges in Phase 0.",
    ],
  };
}

function superficialReasons(anchor: Phase0Artwork, candidate: Phase0Artwork): string[] {
  const reasons: string[] = [];

  if (anchor.presentation.grade === candidate.presentation.grade) {
    reasons.push("same_grade");
  }
  if (anchor.source === candidate.source) {
    reasons.push("same_source");
  }
  if (anchor.presentation.motionProfile === candidate.presentation.motionProfile) {
    reasons.push("same_motion_profile");
  }
  if (anchor.presentation.narrationMode && anchor.presentation.narrationMode === candidate.presentation.narrationMode) {
    reasons.push("same_narration_mode");
  }
  if (anchor.metadata.department && anchor.metadata.department === candidate.metadata.department) {
    reasons.push("same_department");
  }

  return reasons;
}

function buildEvaluationFixture(
  releaseVersion: string,
  artworks: Phase0Artwork[],
  baseline: MetadataBaselineReport,
  generatedAt: string,
  topK: number,
  negativePairCount: number,
): EvaluationFixture {
  const featuresById = new Map(artworks.map((artwork) => [artwork.id, featureBundleFor(artwork)] as const));
  const topKByAnchor = new Map(
    artworks.map((anchor) => [
      anchor.id,
      new Set(selectMetadataRelated(artworks, anchor.id, topK).map((candidate) => candidate.id)),
    ] as const),
  );
  const unorderedCandidates: NegativeSample[] = [];

  for (let anchorIndex = 0; anchorIndex < artworks.length; anchorIndex += 1) {
    const anchor = artworks[anchorIndex] as Phase0Artwork;
    const anchorFeatures = featuresById.get(anchor.id);
    if (!anchorFeatures) {
      continue;
    }

    for (let candidateIndex = anchorIndex + 1; candidateIndex < artworks.length; candidateIndex += 1) {
      const candidate = artworks[candidateIndex] as Phase0Artwork;
      const candidateFeatures = featuresById.get(candidate.id);
      if (!candidateFeatures || countSharedCore(anchorFeatures, candidateFeatures) > 0) {
        continue;
      }

      const reasons = superficialReasons(anchor, candidate);
      if (reasons.length === 0) {
        continue;
      }

      unorderedCandidates.push({
        anchorId: anchor.id,
        candidateId: candidate.id,
        anchorTitle: anchor.title,
        candidateTitle: candidate.title,
        baselineScore: scoreRelatedCandidate(anchor, candidate).score,
        appearsInAnchorTopK: (topKByAnchor.get(anchor.id)?.has(candidate.id) ?? false)
          || (topKByAnchor.get(candidate.id)?.has(anchor.id) ?? false),
        superficialReasons: reasons,
      });
    }
  }

  const samples = unorderedCandidates
    .sort((left, right) => {
      if (right.superficialReasons.length !== left.superficialReasons.length) {
        return right.superficialReasons.length - left.superficialReasons.length;
      }
      if (left.baselineScore !== right.baselineScore) {
        return left.baselineScore - right.baselineScore;
      }
      return `${left.anchorId}:${left.candidateId}`.localeCompare(`${right.anchorId}:${right.candidateId}`);
    })
    .slice(0, negativePairCount);
  const topKLeakCount = samples.filter((sample) => sample.appearsInAnchorTopK).length;

  return {
    releaseVersion,
    generatedAt,
    scope: "phase0-evaluation-fixture",
    selectorVersion: SELECTOR_VERSION,
    topK,
    anchors: baseline.anchors.map((anchor) => ({
      id: anchor.id,
      title: anchor.title,
      primaryEmotion: anchor.primaryEmotion,
      grade: anchor.grade,
      expectedBaselineTopK: anchor.topCandidates.map((candidate) => ({
        id: candidate.id,
        score: candidate.score,
        reasonCodes: candidate.reasonCodes,
      })),
    })),
    negativeSamples: samples,
    negativeSummary: {
      requestedPairCount: negativePairCount,
      sampleCount: samples.length,
      unorderedUniqueCount: unorderedCandidates.length,
      uniquePairRequirementMet: samples.length >= negativePairCount,
      topKLeakCount,
      topKLeakRate: samples.length > 0 ? roundNumber(topKLeakCount / samples.length) : 0,
      maxAllowedLeakRate: PHASE0_THRESHOLDS.maxNegativeTop5LeakRate,
    },
    thresholds: PHASE0_THRESHOLDS,
  };
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
  };
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

function collectPublicSignalSources(artwork: Phase0Artwork, releaseVersion: string): SignalSource[] {
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

function relationFor(type: PublicSignalType): RelationshipGraphEdge["relation"] {
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
  releaseInputs: PayloadMeasurementReport["releaseInputs"],
): Array<ManifestFingerprint | ShardFingerprint> {
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

function emptyLimits(): Omit<RelationshipGraphLimitsProposal, "bufferRatio"> {
  return {
    maxPreParseBytes: 0,
    maxShardSizeBytes: 0,
    maxGzipSizeBytes: 0,
    maxNodes: 0,
    maxEdges: 0,
    maxDegreePerNode: 0,
    maxSourceRefsPerNode: 0,
    maxSourceRefsPerEdge: 0,
    maxFieldPathBytes: 0,
    maxStringBytes: 0,
    maxReasonLabelBytes: MAX_REASON_LABEL_BYTES,
  };
}

function buildEstimatedPublicGraph(
  loaded: LoadedReleaseManifest,
  artworks: Phase0Artwork[],
  releaseInputs: PayloadMeasurementReport["releaseInputs"],
  generatedAt: string,
): EstimatedRelationshipGraph {
  const nodes = new Map<string, RelationshipGraphNode>();
  const nodeSourceRefKeys = new Map<string, Set<string>>();
  const edges = new Map<string, RelationshipGraphEdge>();
  const releaseVersion = loaded.releaseVersion;

  function addNodeSourceRef(node: RelationshipGraphNode, sourceRef: ShardSourceRef): void {
    const keys = nodeSourceRefKeys.get(node.id) ?? new Set<string>();
    const key = sourceRefKey(sourceRef);

    if (!keys.has(key)) {
      node.sourceRefs.push(sourceRef);
      keys.add(key);
      nodeSourceRefKeys.set(node.id, keys);
    }
  }

  for (const artwork of artworks) {
    const artworkNodeId = `artwork:${artwork.id}`;
    nodes.set(artworkNodeId, {
      id: artworkNodeId,
      type: "artwork",
      label: artwork.title,
      sourceRefs: [
        makeSourceRef("metadata", artwork.metadataShard, artwork.id, "id", releaseVersion),
      ],
    });

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
      const existingSignalNode = nodes.get(signalNodeId);

      if (existingSignalNode) {
        for (const signal of signalSources) {
          addNodeSourceRef(existingSignalNode, signal.sourceRef);
        }
      } else {
        nodes.set(signalNodeId, {
          id: signalNodeId,
          type,
          label: firstSignal.label,
          sourceRefs: signalSources.map((signal) => signal.sourceRef),
        });
        nodeSourceRefKeys.set(signalNodeId, new Set(signalSources.map((signal) => sourceRefKey(signal.sourceRef))));
      }

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
          MAX_REASON_LABEL_BYTES,
        ),
        sourceRefs: signalSources.map((signal) => signal.sourceRef),
      });
    }
  }

  return {
    schemaVersion: "relationship-graph.v1",
    releaseVersion,
    generatedAt,
    build: {
      builderName: "@artduo/pipeline/relationship-graph",
      builderVersion: GRAPH_BUILDER_VERSION,
      taxonomyVersion: TAXONOMY_VERSION,
      inputFingerprints: buildInputFingerprints(loaded.manifest, releaseInputs),
    },
    stats: {
      nodeCount: nodes.size,
      edgeCount: edges.size,
    },
    limits: emptyLimits(),
    nodes: [...nodes.values()].sort((left, right) => left.id.localeCompare(right.id)),
    edges: [...edges.values()].sort((left, right) => left.id.localeCompare(right.id)),
  };
}

function serializeEstimatedGraph(graph: EstimatedRelationshipGraph): string {
  return `${JSON.stringify(graph, null, 2)}\n`;
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

function collectDegreeStats(graph: EstimatedRelationshipGraph): {
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

function collectStringByteStats(value: unknown): StringByteStats {
  const stats: StringByteStats = {
    maxStringBytes: 0,
    maxStringPath: "",
    maxReasonLabelBytes: 0,
    sourceRefs: {
      maxFieldPathBytes: 0,
      maxRecordIdBytes: 0,
      maxShardIdBytes: 0,
      maxSerializedSourceRefBytes: 0,
    },
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
        stats.sourceRefs.maxFieldPathBytes = Math.max(stats.sourceRefs.maxFieldPathBytes, currentBytes);
      }
      if (currentPath.endsWith(".recordId")) {
        stats.sourceRefs.maxRecordIdBytes = Math.max(stats.sourceRefs.maxRecordIdBytes, currentBytes);
      }
      if (currentPath.endsWith(".shardId")) {
        stats.sourceRefs.maxShardIdBytes = Math.max(stats.sourceRefs.maxShardIdBytes, currentBytes);
      }
      return;
    }

    if (Array.isArray(current)) {
      current.forEach((entry, index) => visit(entry, `${currentPath}[${index}]`));
      return;
    }

    if (current && typeof current === "object") {
      const record = current as Record<string, unknown>;
      if (
        typeof record.artifact === "string"
        && typeof record.shardId === "string"
        && typeof record.recordId === "string"
        && typeof record.fieldPath === "string"
      ) {
        stats.sourceRefs.maxSerializedSourceRefBytes = Math.max(
          stats.sourceRefs.maxSerializedSourceRefBytes,
          byteLength(JSON.stringify(record)),
        );
      }
      for (const [key, entry] of Object.entries(record)) {
        visit(entry, currentPath ? `${currentPath}.${key}` : key);
      }
    }
  }

  visit(value, "");
  return stats;
}

function maxSourceRefsPerNode(graph: EstimatedRelationshipGraph): number {
  return Math.max(0, ...graph.nodes.map((node) => node.sourceRefs.length));
}

function maxSourceRefsPerEdge(graph: EstimatedRelationshipGraph): number {
  return Math.max(0, ...graph.edges.map((edge) => edge.sourceRefs.length));
}

function proposeLimits(
  graph: EstimatedRelationshipGraph,
  jsonSizeBytes: number,
  gzipSizeBytes: number,
  degrees: Map<string, number>,
  byteStats: StringByteStats,
): RelationshipGraphLimitsProposal {
  return {
    bufferRatio: 0.3,
    maxPreParseBytes: withBuffer(jsonSizeBytes, 1024, 1024),
    maxShardSizeBytes: withBuffer(jsonSizeBytes, 1024, 1024),
    maxGzipSizeBytes: withBuffer(gzipSizeBytes, 1024, 1024),
    maxNodes: withBuffer(graph.nodes.length, 10, 10),
    maxEdges: withBuffer(graph.edges.length, 10, 10),
    maxDegreePerNode: withBuffer(Math.max(0, ...degrees.values()), 5, 5),
    maxSourceRefsPerNode: withBuffer(maxSourceRefsPerNode(graph), 10, 10),
    maxSourceRefsPerEdge: withBuffer(maxSourceRefsPerEdge(graph), 1, 1),
    maxFieldPathBytes: withBuffer(byteStats.sourceRefs.maxFieldPathBytes, 16, 128),
    maxStringBytes: withBuffer(byteStats.maxStringBytes, 64, 256),
    maxReasonLabelBytes: MAX_REASON_LABEL_BYTES,
  };
}

function buildPayloadMeasurementReport(
  loaded: LoadedReleaseManifest,
  artworks: Phase0Artwork[],
  releaseInputs: PayloadMeasurementReport["releaseInputs"],
  generatedAt: string,
): PayloadMeasurementReport {
  const graph = buildEstimatedPublicGraph(loaded, artworks, releaseInputs, generatedAt);
  let serialized = serializeEstimatedGraph(graph);
  let gzipSizeBytes = gzipSync(serialized).byteLength;
  let byteStats = collectStringByteStats(graph);
  let degreeStats = collectDegreeStats(graph);
  const limits = proposeLimits(graph, byteLength(serialized), gzipSizeBytes, degreeStats.degrees, byteStats);
  graph.limits = {
    maxPreParseBytes: limits.maxPreParseBytes,
    maxShardSizeBytes: limits.maxShardSizeBytes,
    maxGzipSizeBytes: limits.maxGzipSizeBytes,
    maxNodes: limits.maxNodes,
    maxEdges: limits.maxEdges,
    maxDegreePerNode: limits.maxDegreePerNode,
    maxSourceRefsPerNode: limits.maxSourceRefsPerNode,
    maxSourceRefsPerEdge: limits.maxSourceRefsPerEdge,
    maxFieldPathBytes: limits.maxFieldPathBytes,
    maxStringBytes: limits.maxStringBytes,
    maxReasonLabelBytes: limits.maxReasonLabelBytes,
  };
  serialized = serializeEstimatedGraph(graph);
  gzipSizeBytes = gzipSync(serialized).byteLength;
  byteStats = collectStringByteStats(graph);
  degreeStats = collectDegreeStats(graph);
  const finalLimits = proposeLimits(graph, byteLength(serialized), gzipSizeBytes, degreeStats.degrees, byteStats);
  graph.limits = {
    maxPreParseBytes: finalLimits.maxPreParseBytes,
    maxShardSizeBytes: finalLimits.maxShardSizeBytes,
    maxGzipSizeBytes: finalLimits.maxGzipSizeBytes,
    maxNodes: finalLimits.maxNodes,
    maxEdges: finalLimits.maxEdges,
    maxDegreePerNode: finalLimits.maxDegreePerNode,
    maxSourceRefsPerNode: finalLimits.maxSourceRefsPerNode,
    maxSourceRefsPerEdge: finalLimits.maxSourceRefsPerEdge,
    maxFieldPathBytes: finalLimits.maxFieldPathBytes,
    maxStringBytes: finalLimits.maxStringBytes,
    maxReasonLabelBytes: finalLimits.maxReasonLabelBytes,
  };
  serialized = serializeEstimatedGraph(graph);
  const finalJsonSizeBytes = byteLength(serialized);
  const finalGzipSizeBytes = gzipSync(serialized).byteLength;
  const nodeCountsByType = countBy(graph.nodes.map((node) => node.type));
  const edgeCountsByRelation = countBy(graph.edges.map((edge) => edge.relation));
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node] as const));
  const embeddingShardBytes = (loaded.manifest.shards.embeddings ?? []).reduce((sum, shard) => sum + shard.sizeBytes, 0);
  const currentManifestAndShardBytes = releaseInputs.manifest.sizeBytes
    + releaseInputs.shards.reduce((sum, shard) => sum + shard.sizeBytes, 0)
    + embeddingShardBytes;

  return {
    releaseVersion: loaded.releaseVersion,
    generatedAt,
    scope: "phase0-payload-measurement-only",
    measurementVersion: MEASUREMENT_VERSION,
    publicSidecarWritten: false,
    releaseInputs,
    estimatedPublicGraph: {
      schemaVersion: "relationship-graph.v1",
      builderVersion: GRAPH_BUILDER_VERSION,
      taxonomyVersion: TAXONOMY_VERSION,
      jsonSizeBytes: finalJsonSizeBytes,
      gzipSizeBytes: finalGzipSizeBytes,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      nodeCountsByType,
      edgeCountsByRelation,
      graphSha256: sha256Text(serialized),
    },
    degreeDistribution: degreeStats.degreeDistribution,
    topHighDegreeSignalNodes: [...degreeStats.degrees.entries()]
      .flatMap(([nodeId, degree]) => {
        const node = nodeById.get(nodeId);
        if (!node || node.type === "artwork") {
          return [];
        }
        return [{
          id: node.id,
          type: node.type,
          label: node.label,
          degree,
          sourceRefCount: node.sourceRefs.length,
        }];
      })
      .sort((left, right) => right.degree - left.degree || left.id.localeCompare(right.id))
      .slice(0, 20),
    byteStats,
    browserCatalogLoadDelta: {
      currentManifestAndShardBytes,
      estimatedAdditionalBytes: finalJsonSizeBytes,
      estimatedAdditionalGzipBytes: finalGzipSizeBytes,
      estimatedIncreaseRatio: currentManifestAndShardBytes > 0
        ? roundNumber(finalJsonSizeBytes / currentManifestAndShardBytes)
        : 0,
    },
    proposedParserLimits: finalLimits,
    notes: [
      "This is a measured estimate of the extracted-only public graph payload. No relationship graph shard was written.",
      "Public graph estimate uses only artwork, emotion, subject, and palette nodes with EXTRACTED release-field edges.",
      "Scene, release, provenance, inferred, ambiguous, prompt, citation, and debug evidence are excluded from the public payload estimate.",
    ],
  };
}

function buildPhase0Report(
  releaseVersion: string,
  generatedAt: string,
  metadataBaselinePath: string,
  payloadMeasurementPath: string,
  evaluationFixturePath: string,
): Phase0Report {
  return {
    releaseVersion,
    generatedAt,
    scope: "relationship-graph-phase0-pr1",
    artifacts: {
      metadataBaseline: metadataBaselinePath,
      payloadMeasurement: payloadMeasurementPath,
      evaluationFixture: evaluationFixturePath,
    },
    decisionGate: {
      continuation: "pending-phase1-contract",
      discardPath: "If a later sidecar selector cannot beat this metadata baseline by the approved Phase 0 thresholds, stop at metadata selector plus internal report.",
      blockedUntil: [
        "Phase 1 contract/parser limits use the measured numeric caps.",
        "No public sidecar artifact is published before the evaluation gate.",
        "Vector search and rerank benchmark remain unchanged.",
      ],
    },
    safeguards: {
      publicSidecarWritten: false,
      manifestUpdated: false,
      runtimeLoaderTouched: false,
      vectorOrRerankTouched: false,
    },
  };
}

export function runRelationshipGraphPhase0(options: RelationshipGraphPhase0Options = {}): RelationshipGraphPhase0Result {
  const rootDir = resolveRootDir(options.rootDir);
  const loaded = loadReleaseManifest({
    rootDir,
    releasesRoot: options.releasesRoot,
    releaseVersion: options.releaseVersion,
    manifestPath: options.manifestPath,
  });
  const reportRoot = resolveReportRoot(rootDir, options.reportRoot);
  const reportDir = path.join(reportRoot, "relationship-graph", loaded.releaseVersion);
  const generatedAt = new Date().toISOString();
  const topK = options.topK ?? 5;
  const anchorCount = options.anchorCount ?? PHASE0_THRESHOLDS.anchorSampleMin;
  const negativePairCount = options.negativePairCount ?? PHASE0_THRESHOLDS.negativePairMin;
  const { artworks, releaseInputs } = loadPhase0Artworks(loaded);
  const metadataBaseline = buildMetadataBaselineReport(
    loaded.releaseVersion,
    artworks,
    generatedAt,
    topK,
    anchorCount,
  );
  const evaluationFixture = buildEvaluationFixture(
    loaded.releaseVersion,
    artworks,
    metadataBaseline,
    generatedAt,
    topK,
    negativePairCount,
  );
  const payloadMeasurement = buildPayloadMeasurementReport(loaded, artworks, releaseInputs, generatedAt);
  const metadataBaselinePath = path.join(reportDir, "metadata-baseline-report.json");
  const payloadMeasurementPath = path.join(reportDir, "payload-measurement.json");
  const evaluationFixturePath = path.join(reportDir, "evaluation-fixture.json");
  const phase0ReportPath = path.join(reportDir, "phase0-report.json");
  const phase0Report = buildPhase0Report(
    loaded.releaseVersion,
    generatedAt,
    metadataBaselinePath,
    payloadMeasurementPath,
    evaluationFixturePath,
  );

  writeJsonFile(metadataBaselinePath, metadataBaseline);
  writeJsonFile(payloadMeasurementPath, payloadMeasurement);
  writeJsonFile(evaluationFixturePath, evaluationFixture);
  writeJsonFile(phase0ReportPath, phase0Report);

  return {
    releaseVersion: loaded.releaseVersion,
    reportDir,
    metadataBaselinePath,
    payloadMeasurementPath,
    evaluationFixturePath,
    phase0ReportPath,
    metadataBaseline,
    payloadMeasurement,
    evaluationFixture,
    phase0Report,
  };
}
