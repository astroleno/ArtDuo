import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { createArtworkExplanationRoute } from "../../src/routes/artworks";
import { InMemoryMetrics } from "../../src/observability/metrics";
import { InMemoryRequestLog } from "../../src/observability/request-log";
import { createDeterministicGroundedExplanationGenerator } from "../../src/services/explanations/explanation-generator-adapter";

function createFixtureRelease(): string {
  const releasesRoot = mkdtempSync(path.join(os.tmpdir(), "artduo-artworks-route-"));
  const releaseVersion = "2026-04-25-curation-b";
  const releaseDir = path.join(releasesRoot, releaseVersion);
  mkdirSync(releaseDir, { recursive: true });

  writeFileSync(
    path.join(releaseDir, "manifest.json"),
    JSON.stringify(
      {
        release: {
          corpusVersion: releaseVersion,
          backgroundCatalogVersion: releaseVersion,
          contractsVersion: "0.2.0",
          createdAt: "2026-04-25T00:00:00.000Z",
        },
        shards: {
          metadata: [
            {
              id: "metadata-01",
              url: "./metadata-01.json",
              checksum: "sha256:test",
              sizeBytes: 100,
              recordCount: 1,
            },
          ],
          search: [{ id: "search-01", url: "./search-01.json", checksum: "sha256:test", sizeBytes: 10, recordCount: 1 }],
          mediaIndex: [
            { id: "media-01", url: "./media-01.json", checksum: "sha256:test", sizeBytes: 10, recordCount: 1 },
          ],
          backgroundScenes: [
            {
              id: "background-scenes-01",
              url: "./background-scenes-01.json",
              checksum: "sha256:test",
              sizeBytes: 10,
              recordCount: 1,
            },
          ],
        },
      },
      null,
      2,
    ),
  );

  writeFileSync(
    path.join(releaseDir, "metadata-01.json"),
    JSON.stringify(
      [{
        id: "met-474091",
        metadata: {
          title: "Cloister",
          artistDisplayName: "Unknown Artist",
          yearLabel: "12th century",
          objectUrl: "https://www.metmuseum.org/art/collection/search/474091",
        },
      }],
      null,
      2,
    ),
  );
  writeFileSync(path.join(releaseDir, "search-01.json"), "[]");
  writeFileSync(path.join(releaseDir, "media-01.json"), "[]");
  writeFileSync(
    path.join(releaseDir, "background-scenes-01.json"),
    JSON.stringify(
      [{
        id: "bg-quiet-cloister",
        asset: {
          label_en: "Quiet cloister wall",
          local_public_path: "/artduo-gallery/bg-classical-museum-color-midnight-blue-007.png",
        },
      }],
      null,
      2,
    ),
  );

  return releasesRoot;
}

function deterministicGenerator() {
  return createDeterministicGroundedExplanationGenerator({
    model: "deterministic-test",
    now: () => "2026-04-29T00:00:00.000Z",
  });
}

test("known artwork returns pending without generator", async () => {
  const releasesRoot = createFixtureRelease();
  const route = createArtworkExplanationRoute({ releasesRoot });
  const response = await route.getArtworkExplanation({
    artworkId: "met-474091",
    releaseVersion: "2026-04-25-curation-b",
    contextText: "quiet meditative reflection",
  });

  assert.equal(response.status, 200);
  if (response.status !== 200) return;
  assert.equal((response.body as { status: string }).status, "pending");
});

test("server provider env is opt-in and does not run by default", async () => {
  const releasesRoot = createFixtureRelease();
  const route = createArtworkExplanationRoute({
    releasesRoot,
    providerEnv: {
      ARTDUO_EXPLANATION_PROVIDER: "openai-compatible",
      ARTDUO_EXPLANATION_ENDPOINT: "https://example.com/v1/explanations",
      ARTDUO_EXPLANATION_MODEL: "test-model",
      ARTDUO_EXPLANATION_API_KEY: "server-only-test-key",
    },
    providerFetch: async () => {
      throw new Error("provider should not run unless enabled");
    },
  });
  const response = await route.getArtworkExplanation({
    artworkId: "met-474091",
    releaseVersion: "2026-04-25-curation-b",
    contextText: "quiet meditative reflection",
  });

  assert.equal(response.status, 200);
  if (response.status !== 200) return;
  assert.equal((response.body as { status: string }).status, "pending");
});

test("enabled server provider receives route grounding", async () => {
  const releasesRoot = createFixtureRelease();
  let providerGroundingArtwork = "";
  const route = createArtworkExplanationRoute({
    releasesRoot,
    enableServerProvider: true,
    providerEnv: {
      ARTDUO_EXPLANATION_PROVIDER: "openai-compatible",
      ARTDUO_EXPLANATION_ENDPOINT: "https://example.com/v1/explanations",
      ARTDUO_EXPLANATION_MODEL: "test-model",
      ARTDUO_EXPLANATION_API_KEY: "server-only-test-key",
    },
    providerFetch: async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { grounding: { artwork: { id: string } } };
      providerGroundingArtwork = body.grounding.artwork.id;
      return new Response(JSON.stringify({
        title: "Provider Cloister",
        shortText: "Grounded provider note.",
        detailText: "Grounded provider detail.",
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  const response = await route.getArtworkExplanation({
    artworkId: "met-474091",
    releaseVersion: "2026-04-25-curation-b",
    contextText: "quiet meditative reflection",
    backgroundSceneId: "bg-quiet-cloister",
    retrievalScore: 0.308327,
    matchedTokens: ["quiet", "meditative", "cloister"],
  });

  assert.equal(response.status, 200);
  assert.equal(providerGroundingArtwork, "met-474091");
  if (response.status !== 200 || "code" in response.body || response.body.status !== "ready") return;
  assert.equal(response.body.content?.evidence.grounding.scene?.id, "bg-quiet-cloister");
});

test("generator returns ready explanation and is cached", async () => {
  const releasesRoot = createFixtureRelease();
  let calls = 0;
  const route = createArtworkExplanationRoute({
    releasesRoot,
    generator: (input) => {
      calls += 1;
      return deterministicGenerator()(input);
    },
  });

  const first = await route.getArtworkExplanation({
    artworkId: "met-474091",
    releaseVersion: "2026-04-25-curation-b",
    contextText: "quiet meditative reflection",
  });
  const second = await route.getArtworkExplanation({
    artworkId: "met-474091",
    releaseVersion: "2026-04-25-curation-b",
    contextText: "quiet meditative reflection",
  });

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  if (first.status !== 200 || second.status !== 200) return;
  assert.equal((first.body as { status: string }).status, "ready");
  assert.equal((second.body as { status: string }).status, "ready");
  assert.equal(calls, 1);
});

test("ready explanation includes grounding context and citations", async () => {
  const releasesRoot = createFixtureRelease();
  let receivedArtworkTitle = "";
  const route = createArtworkExplanationRoute({
    releasesRoot,
    generator: (input) => {
      receivedArtworkTitle = input.grounding.artwork.title;
      return deterministicGenerator()(input);
    },
  });

  const response = await route.getArtworkExplanation({
    artworkId: "met-474091",
    releaseVersion: "2026-04-25-curation-b",
    contextText: "quiet meditative reflection",
    backgroundSceneId: "bg-quiet-cloister",
    retrievalScore: 0.308327,
    matchedTokens: ["quiet", "meditative", "cloister"],
  });

  assert.equal(response.status, 200);
  if (response.status !== 200 || "code" in response.body || response.body.status !== "ready") return;
  const content = response.body.content;
  assert.ok(content);
  assert.equal(receivedArtworkTitle, "Cloister");
  assert.equal(content.evidence.grounding.artwork.id, "met-474091");
  assert.equal(content.evidence.grounding.scene?.id, "bg-quiet-cloister");
  assert.equal(content.evidence.grounding.retrievalScore, 0.308327);
  assert.deepEqual(content.evidence.grounding.matchedTokens, ["quiet", "meditative", "cloister"]);
  assert.equal(content.evidence.grounding.sourceVersions.corpusVersion, "2026-04-25-curation-b");
  assert.ok(content.evidence.citations.some((citation) => citation.kind === "artwork"));
  assert.ok(content.evidence.citations.some((citation) => citation.kind === "scene"));
  assert.ok(content.evidence.citations.some((citation) => citation.kind === "release"));
  assert.ok(content.evidence.citations.some((citation) => citation.kind === "retrieval"));
});

test("unknown artwork returns 404", async () => {
  const releasesRoot = createFixtureRelease();
  const route = createArtworkExplanationRoute({ releasesRoot });
  const response = await route.getArtworkExplanation({
    artworkId: "unknown",
    releaseVersion: "2026-04-25-curation-b",
    contextText: "anything",
  });

  assert.equal(response.status, 404);
});

test("budget guard rejects generation when estimated tokens exceed max", async () => {
  const releasesRoot = createFixtureRelease();
  const route = createArtworkExplanationRoute({
    releasesRoot,
    generator: deterministicGenerator(),
  });
  const response = await route.getArtworkExplanation(
    {
      artworkId: "met-474091",
      releaseVersion: "2026-04-25-curation-b",
      contextText: "quiet meditative reflection",
    },
    { estimatedTokens: 5001, maxTokens: 5000 },
  );

  assert.equal(response.status, 429);
});

test("cached ready explanation is returned even when over-budget input is provided", async () => {
  const releasesRoot = createFixtureRelease();
  let calls = 0;
  const route = createArtworkExplanationRoute({
    releasesRoot,
    generator: (input) => {
      calls += 1;
      return deterministicGenerator()(input);
    },
  });

  const first = await route.getArtworkExplanation({
    artworkId: "met-474091",
    releaseVersion: "2026-04-25-curation-b",
    contextText: "quiet meditative reflection",
  });
  const second = await route.getArtworkExplanation(
    {
      artworkId: "met-474091",
      releaseVersion: "2026-04-25-curation-b",
      contextText: "quiet meditative reflection",
    },
    { estimatedTokens: 99999, maxTokens: 5000 },
  );

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  if (first.status === 200 && second.status === 200) {
    assert.equal((first.body as { status: string }).status, "ready");
    assert.equal((second.body as { status: string }).status, "ready");
  }
  assert.equal(calls, 1);
});

test("explanation route records runtime metrics and request log entries", async () => {
  const releasesRoot = createFixtureRelease();
  const metrics = new InMemoryMetrics();
  const requestLog = new InMemoryRequestLog();
  const route = createArtworkExplanationRoute({
    releasesRoot,
    metrics,
    requestLog,
    generator: deterministicGenerator(),
  });

  await route.getArtworkExplanation({
    artworkId: "met-474091",
    releaseVersion: "2026-04-25-curation-b",
    contextText: "quiet meditative reflection",
  });
  await route.getArtworkExplanation({
    artworkId: "met-474091",
    releaseVersion: "2026-04-25-curation-b",
    contextText: "quiet meditative reflection",
  });

  assert.deepEqual(metrics.list("explanation.generate").map((entry) => entry.tags.result), ["ready", "cache_hit"]);
  assert.deepEqual(requestLog.list().map((entry) => `${entry.route}:${entry.tags.result}`), [
    "/v1/artworks/:id/explanation:ready",
    "/v1/artworks/:id/explanation:cache_hit",
  ]);
});
