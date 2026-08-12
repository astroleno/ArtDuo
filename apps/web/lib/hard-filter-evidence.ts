import type { GrowthForm, NegotiationTrace } from "@artduo/contracts";
import { parseGrowthForm } from "@artduo/contracts";

import type { WebSearchResult } from "./release-catalog";

export const HARD_FILTER_EVIDENCE_SCHEMA_VERSION = "hard-filter-evidence.v1" as const;

export interface HardFilterRejection {
  artworkId: string;
  title: string;
  signal: string;
}

export interface HardFilterEvidence {
  schemaVersion: typeof HARD_FILTER_EVIDENCE_SCHEMA_VERSION;
  query: string;
  normalizedQuery: string;
  candidateCount: number;
  visibleLimit: number;
  visibleArtworkIds: string[];
  rejections: HardFilterRejection[];
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

function assertUnique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new TypeError(`${label} must contain unique artwork IDs.`);
  }
}

export function assertHardFilterEvidenceMatchesSearch(
  evidence: HardFilterEvidence,
  search: WebSearchResult,
): void {
  if (evidence.schemaVersion !== HARD_FILTER_EVIDENCE_SCHEMA_VERSION) {
    throw new TypeError("Hard-filter evidence schema version is not supported.");
  }
  if (evidence.query !== search.query) {
    throw new TypeError("Hard-filter evidence query does not match the visible search.");
  }
  if (evidence.normalizedQuery !== search.normalizedQuery) {
    throw new TypeError("Hard-filter evidence normalized query does not match the visible search.");
  }
  if (!Number.isInteger(evidence.candidateCount) || evidence.candidateCount < search.results.length) {
    throw new TypeError("Hard-filter evidence candidate count is invalid.");
  }
  if (!Number.isInteger(evidence.visibleLimit) || evidence.visibleLimit < search.results.length) {
    throw new TypeError("Hard-filter evidence visible limit is invalid.");
  }

  const visibleArtworkIds = search.results.map((result) => result.artwork.id);
  assertUnique(evidence.visibleArtworkIds, "Hard-filter evidence visibleArtworkIds");
  if (evidence.visibleArtworkIds.length !== visibleArtworkIds.length
    || evidence.visibleArtworkIds.some((artworkId, index) => artworkId !== visibleArtworkIds[index])) {
    throw new TypeError("Hard-filter evidence visible artwork IDs do not match the visible search.");
  }

  const rejectedArtworkIds = evidence.rejections.map((rejection) => rejection.artworkId);
  assertUnique(rejectedArtworkIds, "Hard-filter evidence rejections");
  const visible = new Set(visibleArtworkIds);
  if (rejectedArtworkIds.some((artworkId) => visible.has(artworkId))) {
    throw new TypeError("Hard-filter evidence cannot reject a visible artwork.");
  }
  if (evidence.candidateCount < visibleArtworkIds.length + rejectedArtworkIds.length) {
    throw new TypeError("Hard-filter evidence accounts for more artworks than its candidate count.");
  }
  if (evidence.rejections.some((rejection) => (
    !rejection.artworkId.trim() || !rejection.title.trim() || !rejection.signal.trim()
  ))) {
    throw new TypeError("Hard-filter evidence rejections require artworkId, title, and signal.");
  }
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
