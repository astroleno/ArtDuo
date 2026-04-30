import type { CreateCurationRequest } from "@artduo/contracts";

import type { WebReleaseCatalog, WebSearchResult } from "./release-catalog";

export function buildCreateCurationRequest(input: {
  query: string;
  catalog: WebReleaseCatalog;
  search: WebSearchResult;
}): CreateCurationRequest {
  return {
    userText: input.query,
    releaseVersion: input.catalog.releaseVersion,
    sourceVersions: {
      corpusVersion: input.catalog.manifest.release.corpusVersion,
      backgroundCatalogVersion: input.catalog.manifest.release.backgroundCatalogVersion,
      contractsVersion: input.catalog.manifest.release.contractsVersion,
    },
    exhibitionSnapshot: input.search.results.map((result) => ({
      unitId: `unit-${result.rank}-${result.artwork.id}`,
      artworkId: result.artwork.id,
      backgroundSceneId: result.scene?.id,
      rank: result.rank,
      score: result.combinedScore,
    })),
  };
}
