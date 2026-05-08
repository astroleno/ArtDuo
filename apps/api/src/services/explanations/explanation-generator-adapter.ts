import type { ArtworkExplanationContent, GroundingContext } from "@artduo/contracts";

import type { ArtworkExplanationGenerator } from "./get-artwork-explanation";

export interface ExplanationProviderEnv {
  ARTDUO_EXPLANATION_PROVIDER?: string;
  ARTDUO_EXPLANATION_ENDPOINT?: string;
  ARTDUO_EXPLANATION_MODEL?: string;
  ARTDUO_EXPLANATION_API_KEY?: string;
}

export interface ExplanationProviderAdapterOptions {
  env?: ExplanationProviderEnv;
  fetchImpl?: typeof fetch;
  now?: () => string;
}

function buildGroundedEvidence(grounding: GroundingContext) {
  return {
    grounding,
    citations: [
      {
        kind: "user-intent" as const,
        sourceId: "userText",
        label: "User intent",
        text: grounding.userText,
      },
      {
        kind: "artwork" as const,
        sourceId: grounding.artwork.id,
        label: grounding.artwork.title,
        text: [
          grounding.artwork.title,
          grounding.artwork.artistDisplayName,
          grounding.artwork.yearLabel,
        ].filter(Boolean).join(", "),
        url: grounding.artwork.objectUrl ?? grounding.artwork.sourceApiUrl,
      },
      ...(grounding.scene
        ? [{
            kind: "scene" as const,
            sourceId: grounding.scene.id,
            label: grounding.scene.label,
            url: grounding.scene.imageUrl,
          }]
        : []),
      {
        kind: "release" as const,
        sourceId: grounding.releaseVersion,
        label: `Release ${grounding.releaseVersion}`,
        text: [
          `corpus=${grounding.sourceVersions.corpusVersion}`,
          `background=${grounding.sourceVersions.backgroundCatalogVersion}`,
          `contracts=${grounding.sourceVersions.contractsVersion}`,
        ].join("; "),
      },
      {
        kind: "retrieval" as const,
        sourceId: grounding.artwork.id,
        label: "Retrieval match",
        text: `score=${grounding.retrievalScore}; matchedTokens=${grounding.matchedTokens.join(", ")}`,
      },
    ],
  };
}

export function createDeterministicGroundedExplanationGenerator(input: {
  model?: string;
  now?: () => string;
} = {}): ArtworkExplanationGenerator {
  return ({ artworkId, contextText, grounding }) => {
    const userText = contextText.trim() || grounding.userText || "your curation intent";
    const title = grounding.artwork.title || artworkId;

    return {
      title: `Curation Note · ${title}`,
      shortText: `Curation note: ${userText.slice(0, 120)}`,
      detailText: [
        `${title} is explained from the release-grounded artwork metadata`,
        grounding.scene ? `and the matched scene "${grounding.scene.label}"` : "without requiring a scene match",
        `using retrieval score ${grounding.retrievalScore.toFixed(3)}.`,
      ].join(" "),
      generatedAt: input.now?.() ?? new Date().toISOString(),
      model: input.model ?? "deterministic-grounded-generator-v0",
      evidence: buildGroundedEvidence(grounding),
    };
  };
}

function readProviderConfig(env: ExplanationProviderEnv) {
  if (env.ARTDUO_EXPLANATION_PROVIDER !== "openai-compatible") {
    return undefined;
  }

  const endpoint = env.ARTDUO_EXPLANATION_ENDPOINT?.trim();
  const model = env.ARTDUO_EXPLANATION_MODEL?.trim();
  const apiKey = env.ARTDUO_EXPLANATION_API_KEY?.trim();

  if (!endpoint || !model || !apiKey) {
    return undefined;
  }

  return { endpoint, model, apiKey };
}

export function createServerGroundedExplanationGeneratorFromEnv(
  options: ExplanationProviderAdapterOptions = {},
): ArtworkExplanationGenerator | undefined {
  const env = (options.env ?? process.env) as ExplanationProviderEnv;
  const config = readProviderConfig(env);
  if (!config) {
    return undefined;
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date().toISOString());

  return async ({ grounding }) => {
    const response = await fetchImpl(config.endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        grounding,
        instruction: "Write a concise artwork explanation using only the supplied grounding and citations.",
      }),
    });

    if (!response.ok) {
      throw new Error(`Explanation provider failed: ${response.status}`);
    }

    const raw = await response.json() as {
      title?: string;
      shortText?: string;
      detailText?: string;
      model?: string;
    };

    return {
      title: raw.title?.trim() || `Curation Note · ${grounding.artwork.title}`,
      shortText: raw.shortText?.trim() || `Curation note: ${grounding.userText}`,
      detailText: raw.detailText?.trim() || `Grounded in ${grounding.artwork.title} from release ${grounding.releaseVersion}.`,
      generatedAt: now(),
      model: raw.model?.trim() || config.model,
      evidence: buildGroundedEvidence(grounding),
    };
  };
}
