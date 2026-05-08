import type { ArtworkExplanation } from "@artduo/contracts";
import { createArtworkExplanationRoute } from "../../api/src/routes/artworks";
import { createDeterministicGroundedExplanationGenerator } from "../../api/src/services/explanations/explanation-generator-adapter";

interface ArtworkExplanationRoute {
  getArtworkExplanation: (input: {
    artworkId: string;
    releaseVersion: string;
    contextText: string;
    backgroundSceneId?: string;
    retrievalScore?: number;
    matchedTokens?: string[];
  }) => Promise<{ status: number; body: ArtworkExplanation | { code: string; message: string } }>;
}

const route = createArtworkExplanationRoute({
  generator: createDeterministicGroundedExplanationGenerator({ model: "local-curation-generator-v0" }),
});

export async function getArtworkExplanationClient(
  input: {
    artworkId: string;
    releaseVersion: string;
    contextText?: string;
    backgroundSceneId?: string;
    retrievalScore?: number;
    matchedTokens?: string[];
  },
  deps?: { route?: ArtworkExplanationRoute },
): Promise<ArtworkExplanation> {
  const activeRoute = deps?.route ?? route;

  const response = await activeRoute.getArtworkExplanation({
    artworkId: input.artworkId,
    releaseVersion: input.releaseVersion,
    contextText: input.contextText ?? "",
    backgroundSceneId: input.backgroundSceneId,
    retrievalScore: input.retrievalScore,
    matchedTokens: input.matchedTokens,
  });

  if (response.status !== 200) {
    return {
      artworkId: input.artworkId,
      releaseVersion: input.releaseVersion,
      status: "failed",
      error: "Explanation unavailable",
      cacheKey: `failed:${input.releaseVersion}:${input.artworkId}`,
      updatedAt: new Date().toISOString(),
    };
  }

  return response.body as ArtworkExplanation;
}
