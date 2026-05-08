import type { ArtworkExplanation, ArtworkExplanationContent, GroundingContext } from "@artduo/contracts";

import { buildExplanationCacheKey, InMemoryExplanationCache } from "./explanation-cache";

export interface GetArtworkExplanationInput {
  artworkId: string;
  releaseVersion: string;
  contextText: string;
  grounding: GroundingContext;
}

export interface ArtworkExplanationGeneratorInput extends GetArtworkExplanationInput {}

export type ArtworkExplanationGenerator = (
  input: ArtworkExplanationGeneratorInput,
) => ArtworkExplanationContent | Promise<ArtworkExplanationContent>;

export async function getArtworkExplanation(
  cache: InMemoryExplanationCache,
  input: GetArtworkExplanationInput,
  generator?: ArtworkExplanationGenerator,
): Promise<ArtworkExplanation> {
  const cacheKey = buildExplanationCacheKey(input);
  const cached = cache.get(cacheKey);
  if (cached) {
    return {
      artworkId: input.artworkId,
      releaseVersion: input.releaseVersion,
      status: "ready",
      content: cached,
      cacheKey,
      updatedAt: cached.generatedAt,
    };
  }

  if (!generator) {
    return {
      artworkId: input.artworkId,
      releaseVersion: input.releaseVersion,
      status: "pending",
      cacheKey,
      updatedAt: new Date().toISOString(),
    };
  }

  const content = await generator(input);
  cache.set(cacheKey, content);
  return {
    artworkId: input.artworkId,
    releaseVersion: input.releaseVersion,
    status: "ready",
    content,
    cacheKey,
    updatedAt: content.generatedAt,
  };
}
