import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  parseImageEmbeddingA2aCaseSetRunnerArtifact,
  parseImageEmbeddingA2aReplayRunnerArtifact,
  parseImageEmbeddingPlaywrightRunnerArtifact,
  parseImageEmbeddingTextBenchmarkRunnerArtifact,
  type ImageEmbeddingEvidenceRunnerArtifacts,
  type ImageEmbeddingRunnerArtifactParseResult,
} from "./image-embedding-evidence-artifacts";
import {
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
  fusionE2eRunnerArtifactPath?: string;
  promotionBindingChecksum?: string;
  /** Internal test seam; the production CLI executes the preflight command itself. */
  preflightCheck?: () => ImageEmbeddingEvidencePreflight;
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
  const fusion = Boolean(options.fusionE2eRunnerArtifactPath);
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
  const result = spawnSync("pnpm", ["preflight:check"], { cwd: rootDir, stdio: "ignore" });
  return {
    command: "pnpm preflight:check",
    exitCode: typeof result.status === "number" ? result.status : 1,
  };
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
    const raw = readRunnerArtifact(
      options.fusionE2eRunnerArtifactPath!,
      "Fusion E2E",
      parseImageEmbeddingPlaywrightRunnerArtifact,
    );
    const preflight = options.preflightCheck?.() ?? runPreflight(rootDir);
    runnerArtifactChecksums.fusionE2e = raw.checksum;
    runnerArtifacts.fusionE2e = raw.artifact;
    context.preflight = preflight;
    context.promotionBindingChecksum = options.promotionBindingChecksum;
    evidence = {
      schemaVersion: "image-embedding-fusion-e2e-evidence.v2",
      ...binding,
      suiteChecksum: evidenceSuites.fusionE2e.suiteChecksum,
      runnerArtifactChecksum: raw.checksum,
      promotionBindingChecksum: options.promotionBindingChecksum,
      preflight,
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
