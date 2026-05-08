import assert from "node:assert/strict";
import { test } from "node:test";

import { createArtworkExplanationRoute } from "../../src/routes/artworks";
import { createCurationSession, resetCurationRouteState } from "../../src/routes/curations";
import { createMetricTimer, InMemoryMetrics } from "../../src/observability/metrics";
import { createDeterministicGroundedExplanationGenerator } from "../../src/services/explanations/explanation-generator-adapter";

test("curation flow records create and explanation timings without real LLM credentials", async () => {
  resetCurationRouteState();
  const metrics = new InMemoryMetrics();
  let now = 1_000;
  const nextNow = () => now;
  const advance = (delta: number) => {
    now += delta;
    return now;
  };

  const stopCreate = createMetricTimer(metrics, "exhibition.create", { releaseVersion: "2026-04-25-curation-b" }, nextNow);
  const sessionResponse = createCurationSession(
    {
      releaseVersion: "2026-04-25-curation-b",
      sourceVersions: {
        corpusVersion: "2026-04-25-curation-b",
        backgroundCatalogVersion: "2026-04-25-curation-b",
        contractsVersion: "0.2.0",
      },
      userText: "I want a quiet moonlit room",
      exhibitionSnapshot: [
        {
          unitId: "unit-met-438417",
          artworkId: "met-438417",
          backgroundSceneId: "scene-quiet",
          rank: 1,
          score: 0.98,
        },
      ],
    },
    { "Idempotency-Key": "flow-observability" },
  );
  advance(37);
  stopCreate(nextNow);

  const route = createArtworkExplanationRoute({
    generator: createDeterministicGroundedExplanationGenerator({
      model: "deterministic-test",
      now: () => "2026-05-05T00:00:00.000Z",
    }),
  });
  const stopExplanation = createMetricTimer(metrics, "explanation.generate", { artworkId: "met-438417" }, nextNow);
  const explanationResponse = await route.getArtworkExplanation({
    artworkId: "met-438417",
    releaseVersion: "2026-04-25-curation-b",
    contextText: "I want a quiet moonlit room",
  });
  advance(22);
  stopExplanation(nextNow);

  assert.equal(sessionResponse.status, 201);
  assert.equal(explanationResponse.status, 200);
  assert.equal(metrics.summary("exhibition.create").totalDurationMs, 37);
  assert.equal(metrics.summary("explanation.generate").totalDurationMs, 22);
});
