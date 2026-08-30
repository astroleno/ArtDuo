import assert from "node:assert/strict";
import { test } from "node:test";

import { getArtworkExplanationClient } from "../../lib/explanation-client";

function openAiSseResponse(content: Record<string, string>): Response {
  return new Response([
    `data: ${JSON.stringify({
      model: "deepseek-v4-flash",
      choices: [{ delta: { content: JSON.stringify(content) } }],
    })}`,
    "",
    "data: [DONE]",
    "",
  ].join("\n"), {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

test("explanation client returns pending or ready non-blocking states", async () => {
  const pending = await getArtworkExplanationClient(
    { artworkId: "met-1", releaseVersion: "2026-04-25-curation-b", contextText: "quiet moonlit room" },
    {
      route: {
        getArtworkExplanation: async () => ({
          status: 200,
          body: {
            artworkId: "met-1",
            releaseVersion: "2026-04-25-curation-b",
            status: "pending",
            cacheKey: "k1",
            updatedAt: "2026-04-30T00:00:00.000Z",
          },
        }),
      },
    },
  );

  const ready = await getArtworkExplanationClient(
    { artworkId: "met-1", releaseVersion: "2026-04-25-curation-b", contextText: "quiet moonlit room" },
    {
      route: {
        getArtworkExplanation: async () => ({
          status: 200,
          body: {
            artworkId: "met-1",
            releaseVersion: "2026-04-25-curation-b",
            status: "ready",
            content: {
              title: "Moonlit Pause",
              shortText: "A calm threshold.",
              detailText: "Longer detail text",
              generatedAt: "2026-04-30T00:00:00.000Z",
              evidence: {
                grounding: {
                  userText: "quiet moonlit room",
                  releaseVersion: "2026-04-25-curation-b",
                  artwork: {
                    id: "met-1",
                    title: "Moonlit Pause",
                  },
                  retrievalScore: 0.91,
                  matchedTokens: ["quiet", "moonlit"],
                  sourceVersions: {
                    corpusVersion: "2026-04-25-curation-b",
                    backgroundCatalogVersion: "2026-04-25-curation-b",
                    contractsVersion: "0.2.0",
                  },
                },
                citations: [
                  {
                    kind: "artwork",
                    sourceId: "met-1",
                    label: "Moonlit Pause",
                  },
                  {
                    kind: "release",
                    sourceId: "2026-04-25-curation-b",
                    label: "Release 2026-04-25-curation-b",
                  },
                ],
              },
            },
            cacheKey: "k2",
            updatedAt: "2026-04-30T00:00:00.000Z",
          },
        }),
      },
    },
  );

  assert.equal(pending.status, "pending");
  assert.equal(ready.status, "ready");
});

test("explanation client forwards retrieval grounding fields to the route", async () => {
  let forwarded: unknown;

  await getArtworkExplanationClient(
    {
      artworkId: "met-1",
      releaseVersion: "2026-04-25-curation-b",
      contextText: "quiet moonlit room",
      backgroundSceneId: "bg-moon",
      retrievalScore: 0.917,
      matchedTokens: ["quiet", "moonlit"],
    },
    {
      route: {
        getArtworkExplanation: async (input) => {
          forwarded = input;
          return {
            status: 200,
            body: {
              artworkId: "met-1",
              releaseVersion: "2026-04-25-curation-b",
              status: "pending",
              cacheKey: "k1",
              updatedAt: "2026-04-30T00:00:00.000Z",
            },
          };
        },
      },
    },
  );

  assert.deepEqual(forwarded, {
    artworkId: "met-1",
    releaseVersion: "2026-04-25-curation-b",
    contextText: "quiet moonlit room",
    backgroundSceneId: "bg-moon",
    retrievalScore: 0.917,
    matchedTokens: ["quiet", "moonlit"],
  });
});

test("explanation client maps route errors to failed state", async () => {
  const failed = await getArtworkExplanationClient(
    { artworkId: "unknown", releaseVersion: "2026-04-25-curation-b", contextText: "x" },
    {
      route: {
        getArtworkExplanation: async () => ({
          status: 404,
          body: { code: "artwork_not_found", message: "not found" },
        }),
      },
    },
  );

  assert.equal(failed.status, "failed");
  assert.equal(failed.error, "Explanation unavailable");
});

test("default explanation client uses configured DeepSeek streaming instead of the local fallback", async () => {
  const previous = {
    baseUrl: process.env.DEEPSEEK_BASE_URL,
    model: process.env.DEEPSEEK_MODEL,
    apiKey: process.env.DEEPSEEK_API_KEY,
    fetch: globalThis.fetch,
  };
  let providerCalled = false;

  process.env.DEEPSEEK_BASE_URL = "https://api.deepseek.com";
  process.env.DEEPSEEK_MODEL = "deepseek-v4-flash";
  process.env.DEEPSEEK_API_KEY = "deepseek-client-test-key";
  globalThis.fetch = async () => {
    providerCalled = true;
    return openAiSseResponse({
      title: "Provider Cloister",
      shortText: "Grounded provider note.",
      detailText: "Grounded provider detail.",
    });
  };

  try {
    const explanation = await getArtworkExplanationClient({
      artworkId: "met-474091",
      releaseVersion: "2026-04-25-curation-b",
      contextText: "quiet meditative reflection",
      retrievalScore: 0.308327,
      matchedTokens: ["quiet", "meditative", "cloister"],
    });

    assert.equal(providerCalled, true);
    assert.equal(explanation.status, "ready");
    assert.equal(explanation.content?.title, "Provider Cloister");
  } finally {
    if (previous.baseUrl === undefined) delete process.env.DEEPSEEK_BASE_URL;
    else process.env.DEEPSEEK_BASE_URL = previous.baseUrl;
    if (previous.model === undefined) delete process.env.DEEPSEEK_MODEL;
    else process.env.DEEPSEEK_MODEL = previous.model;
    if (previous.apiKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previous.apiKey;
    globalThis.fetch = previous.fetch;
  }
});
