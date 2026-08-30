import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import artworkPage from "../../app/artwork/[id]/page";
import { buildRecommendationReason } from "../../lib/artwork-page-copy";

test("artwork recommendation copy describes retrieval evidence without claiming theme or author intent", () => {
  const text = buildRecommendationReason({
    artworkId: "met-438417",
    releaseVersion: "v2",
    status: "ready",
    cacheKey: "test-cache-key",
    updatedAt: "2026-08-31T00:00:00.000Z",
    content: {
      title: "Moonlight",
      shortText: "A grounded introduction.",
      detailText: "A grounded detailed introduction.",
      generatedAt: "2026-08-31T00:00:00.000Z",
      evidence: {
        grounding: {
          userText: "quiet moonlit room",
          releaseVersion: "v2",
          artwork: {
            id: "met-438417",
            title: "Moonlight",
            artistDisplayName: "Artist",
          },
          scene: { id: "scene-quiet-room", label: "Quiet room" },
          retrievalScore: 0.8,
          matchedTokens: ["moonlight", "contemplation"],
          sourceVersions: {
            corpusVersion: "v2",
            backgroundCatalogVersion: "v2",
            contractsVersion: "0.2.0",
          },
        },
        citations: [],
      },
    },
  });

  assert.match(text, /检索记录/);
  assert.match(text, /只说明选择依据/);
  assert.doesNotMatch(text, /情绪、主题与画面气质|作者意图相互靠近/);
});

test("artwork page renders the generated detail text instead of discarding it", async () => {
  (globalThis as typeof globalThis & { React: typeof React }).React = React;
  const page = await artworkPage({
    params: Promise.resolve({ id: "met-438417" }),
    searchParams: Promise.resolve({ query: "quiet moonlit room" }),
  });
  const html = renderToStaticMarkup(page);

  assert.match(html, /release-grounded artwork metadata/);
});
