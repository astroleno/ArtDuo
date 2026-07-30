export interface ImageEmbeddingEvidenceCaseSet {
  passIds: string[];
  failIds: string[];
  blockedOrSkippedIds: string[];
}

export interface ImageEmbeddingEvidenceSuite {
  suiteChecksum: string;
  caseIds: string[];
}

export interface ImageEmbeddingA2aCaseSetSuite {
  suiteChecksum: string;
  baseline: {
    passIds: string[];
    failIds: string[];
    blockedIds: string[];
  };
}

export interface ImageEmbeddingE2eCaseSetSuite {
  suiteChecksum: string;
  baseline: {
    passIds: string[];
    failIds: string[];
    skippedIds: string[];
  };
}

export interface ImageEmbeddingEvidenceSuiteBindings {
  textBenchmark: ImageEmbeddingEvidenceSuite;
  a2a: {
    caseSet: ImageEmbeddingA2aCaseSetSuite;
    replay: ImageEmbeddingEvidenceSuite;
  };
  e2e: ImageEmbeddingE2eCaseSetSuite;
  fusionE2e: ImageEmbeddingEvidenceSuite;
}

export interface ImageEmbeddingEvidenceRunnerArtifactChecksums {
  textBenchmark?: string;
  a2aCaseSet?: string;
  a2aReplay?: string;
  e2e?: string;
  fusionE2e?: string;
}

export interface ImageEmbeddingEvidenceContext {
  releaseVersion: string;
  baseManifestChecksum: string;
  commitSha?: string;
  promotionBindingChecksum?: string;
  evidenceSuites?: ImageEmbeddingEvidenceSuiteBindings;
  runnerArtifactChecksums?: ImageEmbeddingEvidenceRunnerArtifactChecksums;
}

export interface ImageEmbeddingEvidenceValidation {
  valid: boolean;
  reasons: string[];
}

export interface ImageEmbeddingEvidenceSuiteBindingsParseResult {
  bindings?: ImageEmbeddingEvidenceSuiteBindings;
  reasons: string[];
}

const TEXT_BENCHMARK_SCHEMA = "image-embedding-text-benchmark-evidence.v2";
const A2A_SCHEMA = "image-embedding-a2a-evidence.v2";
const E2E_SCHEMA = "image-embedding-e2e-evidence.v2";
const FUSION_E2E_SCHEMA = "image-embedding-fusion-e2e-evidence.v2";
const COMMIT_SHA = /^[a-f0-9]{40}$/u;
const CHECKSUM = /^sha256:[a-f0-9]{64}$/u;
const TEXT_PROMPT_COUNT = 24;
const MINIMUM_TEXT_TOP1_HIT_COUNT = 23;
const A2A_CASE_SET_COUNTS = { pass: 55, fail: 40, blocked: 5 } as const;
const A2A_CASE_SET_COUNT = A2A_CASE_SET_COUNTS.pass + A2A_CASE_SET_COUNTS.fail + A2A_CASE_SET_COUNTS.blocked;
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

function parseCaseSet(value: unknown, blockedKey: "blockedIds" | "skippedIds", label: string): {
  parsed?: ImageEmbeddingEvidenceCaseSet;
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

function caseSetIds(caseSet: ImageEmbeddingEvidenceCaseSet): string[] {
  return [...caseSet.passIds, ...caseSet.failIds, ...caseSet.blockedOrSkippedIds];
}

function sameCaseSetStatus(left: ImageEmbeddingEvidenceCaseSet, right: ImageEmbeddingEvidenceCaseSet): boolean {
  return sameIdSet(left.passIds, right.passIds)
    && sameIdSet(left.failIds, right.failIds)
    && sameIdSet(left.blockedOrSkippedIds, right.blockedOrSkippedIds);
}

function validateCaseSetRegression(
  baseline: ImageEmbeddingEvidenceCaseSet,
  candidate: ImageEmbeddingEvidenceCaseSet,
  label: string,
): string[] {
  const baselineIds = caseSetIds(baseline).sort();
  const candidateIds = caseSetIds(candidate).sort();
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

function parseSimpleSuite(value: unknown, label: string, expectedCaseCount?: number): {
  suite?: ImageEmbeddingEvidenceSuite;
  reasons: string[];
} {
  if (!exactKeys(value, ["suiteChecksum", "caseIds"])) {
    return { reasons: [`${label} frozen suite schema is invalid.`] };
  }
  const caseIds = uniqueStringArray(value.caseIds);
  if (typeof value.suiteChecksum !== "string" || !CHECKSUM.test(value.suiteChecksum)
    || !caseIds
    || (expectedCaseCount !== undefined && caseIds.length !== expectedCaseCount)) {
    return { reasons: [`${label} frozen suite contents are invalid.`] };
  }
  return {
    suite: {
      suiteChecksum: value.suiteChecksum,
      caseIds,
    },
    reasons: [],
  };
}

function parseA2aCaseSetSuite(value: unknown): {
  suite?: ImageEmbeddingA2aCaseSetSuite;
  reasons: string[];
} {
  if (!exactKeys(value, ["suiteChecksum", "baseline"])) {
    return { reasons: ["A2A case-set frozen suite schema is invalid."] };
  }
  const baseline = parseCaseSet(value.baseline, "blockedIds", "A2A frozen baseline");
  if (typeof value.suiteChecksum !== "string" || !CHECKSUM.test(value.suiteChecksum)
    || !baseline.parsed) {
    return { reasons: [...baseline.reasons, "A2A case-set frozen suite contents are invalid."] };
  }
  const caseCount = caseSetIds(baseline.parsed).length;
  if (baseline.parsed.passIds.length !== A2A_CASE_SET_COUNTS.pass
    || baseline.parsed.failIds.length !== A2A_CASE_SET_COUNTS.fail
    || baseline.parsed.blockedOrSkippedIds.length !== A2A_CASE_SET_COUNTS.blocked
    || caseCount !== A2A_CASE_SET_COUNT) {
    return { reasons: ["A2A frozen baseline must contain the authoritative 55/40/5 100-row case set."] };
  }
  return {
    suite: {
      suiteChecksum: value.suiteChecksum,
      baseline: {
        passIds: baseline.parsed.passIds,
        failIds: baseline.parsed.failIds,
        blockedIds: baseline.parsed.blockedOrSkippedIds,
      },
    },
    reasons: [],
  };
}

function parseE2eCaseSetSuite(value: unknown): {
  suite?: ImageEmbeddingE2eCaseSetSuite;
  reasons: string[];
} {
  if (!exactKeys(value, ["suiteChecksum", "baseline"])) {
    return { reasons: ["E2E frozen suite schema is invalid."] };
  }
  const baseline = parseCaseSet(value.baseline, "skippedIds", "E2E frozen baseline");
  if (typeof value.suiteChecksum !== "string" || !CHECKSUM.test(value.suiteChecksum)
    || !baseline.parsed) {
    return { reasons: [...baseline.reasons, "E2E frozen suite contents are invalid."] };
  }
  if (caseSetIds(baseline.parsed).length !== E2E_CASE_COUNT) {
    return { reasons: ["E2E frozen suite must contain the authoritative 14-case baseline."] };
  }
  return {
    suite: {
      suiteChecksum: value.suiteChecksum,
      baseline: {
        passIds: baseline.parsed.passIds,
        failIds: baseline.parsed.failIds,
        skippedIds: baseline.parsed.blockedOrSkippedIds,
      },
    },
    reasons: [],
  };
}

export function parseImageEmbeddingEvidenceSuiteBindings(value: unknown): ImageEmbeddingEvidenceSuiteBindingsParseResult {
  if (!exactKeys(value, ["textBenchmark", "a2a", "e2e", "fusionE2e"])) {
    return { reasons: ["Image embedding evidence suite bindings are missing or malformed."] };
  }
  if (!exactKeys(value.a2a, ["caseSet", "replay"])) {
    return { reasons: ["A2A frozen suite bindings are malformed."] };
  }
  const textBenchmark = parseSimpleSuite(value.textBenchmark, "Text benchmark", TEXT_PROMPT_COUNT);
  const a2aCaseSet = parseA2aCaseSetSuite(value.a2a.caseSet);
  const a2aReplay = parseSimpleSuite(value.a2a.replay, "A2A replay", A2A_REPLAY_CASE_COUNT);
  const e2e = parseE2eCaseSetSuite(value.e2e);
  const fusionE2e = parseSimpleSuite(value.fusionE2e, "Fusion E2E");
  const reasons = [
    ...textBenchmark.reasons,
    ...a2aCaseSet.reasons,
    ...a2aReplay.reasons,
    ...e2e.reasons,
    ...fusionE2e.reasons,
  ];
  if (fusionE2e.suite && fusionE2e.suite.caseIds.length < MINIMUM_FUSION_E2E_CASE_COUNT) {
    reasons.push("Fusion E2E frozen suite does not meet the minimum targeted case count.");
  }
  if (!textBenchmark.suite || !a2aCaseSet.suite || !a2aReplay.suite || !e2e.suite || !fusionE2e.suite) {
    return { reasons };
  }
  return {
    bindings: {
      textBenchmark: textBenchmark.suite,
      a2a: { caseSet: a2aCaseSet.suite, replay: a2aReplay.suite },
      e2e: e2e.suite,
      fusionE2e: fusionE2e.suite,
    },
    reasons,
  };
}

function expectedA2aBaseline(suite: ImageEmbeddingA2aCaseSetSuite): ImageEmbeddingEvidenceCaseSet {
  return {
    passIds: suite.baseline.passIds,
    failIds: suite.baseline.failIds,
    blockedOrSkippedIds: suite.baseline.blockedIds,
  };
}

function expectedE2eBaseline(suite: ImageEmbeddingE2eCaseSetSuite): ImageEmbeddingEvidenceCaseSet {
  return {
    passIds: suite.baseline.passIds,
    failIds: suite.baseline.failIds,
    blockedOrSkippedIds: suite.baseline.skippedIds,
  };
}

function validateSuiteAndArtifactBinding(input: {
  label: string;
  evidenceSuiteChecksum: unknown;
  evidenceRunnerArtifactChecksum: unknown;
  suite?: Pick<ImageEmbeddingEvidenceSuite, "suiteChecksum">;
  observedRunnerArtifactChecksum?: string;
}): string[] {
  const reasons: string[] = [];
  if (!input.suite) {
    return [`${input.label} evidence cannot be accepted without frozen suite bindings.`];
  }
  if (typeof input.evidenceSuiteChecksum !== "string" || !CHECKSUM.test(input.evidenceSuiteChecksum)
    || input.evidenceSuiteChecksum !== input.suite.suiteChecksum) {
    reasons.push(`${input.label} evidence suite checksum does not match the frozen suite.`);
  }
  if (typeof input.evidenceRunnerArtifactChecksum !== "string" || !CHECKSUM.test(input.evidenceRunnerArtifactChecksum)) {
    reasons.push(`${input.label} evidence runner artifact checksum is invalid.`);
  }
  if (!input.observedRunnerArtifactChecksum || !CHECKSUM.test(input.observedRunnerArtifactChecksum)
    || input.evidenceRunnerArtifactChecksum !== input.observedRunnerArtifactChecksum) {
    reasons.push(`${input.label} runner artifact is missing or detached from this evidence.`);
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
  if (!exactKeys(evidence, [
    "schemaVersion",
    "releaseVersion",
    "commitSha",
    "baseManifestChecksum",
    "suiteChecksum",
    "runnerArtifactChecksum",
    "vectorBenchmark",
  ])) {
    return validation([...reasons, "Text benchmark evidence contains unsupported fields."]);
  }
  reasons.push(...validateSuiteAndArtifactBinding({
    label: "Text benchmark",
    evidenceSuiteChecksum: evidence.suiteChecksum,
    evidenceRunnerArtifactChecksum: evidence.runnerArtifactChecksum,
    suite: context.evidenceSuites?.textBenchmark,
    observedRunnerArtifactChecksum: context.runnerArtifactChecksums?.textBenchmark,
  }));
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
  if (!sameIdSet([...resultIds].sort(), [...(context.evidenceSuites?.textBenchmark.caseIds ?? [])].sort())) {
    reasons.push("Text benchmark evidence result IDs do not match the frozen prompt suite.");
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
  if (!exactKeys(evidence, ["schemaVersion", "releaseVersion", "commitSha", "baseManifestChecksum", "caseSet", "replay"])) {
    return validation([...reasons, "A2A evidence contains unsupported fields."]);
  }
  if (!exactKeys(evidence.caseSet, ["suiteChecksum", "runnerArtifactChecksum", "baseline", "candidate"])) {
    return validation([...reasons, "A2A case-set evidence schema is invalid."]);
  }
  reasons.push(...validateSuiteAndArtifactBinding({
    label: "A2A case set",
    evidenceSuiteChecksum: evidence.caseSet.suiteChecksum,
    evidenceRunnerArtifactChecksum: evidence.caseSet.runnerArtifactChecksum,
    suite: context.evidenceSuites?.a2a.caseSet,
    observedRunnerArtifactChecksum: context.runnerArtifactChecksums?.a2aCaseSet,
  }));
  const baseline = parseCaseSet(evidence.caseSet.baseline, "blockedIds", "A2A baseline");
  const candidate = parseCaseSet(evidence.caseSet.candidate, "blockedIds", "A2A candidate");
  reasons.push(...baseline.reasons, ...candidate.reasons);
  const expectedBaseline = context.evidenceSuites?.a2a.caseSet
    ? expectedA2aBaseline(context.evidenceSuites.a2a.caseSet)
    : undefined;
  if (baseline.parsed && expectedBaseline && !sameCaseSetStatus(baseline.parsed, expectedBaseline)) {
    reasons.push("A2A baseline statuses do not match the frozen authoritative 55/40/5 case set.");
  }
  if (candidate.parsed && expectedBaseline) {
    reasons.push(...validateCaseSetRegression(expectedBaseline, candidate.parsed, "A2A"));
  }
  if (!exactKeys(evidence.replay, ["suiteChecksum", "runnerArtifactChecksum", "caseIds", "averageTotal", "hardResistanceViolationIds"])) {
    return validation([...reasons, "A2A replay schema is invalid."]);
  }
  reasons.push(...validateSuiteAndArtifactBinding({
    label: "A2A replay",
    evidenceSuiteChecksum: evidence.replay.suiteChecksum,
    evidenceRunnerArtifactChecksum: evidence.replay.runnerArtifactChecksum,
    suite: context.evidenceSuites?.a2a.replay,
    observedRunnerArtifactChecksum: context.runnerArtifactChecksums?.a2aReplay,
  }));
  const replayCaseIds = uniqueStringArray(evidence.replay.caseIds);
  const averageTotal = evidence.replay.averageTotal;
  const hardResistanceViolationIds = uniqueStringArray(evidence.replay.hardResistanceViolationIds);
  if (!replayCaseIds || replayCaseIds.length !== A2A_REPLAY_CASE_COUNT || !finiteNumber(averageTotal) || !hardResistanceViolationIds) {
    return validation([...reasons, "A2A replay summary is invalid."]);
  }
  const expectedReplayIds = context.evidenceSuites?.a2a.replay.caseIds ?? [];
  if (!sameIdSet([...replayCaseIds].sort(), [...expectedReplayIds].sort())) {
    reasons.push("A2A replay case IDs do not match the independent frozen 50-case replay suite.");
  }
  if (!isSubset(hardResistanceViolationIds, expectedReplayIds)) {
    reasons.push("A2A replay contains a hard-resistance ID outside the frozen replay suite.");
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
  if (!exactKeys(evidence, [
    "schemaVersion",
    "releaseVersion",
    "commitSha",
    "baseManifestChecksum",
    "suiteChecksum",
    "runnerArtifactChecksum",
    "preflight",
    "caseSets",
  ])) {
    return validation([...reasons, "E2E evidence contains unsupported fields."]);
  }
  reasons.push(...validateSuiteAndArtifactBinding({
    label: "E2E",
    evidenceSuiteChecksum: evidence.suiteChecksum,
    evidenceRunnerArtifactChecksum: evidence.runnerArtifactChecksum,
    suite: context.evidenceSuites?.e2e,
    observedRunnerArtifactChecksum: context.runnerArtifactChecksums?.e2e,
  }));
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
  const expectedBaseline = context.evidenceSuites?.e2e
    ? expectedE2eBaseline(context.evidenceSuites.e2e)
    : undefined;
  if (baseline.parsed && expectedBaseline && !sameCaseSetStatus(baseline.parsed, expectedBaseline)) {
    reasons.push("E2E baseline statuses do not match the frozen 14-case suite.");
  }
  if (candidate.parsed && expectedBaseline) {
    reasons.push(...validateCaseSetRegression(expectedBaseline, candidate.parsed, "E2E"));
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
    "suiteChecksum",
    "runnerArtifactChecksum",
    "promotionBindingChecksum",
    "preflight",
    "targetedE2e",
  ])) {
    return validation([...reasons, "Fusion E2E evidence contains unsupported fields."]);
  }
  reasons.push(...validateSuiteAndArtifactBinding({
    label: "Fusion E2E",
    evidenceSuiteChecksum: evidence.suiteChecksum,
    evidenceRunnerArtifactChecksum: evidence.runnerArtifactChecksum,
    suite: context.evidenceSuites?.fusionE2e,
    observedRunnerArtifactChecksum: context.runnerArtifactChecksums?.fusionE2e,
  }));
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
  const frozenCaseIds = context.evidenceSuites?.fusionE2e.caseIds ?? [];
  if (new Set(observedIds).size !== observedIds.length
    || !sameIdSet([...expectedCaseIds].sort(), [...frozenCaseIds].sort())
    || !sameIdSet([...expectedCaseIds].sort(), [...observedIds].sort())
    || !sameIdSet([...expectedCaseIds].sort(), [...passedCaseIds].sort())
    || failedCaseIds.length > 0
    || skippedCaseIds.length > 0) {
    reasons.push("Fusion E2E targeted cases are incomplete, failed, skipped, or do not match the frozen suite.");
  }
  return validation(reasons);
}
