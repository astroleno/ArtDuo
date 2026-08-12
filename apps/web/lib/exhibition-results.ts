import {
  buildUserAffectAgent,
  findAffectResistanceConflict,
  hardResistanceSignals,
  normalizeAffectSignal,
} from "@artduo/corpus";

import type { WebSearchResult } from "./release-catalog";

type Candidate = WebSearchResult["results"][number];

export interface HardFilteredExhibition {
  search: WebSearchResult;
  candidateCount: number;
  rejectedArtworkIds: string[];
  rejectionSignalsByArtworkId: Record<string, string>;
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
  const rejectedArtworkIds: string[] = [];
  const rejectionSignalsByArtworkId: Record<string, string> = {};
  const accepted: WebSearchResult["results"] = [];

  for (const candidate of candidateSearch.results) {
    const conflict = findAffectResistanceConflict(hardSignals, artworkAffectSignals(candidate));
    if (conflict) {
      rejectedArtworkIds.push(candidate.artwork.id);
      rejectionSignalsByArtworkId[candidate.artwork.id] = conflict;
      continue;
    }
    if (accepted.length < limit) {
      accepted.push(candidate);
    }
  }

  return {
    search: {
      ...candidateSearch,
      results: accepted.map((candidate, index) => ({ ...candidate, rank: index + 1 })),
    },
    candidateCount: candidateSearch.results.length,
    rejectedArtworkIds,
    rejectionSignalsByArtworkId,
  };
}
