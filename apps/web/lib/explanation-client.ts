import type { ArtworkExplanation } from "@artduo/contracts";
import { createArtworkExplanationRoute } from "../../api/src/routes/artworks";
import {
  createDeterministicGroundedExplanationGenerator,
  createServerGroundedExplanationGeneratorFromEnv,
  type ExplanationProviderEnv,
} from "../../api/src/services/explanations/explanation-generator-adapter";

interface ArtworkExplanationRoute {
  getArtworkExplanation: (input: {
    artworkId: string;
    releaseVersion: string;
    contextText: string;
    backgroundSceneId?: string;
    retrievalScore?: number;
    matchedTokens?: string[];
  }) =>
    | { status: number; body: ArtworkExplanation | { code: string; message: string } }
    | Promise<{ status: number; body: ArtworkExplanation | { code: string; message: string } }>;
}

const localRoute = createArtworkExplanationRoute({
  generator: createDeterministicGroundedExplanationGenerator({ model: "local-curation-generator-v0" }),
});
let providerFingerprint = "";
let providerRoute: ArtworkExplanationRoute | undefined;

function currentProviderFingerprint(): string {
  return [
    process.env.ARTDUO_EXPLANATION_PROVIDER,
    process.env.ARTDUO_EXPLANATION_ENDPOINT,
    process.env.ARTDUO_EXPLANATION_MODEL,
    process.env.ARTDUO_EXPLANATION_API_KEY,
    process.env.DEEPSEEK_BASE_URL,
    process.env.DEEPSEEK_MODEL,
    process.env.DEEPSEEK_API_KEY,
  ].map((value) => value ?? "").join("\u0000");
}

function currentProviderEnv(): ExplanationProviderEnv {
  return {
    ARTDUO_EXPLANATION_PROVIDER: process.env.ARTDUO_EXPLANATION_PROVIDER,
    ARTDUO_EXPLANATION_ENDPOINT: process.env.ARTDUO_EXPLANATION_ENDPOINT,
    ARTDUO_EXPLANATION_MODEL: process.env.ARTDUO_EXPLANATION_MODEL,
    ARTDUO_EXPLANATION_API_KEY: process.env.ARTDUO_EXPLANATION_API_KEY,
    DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL,
    DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
  };
}

function resolveDefaultRoute(): ArtworkExplanationRoute {
  const fingerprint = currentProviderFingerprint();
  if (fingerprint !== providerFingerprint) {
    const generator = createServerGroundedExplanationGeneratorFromEnv({
      env: currentProviderEnv(),
      fetchImpl: fetch,
    });
    providerRoute = generator ? createArtworkExplanationRoute({ generator }) : undefined;
    providerFingerprint = fingerprint;
  }

  return providerRoute ?? localRoute;
}

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
  const activeRoute = deps?.route ?? resolveDefaultRoute();

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
