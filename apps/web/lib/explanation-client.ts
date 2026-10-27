import type { ArtworkExplanation, ArtworkExplanationContent } from "@artduo/contracts";
import path from "node:path";
import { createArtworkExplanationRoute } from "../../api/src/routes/artworks";
import { readProjectModelEnvironment } from "../../api/src/services/curation/chat-provider";
import { projectRootFromCwd } from "../../api/src/runtime/environment";
import { loadWebReleaseCatalog } from "./release-catalog";
import { parseViewingIntent, viewingFocusEvidence } from "./viewing-intent";
import { NARRATIVE_RECIPE_VERSION, validateGroundedArtworkText } from "../../api/src/services/curation/exhibition-narrative";
import { PersistentExplanationCache } from "../../api/src/services/explanations/explanation-cache";
import {
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

const unavailableRoute: ArtworkExplanationRoute = { getArtworkExplanation: () => ({ status: 503, body: { code: "provider_unavailable", message: "作品讲解暂时无法生成，请稍后重试。" } }) };
let providerFingerprint = "";
let providerRoute: ArtworkExplanationRoute | undefined;

export function validateCurrentExplanationContent(rootDir: string, content: ArtworkExplanationContent): void {
  const grounding = content.evidence.grounding;
  const verified = loadWebReleaseCatalog({ rootDir, releaseVersion: grounding.releaseVersion }).artworkById.get(grounding.artwork.id);
  if (!verified) throw new TypeError("Explanation artwork is unavailable");
  if (verified.visualEvidence) {
    if (grounding.artwork.description !== verified.visualEvidence.observation || grounding.artwork.artistDisplayName !== verified.artistDisplayName) throw new TypeError("Explanation evidence has changed");
    const intent = parseViewingIntent(grounding.userText), supported = viewingFocusEvidence(verified, intent);
    validateGroundedArtworkText(`${content.shortText}\n${content.detailText}`, {
      id: verified.id, title: verified.title, medium: verified.medium, stageIndex: 0,
      editorialMoods: [], editorialPalette: [], editorialComposition: [],
      visualObservation: { text: verified.visualEvidence.observation, imageSha256: verified.visualEvidence.imageSha256,
        source: "local-image-review", facts: verified.visualEvidence.facts, spatialFraming: verified.visualEvidence.spatialFraming },
    }, intent.focuses?.map(topic => ({ topic, label: topic, evidenceIds: supported.some(focus => focus.topic === topic) ? [verified.id] : [] })));
  }
}

function currentProviderEnv(): ExplanationProviderEnv {
  const cwd = process.cwd();
  const env = readProjectModelEnvironment(cwd.endsWith(path.join("apps", "web")) ? path.resolve(cwd, "../..") : cwd);
  return {
    ARTDUO_EXPLANATION_PROVIDER: env.ARTDUO_EXPLANATION_PROVIDER ?? (env.ARTDUO_CURATION_ENDPOINT ? "openai-compatible" : undefined),
    ARTDUO_EXPLANATION_ENDPOINT: env.ARTDUO_EXPLANATION_ENDPOINT ?? env.ARTDUO_CURATION_ENDPOINT,
    ARTDUO_EXPLANATION_MODEL: env.ARTDUO_EXPLANATION_MODEL ?? env.ARTDUO_CURATION_MODEL,
    ARTDUO_EXPLANATION_API_KEY: env.ARTDUO_EXPLANATION_API_KEY ?? env.ARTDUO_CURATION_API_KEY,
    DEEPSEEK_BASE_URL: env.DEEPSEEK_BASE_URL,
    DEEPSEEK_MODEL: env.DEEPSEEK_MODEL,
    DEEPSEEK_API_KEY: env.DEEPSEEK_API_KEY,
  };
}

function resolveDefaultRoute(): ArtworkExplanationRoute {
  const env = currentProviderEnv();
  const fingerprint = Object.values(env).map((value) => value ?? "").join("\u0000");
  if (fingerprint !== providerFingerprint) {
    const generator = createServerGroundedExplanationGeneratorFromEnv({
      env,
      fetchImpl: fetch,
      rootDir: projectRootFromCwd(),
    });
    const root = projectRootFromCwd();
    providerRoute = generator ? createArtworkExplanationRoute({ rootDir: root,
      cache: new PersistentExplanationCache(root, `${env.ARTDUO_EXPLANATION_MODEL ?? env.DEEPSEEK_MODEL}:${NARRATIVE_RECIPE_VERSION}`, content => validateCurrentExplanationContent(root, content)),
      generator: async input => {
      const content = await generator(input);
      const verified = loadWebReleaseCatalog({ rootDir: projectRootFromCwd(), releaseVersion: input.releaseVersion }).artworkById.get(input.artworkId);
      if (verified?.visualEvidence) {
        const intent = parseViewingIntent(input.contextText), supported = viewingFocusEvidence(verified, intent);
        validateGroundedArtworkText(`${content.shortText}\n${content.detailText}`, {
          id: verified.id, title: verified.title, medium: verified.medium, stageIndex: 0,
          editorialMoods: [], editorialPalette: [], editorialComposition: [],
          visualObservation: { text: verified.visualEvidence.observation, imageSha256: verified.visualEvidence.imageSha256,
            source: "local-image-review", facts: verified.visualEvidence.facts, spatialFraming: verified.visualEvidence.spatialFraming },
        }, intent.focuses?.map(topic => ({ topic, label: topic, evidenceIds: supported.some(focus => focus.topic === topic) ? [verified.id] : [] })));
      }
      return content;
    }, resolveArtworkEvidence(artwork, releaseVersion) {
      const verified = loadWebReleaseCatalog({ rootDir: projectRootFromCwd(), releaseVersion }).artworkById.get(artwork.id);
      return verified ? { ...artwork, artistDisplayName: verified.artistDisplayName,
        description: verified.visualEvidence?.observation ?? artwork.description } : artwork;
    } }) : undefined;
    providerFingerprint = fingerprint;
  }

  return providerRoute ?? unavailableRoute;
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
