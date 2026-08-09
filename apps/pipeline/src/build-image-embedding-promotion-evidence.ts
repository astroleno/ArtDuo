import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  constants as fsConstants,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  parseImageEmbeddingA2aCaseSetRunnerArtifact,
  parseImageEmbeddingA2aReplayRunnerArtifact,
  parseImageEmbeddingFusionPlaywrightRunnerArtifact,
  parseImageEmbeddingPlaywrightRunnerArtifact,
  parseImageEmbeddingTextBenchmarkRunnerArtifact,
  type ImageEmbeddingEvidenceRunnerArtifacts,
  type ImageEmbeddingFusionPromotionInputBinding,
  type ImageEmbeddingFusionPlaywrightRunnerArtifact,
  type ImageEmbeddingRunnerArtifactParseResult,
} from "./image-embedding-evidence-artifacts";
import {
  imageEmbeddingEvidencePreflightEnvironment,
  validateImageEmbeddingA2aEvidence,
  validateImageEmbeddingE2eEvidence,
  validateImageEmbeddingFusionE2eEvidence,
  validateImageEmbeddingTextBenchmarkEvidence,
  type ImageEmbeddingEvidenceCaseSet,
  type ImageEmbeddingEvidenceContext,
  type ImageEmbeddingEvidencePreflight,
  type ImageEmbeddingEvidenceRunnerArtifactChecksums,
  type ImageEmbeddingEvidenceSuiteBindings,
} from "./image-embedding-promotion-evidence";
import { readImageEmbeddingEvidenceSuiteManifest } from "./image-embedding-evidence-suite-manifest";
import { readImageEmbeddingPromotionEvidenceBuildOptions } from "./cli";

type EvidenceKind = "text-benchmark" | "a2a" | "e2e" | "fusion-e2e";

export interface ImageEmbeddingPromotionEvidenceBuildOptions {
  rootDir?: string;
  releaseVersion?: string;
  manifestPath?: string;
  promotionAnchorPath?: string;
  outputPath?: string;
  textBenchmarkRunnerArtifactPath?: string;
  a2aCaseSetRunnerArtifactPath?: string;
  a2aReplayRunnerArtifactPath?: string;
  e2eRunnerArtifactPath?: string;
  fusionE2eRunnerArtifactOutputPath?: string;
  fusionCandidateShardPath?: string;
  fusionPromotionReportPath?: string;
  promotionBindingChecksum?: string;
  /** Internal test seam; the production CLI executes the preflight command itself. */
  preflightCheck?: () => ImageEmbeddingEvidencePreflight;
  /** Internal test seam; the production CLI executes the frozen Fusion E2E suite itself. */
  fusionE2eCheck?: (input: ImageEmbeddingFusionE2eRunInput) => { command: "pnpm test:e2e:fusion"; exitCode: number };
}

export interface ImageEmbeddingFusionE2eRunInput {
  artifactPath: string;
  baseManifestPath: string;
  candidateShardPath: string;
  promotionReportPath: string;
  binding: ImageEmbeddingFusionPromotionInputBinding;
}

export interface ImageEmbeddingPromotionEvidenceBuildResult {
  kind: EvidenceKind;
  outputPath: string;
  checksum: `sha256:${string}`;
}

const CHECKSUM = /^sha256:[a-f0-9]{64}$/u;
const COMMIT_SHA = /^[a-f0-9]{40}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sha256Checksum(value: Uint8Array | string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Promotion binding canonical JSON does not permit non-finite numbers.");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  throw new TypeError("Promotion binding payload is not canonical JSON.");
}

function numberMeets(value: unknown, predicate: (value: number) => boolean): boolean {
  return typeof value === "number" && Number.isFinite(value) && predicate(value);
}

function promotionPayloadIsReady(payload: Record<string, unknown>): boolean {
  const gates = isRecord(payload.gateEvidence) ? payload.gateEvidence : undefined;
  const artwork = gates && isRecord(gates.artworkHoldout) ? gates.artworkHoldout : undefined;
  const scene = gates && isRecord(gates.sceneHoldout) ? gates.sceneHoldout : undefined;
  const human = gates && isRecord(gates.humanReview) ? gates.humanReview : undefined;
  return gates?.bindingIntegrity === true
    && gates.buildCoverageReady === true
    && artwork?.minimumSampleMet === true
    && artwork.allStrataSufficient === true
    && numberMeets(artwork.pointEstimate, (value) => value >= 0.8)
    && numberMeets(artwork.lowerConfidence, (value) => value >= 0.7)
    && scene?.minimumSampleMet === true
    && scene.allStrataSufficient === true
    && numberMeets(scene.pointEstimate, (value) => value >= 0.7)
    && numberMeets(scene.lowerConfidence, (value) => value >= 0.6)
    && gates.reviewPackReady === true
    && human?.valid === true
    && human.complete === true
    && numberMeets(human.completedCount, (value) => value >= 30)
    && numberMeets(human.uncertainRate, (value) => value <= 0.1)
    && numberMeets(human.candidateAcceptableRate, (value) => value >= 0.8)
    && numberMeets(human.candidateRegressionRate, (value) => value <= 0.1)
    && gates.baselineBindingsReady === true
    && gates.visualPolicySelectionReady === true;
}

function readJsonBytes(filePath: string, label: string): { bytes: Buffer; value: unknown } {
  try {
    const bytes = readFileSync(filePath);
    return { bytes, value: JSON.parse(bytes.toString("utf8")) as unknown };
  } catch {
    throw new TypeError(`${label} could not be read as JSON.`);
  }
}

function resolveFusionPromotionInputs(
  options: ImageEmbeddingPromotionEvidenceBuildOptions,
  release: { releaseVersion: string; manifestPath: string; baseManifestChecksum: `sha256:${string}` },
): Omit<ImageEmbeddingFusionE2eRunInput, "artifactPath"> {
  const candidateShardPath = path.resolve(options.fusionCandidateShardPath!);
  const promotionReportPath = path.resolve(options.fusionPromotionReportPath!);
  const candidate = readJsonBytes(candidateShardPath, "Fusion candidate shard");
  if (!Array.isArray(candidate.value) || candidate.value.length === 0) {
    throw new TypeError("Fusion candidate shard must be a non-empty JSON array.");
  }
  const candidateShardChecksum = sha256Checksum(JSON.stringify(candidate.value, null, 2));
  const report = readJsonBytes(promotionReportPath, "Task 5 promotion report");
  if (!isRecord(report.value)
    || report.value.schemaVersion !== "image-embedding-evaluation-report.v1"
    || report.value.releaseVersion !== release.releaseVersion
    || !isRecord(report.value.promotionBindingPayload)
    || !isRecord(report.value.promotionBinding)) {
    throw new TypeError("Task 5 promotion report schema or release binding is invalid.");
  }
  const payload = report.value.promotionBindingPayload;
  const promotionBinding = report.value.promotionBinding;
  const promotionBindingChecksum = sha256Checksum(canonicalJson(payload));
  if (promotionBinding.promotionReady !== true
    || promotionBinding.fusionVerificationReady !== false
    || promotionBinding.promotionBindingChecksum !== promotionBindingChecksum
    || options.promotionBindingChecksum !== promotionBindingChecksum) {
    throw new TypeError("Task 5 promotion report is not a verified promotion-ready decision.");
  }
  if (!promotionPayloadIsReady(payload)) {
    throw new TypeError("Task 5 promotionReady=true does not match the canonical Task 5 gates.");
  }
  for (const [field, expected] of [
    ["releaseVersion", release.releaseVersion],
    ["baseManifestChecksum", release.baseManifestChecksum],
    ["candidateShardChecksum", candidateShardChecksum],
  ] as const) {
    if (payload[field] !== expected || promotionBinding[field] !== expected) {
      throw new TypeError(`Task 5 promotion report ${field} does not match the producer-selected input.`);
    }
  }
  return {
    baseManifestPath: release.manifestPath,
    candidateShardPath,
    promotionReportPath,
    binding: {
      releaseVersion: release.releaseVersion,
      baseManifestChecksum: release.baseManifestChecksum,
      candidateShardChecksum,
      promotionReportChecksum: sha256Checksum(report.bytes),
      promotionBindingChecksum,
    },
  };
}

function resolveRootDir(rootDir?: string): string {
  return rootDir ? path.resolve(rootDir) : path.resolve(process.cwd(), "../..");
}

function resolveReleaseInput(options: ImageEmbeddingPromotionEvidenceBuildOptions, rootDir: string): {
  releaseVersion: string;
  manifestPath: string;
  baseManifestChecksum: `sha256:${string}`;
} {
  const manifestPath = options.manifestPath
    ? path.resolve(options.manifestPath)
    : options.releaseVersion
      ? path.join(rootDir, "data", "releases", options.releaseVersion, "manifest.json")
      : undefined;
  if (!manifestPath) {
    throw new TypeError("Promotion evidence requires --release-version or --manifest.");
  }
  let manifest: unknown;
  let bytes: Buffer;
  try {
    bytes = readFileSync(manifestPath);
    manifest = JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw new TypeError("Promotion evidence manifest could not be read as JSON.");
  }
  if (!isRecord(manifest) || !isRecord(manifest.release) || typeof manifest.release.corpusVersion !== "string"
    || !manifest.release.corpusVersion.trim()) {
    throw new TypeError("Promotion evidence manifest does not declare release.corpusVersion.");
  }
  const releaseVersion = manifest.release.corpusVersion;
  if (options.releaseVersion && options.releaseVersion !== releaseVersion) {
    throw new TypeError("Promotion evidence release version does not match the manifest.");
  }
  return { releaseVersion, manifestPath, baseManifestChecksum: sha256Checksum(bytes) };
}

function resolveCleanCommitSha(rootDir: string): string {
  try {
    const commitSha = execFileSync("git", ["-C", rootDir, "rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (!COMMIT_SHA.test(commitSha)) {
      throw new TypeError("Promotion evidence Git HEAD is malformed.");
    }
    const diff = spawnSync("git", ["-C", rootDir, "diff", "--quiet", "--ignore-submodules", "HEAD", "--"], {
      stdio: "ignore",
    });
    if (diff.status !== 0) {
      throw new TypeError("Promotion evidence must be generated from a clean tracked Git tree.");
    }
    return commitSha;
  } catch (error) {
    if (error instanceof TypeError) {
      throw error;
    }
    throw new TypeError("Promotion evidence requires a clean Git checkout with a resolvable HEAD.");
  }
}

function readEvidenceSuites(rootDir: string, anchorPath: string, releaseVersion: string): ImageEmbeddingEvidenceSuiteBindings {
  const parsed = readImageEmbeddingEvidenceSuiteManifest({ rootDir, anchorPath, releaseVersion });
  if (!parsed.bindings || parsed.reasons.length > 0) {
    throw new TypeError(parsed.reasons.join(" ") || "Promotion anchor evidence suites are invalid.");
  }
  return parsed.bindings;
}

function determineKind(options: ImageEmbeddingPromotionEvidenceBuildOptions): EvidenceKind {
  const text = Boolean(options.textBenchmarkRunnerArtifactPath);
  const a2aCaseSet = Boolean(options.a2aCaseSetRunnerArtifactPath);
  const a2aReplay = Boolean(options.a2aReplayRunnerArtifactPath);
  const e2e = Boolean(options.e2eRunnerArtifactPath);
  const fusion = Boolean(options.fusionE2eRunnerArtifactOutputPath);
  if (text && !a2aCaseSet && !a2aReplay && !e2e && !fusion) {
    return "text-benchmark";
  }
  if (!text && a2aCaseSet && a2aReplay && !e2e && !fusion) {
    return "a2a";
  }
  if (!text && !a2aCaseSet && !a2aReplay && e2e && !fusion) {
    return "e2e";
  }
  if (!text && !a2aCaseSet && !a2aReplay && !e2e && fusion) {
    if (!options.promotionBindingChecksum || !CHECKSUM.test(options.promotionBindingChecksum)) {
      throw new TypeError("Fusion promotion evidence requires a valid --promotion-binding-checksum.");
    }
    if (!options.fusionCandidateShardPath || !options.fusionPromotionReportPath) {
      throw new TypeError("Fusion promotion evidence requires explicit Task 5 candidate and promotion report paths.");
    }
    return "fusion-e2e";
  }
  throw new TypeError("Build exactly one evidence kind at a time: text, paired A2A, E2E, or fusion E2E.");
}

function readRunnerArtifact<T>(
  filePath: string,
  label: string,
  parser: (value: unknown) => ImageEmbeddingRunnerArtifactParseResult<T>,
): { artifact: T; checksum: `sha256:${string}` } {
  let bytes: Buffer;
  let value: unknown;
  try {
    bytes = readFileSync(path.resolve(filePath));
    value = JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw new TypeError(`${label} runner artifact could not be read as JSON.`);
  }
  const parsed = parser(value);
  if (!parsed.artifact || parsed.reasons.length > 0) {
    throw new TypeError(`${label} runner artifact is invalid: ${parsed.reasons.join(" ")}`);
  }
  return { artifact: parsed.artifact, checksum: sha256Checksum(bytes) };
}

function runPreflight(rootDir: string): ImageEmbeddingEvidencePreflight {
  const result = spawnSync("pnpm", ["preflight:check"], {
    cwd: rootDir,
    env: imageEmbeddingEvidencePreflightEnvironment(),
    stdio: "ignore",
  });
  return {
    command: "pnpm preflight:check",
    exitCode: typeof result.status === "number" ? result.status : 1,
  };
}

const FUSION_E2E_OVERRIDE_KEYS = [
  "ARTDUO_FUSION_E2E_BASE_MANIFEST",
  "ARTDUO_FUSION_E2E_CANDIDATE_SHARD",
  "ARTDUO_FUSION_E2E_PROMOTION_REPORT",
  "ARTDUO_FUSION_E2E_RELEASE_VERSION",
  "ARTDUO_FUSION_E2E_LOCKED_BASE_MANIFEST",
  "ARTDUO_FUSION_E2E_LOCKED_CANDIDATE_SHARD",
  "ARTDUO_FUSION_E2E_LOCKED_PROMOTION_REPORT",
  "ARTDUO_FUSION_E2E_LOCKED_RELEASE_VERSION",
  "ARTDUO_FUSION_E2E_LOCKED_BASE_MANIFEST_CHECKSUM",
  "ARTDUO_FUSION_E2E_LOCKED_CANDIDATE_SHARD_CHECKSUM",
  "ARTDUO_FUSION_E2E_LOCKED_PROMOTION_REPORT_CHECKSUM",
  "ARTDUO_FUSION_E2E_LOCKED_PROMOTION_BINDING_CHECKSUM",
] as const;

export function imageEmbeddingFusionE2eEnvironment(
  input: ImageEmbeddingFusionE2eRunInput,
  environment: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const result = { ...environment };
  for (const key of FUSION_E2E_OVERRIDE_KEYS) {
    delete result[key];
  }
  return {
    ...result,
    CI: "1",
    PLAYWRIGHT_JSON_OUTPUT_FILE: input.artifactPath,
    ARTDUO_FUSION_E2E_LOCKED_BASE_MANIFEST: input.baseManifestPath,
    ARTDUO_FUSION_E2E_LOCKED_CANDIDATE_SHARD: input.candidateShardPath,
    ARTDUO_FUSION_E2E_LOCKED_PROMOTION_REPORT: input.promotionReportPath,
    ARTDUO_FUSION_E2E_LOCKED_RELEASE_VERSION: input.binding.releaseVersion,
    ARTDUO_FUSION_E2E_LOCKED_BASE_MANIFEST_CHECKSUM: input.binding.baseManifestChecksum,
    ARTDUO_FUSION_E2E_LOCKED_CANDIDATE_SHARD_CHECKSUM: input.binding.candidateShardChecksum,
    ARTDUO_FUSION_E2E_LOCKED_PROMOTION_REPORT_CHECKSUM: input.binding.promotionReportChecksum,
    ARTDUO_FUSION_E2E_LOCKED_PROMOTION_BINDING_CHECKSUM: input.binding.promotionBindingChecksum,
  };
}

function runFusionE2e(rootDir: string, input: ImageEmbeddingFusionE2eRunInput): { command: "pnpm test:e2e:fusion"; exitCode: number } {
  const result = spawnSync("pnpm", ["test:e2e:fusion"], {
    cwd: rootDir,
    env: imageEmbeddingFusionE2eEnvironment(input),
    stdio: "inherit",
  });
  return {
    command: "pnpm test:e2e:fusion",
    exitCode: typeof result.status === "number" ? result.status : 1,
  };
}

function produceFreshFusionRunnerArtifact(
  rootDir: string,
  outputPath: string,
  promotionInputs: Omit<ImageEmbeddingFusionE2eRunInput, "artifactPath">,
  check?: (input: ImageEmbeddingFusionE2eRunInput) => { command: "pnpm test:e2e:fusion"; exitCode: number },
): { artifact: ImageEmbeddingFusionPlaywrightRunnerArtifact; checksum: `sha256:${string}` } {
  const resolvedOutputPath = path.resolve(outputPath);
  if (existsSync(resolvedOutputPath)) {
    throw new TypeError("Fusion E2E runner artifact output already exists; refusing to overwrite it.");
  }
  mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
  const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), "artduo-fusion-e2e-"));
  const temporaryArtifactPath = path.join(temporaryDirectory, "playwright-report.json");
  try {
    const input = { ...promotionInputs, artifactPath: temporaryArtifactPath };
    const fusionRun = check?.(input) ?? runFusionE2e(rootDir, input);
    if (fusionRun.command !== "pnpm test:e2e:fusion" || fusionRun.exitCode !== 0) {
      throw new TypeError("Fusion E2E evidence requires a successful fresh run of pnpm test:e2e:fusion.");
    }
    const raw = readRunnerArtifact(
      temporaryArtifactPath,
      "Fusion E2E",
      parseImageEmbeddingFusionPlaywrightRunnerArtifact,
    );
    try {
      copyFileSync(temporaryArtifactPath, resolvedOutputPath, fsConstants.COPYFILE_EXCL);
    } catch (error) {
      if (isRecord(error) && error.code === "EEXIST") {
        throw new TypeError("Fusion E2E runner artifact output already exists; refusing to overwrite it.");
      }
      throw error;
    }
    return raw;
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function toBlockedCaseSet(caseSet: ImageEmbeddingEvidenceCaseSet): {
  passIds: string[];
  failIds: string[];
  blockedIds: string[];
} {
  return {
    passIds: caseSet.passIds,
    failIds: caseSet.failIds,
    blockedIds: caseSet.blockedOrSkippedIds,
  };
}

function toSkippedCaseSet(caseSet: ImageEmbeddingEvidenceCaseSet): {
  passIds: string[];
  failIds: string[];
  skippedIds: string[];
} {
  return {
    passIds: caseSet.passIds,
    failIds: caseSet.failIds,
    skippedIds: caseSet.blockedOrSkippedIds,
  };
}

function writeJsonAtomically(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
    renameSync(temporaryPath, filePath);
  } catch (error) {
    try {
      unlinkSync(temporaryPath);
    } catch {
      // No temporary file was created, or it has already moved into place.
    }
    throw error;
  }
}

function assertValid(kind: EvidenceKind, value: unknown, context: ImageEmbeddingEvidenceContext): void {
  const validation = kind === "text-benchmark"
    ? validateImageEmbeddingTextBenchmarkEvidence(value, context)
    : kind === "a2a"
      ? validateImageEmbeddingA2aEvidence(value, context)
      : kind === "e2e"
        ? validateImageEmbeddingE2eEvidence(value, context)
        : validateImageEmbeddingFusionE2eEvidence(value, context as ImageEmbeddingEvidenceContext & { promotionBindingChecksum: string });
  if (!validation.valid) {
    throw new TypeError(`Refusing to write invalid ${kind} evidence: ${validation.reasons.join(" ")}`);
  }
}

export function buildImageEmbeddingPromotionEvidence(
  options: ImageEmbeddingPromotionEvidenceBuildOptions,
): ImageEmbeddingPromotionEvidenceBuildResult {
  if (!options.outputPath) {
    throw new TypeError("Promotion evidence requires an explicit --output path.");
  }
  const rootDir = resolveRootDir(options.rootDir);
  const release = resolveReleaseInput(options, rootDir);
  const outputPath = path.resolve(options.outputPath);
  const releaseDir = path.join(rootDir, "data", "releases", release.releaseVersion);
  if (outputPath === releaseDir || outputPath.startsWith(`${releaseDir}${path.sep}`)) {
    throw new TypeError("Promotion evidence output must remain outside the immutable base release directory.");
  }
  const anchorPath = options.promotionAnchorPath
    ? path.resolve(options.promotionAnchorPath)
    : path.join(rootDir, "data", "curation", "reports", "image-embeddings", release.releaseVersion, "promotion-anchor-set.json");
  const evidenceSuites = readEvidenceSuites(rootDir, anchorPath, release.releaseVersion);
  const commitSha = resolveCleanCommitSha(rootDir);
  const kind = determineKind(options);
  const runnerArtifactChecksums: ImageEmbeddingEvidenceRunnerArtifactChecksums = {};
  const runnerArtifacts: ImageEmbeddingEvidenceRunnerArtifacts = {};
  const context: ImageEmbeddingEvidenceContext = {
    releaseVersion: release.releaseVersion,
    baseManifestChecksum: release.baseManifestChecksum,
    commitSha,
    evidenceSuites,
    runnerArtifactChecksums,
    runnerArtifacts,
  };
  const binding = {
    releaseVersion: release.releaseVersion,
    commitSha,
    baseManifestChecksum: release.baseManifestChecksum,
  };
  let evidence: unknown;

  if (kind === "text-benchmark") {
    const raw = readRunnerArtifact(
      options.textBenchmarkRunnerArtifactPath!,
      "Text benchmark",
      parseImageEmbeddingTextBenchmarkRunnerArtifact,
    );
    runnerArtifactChecksums.textBenchmark = raw.checksum;
    runnerArtifacts.textBenchmark = raw.artifact;
    const top1Hits = raw.artifact.results.filter((result) => result.rerankTop1Hit).length;
    const top5Hits = raw.artifact.results.filter((result) => result.rerankTop5Hit).length;
    evidence = {
      schemaVersion: "image-embedding-text-benchmark-evidence.v2",
      ...binding,
      suiteChecksum: evidenceSuites.textBenchmark.suiteChecksum,
      runnerArtifactChecksum: raw.checksum,
      runnerBinding: raw.artifact.runnerBinding,
      vectorBenchmark: {
        promptCount: raw.artifact.results.length,
        rerankTop1HitRate: top1Hits / raw.artifact.results.length,
        rerankTop5HitRate: top5Hits / raw.artifact.results.length,
        results: raw.artifact.results,
      },
    };
  } else if (kind === "a2a") {
    const caseSet = readRunnerArtifact(
      options.a2aCaseSetRunnerArtifactPath!,
      "A2A case-set",
      parseImageEmbeddingA2aCaseSetRunnerArtifact,
    );
    const replay = readRunnerArtifact(
      options.a2aReplayRunnerArtifactPath!,
      "A2A replay",
      parseImageEmbeddingA2aReplayRunnerArtifact,
    );
    runnerArtifactChecksums.a2aCaseSet = caseSet.checksum;
    runnerArtifactChecksums.a2aReplay = replay.checksum;
    runnerArtifacts.a2aCaseSet = caseSet.artifact;
    runnerArtifacts.a2aReplay = replay.artifact;
    evidence = {
      schemaVersion: "image-embedding-a2a-evidence.v2",
      ...binding,
      caseSet: {
        suiteChecksum: evidenceSuites.a2a.caseSet.suiteChecksum,
        runnerArtifactChecksum: caseSet.checksum,
        baseline: evidenceSuites.a2a.caseSet.baseline,
        candidate: toBlockedCaseSet(caseSet.artifact.candidate),
      },
      replay: {
        suiteChecksum: evidenceSuites.a2a.replay.suiteChecksum,
        runnerArtifactChecksum: replay.checksum,
        caseIds: replay.artifact.caseIds,
        averageTotal: replay.artifact.averageTotal,
        hardResistanceViolationIds: replay.artifact.hardResistanceViolationIds,
      },
    };
  } else if (kind === "e2e") {
    const raw = readRunnerArtifact(
      options.e2eRunnerArtifactPath!,
      "E2E",
      parseImageEmbeddingPlaywrightRunnerArtifact,
    );
    const preflight = options.preflightCheck?.() ?? runPreflight(rootDir);
    runnerArtifactChecksums.e2e = raw.checksum;
    runnerArtifacts.e2e = raw.artifact;
    context.preflight = preflight;
    evidence = {
      schemaVersion: "image-embedding-e2e-evidence.v2",
      ...binding,
      suiteChecksum: evidenceSuites.e2e.suiteChecksum,
      runnerArtifactChecksum: raw.checksum,
      preflight,
      caseSets: {
        baseline: evidenceSuites.e2e.baseline,
        candidate: toSkippedCaseSet(raw.artifact.candidate),
      },
    };
  } else {
    const promotionInputs = resolveFusionPromotionInputs(options, release);
    const raw = produceFreshFusionRunnerArtifact(
      rootDir,
      options.fusionE2eRunnerArtifactOutputPath!,
      promotionInputs,
      options.fusionE2eCheck,
    );
    const preflight = options.preflightCheck?.() ?? runPreflight(rootDir);
    runnerArtifactChecksums.fusionE2e = raw.checksum;
    runnerArtifacts.fusionE2e = raw.artifact;
    context.preflight = preflight;
    context.promotionBindingChecksum = options.promotionBindingChecksum;
    context.fusionPromotionInputBinding = promotionInputs.binding;
    evidence = {
      schemaVersion: "image-embedding-fusion-e2e-evidence.v2",
      ...binding,
      suiteChecksum: evidenceSuites.fusionE2e.suiteChecksum,
      runnerArtifactChecksum: raw.checksum,
      promotionBindingChecksum: options.promotionBindingChecksum,
      preflight,
      runnerBinding: raw.artifact.runnerBinding,
      targetedE2e: {
        expectedCaseIds: evidenceSuites.fusionE2e.caseIds,
        passedCaseIds: raw.artifact.candidate.passIds,
        failedCaseIds: raw.artifact.candidate.failIds,
        skippedCaseIds: raw.artifact.candidate.blockedOrSkippedIds,
      },
    };
  }

  assertValid(kind, evidence, context);
  writeJsonAtomically(outputPath, evidence);
  return { kind, outputPath, checksum: sha256Checksum(readFileSync(outputPath)) };
}

async function main(): Promise<void> {
  const result = buildImageEmbeddingPromotionEvidence(readImageEmbeddingPromotionEvidenceBuildOptions());
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1]?.endsWith("build-image-embedding-promotion-evidence.ts")) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
