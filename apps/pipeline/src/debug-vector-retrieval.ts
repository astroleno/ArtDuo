import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  createRelationshipGraphIndex,
  createUnavailableRelationshipGraphIndex,
  loadEmbeddingShards,
  loadRelationshipGraphShard,
  runRetrievalDebugWithProvider,
  type RelationshipGraphIndex,
  type RelationshipGraphEvidenceItem,
  type RetrievalDebugResult,
} from "@artduo/corpus";
import type { RelationshipGraphSourceRef } from "@artduo/contracts";

import { readEmbeddingRuntimeCliOptions, readVectorRetrievalDebugOptions } from "./cli";
import { resolveEmbeddingRuntime, type EmbeddingRuntimeCliOptions } from "./embedding-runtime";

const RELATIONSHIP_GRAPH_REPORT_FILE = "relationship-graph-report.json";
const INTERNAL_SOURCE_REF_SAMPLE_LIMIT = 8;

export interface VectorRetrievalDebugCliOptions {
  rootDir?: string;
  releasesRoot?: string;
  releaseVersion?: string;
  manifestPath?: string;
  query?: string;
  outputPath?: string;
  limit?: number;
}

export type InternalRelationshipDiagnosticsStatus = "ready" | "unavailable";
export type InternalRelationshipDiagnosticsUnavailableReason = "missing" | "invalid";

export interface InternalRelationshipEvidenceDiagnostic {
  entryId: string;
  artworkId: string;
  signalNodeId: string;
  relation: RelationshipGraphEvidenceItem["relation"];
  publicSourceRefCount: number;
  fullSourceRefCount: number;
  omittedSourceRefCount: number;
  fullSourceRefSample: RelationshipGraphSourceRef[];
}

export interface InternalRelationshipDiagnostics {
  status: InternalRelationshipDiagnosticsStatus;
  reportPath: string;
  releaseVersion?: string;
  unavailableReason?: InternalRelationshipDiagnosticsUnavailableReason;
  warnings: string[];
  builderVersion?: string;
  taxonomyVersion?: string;
  publicSidecar?: {
    nodeCount: number;
    edgeCount: number;
    graphSha256: string;
    manifestUpdated: boolean;
  };
  provenance?: {
    strategy: string;
    publicMaxSourceRefsPerSignalNode: number;
    truncatedSignalNodeCount: number;
    omittedSourceRefCount: number;
  };
  highFanoutSignalNodeCount?: number;
  rerankedEvidenceDiagnostics: InternalRelationshipEvidenceDiagnostic[];
}

export interface VectorRetrievalDebugReport extends RetrievalDebugResult {
  releaseVersion: string;
  manifestPath: string;
  shardPaths: string[];
  relationshipGraphShardPath?: string;
  internalRelationshipDiagnostics: InternalRelationshipDiagnostics;
  requestedProviderMode: string;
  configuredProviderMode: string;
}

function resolveDefaultOutputPath(rootDir: string, releaseVersion: string): string {
  return path.join(rootDir, "data", "curation", "reports", `vector-debug-${releaseVersion}.json`);
}

function writeJsonFile(filePath: string, data: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function resolveRootDir(rootDir?: string): string {
  return rootDir ? path.resolve(rootDir) : path.resolve(process.cwd(), "../..");
}

function isInsideDirectory(parentDir: string, childPath: string): boolean {
  const relative = path.relative(parentDir, childPath);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function resolveReportsRoot(options: {
  rootDir?: string;
  releaseDir: string;
}): string {
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

function resolveInternalRelationshipReportPath(options: {
  rootDir?: string;
  releaseDir: string;
  releaseVersion: string;
}): string {
  const reportsRoot = resolveReportsRoot(options);
  const reportRoot = path.join(reportsRoot, "relationship-graph", options.releaseVersion);
  const reportPath = path.join(reportRoot, RELATIONSHIP_GRAPH_REPORT_FILE);

  if (!isInsideDirectory(reportsRoot, reportPath)) {
    throw new Error(`Relationship graph internal report path escaped reports root: ${reportPath}`);
  }

  return reportPath;
}

function expectObject(value: unknown, dataPath: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${dataPath}: expected object`);
  }

  return value as Record<string, unknown>;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readSourceRefs(value: unknown, releaseVersion: string): RelationshipGraphSourceRef[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    const ref = expectObject(entry, "relationship-graph-report.sourceRef");
    if (ref.releaseVersion !== releaseVersion) {
      throw new TypeError("relationship-graph-report.sourceRef.releaseVersion: expected current release");
    }

    return [ref as unknown as RelationshipGraphSourceRef];
  });
}

function unavailableInternalDiagnostics(
  reportPath: string,
  reason: InternalRelationshipDiagnosticsUnavailableReason,
  warning: string,
): InternalRelationshipDiagnostics {
  return {
    status: "unavailable",
    reportPath,
    unavailableReason: reason,
    warnings: [warning],
    rerankedEvidenceDiagnostics: [],
  };
}

function loadInternalRelationshipDiagnostics(
  options: {
    rootDir?: string;
    releaseDir: string;
  },
  releaseVersion: string,
  rerankedTopK: RetrievalDebugResult["rerankedTopK"],
): InternalRelationshipDiagnostics {
  const reportPath = resolveInternalRelationshipReportPath({
    ...options,
    releaseVersion,
  });

  if (!existsSync(reportPath)) {
    return unavailableInternalDiagnostics(
      reportPath,
      "missing",
      "Relationship graph internal report is absent; internalRelationshipDiagnostics is empty.",
    );
  }

  try {
    const report = expectObject(JSON.parse(readFileSync(reportPath, "utf8")) as unknown, reportPath);
    if (report.releaseVersion !== releaseVersion) {
      throw new TypeError(`${reportPath}.releaseVersion: expected ${releaseVersion}`);
    }

    const publicSidecar = expectObject(report.publicSidecar, `${reportPath}.publicSidecar`);
    const provenance = expectObject(report.provenance, `${reportPath}.provenance`);
    const fullSourceRefsByNode = expectObject(provenance.fullSourceRefsByNode, `${reportPath}.provenance.fullSourceRefsByNode`);
    const highFanoutRows = Array.isArray(report.highFanoutSignalNodes)
      ? report.highFanoutSignalNodes.map((entry) => expectObject(entry, `${reportPath}.highFanoutSignalNodes[]`))
      : [];
    const highFanoutByNodeId = new Map(highFanoutRows.flatMap((entry) => {
      const id = readOptionalString(entry.id);
      return id ? [[id, entry] as const] : [];
    }));

    const rerankedEvidenceDiagnostics = rerankedTopK.flatMap((entry) =>
      (entry.relationshipEvidence ?? []).map((evidence) => {
        const highFanout = highFanoutByNodeId.get(evidence.signalNodeId);
        const fullSourceRefs = readSourceRefs(
          highFanout?.fullSourceRefs ?? fullSourceRefsByNode[evidence.signalNodeId],
          releaseVersion,
        );
        const fullSourceRefCount = readOptionalNumber(highFanout?.fullSourceRefCount)
          ?? (fullSourceRefs.length || evidence.sourceRefs.length);
        const publicSourceRefCount = readOptionalNumber(highFanout?.publicSourceRefCount)
          ?? evidence.sourceRefs.length;
        const omittedSourceRefCount = readOptionalNumber(highFanout?.omittedSourceRefCount)
          ?? Math.max(0, fullSourceRefCount - publicSourceRefCount);

        return {
          entryId: entry.id,
          artworkId: evidence.artworkId,
          signalNodeId: evidence.signalNodeId,
          relation: evidence.relation,
          publicSourceRefCount,
          fullSourceRefCount,
          omittedSourceRefCount,
          fullSourceRefSample: fullSourceRefs.slice(0, INTERNAL_SOURCE_REF_SAMPLE_LIMIT),
        };
      }));

    return {
      status: "ready",
      reportPath,
      releaseVersion,
      warnings: [],
      builderVersion: readOptionalString(report.builderVersion),
      taxonomyVersion: readOptionalString(report.taxonomyVersion),
      publicSidecar: {
        nodeCount: readOptionalNumber(publicSidecar.nodeCount) ?? 0,
        edgeCount: readOptionalNumber(publicSidecar.edgeCount) ?? 0,
        graphSha256: readOptionalString(publicSidecar.graphSha256) ?? "",
        manifestUpdated: readOptionalBoolean(publicSidecar.manifestUpdated) ?? false,
      },
      provenance: {
        strategy: readOptionalString(provenance.strategy) ?? "unknown",
        publicMaxSourceRefsPerSignalNode: readOptionalNumber(provenance.publicMaxSourceRefsPerSignalNode) ?? 0,
        truncatedSignalNodeCount: readOptionalNumber(provenance.truncatedSignalNodeCount) ?? 0,
        omittedSourceRefCount: readOptionalNumber(provenance.omittedSourceRefCount) ?? 0,
      },
      highFanoutSignalNodeCount: highFanoutRows.length,
      rerankedEvidenceDiagnostics,
    };
  } catch {
    return unavailableInternalDiagnostics(
      reportPath,
      "invalid",
      "Relationship graph internal report failed validation; internalRelationshipDiagnostics is empty.",
    );
  }
}

function loadOptionalRelationshipGraphIndex(options: VectorRetrievalDebugCliOptions): {
  index: RelationshipGraphIndex;
  shardPath?: string;
} {
  try {
    const loaded = loadRelationshipGraphShard({
      rootDir: options.rootDir,
      releasesRoot: options.releasesRoot,
      releaseVersion: options.releaseVersion,
      manifestPath: options.manifestPath,
    });

    return {
      index: createRelationshipGraphIndex(loaded?.graph),
      shardPath: loaded?.shardPath,
    };
  } catch {
    return {
      index: createUnavailableRelationshipGraphIndex("invalid", "Relationship graph sidecar failed to load."),
    };
  }
}

export async function buildVectorRetrievalDebugReport(
  options: VectorRetrievalDebugCliOptions,
  runtimeOptions: EmbeddingRuntimeCliOptions = {},
): Promise<VectorRetrievalDebugReport> {
  const query = options.query?.trim();

  if (!query) {
    throw new Error("Missing required --query for vector retrieval debug.");
  }

  const loaded = loadEmbeddingShards({
    rootDir: options.rootDir,
    releasesRoot: options.releasesRoot,
    releaseVersion: options.releaseVersion,
    manifestPath: options.manifestPath,
  });
  const relationshipGraph = loadOptionalRelationshipGraphIndex(options);
  const runtime = resolveEmbeddingRuntime({
    ...runtimeOptions,
    rootDir: options.rootDir,
  });
  const result = await runRetrievalDebugWithProvider(query, loaded.records, {
    limit: options.limit,
    embeddingProvider: runtime.provider,
    relationshipGraphIndex: relationshipGraph.index,
  });

  return {
    releaseVersion: loaded.releaseVersion,
    manifestPath: loaded.manifestPath,
    shardPaths: loaded.shardPaths,
    relationshipGraphShardPath: relationshipGraph.shardPath,
    internalRelationshipDiagnostics: loadInternalRelationshipDiagnostics(
      {
        rootDir: options.rootDir,
        releaseDir: loaded.releaseDir,
      },
      loaded.releaseVersion,
      result.rerankedTopK,
    ),
    requestedProviderMode: runtime.requestedProviderMode,
    configuredProviderMode: runtime.summary.configuredProviderMode,
    ...result,
  };
}

async function main(): Promise<void> {
  const options = readVectorRetrievalDebugOptions();
  const payload = await buildVectorRetrievalDebugReport(options, readEmbeddingRuntimeCliOptions());
  const rootDir = resolveRootDir(options.rootDir);
  const outputPath = options.outputPath ?? resolveDefaultOutputPath(rootDir, payload.releaseVersion);

  writeJsonFile(outputPath, payload);
  console.log(JSON.stringify(payload, null, 2));
  console.log(`report: ${outputPath}`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
