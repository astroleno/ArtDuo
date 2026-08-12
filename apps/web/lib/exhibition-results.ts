import {
  buildHardFilterPartition,
  type HardFilterEvidence,
} from "./hard-filter-evidence";
import type { WebSearchResult } from "./release-catalog";

export interface HardFilteredExhibition {
  search: WebSearchResult;
  evidence: HardFilterEvidence;
}

export function buildHardFilteredExhibition(
  candidateSearch: WebSearchResult,
  options: { limit?: number } = {},
): HardFilteredExhibition {
  const limit = options.limit ?? 12;
  const partition = buildHardFilterPartition(candidateSearch, limit);

  return {
    search: {
      ...candidateSearch,
      results: partition.visibleResults.map((candidate, index) => ({ ...candidate, rank: index + 1 })),
    },
    evidence: partition.evidence,
  };
}
