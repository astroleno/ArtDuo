import assert from "node:assert/strict";
import { test } from "node:test";

import type { GroundingContext } from "@artduo/contracts";

import {
  createDeterministicGroundedExplanationGenerator,
  createServerGroundedExplanationGeneratorFromEnv,
} from "../../src/services/explanations/explanation-generator-adapter";

const grounding: GroundingContext = {
  userText: "quiet meditative reflection",
  releaseVersion: "2026-04-25-curation-b",
  artwork: {
    id: "met-474091",
    title: "Cloister",
    artistDisplayName: "Unknown Artist",
    objectUrl: "https://www.metmuseum.org/art/collection/search/474091",
  },
  scene: {
    id: "bg-quiet-cloister",
    label: "Quiet cloister wall",
    imageUrl: "/artduo-gallery/bg-classical-museum-color-midnight-blue-007.png",
  },
  retrievalScore: 0.308327,
  matchedTokens: ["quiet", "meditative", "cloister"],
  sourceVersions: {
    corpusVersion: "2026-04-25-curation-b",
    backgroundCatalogVersion: "2026-04-25-curation-b",
    contractsVersion: "0.2.0",
  },
};

test("deterministic generator returns grounded evidence without real LLM credentials", async () => {
  const generator = createDeterministicGroundedExplanationGenerator({
    now: () => "2026-05-08T00:00:00.000Z",
  });

  const content = await generator({
    artworkId: "met-474091",
    releaseVersion: "2026-04-25-curation-b",
    contextText: "quiet meditative reflection",
    grounding,
  });

  assert.equal(content.evidence.grounding.artwork.id, "met-474091");
  assert.equal(content.evidence.grounding.scene?.id, "bg-quiet-cloister");
  assert.ok(content.evidence.citations.some((citation) => citation.kind === "artwork"));
  assert.ok(content.evidence.citations.some((citation) => citation.kind === "release"));
  assert.ok(content.evidence.citations.some((citation) => citation.kind === "retrieval"));
});

test("server provider adapter is disabled unless server env is explicitly configured", () => {
  const generator = createServerGroundedExplanationGeneratorFromEnv({
    env: {
      ARTDUO_EXPLANATION_PROVIDER: "openai-compatible",
      ARTDUO_EXPLANATION_ENDPOINT: "https://example.com/v1/explanations",
      ARTDUO_EXPLANATION_MODEL: "test-model",
    },
  });

  assert.equal(generator, undefined);
});

test("server provider adapter sends grounding and preserves citations", async () => {
  let requestBody: unknown;
  const generator = createServerGroundedExplanationGeneratorFromEnv({
    env: {
      ARTDUO_EXPLANATION_PROVIDER: "openai-compatible",
      ARTDUO_EXPLANATION_ENDPOINT: "https://example.com/v1/explanations",
      ARTDUO_EXPLANATION_MODEL: "test-model",
      ARTDUO_EXPLANATION_API_KEY: "server-only-test-key",
    },
    now: () => "2026-05-08T00:00:00.000Z",
    fetchImpl: async (_url, init) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        title: "Grounded Cloister",
        shortText: "A grounded note.",
        detailText: "A grounded detail.",
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  assert.ok(generator);
  const content = await generator({
    artworkId: "met-474091",
    releaseVersion: "2026-04-25-curation-b",
    contextText: "quiet meditative reflection",
    grounding,
  });

  assert.deepEqual((requestBody as { grounding: GroundingContext }).grounding, grounding);
  assert.equal(content.model, "test-model");
  assert.equal(content.evidence.grounding.releaseVersion, "2026-04-25-curation-b");
  assert.ok(content.evidence.citations.some((citation) => citation.kind === "scene"));
});
