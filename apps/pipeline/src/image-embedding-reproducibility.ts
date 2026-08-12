import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { parseImageEmbeddingShardRecords } from "@artduo/contracts";

const EVIDENCE_SCHEMA = "artduo-image-embedding-reproducibility-evidence.v1";
const OFFLINE_BUILD_MANIFEST_SCHEMA = "artduo-image-embedding-offline-build-manifest.v1";
const BUNDLE_SCHEMA = "artduo-image-embedding-reproducibility-bundle.v1";
const SOURCE_CACHE_SCHEMA = "artduo-image-source-cache.v1";
const SOURCE_CACHE_AGGREGATE_ALGORITHM = "sha256(concat(sortByRelativePath(fileSha256 + twoSpaces + relativePath + newline)))";
const CHECKSUM = /^sha256:[a-f0-9]{64}$/u;
const GIT_SHA = /^[a-f0-9]{40}$/u;
const SEMVER = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u;
const REQUIRED_RUN_IDS = [
  "normal-frozen-install",
  "offline-frozen-install",
  "real-provider-smoke",
  "offline-shadow-rebuild",
] as const;
const REQUIRED_INPUTS = [
  "package.json",
  "apps/pipeline/package.json",
  "pnpm-lock.yaml",
] as const;

type Checksum = `sha256:${string}`;
type RequiredRunId = typeof REQUIRED_RUN_IDS[number];

export interface ReproducibilityInputBinding {
  path: string;
  checksum: Checksum;
}

export interface ReproducibilityRunBinding {
  id: RequiredRunId;
  command: string;
  isolation?: string;
  nativeScriptsEnabled?: boolean;
  assertions: string[];
  exitCode: 0;
  trackedGitStatusAfterRun: "clean";
  log: ReproducibilityInputBinding;
}

export interface ControlledFailure {
  entityType: "artwork" | "background-scene";
  entityId: string;
  code: string;
}

export interface ImageEmbeddingReproducibilityEvidence {
  schemaVersion: typeof EVIDENCE_SCHEMA;
  releaseVersion: string;
  generatedAt: string;
  execution: {
    commitSha: string;
    treeSha: string;
    trackedGitStatusBeforeRuns: "clean";
    untrackedPromotionArtifactsExcluded: true;
  };
  environment: {
    operatingSystem: string;
    architecture: string;
    nodeVersion: string;
    pnpmVersion: string;
  };
  inputs: ReproducibilityInputBinding[];
  runtimeArtifacts: {
    model: {
      id: string;
      revision: string;
      variant: string;
      artifact: string;
      sizeBytes: number;
      checksum: Checksum;
    };
    sourceCache: {
      schema: typeof SOURCE_CACHE_SCHEMA;
      fileCount: number;
      aggregateAlgorithm: typeof SOURCE_CACHE_AGGREGATE_ALGORITHM;
      aggregateChecksum: Checksum;
      committed: false;
    };
  };
  resolvedDependencies: {
    "@xenova/transformers": string;
    sharp: string;
    commander: string;
    "ipaddr.js": string;
  };
  runs: ReproducibilityRunBinding[];
  outputs: {
    candidate: {
      committed: false;
      recordCount: number;
      declaredChecksum: Checksum;
      bytesChecksum: Checksum;
    };
    offlineReport: {
      bytesChecksum: Checksum;
      coverageReady: boolean;
      controlledFailures: ControlledFailure[];
    };
  };
  promotionState: {
    promotionReady: boolean;
    task6Authorized: boolean;
    artworkHoldoutAccuracy: number;
    artworkHoldoutLowerConfidence: number;
    sceneTop3HitRate: number;
    sceneTop3LowerConfidence: number;
    humanReviewCompleted: number;
    humanReviewRequired: number;
  };
}

interface OfflineBuildManifest {
  schemaVersion: typeof OFFLINE_BUILD_MANIFEST_SCHEMA;
  releaseVersion: string;
  executionCommitSha: string;
  inputs: {
    baseManifestChecksum: Checksum;
    promotionAnchorSetChecksum: Checksum;
    modelArtifactChecksum: Checksum;
    sourceCacheAggregateChecksum: Checksum;
  };
  candidate: {
    recordCount: number;
    sizeBytes: number;
    declaredChecksum: Checksum;
    bytesChecksum: Checksum;
  };
  report: {
    bytesChecksum: Checksum;
    coverageReady: boolean;
    controlledFailures: ControlledFailure[];
  };
}

interface ReproducibilityBundle {
  schemaVersion: typeof BUNDLE_SCHEMA;
  releaseVersion: string;
  evidence: ReproducibilityInputBinding;
  offlineBuildManifest: ReproducibilityInputBinding;
  artifactRetention: {
    status: "local-only" | "immutable-storage";
    task7Ready: boolean;
    immutableArtifacts: Array<{
      kind: "model" | "source-cache" | "candidate" | "offline-report";
      uri: string;
      sizeBytes: number;
      checksum: Checksum;
    }>;
  };
}

export interface ImageEmbeddingReproducibilityVerificationOptions {
  rootDir: string;
  bundlePath: string;
  modelArtifactPath: string;
  sourceCacheRoot: string;
  candidatePath?: string;
  verifyResolvedDependencies?: boolean;
}

export interface ImageEmbeddingReproducibilityVerificationResult {
  valid: boolean;
  task7ArtifactReady: boolean;
  reasons: string[];
}

interface ParseResult<T> {
  value?: T;
  reasons: string[];
}

export interface EvidenceParseResult {
  evidence?: ImageEmbeddingReproducibilityEvidence;
  reasons: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isFiniteRatio(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isChecksum(value: unknown): value is Checksum {
  return typeof value === "string" && CHECKSUM.test(value);
}

function sha256(value: Uint8Array | string): Checksum {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function isSafeRelativePath(value: string): boolean {
  return value.length > 0
    && !path.isAbsolute(value)
    && !value.includes("\\")
    && path.posix.normalize(value) === value
    && value !== "."
    && !value.startsWith("../");
}

function isInside(parentPath: string, childPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function parseBinding(value: unknown, options: { allowDotRelative?: boolean } = {}): ReproducibilityInputBinding | undefined {
  if (!exactKeys(value, ["path", "checksum"])
    || !isNonEmptyString(value.path)
    || !(options.allowDotRelative && value.path.startsWith("./")
      ? isSafeRelativePath(value.path.slice(2))
      : isSafeRelativePath(value.path))
    || !isChecksum(value.checksum)) {
    return undefined;
  }
  return { path: value.path, checksum: value.checksum };
}

function parseControlledFailures(value: unknown): ControlledFailure[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const parsed: ControlledFailure[] = [];
  for (const entry of value) {
    if (!exactKeys(entry, ["entityType", "entityId", "code"])
      || (entry.entityType !== "artwork" && entry.entityType !== "background-scene")
      || !isNonEmptyString(entry.entityId)
      || !isNonEmptyString(entry.code)) {
      return undefined;
    }
    parsed.push({ entityType: entry.entityType, entityId: entry.entityId, code: entry.code });
  }
  return parsed;
}

function parseRun(value: unknown): ReproducibilityRunBinding | undefined {
  if (!isRecord(value)
    || !REQUIRED_RUN_IDS.includes(value.id as RequiredRunId)
    || !isNonEmptyString(value.command)
    || !Array.isArray(value.assertions)
    || value.assertions.length === 0
    || !value.assertions.every(isNonEmptyString)
    || value.exitCode !== 0
    || value.trackedGitStatusAfterRun !== "clean") {
    return undefined;
  }
  const commonKeys = ["id", "command", "assertions", "exitCode", "trackedGitStatusAfterRun", "log"];
  const installRun = value.id === "normal-frozen-install" || value.id === "offline-frozen-install";
  const keys = installRun ? [...commonKeys, "isolation", "nativeScriptsEnabled"] : commonKeys;
  if (!exactKeys(value, keys)
    || (installRun && (!isNonEmptyString(value.isolation) || value.nativeScriptsEnabled !== true))) {
    return undefined;
  }
  const log = parseBinding(value.log);
  if (!log) {
    return undefined;
  }
  return {
    id: value.id as RequiredRunId,
    command: value.command,
    ...(installRun ? { isolation: value.isolation as string, nativeScriptsEnabled: true as const } : {}),
    assertions: value.assertions as string[],
    exitCode: 0,
    trackedGitStatusAfterRun: "clean",
    log,
  };
}

export function parseImageEmbeddingReproducibilityEvidence(value: unknown): EvidenceParseResult {
  const topKeys = [
    "schemaVersion",
    "releaseVersion",
    "generatedAt",
    "execution",
    "environment",
    "inputs",
    "runtimeArtifacts",
    "resolvedDependencies",
    "runs",
    "outputs",
    "promotionState",
  ];
  if (!exactKeys(value, topKeys)) {
    return { reasons: ["Reproducibility evidence must match the exact schema without unexpected fields."] };
  }
  if (value.schemaVersion !== EVIDENCE_SCHEMA
    || !isNonEmptyString(value.releaseVersion)
    || !isNonEmptyString(value.generatedAt)
    || !ISO_DATE.test(value.generatedAt)) {
    return { reasons: ["Reproducibility evidence schema, release, or timestamp is invalid."] };
  }
  const execution = value.execution;
  if (!exactKeys(execution, ["commitSha", "treeSha", "trackedGitStatusBeforeRuns", "untrackedPromotionArtifactsExcluded"])
    || typeof execution.commitSha !== "string"
    || !GIT_SHA.test(execution.commitSha)
    || typeof execution.treeSha !== "string"
    || !GIT_SHA.test(execution.treeSha)
    || execution.trackedGitStatusBeforeRuns !== "clean"
    || execution.untrackedPromotionArtifactsExcluded !== true) {
    return { reasons: ["Reproducibility execution binding is invalid."] };
  }
  const environment = value.environment;
  if (!exactKeys(environment, ["operatingSystem", "architecture", "nodeVersion", "pnpmVersion"])
    || !isNonEmptyString(environment.operatingSystem)
    || !isNonEmptyString(environment.architecture)
    || typeof environment.nodeVersion !== "string"
    || !/^v\d+\.\d+\.\d+/u.test(environment.nodeVersion)
    || typeof environment.pnpmVersion !== "string"
    || !SEMVER.test(environment.pnpmVersion)) {
    return { reasons: ["Reproducibility environment binding is invalid."] };
  }
  if (!Array.isArray(value.inputs) || value.inputs.length < REQUIRED_INPUTS.length) {
    return { reasons: ["Reproducibility input bindings are missing."] };
  }
  const inputs = value.inputs.map((entry) => parseBinding(entry));
  if (inputs.some((entry) => entry === undefined)) {
    return { reasons: ["Reproducibility input binding is invalid or unsafe."] };
  }
  const typedInputs = inputs as ReproducibilityInputBinding[];
  const inputPaths = typedInputs.map((entry) => entry.path);
  if (new Set(inputPaths).size !== inputPaths.length
    || REQUIRED_INPUTS.some((required) => !inputPaths.includes(required))
    || !inputPaths.includes(`data/releases/${value.releaseVersion}/manifest.json`)
    || !inputPaths.includes(`data/curation/reports/image-embeddings/${value.releaseVersion}/promotion-anchor-set.json`)
    || !inputPaths.includes(`data/curation/reports/image-embeddings/${value.releaseVersion}/image-embedding-report.json`)) {
    return { reasons: ["Reproducibility input bindings do not contain the required release files."] };
  }
  const runtimeArtifacts = value.runtimeArtifacts;
  if (!exactKeys(runtimeArtifacts, ["model", "sourceCache"])) {
    return { reasons: ["Runtime artifact bindings are invalid."] };
  }
  const model = runtimeArtifacts.model;
  if (!exactKeys(model, ["id", "revision", "variant", "artifact", "sizeBytes", "checksum"])
    || !isNonEmptyString(model.id)
    || !isNonEmptyString(model.revision)
    || !isNonEmptyString(model.variant)
    || !isNonEmptyString(model.artifact)
    || !isSafeRelativePath(model.artifact)
    || !isNonNegativeInteger(model.sizeBytes)
    || model.sizeBytes === 0
    || !isChecksum(model.checksum)) {
    return { reasons: ["Model artifact binding is invalid."] };
  }
  const sourceCache = runtimeArtifacts.sourceCache;
  if (!exactKeys(sourceCache, ["schema", "fileCount", "aggregateAlgorithm", "aggregateChecksum", "committed"])
    || sourceCache.schema !== SOURCE_CACHE_SCHEMA
    || !isNonNegativeInteger(sourceCache.fileCount)
    || sourceCache.fileCount === 0
    || sourceCache.aggregateAlgorithm !== SOURCE_CACHE_AGGREGATE_ALGORITHM
    || !isChecksum(sourceCache.aggregateChecksum)
    || sourceCache.committed !== false) {
    return { reasons: ["Source cache binding is invalid."] };
  }
  const dependencies = value.resolvedDependencies;
  const dependencyKeys = ["@xenova/transformers", "sharp", "commander", "ipaddr.js"];
  if (!exactKeys(dependencies, dependencyKeys)
    || dependencyKeys.some((key) => typeof dependencies[key] !== "string" || !SEMVER.test(dependencies[key] as string))) {
    return { reasons: ["Resolved dependency binding is invalid."] };
  }
  if (!Array.isArray(value.runs) || value.runs.length !== REQUIRED_RUN_IDS.length) {
    return { reasons: ["Reproducibility run bindings are incomplete."] };
  }
  const runs = value.runs.map(parseRun);
  if (runs.some((entry) => entry === undefined)) {
    return { reasons: ["Reproducibility run binding is invalid."] };
  }
  const typedRuns = runs as ReproducibilityRunBinding[];
  const runIds = typedRuns.map((run) => run.id);
  if (new Set(runIds).size !== REQUIRED_RUN_IDS.length || REQUIRED_RUN_IDS.some((id) => !runIds.includes(id))) {
    return { reasons: ["Reproducibility run IDs are incomplete or duplicated."] };
  }
  const outputs = value.outputs;
  if (!exactKeys(outputs, ["candidate", "offlineReport"])) {
    return { reasons: ["Reproducibility outputs are invalid."] };
  }
  const candidate = outputs.candidate;
  if (!exactKeys(candidate, ["committed", "recordCount", "declaredChecksum", "bytesChecksum"])
    || candidate.committed !== false
    || !isNonNegativeInteger(candidate.recordCount)
    || candidate.recordCount === 0
    || !isChecksum(candidate.declaredChecksum)
    || !isChecksum(candidate.bytesChecksum)) {
    return { reasons: ["Candidate output binding is invalid."] };
  }
  const offlineReport = outputs.offlineReport;
  const controlledFailures = isRecord(offlineReport) ? parseControlledFailures(offlineReport.controlledFailures) : undefined;
  if (!exactKeys(offlineReport, ["bytesChecksum", "coverageReady", "controlledFailures"])
    || !isChecksum(offlineReport.bytesChecksum)
    || typeof offlineReport.coverageReady !== "boolean"
    || !controlledFailures) {
    return { reasons: ["Offline report binding is invalid."] };
  }
  const promotionState = value.promotionState;
  if (!exactKeys(promotionState, [
    "promotionReady",
    "task6Authorized",
    "artworkHoldoutAccuracy",
    "artworkHoldoutLowerConfidence",
    "sceneTop3HitRate",
    "sceneTop3LowerConfidence",
    "humanReviewCompleted",
    "humanReviewRequired",
  ])
    || typeof promotionState.promotionReady !== "boolean"
    || typeof promotionState.task6Authorized !== "boolean"
    || promotionState.task6Authorized !== promotionState.promotionReady
    || !isFiniteRatio(promotionState.artworkHoldoutAccuracy)
    || !isFiniteRatio(promotionState.artworkHoldoutLowerConfidence)
    || !isFiniteRatio(promotionState.sceneTop3HitRate)
    || !isFiniteRatio(promotionState.sceneTop3LowerConfidence)
    || !isNonNegativeInteger(promotionState.humanReviewCompleted)
    || !isNonNegativeInteger(promotionState.humanReviewRequired)
    || promotionState.humanReviewRequired === 0
    || promotionState.humanReviewCompleted > promotionState.humanReviewRequired) {
    return { reasons: ["Promotion state binding is invalid."] };
  }

  return {
    evidence: {
      schemaVersion: EVIDENCE_SCHEMA,
      releaseVersion: value.releaseVersion,
      generatedAt: value.generatedAt,
      execution: {
        commitSha: execution.commitSha,
        treeSha: execution.treeSha,
        trackedGitStatusBeforeRuns: "clean",
        untrackedPromotionArtifactsExcluded: true,
      },
      environment: {
        operatingSystem: environment.operatingSystem,
        architecture: environment.architecture,
        nodeVersion: environment.nodeVersion,
        pnpmVersion: environment.pnpmVersion,
      },
      inputs: typedInputs,
      runtimeArtifacts: {
        model: {
          id: model.id,
          revision: model.revision,
          variant: model.variant,
          artifact: model.artifact,
          sizeBytes: model.sizeBytes,
          checksum: model.checksum,
        },
        sourceCache: {
          schema: SOURCE_CACHE_SCHEMA,
          fileCount: sourceCache.fileCount,
          aggregateAlgorithm: SOURCE_CACHE_AGGREGATE_ALGORITHM,
          aggregateChecksum: sourceCache.aggregateChecksum,
          committed: false,
        },
      },
      resolvedDependencies: dependencies as ImageEmbeddingReproducibilityEvidence["resolvedDependencies"],
      runs: typedRuns,
      outputs: {
        candidate: {
          committed: false,
          recordCount: candidate.recordCount,
          declaredChecksum: candidate.declaredChecksum,
          bytesChecksum: candidate.bytesChecksum,
        },
        offlineReport: {
          bytesChecksum: offlineReport.bytesChecksum,
          coverageReady: offlineReport.coverageReady,
          controlledFailures,
        },
      },
      promotionState: promotionState as ImageEmbeddingReproducibilityEvidence["promotionState"],
    },
    reasons: [],
  };
}

function parseOfflineBuildManifest(value: unknown): ParseResult<OfflineBuildManifest> {
  if (!exactKeys(value, ["schemaVersion", "releaseVersion", "executionCommitSha", "inputs", "candidate", "report"])
    || value.schemaVersion !== OFFLINE_BUILD_MANIFEST_SCHEMA
    || !isNonEmptyString(value.releaseVersion)
    || typeof value.executionCommitSha !== "string"
    || !GIT_SHA.test(value.executionCommitSha)) {
    return { reasons: ["Offline build manifest does not match the exact v1 schema."] };
  }
  const inputs = value.inputs;
  if (!exactKeys(inputs, ["baseManifestChecksum", "promotionAnchorSetChecksum", "modelArtifactChecksum", "sourceCacheAggregateChecksum"])
    || !isChecksum(inputs.baseManifestChecksum)
    || !isChecksum(inputs.promotionAnchorSetChecksum)
    || !isChecksum(inputs.modelArtifactChecksum)
    || !isChecksum(inputs.sourceCacheAggregateChecksum)) {
    return { reasons: ["Offline build manifest input bindings are invalid."] };
  }
  const candidate = value.candidate;
  if (!exactKeys(candidate, ["recordCount", "sizeBytes", "declaredChecksum", "bytesChecksum"])
    || !isNonNegativeInteger(candidate.recordCount)
    || candidate.recordCount === 0
    || !isNonNegativeInteger(candidate.sizeBytes)
    || candidate.sizeBytes === 0
    || !isChecksum(candidate.declaredChecksum)
    || !isChecksum(candidate.bytesChecksum)) {
    return { reasons: ["Offline build manifest candidate binding is invalid."] };
  }
  const report = value.report;
  const failures = isRecord(report) ? parseControlledFailures(report.controlledFailures) : undefined;
  if (!exactKeys(report, ["bytesChecksum", "coverageReady", "controlledFailures"])
    || !isChecksum(report.bytesChecksum)
    || typeof report.coverageReady !== "boolean"
    || !failures) {
    return { reasons: ["Offline build manifest report binding is invalid."] };
  }
  return {
    value: {
      schemaVersion: OFFLINE_BUILD_MANIFEST_SCHEMA,
      releaseVersion: value.releaseVersion,
      executionCommitSha: value.executionCommitSha,
      inputs: inputs as OfflineBuildManifest["inputs"],
      candidate: candidate as OfflineBuildManifest["candidate"],
      report: { bytesChecksum: report.bytesChecksum, coverageReady: report.coverageReady, controlledFailures: failures },
    },
    reasons: [],
  };
}

function parseBundle(value: unknown): ParseResult<ReproducibilityBundle> {
  if (!exactKeys(value, ["schemaVersion", "releaseVersion", "evidence", "offlineBuildManifest", "artifactRetention"])
    || value.schemaVersion !== BUNDLE_SCHEMA
    || !isNonEmptyString(value.releaseVersion)) {
    return { reasons: ["Reproducibility bundle does not match the exact v1 schema."] };
  }
  const evidence = parseBinding(value.evidence, { allowDotRelative: true });
  const offlineBuildManifest = parseBinding(value.offlineBuildManifest, { allowDotRelative: true });
  if (!evidence || !offlineBuildManifest) {
    return { reasons: ["Reproducibility bundle file bindings are invalid."] };
  }
  const retention = value.artifactRetention;
  if (!exactKeys(retention, ["status", "task7Ready", "immutableArtifacts"])
    || (retention.status !== "local-only" && retention.status !== "immutable-storage")
    || typeof retention.task7Ready !== "boolean"
    || !Array.isArray(retention.immutableArtifacts)) {
    return { reasons: ["Artifact retention binding is invalid."] };
  }
  const artifacts: ReproducibilityBundle["artifactRetention"]["immutableArtifacts"] = [];
  for (const artifact of retention.immutableArtifacts) {
    if (!exactKeys(artifact, ["kind", "uri", "sizeBytes", "checksum"])
      || !["model", "source-cache", "candidate", "offline-report"].includes(artifact.kind as string)
      || !isNonEmptyString(artifact.uri)
      || !/^https:\/\//u.test(artifact.uri)
      || !isNonNegativeInteger(artifact.sizeBytes)
      || artifact.sizeBytes === 0
      || !isChecksum(artifact.checksum)) {
      return { reasons: ["Immutable artifact storage binding is invalid."] };
    }
    artifacts.push(artifact as ReproducibilityBundle["artifactRetention"]["immutableArtifacts"][number]);
  }
  const expectedKinds = ["model", "source-cache", "candidate", "offline-report"];
  const kinds = artifacts.map((artifact) => artifact.kind);
  const task7Ready = retention.status === "immutable-storage"
    && expectedKinds.every((kind) => kinds.includes(kind as typeof artifacts[number]["kind"]))
    && new Set(kinds).size === expectedKinds.length;
  if (retention.task7Ready !== task7Ready) {
    return { reasons: ["Artifact retention task7Ready does not match immutable storage coverage."] };
  }
  return {
    value: {
      schemaVersion: BUNDLE_SCHEMA,
      releaseVersion: value.releaseVersion,
      evidence,
      offlineBuildManifest,
      artifactRetention: {
        status: retention.status,
        task7Ready,
        immutableArtifacts: artifacts,
      },
    },
    reasons: [],
  };
}

function readStrictJson<T>(filePath: string, parser: (value: unknown) => ParseResult<T>): ParseResult<T> {
  try {
    return parser(JSON.parse(readFileSync(filePath, "utf8")) as unknown);
  } catch {
    return { reasons: [`File is missing, unreadable, or invalid JSON: ${filePath}.`] };
  }
}

function resolveBoundFile(rootDir: string, bindingDir: string, binding: ReproducibilityInputBinding, reasons: string[], label: string): string | undefined {
  const target = path.resolve(bindingDir, binding.path);
  if (!isInside(rootDir, target)) {
    reasons.push(`${label} path escapes the repository.`);
    return undefined;
  }
  try {
    if (sha256(readFileSync(target)) !== binding.checksum) {
      reasons.push(`${label} checksum does not match.`);
    }
  } catch {
    reasons.push(`${label} is missing or unreadable.`);
  }
  return target;
}

function gitOutput(rootDir: string, args: string[]): string | undefined {
  try {
    return execFileSync("git", args, { cwd: rootDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return undefined;
  }
}

function packageManifestMatchesAfterVerifierAddition(
  inputPath: string,
  committedBytes: Buffer,
  currentBytes: Buffer,
): boolean {
  const expectedScript = inputPath === "package.json"
    ? ["image-embeddings:verify-reproducibility", "pnpm --filter @artduo/pipeline verify:image-embedding-reproducibility"]
    : inputPath === "apps/pipeline/package.json"
      ? ["verify:image-embedding-reproducibility", "pnpm run workspace:prepare && tsx src/verify-image-embedding-reproducibility.ts"]
      : undefined;
  if (!expectedScript) {
    return false;
  }
  try {
    const committed = JSON.parse(committedBytes.toString("utf8")) as unknown;
    const current = JSON.parse(currentBytes.toString("utf8")) as unknown;
    if (!isRecord(committed) || !isRecord(current) || !isRecord(committed.scripts) || !isRecord(current.scripts)) {
      return false;
    }
    const [scriptName, scriptCommand] = expectedScript;
    if (current.scripts[scriptName] !== scriptCommand || Object.hasOwn(committed.scripts, scriptName)) {
      return false;
    }
    const normalizedCurrent = structuredClone(current);
    if (!isRecord(normalizedCurrent.scripts)) {
      return false;
    }
    delete normalizedCurrent.scripts[scriptName];
    if (Object.keys(normalizedCurrent.scripts).length === 0 && !Object.hasOwn(committed, "scripts")) {
      delete normalizedCurrent.scripts;
    }
    return JSON.stringify(normalizedCurrent) === JSON.stringify(committed);
  } catch {
    return false;
  }
}

function verifyGitBinding(
  rootDir: string,
  evidence: ImageEmbeddingReproducibilityEvidence,
  reasons: string[],
): void {
  const commit = gitOutput(rootDir, ["rev-parse", `${evidence.execution.commitSha}^{commit}`]);
  if (commit !== evidence.execution.commitSha) {
    reasons.push("Execution commit does not exist in the current repository.");
    return;
  }
  const tree = gitOutput(rootDir, ["rev-parse", `${evidence.execution.commitSha}^{tree}`]);
  if (tree !== evidence.execution.treeSha) {
    reasons.push("Execution tree checksum does not match the evidence commit.");
  }
  const head = gitOutput(rootDir, ["rev-parse", "HEAD"]);
  if (!head || gitOutput(rootDir, ["merge-base", "--is-ancestor", evidence.execution.commitSha, head]) === undefined) {
    reasons.push("Execution commit is not an ancestor of the current HEAD.");
  }
  const trackedStatus = gitOutput(rootDir, ["status", "--porcelain", "--untracked-files=no"]);
  if (trackedStatus === undefined || trackedStatus.length > 0) {
    reasons.push("Current tracked worktree is not clean.");
  }
}

function verifyInputBindings(rootDir: string, evidence: ImageEmbeddingReproducibilityEvidence, reasons: string[]): void {
  for (const input of evidence.inputs) {
    let committedBytes: Buffer;
    try {
      committedBytes = execFileSync("git", ["show", `${evidence.execution.commitSha}:${input.path}`], {
        cwd: rootDir,
        stdio: ["ignore", "pipe", "ignore"],
      });
      if (sha256(committedBytes) !== input.checksum) {
        reasons.push(`Committed input checksum does not match: ${input.path}.`);
      }
    } catch {
      reasons.push(`Committed input is missing: ${input.path}.`);
      continue;
    }
    try {
      const currentBytes = readFileSync(path.join(rootDir, input.path));
      if (sha256(currentBytes) !== input.checksum
        && !packageManifestMatchesAfterVerifierAddition(input.path, committedBytes, currentBytes)) {
        reasons.push(`Current input checksum does not match: ${input.path}.`);
      }
    } catch {
      reasons.push(`Current input is missing or unreadable: ${input.path}.`);
    }
  }
}

function walkFiles(rootDir: string, currentDir = rootDir): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(currentDir, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    const target = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(rootDir, target));
    } else if (entry.isFile()) {
      files.push(path.relative(rootDir, target).split(path.sep).join("/"));
    }
  }
  return files;
}

export function calculateImageSourceCacheAggregate(rootDir: string): { fileCount: number; checksum: Checksum } {
  const files = walkFiles(rootDir);
  const index = files.map((relativePath) => {
    const fileChecksum = sha256(readFileSync(path.join(rootDir, relativePath))).slice("sha256:".length);
    return `${fileChecksum}  ${relativePath}\n`;
  }).join("");
  return { fileCount: files.length, checksum: sha256(index) };
}

function verifyLogs(rootDir: string, evidence: ImageEmbeddingReproducibilityEvidence, reasons: string[]): void {
  for (const run of evidence.runs) {
    const logPath = path.join(rootDir, run.log.path);
    let bytes: Buffer;
    try {
      bytes = readFileSync(logPath);
    } catch {
      reasons.push(`Run log is missing or unreadable: ${run.id}.`);
      continue;
    }
    if (sha256(bytes) !== run.log.checksum) {
      reasons.push(`Run log checksum does not match: ${run.id}.`);
      continue;
    }
    const text = bytes.toString("utf8");
    if (!text.includes(`command: ${run.command}\n`)
      || !text.includes(`executionCommitSha: ${evidence.execution.commitSha}\n`)
      || !text.includes("trackedGitStatus: clean\n")
      || !/exitCode: 0\n$/u.test(text)) {
      reasons.push(`Run log semantic binding is invalid: ${run.id}.`);
    }
  }
}

function readBuildReport(
  rootDir: string,
  evidence: ImageEmbeddingReproducibilityEvidence,
  reasons: string[],
): { value: Record<string, unknown>; checksum: Checksum } | undefined {
  const reportPath = `data/curation/reports/image-embeddings/${evidence.releaseVersion}/image-embedding-report.json`;
  try {
    const bytes = readFileSync(path.join(rootDir, reportPath));
    const value = JSON.parse(bytes.toString("utf8")) as unknown;
    if (!isRecord(value)) {
      reasons.push("Image embedding build report is not an object.");
      return undefined;
    }
    return { value, checksum: sha256(bytes) };
  } catch {
    reasons.push("Image embedding build report is missing or invalid JSON.");
    return undefined;
  }
}

function inputChecksum(evidence: ImageEmbeddingReproducibilityEvidence, suffix: string): Checksum | undefined {
  return evidence.inputs.find((input) => input.path.endsWith(suffix))?.checksum;
}

function sameFailures(left: ControlledFailure[], right: ControlledFailure[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function verifyImageEmbeddingReproducibility(
  options: ImageEmbeddingReproducibilityVerificationOptions,
): Promise<ImageEmbeddingReproducibilityVerificationResult> {
  const rootDir = path.resolve(options.rootDir);
  const bundlePath = path.resolve(options.bundlePath);
  const reasons: string[] = [];
  if (!isInside(rootDir, bundlePath)) {
    return { valid: false, task7ArtifactReady: false, reasons: ["Reproducibility bundle path escapes the repository."] };
  }
  const bundleResult = readStrictJson(bundlePath, parseBundle);
  if (!bundleResult.value) {
    return { valid: false, task7ArtifactReady: false, reasons: bundleResult.reasons };
  }
  const bundle = bundleResult.value;
  const bundleDir = path.dirname(bundlePath);
  const evidencePath = resolveBoundFile(rootDir, bundleDir, bundle.evidence, reasons, "Evidence envelope");
  const offlineManifestPath = resolveBoundFile(rootDir, bundleDir, bundle.offlineBuildManifest, reasons, "Offline build manifest");
  if (!evidencePath || !offlineManifestPath) {
    return { valid: false, task7ArtifactReady: bundle.artifactRetention.task7Ready, reasons };
  }
  const evidenceResult = readStrictJson(evidencePath, (value) => {
    const parsed = parseImageEmbeddingReproducibilityEvidence(value);
    return { value: parsed.evidence, reasons: parsed.reasons };
  });
  const offlineResult = readStrictJson(offlineManifestPath, parseOfflineBuildManifest);
  if (!evidenceResult.value || !offlineResult.value) {
    reasons.push(...evidenceResult.reasons, ...offlineResult.reasons);
    return { valid: false, task7ArtifactReady: bundle.artifactRetention.task7Ready, reasons };
  }
  const evidence = evidenceResult.value;
  const offlineManifest = offlineResult.value;
  if (bundle.releaseVersion !== evidence.releaseVersion || bundle.releaseVersion !== offlineManifest.releaseVersion) {
    reasons.push("Release version differs across reproducibility bundle files.");
  }
  verifyGitBinding(rootDir, evidence, reasons);
  verifyInputBindings(rootDir, evidence, reasons);
  verifyLogs(rootDir, evidence, reasons);

  if (options.verifyResolvedDependencies ?? true) {
    try {
      const rootRequire = createRequire(path.join(rootDir, "package.json"));
      const pipelineRequire = createRequire(path.join(rootDir, "apps", "pipeline", "package.json"));
      const transformersPackagePath = rootRequire.resolve("@xenova/transformers/package.json");
      const transformersRequire = createRequire(transformersPackagePath);
      const dependencyPaths: Record<keyof ImageEmbeddingReproducibilityEvidence["resolvedDependencies"], string> = {
        "@xenova/transformers": transformersPackagePath,
        sharp: transformersRequire.resolve("sharp/package.json"),
        commander: path.join(path.dirname(rootRequire.resolve("commander")), "package.json"),
        "ipaddr.js": pipelineRequire.resolve("ipaddr.js/package.json"),
      };
      for (const [dependency, packagePath] of Object.entries(dependencyPaths)) {
        try {
          const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as unknown;
          if (!isRecord(packageJson) || packageJson.version !== evidence.resolvedDependencies[dependency as keyof typeof dependencyPaths]) {
            reasons.push(`Resolved dependency version does not match: ${dependency}.`);
          }
        } catch {
          reasons.push(`Resolved dependency is missing or unreadable: ${dependency}.`);
        }
      }
    } catch {
      reasons.push("Resolved dependency tree could not be inspected.");
    }
  }

  try {
    const modelSize = statSync(options.modelArtifactPath).size;
    if (modelSize !== evidence.runtimeArtifacts.model.sizeBytes
      || sha256(readFileSync(options.modelArtifactPath)) !== evidence.runtimeArtifacts.model.checksum) {
      reasons.push("Model artifact size or checksum does not match.");
    }
  } catch {
    reasons.push("Model artifact is missing or unreadable.");
  }
  try {
    const aggregate = calculateImageSourceCacheAggregate(options.sourceCacheRoot);
    if (aggregate.fileCount !== evidence.runtimeArtifacts.sourceCache.fileCount
      || aggregate.checksum !== evidence.runtimeArtifacts.sourceCache.aggregateChecksum) {
      reasons.push("Source cache file count or aggregate checksum does not match.");
    }
  } catch {
    reasons.push("Source cache is missing or unreadable.");
  }

  const candidatePath = path.resolve(options.candidatePath ?? path.join(
    rootDir,
    "data",
    "curation",
    "reports",
    "image-embeddings",
    evidence.releaseVersion,
    "candidates",
    "image-embeddings-01.json",
  ));
  let candidateSize = 0;
  try {
    const candidateBytes = readFileSync(candidatePath);
    candidateSize = candidateBytes.byteLength;
    if (sha256(candidateBytes) !== evidence.outputs.candidate.bytesChecksum) {
      reasons.push("Candidate bytes checksum does not match.");
    }
    const candidateValue = JSON.parse(candidateBytes.toString("utf8")) as unknown;
    const records = parseImageEmbeddingShardRecords(candidateValue, candidatePath);
    if (records.length !== evidence.outputs.candidate.recordCount
      || sha256(JSON.stringify(candidateValue, null, 2)) !== evidence.outputs.candidate.declaredChecksum) {
      reasons.push("Candidate record count or canonical checksum does not match.");
    }
  } catch {
    reasons.push("Candidate is missing, unreadable, or invalid.");
  }

  const buildReportResult = readBuildReport(rootDir, evidence, reasons);
  const buildReport = buildReportResult?.value;
  const reportCandidate = buildReport?.candidateShard;
  const reportGates = buildReport?.gates;
  if (buildReport) {
    if (buildReport.releaseVersion !== evidence.releaseVersion
      || buildReportResult.checksum !== inputChecksum(evidence, `data/curation/reports/image-embeddings/${evidence.releaseVersion}/image-embedding-report.json`)
      || buildReport.baseManifestChecksum !== inputChecksum(evidence, `data/releases/${evidence.releaseVersion}/manifest.json`)
      || buildReport.promotionAnchorSetChecksum !== inputChecksum(evidence, `data/curation/reports/image-embeddings/${evidence.releaseVersion}/promotion-anchor-set.json`)
      || buildReport.model !== evidence.runtimeArtifacts.model.id
      || buildReport.modelRevision !== evidence.runtimeArtifacts.model.revision
      || buildReport.modelVariant !== evidence.runtimeArtifacts.model.variant
      || buildReport.modelArtifactChecksum !== evidence.runtimeArtifacts.model.checksum
      || !isRecord(reportCandidate)
      || reportCandidate.recordCount !== evidence.outputs.candidate.recordCount
      || reportCandidate.sizeBytes !== candidateSize
      || reportCandidate.checksum !== evidence.outputs.candidate.declaredChecksum
      || !isRecord(reportGates)
      || typeof reportGates.coverageReady !== "boolean") {
      reasons.push("Tracked build report does not match release, runtime, candidate, or coverage bindings.");
    }
  }

  if (offlineManifest.executionCommitSha !== evidence.execution.commitSha
    || offlineManifest.inputs.baseManifestChecksum !== inputChecksum(evidence, `data/releases/${evidence.releaseVersion}/manifest.json`)
    || offlineManifest.inputs.promotionAnchorSetChecksum !== inputChecksum(evidence, `data/curation/reports/image-embeddings/${evidence.releaseVersion}/promotion-anchor-set.json`)
    || offlineManifest.inputs.modelArtifactChecksum !== evidence.runtimeArtifacts.model.checksum
    || offlineManifest.inputs.sourceCacheAggregateChecksum !== evidence.runtimeArtifacts.sourceCache.aggregateChecksum
    || offlineManifest.candidate.recordCount !== evidence.outputs.candidate.recordCount
    || offlineManifest.candidate.sizeBytes !== candidateSize
    || offlineManifest.candidate.declaredChecksum !== evidence.outputs.candidate.declaredChecksum
    || offlineManifest.candidate.bytesChecksum !== evidence.outputs.candidate.bytesChecksum
    || offlineManifest.report.bytesChecksum !== evidence.outputs.offlineReport.bytesChecksum
    || offlineManifest.report.coverageReady !== evidence.outputs.offlineReport.coverageReady
    || !sameFailures(offlineManifest.report.controlledFailures, evidence.outputs.offlineReport.controlledFailures)) {
    reasons.push("Offline build manifest does not match the evidence inputs or outputs.");
  }

  const offlineLog = evidence.runs.find((run) => run.id === "offline-shadow-rebuild");
  if (offlineLog) {
    try {
      const text = readFileSync(path.join(rootDir, offlineLog.log.path), "utf8");
      const requiredLines = [
        `candidateDeclaredChecksum: ${offlineManifest.candidate.declaredChecksum}`,
        `candidateBytesChecksum: ${offlineManifest.candidate.bytesChecksum}`,
        `candidateRecordCount: ${offlineManifest.candidate.recordCount}`,
        `reportBytesChecksum: ${offlineManifest.report.bytesChecksum}`,
        `coverageReady: ${offlineManifest.report.coverageReady}`,
      ];
      if (requiredLines.some((line) => !text.includes(`${line}\n`))) {
        reasons.push("Offline build log does not match the checksummed build manifest.");
      }
    } catch {
      // The generic log verifier already reports this condition.
    }
  }

  return {
    valid: reasons.length === 0,
    task7ArtifactReady: bundle.artifactRetention.task7Ready,
    reasons,
  };
}
