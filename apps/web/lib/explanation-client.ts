import type { ArtworkExplanation } from "@artduo/contracts";
import { createArtworkExplanationRoute } from "../../api/src/routes/artworks";

interface ArtworkExplanationRoute {
  getArtworkExplanation: (input: {
    artworkId: string;
    releaseVersion: string;
    contextText: string;
  }) => Promise<{ status: number; body: ArtworkExplanation | { code: string; message: string } }>;
}

const route = createArtworkExplanationRoute({
  generator: ({ artworkId, contextText }) => {
    const context = contextText.trim() || "your curation intent";
    const now = new Date().toISOString();
    return {
      title: `Curation Note · ${artworkId}`,
      shortText: `Curation note: ${context.slice(0, 120)}`,
      detailText: `This artwork resonates with the current intent through composition, mood, and scene affinity cues from the release corpus.`,
      generatedAt: now,
      model: "local-curation-generator-v0",
    };
  },
});

export async function getArtworkExplanationClient(
  input: { artworkId: string; releaseVersion: string; contextText?: string },
  deps?: { route?: ArtworkExplanationRoute },
): Promise<ArtworkExplanation> {
  const activeRoute = deps?.route ?? route;

  const response = await activeRoute.getArtworkExplanation({
    artworkId: input.artworkId,
    releaseVersion: input.releaseVersion,
    contextText: input.contextText ?? "",
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
