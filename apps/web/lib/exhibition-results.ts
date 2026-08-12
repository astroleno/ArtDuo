import {
  buildUserAffectAgent,
  findAffectResistanceConflict,
  hardResistanceSignals,
  normalizeAffectSignal,
} from "@artduo/corpus";

import type { WebSearchResult } from "./release-catalog";
import {
  HARD_FILTER_EVIDENCE_SCHEMA_VERSION,
  type HardFilterEvidence,
} from "./hard-filter-evidence";

type Candidate = WebSearchResult["results"][number];

export interface HardFilteredExhibition {
  search: WebSearchResult;
  evidence: HardFilterEvidence;
}

export function artworkAffectSignals(candidate: Candidate): string[] {
  const artwork = candidate.artwork;
  return [...new Set([
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
  ].map(normalizeAffectSignal).filter(Boolean))];
}

export function visibleHardResistanceViolationIds(search: WebSearchResult): string[] {
  const hardSignals = hardResistanceSignals(buildUserAffectAgent(search.query));
  if (hardSignals.length === 0) {
    return [];
  }

  return search.results
    .filter((candidate) => Boolean(findAffectResistanceConflict(hardSignals, artworkAffectSignals(candidate))))
    .map((candidate) => candidate.artwork.id);
}

export function buildHardFilteredExhibition(
  candidateSearch: WebSearchResult,
  options: { limit?: number } = {},
): HardFilteredExhibition {
  const limit = options.limit ?? 12;
  if (!Number.isInteger(limit) || limit < 0) {
    throw new TypeError("Hard-filtered exhibition limit must be a non-negative integer.");
  }
  const hardSignals = hardResistanceSignals(buildUserAffectAgent(candidateSearch.query));
  const rejections: HardFilterEvidence["rejections"] = [];
  const accepted: WebSearchResult["results"] = [];

  for (const candidate of candidateSearch.results) {
    const conflict = findAffectResistanceConflict(hardSignals, artworkAffectSignals(candidate));
    if (conflict) {
      rejections.push({
        artworkId: candidate.artwork.id,
        title: candidate.artwork.title,
        signal: conflict,
      });
      continue;
    }
    if (accepted.length < limit) {
      accepted.push(candidate);
    }
  }

  const search: WebSearchResult = {
      ...candidateSearch,
      results: accepted.map((candidate, index) => ({ ...candidate, rank: index + 1 })),
  };
  const evidence: HardFilterEvidence = {
    schemaVersion: HARD_FILTER_EVIDENCE_SCHEMA_VERSION,
    query: candidateSearch.query,
    normalizedQuery: candidateSearch.normalizedQuery,
    candidateCount: candidateSearch.results.length,
    visibleLimit: limit,
    visibleArtworkIds: search.results.map((candidate) => candidate.artwork.id),
    rejections,
  };

  return {
    search,
    evidence,
  };
}
