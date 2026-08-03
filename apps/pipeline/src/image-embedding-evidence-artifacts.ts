import type { ImageEmbeddingEvidenceCaseSet } from "./image-embedding-promotion-evidence";

export interface ImageEmbeddingTextBenchmarkRunnerResult {
  id: string;
  rerankTop1Hit: boolean;
  rerankTop5Hit: boolean;
}

export interface ImageEmbeddingTextBenchmarkRunnerArtifact {
  releaseVersion: string;
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

export interface ImageEmbeddingEvidenceRunnerArtifacts {
  textBenchmark?: ImageEmbeddingTextBenchmarkRunnerArtifact;
  a2aCaseSet?: ImageEmbeddingA2aCaseSetRunnerArtifact;
  a2aReplay?: ImageEmbeddingA2aReplayRunnerArtifact;
  e2e?: ImageEmbeddingPlaywrightRunnerArtifact;
  fusionE2e?: ImageEmbeddingPlaywrightRunnerArtifact;
}

export interface ImageEmbeddingRunnerArtifactParseResult<T> {
  artifact?: T;
  reasons: string[];
}

type PlaywrightStatus = "pass" | "fail" | "skipped";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
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
  const results = parseTextResults(value.results);
  if (!releaseVersion || !results || results.length === 0 || !Number.isInteger(value.promptCount) || value.promptCount !== results.length) {
    return { reasons: ["Text benchmark runner artifact has invalid release, prompt count, or result rows."] };
  }
  const top1 = results.filter((result) => result.rerankTop1Hit).length / results.length;
  const top5 = results.filter((result) => result.rerankTop5Hit).length / results.length;
  if (!finiteNumber(value.rerankTop1HitRate) || !finiteNumber(value.rerankTop5HitRate)
    || Math.abs(value.rerankTop1HitRate - top1) > 1e-6
    || Math.abs(value.rerankTop5HitRate - top5) > 1e-6) {
    return { reasons: ["Text benchmark runner artifact summaries do not match its result rows."] };
  }
  return { artifact: { releaseVersion, results }, reasons: [] };
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
