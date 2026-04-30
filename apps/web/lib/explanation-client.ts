import type { ArtworkExplanation } from "@artduo/contracts";

interface ArtworkExplanationRoute {
  getArtworkExplanation: (input: {
    artworkId: string;
    releaseVersion: string;
    contextText: string;
  }) => Promise<{ status: number; body: ArtworkExplanation | { code: string; message: string } }>;
}

export async function getArtworkExplanationClient(
  input: { artworkId: string; releaseVersion: string; contextText?: string },
  deps?: { route?: ArtworkExplanationRoute },
): Promise<ArtworkExplanation> {
  const route = deps?.route;
  if (!route) {
    return {
      artworkId: input.artworkId,
      releaseVersion: input.releaseVersion,
      status: "pending",
      cacheKey: `pending:${input.releaseVersion}:${input.artworkId}`,
      updatedAt: new Date().toISOString(),
    };
  }

  const response = await route.getArtworkExplanation({
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
