import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  createRelationshipGraphIndex,
  loadEmbeddingShards,
  loadRelationshipGraphShard,
  runRetrievalDebugWithProvider,
  runVectorBenchmarkWithProvider,
  type RelationshipGraphIndex,
  type VectorBenchmarkPrompt,
  type VectorBenchmarkResult,
} from "@artduo/corpus";
import type {
  RelationshipGraphEdge,
  RelationshipGraphRelation,
  RelationshipGraphShard,
} from "@artduo/contracts";

import { resolveEmbeddingRuntime, type EmbeddingRuntimeCliOptions } from "./embedding-runtime";

const EVALUATION_REPORT_FILE = "evaluation-report.json";
const DEFAULT_TOP_K = 5;

const RELATION_WEIGHTS: Record<RelationshipGraphRelation, number> = {
  has_emotion: 5,
  has_subject: 2.4,
  has_palette: 1.2,
};

const REASON_BY_RELATION: Record<RelationshipGraphRelation, string> = {
  has_emotion: "shared_emotion",
  has_subject: "shared_subject",
  has_palette: "shared_palette",
};

export interface RelationshipGraphEvaluationOptions {
  rootDir?: string;
  releasesRoot?: string;
  releaseVersion?: string;
  manifestPath?: string;
  reportRoot?: string;
  promptsPath?: string;
  outputPath?: string;
  topK?: number;
  benchmarkLimit?: number;
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

interface EvaluationFixture {
  releaseVersion: string;
  topK: number;
  anchors: Array<{
    id: string;
    title: string;
    expectedBaselineTopK: Array<{
      id: string;
      score: number;
      reasonCodes: string[];
    }>;
  }>;
  negativeSamples: Array<{
    anchorId: string;
    candidateId: string;
    baselineScore: number;
    superficialReasons: string[];
  }>;
  thresholds: Phase0Thresholds;
}

interface MetadataBaselineReport {
  releaseVersion: string;
  topK: number;
  anchorCount: number;
}

interface GraphSignal {
  signalNodeId: string;
  relation: RelationshipGraphRelation;
  label: string;
}

export interface EvaluatedRelatedCandidate {
  id: string;
  score: number;
  reasonCodes: string[];
  sharedSignals: Array<{
    signalNodeId: string;
    relation: RelationshipGraphRelation;
    label: string;
  }>;
}

interface AnchorEvaluation {
  id: string;
  title: string;
  baselineTopK: Array<{
    id: string;
    score: number;
    reasonCodes: string[];
    evidenceBacked: boolean;
  }>;
  sidecarTopK: EvaluatedRelatedCandidate[];
  baselinePrecisionAtK: number;
  sidecarPrecisionAtK: number;
  reasonCodeOverlapRate: number;
}

export interface RelationshipGraphEvaluationReport {
  releaseVersion: string;
  generatedAt: string;
  scope: "relationship-graph-evaluation.phase4";
  topK: number;
  inputs: {
    manifestPath: string;
    relationshipGraphShardPath: string;
    metadataBaselinePath: string;
    evaluationFixturePath: string;
    promptsPath: string;
  };
  baseline: {
    anchorCount: number;
    precisionAtK: number;
  };
  sidecar: {
    selectorStatus: RelationshipGraphIndex["status"];
    precisionAtK: number;
    absolutePrecisionLiftOverBaseline: number;
    publicLeakFree: boolean;
    payloadWithinLimits: boolean;
    actualShardSizeBytes: number;
    manifestShardSizeBytes: number;
    maxShardSizeBytes: number;
  };
  negatives: {
    sampleCount: number;
    topKLeakCount: number;
    topKLeakRate: number;
    maxAllowedLeakRate: number;
  };
  reasonHelpfulness: {
    method: "automatic-proxy";
    humanReviewRequired: true;
    automaticScoreCount: number;
    requiredHumanReviewSampleCount: number;
    averageScore: number;
    score2PlusRate: number;
    scoreCounts: Record<"1" | "2" | "3", number>;
  };
  vectorBenchmark: {
    unchangedWithGraphJoin: boolean;
    promptCount: number;
    rerankTop1HitRate: number;
    rerankTop5HitRate: number;
    lexicalTop1HitRate: number;
    lexicalTop5HitRate: number;
    comparisons: Array<{
      id: string;
      vectorOrderUnchanged: boolean;
      rerankOrderUnchanged: boolean;
    }>;
  };
  gates: {
    vectorBenchmarkPass: boolean;
    publicLeakPass: boolean;
    payloadPass: boolean;
    precisionPass: boolean;
    negativePass: boolean;
    automaticReasonProxyPass: boolean;
    humanReasonReviewRequired: true;
    automatedGatePass: boolean;
  };
  decision: "keep_internal_pending_human_review" | "iterate" | "discard";
  anchors: AnchorEvaluation[];
  notes: string[];
}

export interface RelationshipGraphEvaluationResult {
  releaseVersion: string;
  reportPath: string;
  report: RelationshipGraphEvaluationReport;
}

function resolveRootDir(rootDir?: string): string {
  return rootDir ? path.resolve(rootDir) : path.resolve(process.cwd(), "../..");
}

function resolveDefaultPromptsPath(rootDir: string): string {
  return path.join(rootDir, "benchmarks", "vector-promotion-prompts.json");
}

function isInsideDirectory(parentDir: string, childPath: string): boolean {
  const relative = path.relative(parentDir, childPath);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function resolveReportsRoot(options: {
  rootDir?: string;
  reportRoot?: string;
  releaseDir: string;
}): string {
  if (options.reportRoot) {
    return path.resolve(options.reportRoot);
  }
  if (options.rootDir) {
    return path.join(path.resolve(options.rootDir), "data", "curation", "reports");
  }

  const releasesRoot = path.dirname(options.releaseDir);
  const dataRoot = path.dirname(releasesRoot);

  if (path.basename(dataRoot) === "data") {
    return path.join(dataRoot, "curation", "reports");
  }

  return path.join(path.dirname(releasesRoot), "data", "curation", "reports");
}

function relationshipGraphReportDir(reportsRoot: string, releaseVersion: string): string {
  const reportDir = path.join(reportsRoot, "relationship-graph", releaseVersion);
  if (!isInsideDirectory(reportsRoot, reportDir)) {
    throw new Error(`Relationship graph evaluation report path escaped reports root: ${reportDir}`);
  }

  return reportDir;
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function writeJsonFile(filePath: string, data: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function normalizePositiveInteger(value: number | undefined, defaultValue: number): number {
  if (value === undefined || !Number.isFinite(value) || value < 1) {
    return defaultValue;
  }

  return Math.floor(value);
}

function roundNumber(value: number): number {
  return Number(value.toFixed(6));
}

function artworkIdFromNodeId(nodeId: string): string {
  return nodeId.startsWith("artwork:") ? nodeId.slice("artwork:".length) : nodeId;
}

function relationPriority(relation: RelationshipGraphRelation): number {
  if (relation === "has_emotion") {
    return 0;
  }
  if (relation === "has_subject") {
    return 1;
  }
  return 2;
}

function buildSignalsByArtwork(graph: RelationshipGraphShard): Map<string, GraphSignal[]> {
  const nodeLabelById = new Map(graph.nodes.map((node) => [node.id, node.label] as const));
  const signalsByArtwork = new Map<string, GraphSignal[]>();

  for (const edge of graph.edges) {
    const artworkId = artworkIdFromNodeId(edge.source);
    const signals = signalsByArtwork.get(artworkId) ?? [];
    signals.push({
      signalNodeId: edge.target,
      relation: edge.relation,
      label: nodeLabelById.get(edge.target) ?? edge.target,
    });
    signalsByArtwork.set(artworkId, signals);
  }

  for (const [artworkId, signals] of signalsByArtwork.entries()) {
    signalsByArtwork.set(artworkId, [...signals].sort((left, right) =>
      relationPriority(left.relation) - relationPriority(right.relation)
      || left.label.localeCompare(right.label)
      || left.signalNodeId.localeCompare(right.signalNodeId)));
  }

  return signalsByArtwork;
}

function sharedSignals(left: GraphSignal[], right: GraphSignal[]): GraphSignal[] {
  const rightById = new Map(right.map((signal) => [signal.signalNodeId, signal] as const));

  return left.filter((signal) => rightById.has(signal.signalNodeId));
}

function buildSidecarCandidate(
  candidateId: string,
  shared: GraphSignal[],
): EvaluatedRelatedCandidate {
  const reasonCodes = [...new Set(shared.map((signal) => REASON_BY_RELATION[signal.relation]))]
    .sort((left, right) => left.localeCompare(right));
  const score = shared.reduce((total, signal) => total + RELATION_WEIGHTS[signal.relation], 0);

  return {
    id: candidateId,
    score: roundNumber(score),
    reasonCodes,
    sharedSignals: shared.map((signal) => ({
      signalNodeId: signal.signalNodeId,
      relation: signal.relation,
      label: signal.label,
    })),
  };
}

function buildSidecarTopKByArtwork(
  signalsByArtwork: Map<string, GraphSignal[]>,
  topK: number,
): Map<string, EvaluatedRelatedCandidate[]> {
  const artworkIds = [...signalsByArtwork.keys()].sort();
  const related = new Map<string, EvaluatedRelatedCandidate[]>();

  for (const anchorId of artworkIds) {
    const anchorSignals = signalsByArtwork.get(anchorId) ?? [];
    const candidates = artworkIds.flatMap((candidateId) => {
      if (candidateId === anchorId) {
        return [];
      }

      const shared = sharedSignals(anchorSignals, signalsByArtwork.get(candidateId) ?? []);
      return shared.length > 0 ? [buildSidecarCandidate(candidateId, shared)] : [];
    }).sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (right.sharedSignals.length !== left.sharedSignals.length) {
        return right.sharedSignals.length - left.sharedSignals.length;
      }

      return left.id.localeCompare(right.id);
    }).slice(0, topK);

    related.set(anchorId, candidates);
  }

  return related;
}

function isEvidenceBacked(
  signalsByArtwork: Map<string, GraphSignal[]>,
  anchorId: string,
  candidateId: string,
): boolean {
  return sharedSignals(signalsByArtwork.get(anchorId) ?? [], signalsByArtwork.get(candidateId) ?? []).length > 0;
}

function precisionAtK(relevantCount: number, anchorCount: number, topK: number): number {
  return anchorCount > 0 && topK > 0 ? roundNumber(relevantCount / (anchorCount * topK)) : 0;
}

function scoreReasonHelpfulness(candidate: EvaluatedRelatedCandidate): 1 | 2 | 3 {
  const reasonCodes = new Set(candidate.reasonCodes);
  if (reasonCodes.has("shared_emotion") && reasonCodes.has("shared_subject")) {
    return 3;
  }
  if (reasonCodes.has("shared_emotion") || reasonCodes.has("shared_subject")) {
    return 2;
  }

  return 1;
}

function summarizeReasonHelpfulness(
  anchors: AnchorEvaluation[],
  thresholds: Phase0Thresholds,
): RelationshipGraphEvaluationReport["reasonHelpfulness"] {
  const scores = anchors.flatMap((anchor) => anchor.sidecarTopK.map((candidate) => scoreReasonHelpfulness(candidate)));
  const scoreCounts: Record<"1" | "2" | "3", number> = {
    "1": scores.filter((score) => score === 1).length,
    "2": scores.filter((score) => score === 2).length,
    "3": scores.filter((score) => score === 3).length,
  };
  const averageScore = scores.length > 0
    ? roundNumber(scores.reduce((total, score) => total + score, 0) / scores.length)
    : 0;
  const score2PlusRate = scores.length > 0
    ? roundNumber(scores.filter((score) => score >= 2).length / scores.length)
    : 0;

  return {
    method: "automatic-proxy",
    humanReviewRequired: true,
    automaticScoreCount: scores.length,
    requiredHumanReviewSampleCount: thresholds.reasonReviewSampleMin,
    averageScore,
    score2PlusRate,
    scoreCounts,
  };
}

function reasonOverlapRate(baselineReasonCodes: string[], sidecarReasonCodes: string[]): number {
  const baseline = new Set(baselineReasonCodes);
  const sidecar = new Set(sidecarReasonCodes);
  const union = new Set([...baseline, ...sidecar]);

  if (union.size === 0) {
    return 0;
  }

  return roundNumber([...union].filter((reasonCode) => baseline.has(reasonCode) && sidecar.has(reasonCode)).length / union.size);
}

function buildAnchorEvaluations(
  fixture: EvaluationFixture,
  signalsByArtwork: Map<string, GraphSignal[]>,
  sidecarTopKByArtwork: Map<string, EvaluatedRelatedCandidate[]>,
  topK: number,
): {
  anchors: AnchorEvaluation[];
  baselineRelevantCount: number;
  sidecarRelevantCount: number;
} {
  let baselineRelevantCount = 0;
  let sidecarRelevantCount = 0;

  const anchors = fixture.anchors.map((anchor) => {
    const baselineTopK = anchor.expectedBaselineTopK.slice(0, topK).map((candidate) => {
      const evidenceBacked = isEvidenceBacked(signalsByArtwork, anchor.id, candidate.id);
      if (evidenceBacked) {
        baselineRelevantCount += 1;
      }

      return {
        ...candidate,
        evidenceBacked,
      };
    });
    const sidecarTopK = sidecarTopKByArtwork.get(anchor.id) ?? [];
    sidecarRelevantCount += sidecarTopK.filter((candidate) => isEvidenceBacked(signalsByArtwork, anchor.id, candidate.id)).length;

    return {
      id: anchor.id,
      title: anchor.title,
      baselineTopK,
      sidecarTopK,
      baselinePrecisionAtK: precisionAtK(baselineTopK.filter((candidate) => candidate.evidenceBacked).length, 1, topK),
      sidecarPrecisionAtK: precisionAtK(sidecarTopK.length, 1, topK),
      reasonCodeOverlapRate: reasonOverlapRate(
        baselineTopK.flatMap((candidate) => candidate.reasonCodes),
        sidecarTopK.flatMap((candidate) => candidate.reasonCodes),
      ),
    };
  });

  return {
    anchors,
    baselineRelevantCount,
    sidecarRelevantCount,
  };
}

function negativeLeakSummary(
  fixture: EvaluationFixture,
  sidecarTopKByArtwork: Map<string, EvaluatedRelatedCandidate[]>,
): RelationshipGraphEvaluationReport["negatives"] {
  const leakCount = fixture.negativeSamples.filter((sample) => {
    const anchorTopK = new Set((sidecarTopKByArtwork.get(sample.anchorId) ?? []).map((candidate) => candidate.id));
    const candidateTopK = new Set((sidecarTopKByArtwork.get(sample.candidateId) ?? []).map((candidate) => candidate.id));

    return anchorTopK.has(sample.candidateId) || candidateTopK.has(sample.anchorId);
  }).length;
  const sampleCount = fixture.negativeSamples.length;

  return {
    sampleCount,
    topKLeakCount: leakCount,
    topKLeakRate: sampleCount > 0 ? roundNumber(leakCount / sampleCount) : 0,
    maxAllowedLeakRate: fixture.thresholds.maxNegativeTop5LeakRate,
  };
}

function publicPayloadWithinLimits(graph: RelationshipGraphShard, actualShardSizeBytes: number): boolean {
  const degreeByNode = new Map<string, number>(graph.nodes.map((node) => [node.id, 0]));
  for (const edge of graph.edges) {
    degreeByNode.set(edge.source, (degreeByNode.get(edge.source) ?? 0) + 1);
    degreeByNode.set(edge.target, (degreeByNode.get(edge.target) ?? 0) + 1);
  }

  return graph.nodes.length <= graph.limits.maxNodes
    && graph.edges.length <= graph.limits.maxEdges
    && actualShardSizeBytes <= graph.limits.maxShardSizeBytes
    && [...degreeByNode.values()].every((degree) => degree <= graph.limits.maxDegreePerNode);
}

function publicLeakFree(anchors: AnchorEvaluation[]): boolean {
  const serialized = JSON.stringify(anchors.map((anchor) => anchor.sidecarTopK));

  return !/(fullSourceRefsByNode|fullSourceRefSample|privateNotes|provenance|debugPayload|internal)/u.test(serialized);
}

function sameOrder(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

async function compareVectorOrders(
  prompts: VectorBenchmarkPrompt[],
  records: Parameters<typeof runVectorBenchmarkWithProvider>[1],
  relationshipGraphIndex: RelationshipGraphIndex,
  runtimeOptions: Parameters<typeof runVectorBenchmarkWithProvider>[2],
): Promise<RelationshipGraphEvaluationReport["vectorBenchmark"]["comparisons"]> {
  return Promise.all(prompts.map(async (prompt) => {
    const baseline = await runRetrievalDebugWithProvider(prompt.query, records, runtimeOptions);
    const withGraph = await runRetrievalDebugWithProvider(prompt.query, records, {
      ...runtimeOptions,
      relationshipGraphIndex,
    });

    return {
      id: prompt.id,
      vectorOrderUnchanged: sameOrder(
        baseline.vectorTopK.map((entry) => entry.id),
        withGraph.vectorTopK.map((entry) => entry.id),
      ),
      rerankOrderUnchanged: sameOrder(
        baseline.rerankedTopK.map((entry) => entry.id),
        withGraph.rerankedTopK.map((entry) => entry.id),
      ),
    };
  }));
}

function vectorBenchmarkSummary(
  benchmark: VectorBenchmarkResult,
  comparisons: RelationshipGraphEvaluationReport["vectorBenchmark"]["comparisons"],
): RelationshipGraphEvaluationReport["vectorBenchmark"] {
  return {
    unchangedWithGraphJoin: comparisons.every((comparison) =>
      comparison.vectorOrderUnchanged && comparison.rerankOrderUnchanged),
    promptCount: benchmark.promptCount,
    rerankTop1HitRate: benchmark.rerankTop1HitRate,
    rerankTop5HitRate: benchmark.rerankTop5HitRate,
    lexicalTop1HitRate: benchmark.lexicalTop1HitRate,
    lexicalTop5HitRate: benchmark.lexicalTop5HitRate,
    comparisons,
  };
}

function buildDecision(gates: RelationshipGraphEvaluationReport["gates"]): RelationshipGraphEvaluationReport["decision"] {
  if (!gates.precisionPass || !gates.negativePass) {
    return "discard";
  }
  if (!gates.automatedGatePass) {
    return "iterate";
  }

  return "keep_internal_pending_human_review";
}

export async function evaluateRelationshipGraph(
  options: RelationshipGraphEvaluationOptions = {},
  runtimeOptions: EmbeddingRuntimeCliOptions = {},
): Promise<RelationshipGraphEvaluationResult> {
  const rootDir = resolveRootDir(options.rootDir);
  const loadedEmbeddings = loadEmbeddingShards({
    rootDir: options.rootDir ? rootDir : undefined,
    releasesRoot: options.releasesRoot,
    releaseVersion: options.releaseVersion,
    manifestPath: options.manifestPath,
  });
  const loadedGraph = loadRelationshipGraphShard({
    rootDir: options.rootDir ? rootDir : undefined,
    releasesRoot: options.releasesRoot,
    releaseVersion: options.releaseVersion,
    manifestPath: options.manifestPath,
  });

  if (!loadedGraph) {
    throw new Error(`Release ${loadedEmbeddings.releaseVersion} does not expose a relationship graph shard.`);
  }

  const reportsRoot = resolveReportsRoot({
    rootDir: options.rootDir ? rootDir : undefined,
    reportRoot: options.reportRoot,
    releaseDir: loadedEmbeddings.releaseDir,
  });
  const reportDir = relationshipGraphReportDir(reportsRoot, loadedEmbeddings.releaseVersion);
  const metadataBaselinePath = path.join(reportDir, "metadata-baseline-report.json");
  const evaluationFixturePath = path.join(reportDir, "evaluation-fixture.json");
  const outputPath = options.outputPath
    ? path.resolve(options.outputPath)
    : path.join(reportDir, EVALUATION_REPORT_FILE);
  const promptsPath = options.promptsPath
    ? path.resolve(options.promptsPath)
    : resolveDefaultPromptsPath(rootDir);

  const metadataBaseline = readJsonFile<MetadataBaselineReport>(metadataBaselinePath);
  const fixture = readJsonFile<EvaluationFixture>(evaluationFixturePath);
  const prompts = readJsonFile<VectorBenchmarkPrompt[]>(promptsPath);
  if (metadataBaseline.releaseVersion !== loadedEmbeddings.releaseVersion || fixture.releaseVersion !== loadedEmbeddings.releaseVersion) {
    throw new Error(`Phase 4 evaluation inputs must match release ${loadedEmbeddings.releaseVersion}.`);
  }

  const topK = normalizePositiveInteger(options.topK, fixture.topK || metadataBaseline.topK || DEFAULT_TOP_K);
  const benchmarkLimit = normalizePositiveInteger(options.benchmarkLimit, topK);
  const graphIndex = createRelationshipGraphIndex(loadedGraph.graph);
  const signalsByArtwork = buildSignalsByArtwork(loadedGraph.graph);
  const sidecarTopKByArtwork = buildSidecarTopKByArtwork(signalsByArtwork, topK);
  const anchorEvaluations = buildAnchorEvaluations(fixture, signalsByArtwork, sidecarTopKByArtwork, topK);
  const baselinePrecisionAtK = precisionAtK(anchorEvaluations.baselineRelevantCount, fixture.anchors.length, topK);
  const sidecarPrecisionAtK = precisionAtK(anchorEvaluations.sidecarRelevantCount, fixture.anchors.length, topK);
  const absolutePrecisionLiftOverBaseline = roundNumber(sidecarPrecisionAtK - baselinePrecisionAtK);
  const negatives = negativeLeakSummary(fixture, sidecarTopKByArtwork);
  const reasonHelpfulness = summarizeReasonHelpfulness(anchorEvaluations.anchors, fixture.thresholds);
  const leakFree = publicLeakFree(anchorEvaluations.anchors);
  const actualShardSizeBytes = statSync(loadedGraph.shardPath).size;
  const manifestShardSizeBytes = loadedGraph.shard.sizeBytes;
  const payloadWithinLimits = publicPayloadWithinLimits(loadedGraph.graph, actualShardSizeBytes);
  const runtime = resolveEmbeddingRuntime({
    ...runtimeOptions,
    rootDir,
  });
  const benchmarkOptions = {
    limit: benchmarkLimit,
    embeddingProvider: runtime.provider,
  };
  const vectorBenchmark = await runVectorBenchmarkWithProvider(prompts, loadedEmbeddings.records, benchmarkOptions);
  const vectorComparisons = await compareVectorOrders(prompts, loadedEmbeddings.records, graphIndex, benchmarkOptions);
  const vectorSummary = vectorBenchmarkSummary(vectorBenchmark, vectorComparisons);
  const gates = {
    vectorBenchmarkPass: vectorSummary.unchangedWithGraphJoin,
    publicLeakPass: leakFree,
    payloadPass: payloadWithinLimits,
    precisionPass: sidecarPrecisionAtK >= fixture.thresholds.requiredSidecarPrecisionAt5
      && absolutePrecisionLiftOverBaseline >= fixture.thresholds.requiredAbsolutePrecisionLiftOverBaseline,
    negativePass: negatives.topKLeakRate <= fixture.thresholds.maxNegativeTop5LeakRate,
    automaticReasonProxyPass: reasonHelpfulness.automaticScoreCount >= fixture.thresholds.reasonReviewSampleMin
      && reasonHelpfulness.averageScore >= fixture.thresholds.requiredReasonAverageHelpfulness
      && reasonHelpfulness.score2PlusRate >= fixture.thresholds.requiredReasonScore2PlusRate,
    humanReasonReviewRequired: true as const,
    automatedGatePass: false,
  };
  gates.automatedGatePass = gates.vectorBenchmarkPass
    && gates.publicLeakPass
    && gates.payloadPass
    && gates.precisionPass
    && gates.negativePass
    && gates.automaticReasonProxyPass;
  const report: RelationshipGraphEvaluationReport = {
    releaseVersion: loadedEmbeddings.releaseVersion,
    generatedAt: new Date().toISOString(),
    scope: "relationship-graph-evaluation.phase4",
    topK,
    inputs: {
      manifestPath: loadedEmbeddings.manifestPath,
      relationshipGraphShardPath: loadedGraph.shardPath,
      metadataBaselinePath,
      evaluationFixturePath,
      promptsPath,
    },
    baseline: {
      anchorCount: metadataBaseline.anchorCount,
      precisionAtK: baselinePrecisionAtK,
    },
    sidecar: {
      selectorStatus: graphIndex.status,
      precisionAtK: sidecarPrecisionAtK,
      absolutePrecisionLiftOverBaseline,
      publicLeakFree: leakFree,
      payloadWithinLimits,
      actualShardSizeBytes,
      manifestShardSizeBytes,
      maxShardSizeBytes: loadedGraph.graph.limits.maxShardSizeBytes,
    },
    negatives,
    reasonHelpfulness,
    vectorBenchmark: vectorSummary,
    gates,
    decision: buildDecision(gates),
    anchors: anchorEvaluations.anchors,
    notes: [
      "Precision@K is an automated evidence-backed related-pair metric: a candidate is relevant when it shares at least one public graph signal with the anchor.",
      "Reason helpfulness is an automatic proxy only; the documented blind human review gate is still required before user-facing UI work.",
      "Vector benchmark pass means joining public graph evidence into debug retrieval leaves vectorTopK and rerankedTopK order unchanged for benchmark prompts.",
    ],
  };

  writeJsonFile(outputPath, report);

  return {
    releaseVersion: loadedEmbeddings.releaseVersion,
    reportPath: outputPath,
    report,
  };
}
