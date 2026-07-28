export interface ImageEmbeddingEvidenceContext {
  releaseVersion: string;
  baseManifestChecksum: string;
  commitSha?: string;
  promotionBindingChecksum?: string;
}

export interface ImageEmbeddingEvidenceValidation {
  valid: boolean;
  reasons: string[];
}

const TEXT_BENCHMARK_SCHEMA = "image-embedding-text-benchmark-evidence.v1";
const A2A_SCHEMA = "image-embedding-a2a-evidence.v1";
const E2E_SCHEMA = "image-embedding-e2e-evidence.v1";
const FUSION_E2E_SCHEMA = "image-embedding-fusion-e2e-evidence.v1";
const COMMIT_SHA = /^[a-f0-9]{40}$/u;
const CHECKSUM = /^sha256:[a-f0-9]{64}$/u;
const TEXT_PROMPT_COUNT = 24;
const MINIMUM_TEXT_TOP1_HIT_COUNT = 23;
const A2A_REPLAY_CASE_COUNT = 50;
const MINIMUM_A2A_AVERAGE_TOTAL = 0.975;
const E2E_CASE_COUNT = 14;
const MINIMUM_FUSION_E2E_CASE_COUNT = 5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: unknown, keys: string[]): value is Record<string, unknown> {
  return isRecord(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function uniqueStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !entry.trim())) {
    return undefined;
  }
  const values = value.map((entry) => entry.trim());
  return new Set(values).size === values.length ? values : undefined;
}

function validation(reasons: string[]): ImageEmbeddingEvidenceValidation {
  return { valid: reasons.length === 0, reasons };
}

function validateBinding(value: unknown, context: ImageEmbeddingEvidenceContext, label: string): string[] {
  if (!exactKeys(value, ["schemaVersion", "releaseVersion", "commitSha", "baseManifestChecksum"])) {
    return [`${label} evidence binding schema is invalid.`];
  }
  const binding = value;
  const reasons: string[] = [];
  if (binding.releaseVersion !== context.releaseVersion) {
    reasons.push(`${label} evidence releaseVersion does not match the selected release.`);
  }
  if (binding.baseManifestChecksum !== context.baseManifestChecksum) {
    reasons.push(`${label} evidence base manifest checksum does not match.`);
  }
  if (typeof binding.commitSha !== "string" || !COMMIT_SHA.test(binding.commitSha)) {
    reasons.push(`${label} evidence commit SHA is invalid.`);
  } else if (!context.commitSha) {
    reasons.push(`${label} evidence cannot bind because the evaluator commit SHA is unavailable.`);
  } else if (binding.commitSha !== context.commitSha) {
    reasons.push(`${label} evidence commit SHA does not match the evaluator commit.`);
  }
  if (typeof binding.baseManifestChecksum !== "string" || !CHECKSUM.test(binding.baseManifestChecksum)) {
    reasons.push(`${label} evidence base manifest checksum format is invalid.`);
  }
  return reasons;
}

function parseBoundEvidence(value: unknown, schemaVersion: string, context: ImageEmbeddingEvidenceContext, label: string): {
  evidence?: Record<string, unknown>;
  reasons: string[];
} {
  if (!isRecord(value) || value.schemaVersion !== schemaVersion) {
    return { reasons: [`${label} evidence schemaVersion is unknown or invalid.`] };
  }
  const binding = {
    schemaVersion: value.schemaVersion,
    releaseVersion: value.releaseVersion,
    commitSha: value.commitSha,
    baseManifestChecksum: value.baseManifestChecksum,
  };
  return {
    evidence: value,
    reasons: validateBinding(binding, context, label),
  };
}

interface ParsedCaseSet {
  passIds: string[];
  failIds: string[];
  blockedOrSkippedIds: string[];
}

function parseCaseSet(value: unknown, blockedKey: "blockedIds" | "skippedIds", label: string): {
  parsed?: ParsedCaseSet;
  reasons: string[];
} {
  if (!exactKeys(value, ["passIds", "failIds", blockedKey])) {
    return { reasons: [`${label} case-set schema is invalid.`] };
  }
  const passIds = uniqueStringArray(value.passIds);
  const failIds = uniqueStringArray(value.failIds);
  const blockedOrSkippedIds = uniqueStringArray(value[blockedKey]);
  if (!passIds || !failIds || !blockedOrSkippedIds) {
    return { reasons: [`${label} case-set IDs must be unique non-empty strings.`] };
  }
  const allIds = [...passIds, ...failIds, ...blockedOrSkippedIds];
  if (new Set(allIds).size !== allIds.length) {
    return { reasons: [`${label} case-set statuses overlap.`] };
  }
  return { parsed: { passIds, failIds, blockedOrSkippedIds }, reasons: [] };
}

function sameIdSet(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id) => right.includes(id));
}

function isSubset(left: string[], right: string[]): boolean {
  const rightIds = new Set(right);
  return left.every((id) => rightIds.has(id));
}

function validateCaseSetRegression(
  baseline: ParsedCaseSet,
  candidate: ParsedCaseSet,
  label: string,
): string[] {
  const baselineIds = [...baseline.passIds, ...baseline.failIds, ...baseline.blockedOrSkippedIds].sort();
  const candidateIds = [...candidate.passIds, ...candidate.failIds, ...candidate.blockedOrSkippedIds].sort();
  const reasons: string[] = [];
  if (!sameIdSet(baselineIds, candidateIds)) {
    reasons.push(`${label} candidate case IDs do not match the frozen baseline.`);
  }
  if (!isSubset(baseline.passIds, candidate.passIds)) {
    reasons.push(`${label} candidate regressed a previously passing case.`);
  }
  if (!isSubset(candidate.failIds, baseline.failIds) || !isSubset(candidate.blockedOrSkippedIds, baseline.blockedOrSkippedIds)) {
    reasons.push(`${label} candidate introduced failed or blocked cases.`);
  }
  return reasons;
}

export function validateImageEmbeddingTextBenchmarkEvidence(
  value: unknown,
  context: ImageEmbeddingEvidenceContext,
): ImageEmbeddingEvidenceValidation {
  const parsed = parseBoundEvidence(value, TEXT_BENCHMARK_SCHEMA, context, "Text benchmark");
  if (!parsed.evidence) {
    return validation(parsed.reasons);
  }
  const evidence = parsed.evidence;
  const reasons = [...parsed.reasons];
  if (!exactKeys(evidence, ["schemaVersion", "releaseVersion", "commitSha", "baseManifestChecksum", "vectorBenchmark"])) {
    return validation([...reasons, "Text benchmark evidence contains unsupported fields."]);
  }
  const benchmark = evidence.vectorBenchmark;
  if (!exactKeys(benchmark, ["promptCount", "rerankTop1HitRate", "rerankTop5HitRate", "results"])) {
    return validation([...reasons, "Text benchmark evidence benchmark schema is invalid."]);
  }
  const promptCount = benchmark.promptCount;
  const top1 = benchmark.rerankTop1HitRate;
  const top5 = benchmark.rerankTop5HitRate;
  if (!Number.isInteger(promptCount) || promptCount !== TEXT_PROMPT_COUNT || !finiteNumber(top1) || !finiteNumber(top5)) {
    return validation([...reasons, "Text benchmark evidence summary is invalid."]);
  }
  if (!Array.isArray(benchmark.results) || benchmark.results.length !== promptCount) {
    return validation([...reasons, "Text benchmark evidence result count does not match its prompt count."]);
  }
  const resultIds = new Set<string>();
  let top1Hits = 0;
  let top5Hits = 0;
  for (const result of benchmark.results) {
    if (!exactKeys(result, ["id", "rerankTop1Hit", "rerankTop5Hit"])
      || typeof result.id !== "string"
      || !result.id.trim()
      || typeof result.rerankTop1Hit !== "boolean"
      || typeof result.rerankTop5Hit !== "boolean"
      || resultIds.has(result.id)) {
      return validation([...reasons, "Text benchmark evidence results are malformed or duplicate."]);
    }
    resultIds.add(result.id);
    if (result.rerankTop1Hit) {
      top1Hits += 1;
    }
    if (result.rerankTop5Hit) {
      top5Hits += 1;
    }
  }
  const computedTop1 = top1Hits / promptCount;
  const computedTop5 = top5Hits / promptCount;
  if (Math.abs(top1 - computedTop1) > 1e-6 || Math.abs(top5 - computedTop5) > 1e-6) {
    reasons.push("Text benchmark evidence summary does not match its result rows.");
  }
  if (top1Hits < MINIMUM_TEXT_TOP1_HIT_COUNT || top5Hits !== TEXT_PROMPT_COUNT) {
    reasons.push("Text benchmark evidence does not meet the frozen Top-1/Top-5 thresholds.");
  }
  return validation(reasons);
}

export function validateImageEmbeddingA2aEvidence(
  value: unknown,
  context: ImageEmbeddingEvidenceContext,
): ImageEmbeddingEvidenceValidation {
  const parsed = parseBoundEvidence(value, A2A_SCHEMA, context, "A2A");
  if (!parsed.evidence) {
    return validation(parsed.reasons);
  }
  const evidence = parsed.evidence;
  const reasons = [...parsed.reasons];
  if (!exactKeys(evidence, ["schemaVersion", "releaseVersion", "commitSha", "baseManifestChecksum", "caseSets", "replay"])) {
    return validation([...reasons, "A2A evidence contains unsupported fields."]);
  }
  if (!exactKeys(evidence.caseSets, ["baseline", "candidate"])) {
    return validation([...reasons, "A2A evidence case-set schema is invalid."]);
  }
  const baseline = parseCaseSet(evidence.caseSets.baseline, "blockedIds", "A2A baseline");
  const candidate = parseCaseSet(evidence.caseSets.candidate, "blockedIds", "A2A candidate");
  reasons.push(...baseline.reasons, ...candidate.reasons);
  if (baseline.parsed && candidate.parsed) {
    reasons.push(...validateCaseSetRegression(baseline.parsed, candidate.parsed, "A2A"));
  }
  if (!exactKeys(evidence.replay, ["caseCount", "averageTotal", "hardResistanceViolationIds"])) {
    return validation([...reasons, "A2A replay schema is invalid."]);
  }
  const caseCount = evidence.replay.caseCount;
  const averageTotal = evidence.replay.averageTotal;
  const hardResistanceViolationIds = uniqueStringArray(evidence.replay.hardResistanceViolationIds);
  if (!Number.isInteger(caseCount) || caseCount !== A2A_REPLAY_CASE_COUNT || !finiteNumber(averageTotal) || !hardResistanceViolationIds) {
    return validation([...reasons, "A2A replay summary is invalid."]);
  }
  if (baseline.parsed && caseCount !== baseline.parsed.passIds.length + baseline.parsed.failIds.length + baseline.parsed.blockedOrSkippedIds.length) {
    reasons.push("A2A replay case count does not match the frozen case set.");
  }
  if (averageTotal < MINIMUM_A2A_AVERAGE_TOTAL || hardResistanceViolationIds.length > 0) {
    reasons.push("A2A replay does not meet the average-total or hard-resistance threshold.");
  }
  return validation(reasons);
}

export function validateImageEmbeddingE2eEvidence(
  value: unknown,
  context: ImageEmbeddingEvidenceContext,
): ImageEmbeddingEvidenceValidation {
  const parsed = parseBoundEvidence(value, E2E_SCHEMA, context, "E2E");
  if (!parsed.evidence) {
    return validation(parsed.reasons);
  }
  const evidence = parsed.evidence;
  const reasons = [...parsed.reasons];
  if (!exactKeys(evidence, ["schemaVersion", "releaseVersion", "commitSha", "baseManifestChecksum", "preflight", "caseSets"])) {
    return validation([...reasons, "E2E evidence contains unsupported fields."]);
  }
  if (!exactKeys(evidence.preflight, ["command", "exitCode"])
    || evidence.preflight.command !== "pnpm preflight:check"
    || evidence.preflight.exitCode !== 0) {
    reasons.push("E2E evidence does not prove a successful full preflight run.");
  }
  if (!exactKeys(evidence.caseSets, ["baseline", "candidate"])) {
    return validation([...reasons, "E2E evidence case-set schema is invalid."]);
  }
  const baseline = parseCaseSet(evidence.caseSets.baseline, "skippedIds", "E2E baseline");
  const candidate = parseCaseSet(evidence.caseSets.candidate, "skippedIds", "E2E candidate");
  reasons.push(...baseline.reasons, ...candidate.reasons);
  if (baseline.parsed && candidate.parsed) {
    reasons.push(...validateCaseSetRegression(baseline.parsed, candidate.parsed, "E2E"));
    const baselineCaseCount = baseline.parsed.passIds.length
      + baseline.parsed.failIds.length
      + baseline.parsed.blockedOrSkippedIds.length;
    if (baselineCaseCount !== E2E_CASE_COUNT) {
      reasons.push("E2E evidence does not cover the frozen 14-case suite.");
    }
    if (candidate.parsed.failIds.length > 0 || candidate.parsed.blockedOrSkippedIds.length > 0) {
      reasons.push("E2E candidate contains failed or skipped cases.");
    }
  }
  return validation(reasons);
}

export function validateImageEmbeddingFusionE2eEvidence(
  value: unknown,
  context: ImageEmbeddingEvidenceContext & { promotionBindingChecksum: string },
): ImageEmbeddingEvidenceValidation {
  const parsed = parseBoundEvidence(value, FUSION_E2E_SCHEMA, context, "Fusion E2E");
  if (!parsed.evidence) {
    return validation(parsed.reasons);
  }
  const evidence = parsed.evidence;
  const reasons = [...parsed.reasons];
  if (!exactKeys(evidence, [
    "schemaVersion",
    "releaseVersion",
    "commitSha",
    "baseManifestChecksum",
    "promotionBindingChecksum",
    "preflight",
    "targetedE2e",
  ])) {
    return validation([...reasons, "Fusion E2E evidence contains unsupported fields."]);
  }
  if (evidence.promotionBindingChecksum !== context.promotionBindingChecksum
    || typeof evidence.promotionBindingChecksum !== "string"
    || !CHECKSUM.test(evidence.promotionBindingChecksum)) {
    reasons.push("Fusion E2E evidence does not bind to this promotion decision.");
  }
  if (!exactKeys(evidence.preflight, ["command", "exitCode"])
    || evidence.preflight.command !== "pnpm preflight:check"
    || evidence.preflight.exitCode !== 0) {
    reasons.push("Fusion E2E evidence does not prove a successful full preflight run.");
  }
  if (!exactKeys(evidence.targetedE2e, ["expectedCaseIds", "passedCaseIds", "failedCaseIds", "skippedCaseIds"])) {
    return validation([...reasons, "Fusion E2E targeted result schema is invalid."]);
  }
  const expectedCaseIds = uniqueStringArray(evidence.targetedE2e.expectedCaseIds);
  const passedCaseIds = uniqueStringArray(evidence.targetedE2e.passedCaseIds);
  const failedCaseIds = uniqueStringArray(evidence.targetedE2e.failedCaseIds);
  const skippedCaseIds = uniqueStringArray(evidence.targetedE2e.skippedCaseIds);
  if (!expectedCaseIds || !passedCaseIds || !failedCaseIds || !skippedCaseIds) {
    return validation([...reasons, "Fusion E2E targeted case IDs are invalid."]);
  }
  const observedIds = [...passedCaseIds, ...failedCaseIds, ...skippedCaseIds];
  if (new Set(observedIds).size !== observedIds.length
    || expectedCaseIds.length < MINIMUM_FUSION_E2E_CASE_COUNT
    || !sameIdSet([...expectedCaseIds].sort(), [...observedIds].sort())
    || !sameIdSet([...expectedCaseIds].sort(), [...passedCaseIds].sort())
    || failedCaseIds.length > 0
    || skippedCaseIds.length > 0) {
    reasons.push("Fusion E2E targeted cases are incomplete, failed, skipped, or do not meet the required coverage.");
  }
  return validation(reasons);
}
