import type { ImageEmbeddingEvidenceCaseSet } from "./image-embedding-promotion-evidence";

export interface ImageEmbeddingTextBenchmarkRunnerResult {
  id: string;
  rerankTop1Hit: boolean;
  rerankTop5Hit: boolean;
}

export interface ImageEmbeddingTextBenchmarkRunnerBinding {
  manifestPath: string;
  manifestChecksum: string;
  promptsPath: string;
  promptsChecksum: string;
  requestedProviderMode: string;
  configuredProviderMode: string;
  provider: string;
  model: string;
  dimensions: number;
  limit: number;
}

export interface ImageEmbeddingTextBenchmarkRunnerArtifact {
  releaseVersion: string;
  runnerBinding: ImageEmbeddingTextBenchmarkRunnerBinding;
  results: ImageEmbeddingTextBenchmarkRunnerResult[];
}

export interface ImageEmbeddingA2aCaseSetRunnerArtifact {
  candidate: ImageEmbeddingEvidenceCaseSet;
}

export interface ImageEmbeddingA2aReplayRunnerArtifact {
  caseIds: string[];
  averageTotal: number;
  hardResistanceViolationIds: string[];
}

export interface ImageEmbeddingPlaywrightRunnerArtifact {
  candidate: ImageEmbeddingEvidenceCaseSet;
}

export interface ImageEmbeddingFusionPlaywrightSuiteBinding {
  suiteId: string;
  configPath: string;
  projectName: string;
  specPath: string;
}

export interface ImageEmbeddingFusionPromotionInputBinding {
  releaseVersion: string;
  baseManifestChecksum: string;
  candidateShardChecksum: string;
  promotionReportChecksum: string;
  promotionBindingChecksum: string;
}

export interface ImageEmbeddingFusionPlaywrightRunnerBinding
  extends ImageEmbeddingFusionPlaywrightSuiteBinding, ImageEmbeddingFusionPromotionInputBinding {}

export interface ImageEmbeddingFusionPlaywrightRunnerArtifact extends ImageEmbeddingPlaywrightRunnerArtifact {
  runnerBinding: ImageEmbeddingFusionPlaywrightRunnerBinding;
}

export interface ImageEmbeddingEvidenceRunnerArtifacts {
  textBenchmark?: ImageEmbeddingTextBenchmarkRunnerArtifact;
  a2aCaseSet?: ImageEmbeddingA2aCaseSetRunnerArtifact;
  a2aReplay?: ImageEmbeddingA2aReplayRunnerArtifact;
  e2e?: ImageEmbeddingPlaywrightRunnerArtifact;
  fusionE2e?: ImageEmbeddingFusionPlaywrightRunnerArtifact;
}

export interface ImageEmbeddingRunnerArtifactParseResult<T> {
  artifact?: T;
  reasons: string[];
}

type PlaywrightStatus = "pass" | "fail" | "skipped";
const CHECKSUM = /^sha256:[a-f0-9]{64}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function repositoryRelativePath(value: unknown): string | undefined {
  const candidate = nonEmptyString(value);
  if (!candidate
    || candidate.startsWith("/")
    || candidate.includes("\\")
    || candidate.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    return undefined;
  }
  return candidate;
}

function parseTextRunnerBinding(value: Record<string, unknown>): ImageEmbeddingTextBenchmarkRunnerBinding | undefined {
  const manifestPath = repositoryRelativePath(value.manifestPath);
  const promptsPath = repositoryRelativePath(value.promptsPath);
  const manifestChecksum = nonEmptyString(value.manifestChecksum);
  const promptsChecksum = nonEmptyString(value.promptsChecksum);
  const requestedProviderMode = nonEmptyString(value.requestedProviderMode);
  const configuredProviderMode = nonEmptyString(value.configuredProviderMode);
  const provider = nonEmptyString(value.provider);
  const model = nonEmptyString(value.model);
  if (!manifestPath
    || !promptsPath
    || !manifestChecksum
    || !CHECKSUM.test(manifestChecksum)
    || !promptsChecksum
    || !CHECKSUM.test(promptsChecksum)
    || !requestedProviderMode
    || !configuredProviderMode
    || !provider
    || !model
    || !Number.isInteger(value.dimensions)
    || (value.dimensions as number) <= 0
    || !Number.isInteger(value.limit)
    || (value.limit as number) <= 0) {
    return undefined;
  }
  return {
    manifestPath,
    manifestChecksum,
    promptsPath,
    promptsChecksum,
    requestedProviderMode,
    configuredProviderMode,
    provider,
    model,
    dimensions: value.dimensions as number,
    limit: value.limit as number,
  };
}

function uniqueIds(values: string[]): boolean {
  return new Set(values).size === values.length;
}

function asCaseSet(rows: Array<{ id: string; status: "pass" | "fail" | "blocked" | "skipped" }>): ImageEmbeddingEvidenceCaseSet {
  return {
    passIds: rows.filter((row) => row.status === "pass").map((row) => row.id),
    failIds: rows.filter((row) => row.status === "fail").map((row) => row.id),
    blockedOrSkippedIds: rows.filter((row) => row.status === "blocked" || row.status === "skipped").map((row) => row.id),
  };
}

function parseTextResults(value: unknown): ImageEmbeddingTextBenchmarkRunnerResult[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const results: ImageEmbeddingTextBenchmarkRunnerResult[] = [];
  for (const row of value) {
    if (!isRecord(row)) {
      return undefined;
    }
    const id = nonEmptyString(row.id);
    if (!id || typeof row.rerankTop1Hit !== "boolean" || typeof row.rerankTop5Hit !== "boolean") {
      return undefined;
    }
    results.push({ id, rerankTop1Hit: row.rerankTop1Hit, rerankTop5Hit: row.rerankTop5Hit });
  }
  return uniqueIds(results.map((result) => result.id)) ? results : undefined;
}

export function parseImageEmbeddingTextBenchmarkRunnerArtifact(
  value: unknown,
): ImageEmbeddingRunnerArtifactParseResult<ImageEmbeddingTextBenchmarkRunnerArtifact> {
  if (!isRecord(value)) {
    return { reasons: ["Text benchmark runner artifact must be a JSON object."] };
  }
  const releaseVersion = nonEmptyString(value.releaseVersion);
  const runnerBinding = parseTextRunnerBinding(value);
  const results = parseTextResults(value.results);
  if (!releaseVersion || !runnerBinding || !results || results.length === 0
    || !Number.isInteger(value.promptCount) || value.promptCount !== results.length) {
    return { reasons: ["Text benchmark runner artifact has invalid release, binding, prompt count, or result rows."] };
  }
  const top1 = results.filter((result) => result.rerankTop1Hit).length / results.length;
  const top5 = results.filter((result) => result.rerankTop5Hit).length / results.length;
  if (!finiteNumber(value.rerankTop1HitRate) || !finiteNumber(value.rerankTop5HitRate)
    || Math.abs(value.rerankTop1HitRate - top1) > 1e-6
    || Math.abs(value.rerankTop5HitRate - top5) > 1e-6) {
    return { reasons: ["Text benchmark runner artifact summaries do not match its result rows."] };
  }
  return { artifact: { releaseVersion, runnerBinding, results }, reasons: [] };
}

export function parseImageEmbeddingA2aCaseSetRunnerArtifact(
  value: unknown,
): ImageEmbeddingRunnerArtifactParseResult<ImageEmbeddingA2aCaseSetRunnerArtifact> {
  if (!isRecord(value) || !isRecord(value.counts) || !Array.isArray(value.results)) {
    return { reasons: ["A2A case-set runner artifact has an invalid harness shape."] };
  }
  const rows: Array<{ id: string; status: "pass" | "fail" | "blocked" }> = [];
  for (const row of value.results) {
    if (!isRecord(row)) {
      return { reasons: ["A2A case-set runner artifact contains an invalid result row."] };
    }
    const id = nonEmptyString(row.id);
    if (!id || (row.status !== "pass" && row.status !== "fail" && row.status !== "blocked")) {
      return { reasons: ["A2A case-set runner artifact contains an invalid result status."] };
    }
    rows.push({ id, status: row.status });
  }
  if (!uniqueIds(rows.map((row) => row.id))) {
    return { reasons: ["A2A case-set runner artifact contains duplicate case IDs."] };
  }
  const candidate = asCaseSet(rows);
  if (!Number.isInteger(value.counts.pass) || !Number.isInteger(value.counts.fail) || !Number.isInteger(value.counts.blocked)
    || value.counts.pass !== candidate.passIds.length
    || value.counts.fail !== candidate.failIds.length
    || value.counts.blocked !== candidate.blockedOrSkippedIds.length) {
    return { reasons: ["A2A case-set runner artifact counts do not match its result rows."] };
  }
  return { artifact: { candidate }, reasons: [] };
}

export function parseImageEmbeddingA2aReplayRunnerArtifact(
  value: unknown,
): ImageEmbeddingRunnerArtifactParseResult<ImageEmbeddingA2aReplayRunnerArtifact> {
  if (!Array.isArray(value) || value.length === 0) {
    return { reasons: ["A2A replay runner artifact must be a non-empty result array."] };
  }
  const caseIds: string[] = [];
  const totals: number[] = [];
  const hardResistanceViolationIds: string[] = [];
  for (const row of value) {
    if (!isRecord(row) || !isRecord(row.scores) || !isRecord(row.output) || !isRecord(row.output.curveMetrics)) {
      return { reasons: ["A2A replay runner artifact contains an invalid result row."] };
    }
    const id = nonEmptyString(row.id);
    const total = row.scores.total;
    const hardResistanceViolations = row.output.curveMetrics.hardResistanceViolations;
    if (!id
      || !finiteNumber(total)
      || typeof hardResistanceViolations !== "number"
      || !Number.isInteger(hardResistanceViolations)
      || hardResistanceViolations < 0) {
      return { reasons: ["A2A replay runner artifact contains invalid score or resistance values."] };
    }
    caseIds.push(id);
    totals.push(total);
    if (hardResistanceViolations > 0) {
      hardResistanceViolationIds.push(id);
    }
  }
  if (!uniqueIds(caseIds)) {
    return { reasons: ["A2A replay runner artifact contains duplicate case IDs."] };
  }
  return {
    artifact: {
      caseIds,
      averageTotal: totals.reduce((sum, total) => sum + total, 0) / totals.length,
      hardResistanceViolationIds,
    },
    reasons: [],
  };
}

function statusForPlaywrightTest(value: unknown): PlaywrightStatus | undefined {
  if (!isRecord(value) || !Array.isArray(value.results) || value.results.length === 0) {
    return undefined;
  }
  const statuses = value.results.map((result) => isRecord(result) ? result.status : undefined);
  if (statuses.some((status) => status === "failed" || status === "timedOut" || status === "interrupted")) {
    return "fail";
  }
  if (statuses.every((status) => status === "passed")) {
    return "pass";
  }
  if (statuses.every((status) => status === "skipped")) {
    return "skipped";
  }
  return undefined;
}

function collectPlaywrightRows(
  value: unknown,
  rows: Array<{ id: string; status: PlaywrightStatus }>,
): string | undefined {
  if (!isRecord(value)) {
    return "Playwright runner artifact contains an invalid suite.";
  }
  if (value.specs !== undefined) {
    if (!Array.isArray(value.specs)) {
      return "Playwright runner artifact suite specs are invalid.";
    }
    for (const spec of value.specs) {
      if (!isRecord(spec)) {
        return "Playwright runner artifact contains an invalid spec.";
      }
      const id = nonEmptyString(spec.title);
      if (!id || !Array.isArray(spec.tests) || spec.tests.length !== 1) {
        return "Playwright runner artifact specs must have one named test entry.";
      }
      const status = statusForPlaywrightTest(spec.tests[0]);
      if (!status) {
        return "Playwright runner artifact contains an unsupported test outcome.";
      }
      rows.push({ id, status });
    }
  }
  if (value.suites !== undefined) {
    if (!Array.isArray(value.suites)) {
      return "Playwright runner artifact nested suites are invalid.";
    }
    for (const suite of value.suites) {
      const reason = collectPlaywrightRows(suite, rows);
      if (reason) {
        return reason;
      }
    }
  }
  return undefined;
}

export function parseImageEmbeddingPlaywrightRunnerArtifact(
  value: unknown,
): ImageEmbeddingRunnerArtifactParseResult<ImageEmbeddingPlaywrightRunnerArtifact> {
  if (!isRecord(value) || !Array.isArray(value.suites)) {
    return { reasons: ["Playwright runner artifact must contain a suites array."] };
  }
  const rows: Array<{ id: string; status: PlaywrightStatus }> = [];
  const reason = collectPlaywrightRows(value, rows);
  if (reason) {
    return { reasons: [reason] };
  }
  if (rows.length === 0 || !uniqueIds(rows.map((row) => row.id))) {
    return { reasons: ["Playwright runner artifact must contain unique named case results."] };
  }
  return { artifact: { candidate: asCaseSet(rows) }, reasons: [] };
}

function validateFusionPlaywrightSuite(
  value: unknown,
  specFile: string,
  projectName: string,
): string | undefined {
  if (!isRecord(value)) {
    return "Fusion Playwright runner artifact contains an invalid suite.";
  }
  if (value.specs !== undefined) {
    if (value.file !== specFile || !Array.isArray(value.specs)) {
      return "Fusion Playwright runner artifact was not produced by the frozen spec file.";
    }
    for (const spec of value.specs) {
      if (!isRecord(spec) || spec.file !== specFile || !Array.isArray(spec.tests) || spec.tests.length !== 1) {
        return "Fusion Playwright runner artifact contains a test outside the frozen spec file.";
      }
      const test = spec.tests[0];
      if (!isRecord(test) || test.projectId !== projectName || test.projectName !== projectName) {
        return "Fusion Playwright runner artifact was not produced by the frozen project.";
      }
    }
  }
  if (value.suites !== undefined) {
    if (!Array.isArray(value.suites)) {
      return "Fusion Playwright runner artifact contains invalid nested suites.";
    }
    for (const suite of value.suites) {
      const reason = validateFusionPlaywrightSuite(suite, specFile, projectName);
      if (reason) {
        return reason;
      }
    }
  }
  return undefined;
}

export function parseImageEmbeddingFusionPlaywrightRunnerArtifact(
  value: unknown,
): ImageEmbeddingRunnerArtifactParseResult<ImageEmbeddingFusionPlaywrightRunnerArtifact> {
  if (!isRecord(value)
    || !isRecord(value.config)
    || !isRecord(value.config.metadata)
    || !Array.isArray(value.config.projects)
    || !Array.isArray(value.suites)) {
    return { reasons: ["Fusion Playwright runner artifact must bind its config, project, spec, and suite metadata."] };
  }
  const metadata = value.config.metadata;
  const suiteId = nonEmptyString(metadata.imageEmbeddingEvidenceSuiteId);
  const configPath = repositoryRelativePath(metadata.imageEmbeddingEvidenceConfigPath);
  const projectName = nonEmptyString(metadata.imageEmbeddingEvidenceProjectName);
  const specPath = repositoryRelativePath(metadata.imageEmbeddingEvidenceSpecPath);
  const releaseVersion = nonEmptyString(metadata.imageEmbeddingEvidenceReleaseVersion);
  const baseManifestChecksum = nonEmptyString(metadata.imageEmbeddingEvidenceBaseManifestChecksum);
  const candidateShardChecksum = nonEmptyString(metadata.imageEmbeddingEvidenceCandidateShardChecksum);
  const promotionReportChecksum = nonEmptyString(metadata.imageEmbeddingEvidencePromotionReportChecksum);
  const promotionBindingChecksum = nonEmptyString(metadata.imageEmbeddingEvidencePromotionBindingChecksum);
  const configFile = nonEmptyString(value.config.configFile)?.replaceAll("\\", "/");
  if (!suiteId || !configPath || !projectName || !specPath || !releaseVersion
    || !baseManifestChecksum || !CHECKSUM.test(baseManifestChecksum)
    || !candidateShardChecksum || !CHECKSUM.test(candidateShardChecksum)
    || !promotionReportChecksum || !CHECKSUM.test(promotionReportChecksum)
    || !promotionBindingChecksum || !CHECKSUM.test(promotionBindingChecksum)
    || !configFile
    || !configFile.endsWith(`/${configPath}`)) {
    return { reasons: ["Fusion Playwright runner artifact config or suite metadata is invalid."] };
  }
  const projects = value.config.projects.filter(isRecord);
  if (projects.length !== 1 || projects[0]?.id !== projectName || projects[0]?.name !== projectName) {
    return { reasons: ["Fusion Playwright runner artifact project does not match its frozen project metadata."] };
  }
  const specFile = specPath.split("/").at(-1)!;
  for (const suite of value.suites) {
    const reason = validateFusionPlaywrightSuite(suite, specFile, projectName);
    if (reason) {
      return { reasons: [reason] };
    }
  }
  const parsed = parseImageEmbeddingPlaywrightRunnerArtifact(value);
  if (!parsed.artifact) {
    return { reasons: parsed.reasons };
  }
  return {
    artifact: {
      candidate: parsed.artifact.candidate,
      runnerBinding: {
        suiteId,
        configPath,
        projectName,
        specPath,
        releaseVersion,
        baseManifestChecksum,
        candidateShardChecksum,
        promotionReportChecksum,
        promotionBindingChecksum,
      },
    },
    reasons: [],
  };
}
