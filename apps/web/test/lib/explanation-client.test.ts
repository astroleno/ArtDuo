import assert from "node:assert/strict";
import { test } from "node:test";

import { getArtworkExplanationClient } from "../../lib/explanation-client";

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
