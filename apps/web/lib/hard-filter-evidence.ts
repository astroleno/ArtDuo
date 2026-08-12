import { createHash } from "node:crypto";

import {
  buildUserAffectAgent,
  findAffectResistanceConflict,
  hardResistanceSignals,
  normalizeAffectSignal,
} from "@artduo/corpus";
import type { GrowthForm, NegotiationTrace } from "@artduo/contracts";
import { parseGrowthForm } from "@artduo/contracts";

import type { WebSearchResult } from "./release-catalog";

export const HARD_FILTER_EVIDENCE_SCHEMA_VERSION = "hard-filter-evidence.v2" as const;
export const HARD_FILTER_POLICY_VERSION = "artwork-affect-hard-filter.v1" as const;

type Candidate = WebSearchResult["results"][number];

export interface HardFilterRejection {
  artworkId: string;
  title: string;
  signal: string;
}

export interface HardFilterEvidence {
  schemaVersion: typeof HARD_FILTER_EVIDENCE_SCHEMA_VERSION;
  filterPolicyVersion: typeof HARD_FILTER_POLICY_VERSION;
  query: string;
  normalizedQuery: string;
  candidateCount: number;
  candidateArtworkIds: string[];
  candidatePoolChecksum: `sha256:${string}`;
  hardRuleSignals: string[];
  hardRuleChecksum: `sha256:${string}`;
  visibleLimit: number;
  visibleArtworkIds: string[];
  eligibleUnselectedArtworkIds: string[];
  rejections: HardFilterRejection[];
}

export interface HardFilterPartition {
  visibleResults: WebSearchResult["results"];
  evidence: HardFilterEvidence;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function hash(value: string): string {
  let hashValue = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hashValue ^= value.charCodeAt(index);
    hashValue = Math.imul(hashValue, 16777619);
  }

  return (hashValue >>> 0).toString(36);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Hard-filter canonical JSON only permits finite numbers.");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  throw new TypeError("Hard-filter canonical JSON only permits JSON values.");
}

function sha256(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function assertSameJson(actual: unknown, expected: unknown, label: string): void {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new TypeError(`Hard-filter evidence ${label} does not match the candidate partition.`);
  }
}

export function artworkAffectSignals(candidate: Candidate): string[] {
  const artwork = candidate.artwork;
  return unique([
    ...artwork.moodTags,
    ...artwork.emotionLabels,
    ...artwork.keywordBoosts,
    ...artwork.colorTags,
    ...artwork.subjectTags,
    ...artwork.compositionTags,
    ...artwork.sceneAffinity.paletteModes,
    ...artwork.sceneAffinity.sceneTypes,
    ...artwork.sceneAffinity.spatialModes,
    artwork.motionProfile,
  ].map(normalizeAffectSignal).filter(Boolean));
}

function candidatePoolChecksum(candidateSearch: WebSearchResult): `sha256:${string}` {
  return sha256(canonicalJson(candidateSearch.results));
}

function hardRuleChecksum(hardRuleSignals: string[]): `sha256:${string}` {
  return sha256(canonicalJson({
    filterPolicyVersion: HARD_FILTER_POLICY_VERSION,
    hardRuleSignals,
  }));
}

export function buildHardFilterPartition(
  candidateSearch: WebSearchResult,
  visibleLimit: number,
): HardFilterPartition {
  if (!Number.isInteger(visibleLimit) || visibleLimit < 0) {
    throw new TypeError("Hard-filtered exhibition limit must be a non-negative integer.");
  }
  const candidateArtworkIds = candidateSearch.results.map((candidate) => candidate.artwork.id);
  if (new Set(candidateArtworkIds).size !== candidateArtworkIds.length) {
    throw new TypeError("Hard-filter candidate artwork IDs must be unique.");
  }

  const hardRuleSignals = hardResistanceSignals(buildUserAffectAgent(candidateSearch.query));
  const eligible: WebSearchResult["results"] = [];
  const rejections: HardFilterRejection[] = [];
  for (const candidate of candidateSearch.results) {
    const conflict = findAffectResistanceConflict(hardRuleSignals, artworkAffectSignals(candidate));
    if (conflict) {
      rejections.push({
        artworkId: candidate.artwork.id,
        title: candidate.artwork.title,
        signal: conflict,
      });
    } else {
      eligible.push(candidate);
    }
  }
  const visibleResults = eligible.slice(0, visibleLimit);
  const eligibleUnselected = eligible.slice(visibleLimit);

  return {
    visibleResults,
    evidence: {
      schemaVersion: HARD_FILTER_EVIDENCE_SCHEMA_VERSION,
      filterPolicyVersion: HARD_FILTER_POLICY_VERSION,
      query: candidateSearch.query,
      normalizedQuery: candidateSearch.normalizedQuery,
      candidateCount: candidateSearch.results.length,
      candidateArtworkIds,
      candidatePoolChecksum: candidatePoolChecksum(candidateSearch),
      hardRuleSignals,
      hardRuleChecksum: hardRuleChecksum(hardRuleSignals),
      visibleLimit,
      visibleArtworkIds: visibleResults.map((candidate) => candidate.artwork.id),
      eligibleUnselectedArtworkIds: eligibleUnselected.map((candidate) => candidate.artwork.id),
      rejections,
    },
  };
}

export function assertHardFilterEvidenceMatchesSearch(
  evidence: HardFilterEvidence,
  search: WebSearchResult,
  candidateSearch: WebSearchResult,
  expectedVisibleLimit: number,
): void {
  if (evidence.schemaVersion !== HARD_FILTER_EVIDENCE_SCHEMA_VERSION) {
    throw new TypeError("Hard-filter evidence schema version is not supported.");
  }
  if (evidence.filterPolicyVersion !== HARD_FILTER_POLICY_VERSION) {
    throw new TypeError("Hard-filter evidence policy version is not supported.");
  }
  if (evidence.query !== search.query || evidence.query !== candidateSearch.query) {
    throw new TypeError("Hard-filter evidence query does not match its searches.");
  }
  if (evidence.normalizedQuery !== search.normalizedQuery
    || evidence.normalizedQuery !== candidateSearch.normalizedQuery) {
    throw new TypeError("Hard-filter evidence normalized query does not match its searches.");
  }
  if (evidence.visibleLimit !== expectedVisibleLimit) {
    throw new TypeError("Hard-filter evidence visible limit does not match the caller binding.");
  }

  const expectedPartition = buildHardFilterPartition(candidateSearch, expectedVisibleLimit);
  const expected = expectedPartition.evidence;
  assertSameJson(evidence.candidateCount, expected.candidateCount, "candidate count");
  assertSameJson(evidence.candidateArtworkIds, expected.candidateArtworkIds, "candidate artwork IDs");
  assertSameJson(evidence.candidatePoolChecksum, expected.candidatePoolChecksum, "candidate pool checksum");
  assertSameJson(evidence.hardRuleSignals, expected.hardRuleSignals, "hard-rule signals");
  assertSameJson(evidence.hardRuleChecksum, expected.hardRuleChecksum, "hard-rule checksum");
  assertSameJson(evidence.visibleArtworkIds, expected.visibleArtworkIds, "visible partition");
  assertSameJson(
    evidence.eligibleUnselectedArtworkIds,
    expected.eligibleUnselectedArtworkIds,
    "eligible-unselected partition",
  );
  assertSameJson(evidence.rejections, expected.rejections, "rejection semantics");

  const expectedVisibleResults = expectedPartition.visibleResults
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
  assertSameJson(search.results, expectedVisibleResults, "visible search content");
}

export function mergeHardFilterEvidenceIntoGrowthForm(
  growthForm: GrowthForm,
  evidence: HardFilterEvidence,
): GrowthForm {
  const upstreamRejectedArtworkIds = evidence.rejections.map((rejection) => rejection.artworkId);
  const rejectedArtworkIds = unique([
    ...upstreamRejectedArtworkIds,
    ...growthForm.rejectedArtworkIds,
  ]);
  const upstreamTrace: NegotiationTrace[] = evidence.rejections.map((rejection) => ({
    id: `trace-prefilter-reject-${rejection.artworkId}`,
    step: "reject",
    artworkId: rejection.artworkId,
    signal: rejection.signal,
    message: `Rejected ${rejection.title} during pre-negotiation hard filtering because it matched ${rejection.signal}.`,
  }));
  const firstTrace = growthForm.trace[0];
  const remainingTrace = firstTrace ? growthForm.trace.slice(1) : growthForm.trace;

  return parseGrowthForm({
    ...growthForm,
    id: `growth-${hash(`${growthForm.sourceText}:${growthForm.supportingArtworkIds.join(",")}:${rejectedArtworkIds.join(",")}`)}`,
    rejectedArtworkIds,
    trace: firstTrace
      ? [firstTrace, ...upstreamTrace, ...remainingTrace]
      : [...upstreamTrace, ...remainingTrace],
  });
}
