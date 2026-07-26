import assert from "node:assert/strict";
import { test } from "node:test";

import { embedText } from "@artduo/corpus";

import { chooseCurationFallbackMode, InMemoryAnalyticsSink, trackAnalyticsEvent } from "../../lib/analytics";
import { searchGalleryWithRuntime } from "../../lib/browser-curation";
import type { WebArtwork, WebReleaseCatalog } from "../../lib/release-catalog";

test("analytics chooses polling or local fallback when stream state fails", async () => {
  assert.equal(chooseCurationFallbackMode({ streamAvailable: true, pollingAvailable: true }), "stream");
  assert.equal(chooseCurationFallbackMode({ streamAvailable: false, pollingAvailable: true }), "polling");
  assert.equal(chooseCurationFallbackMode({ streamAvailable: false, pollingAvailable: false }), "local-state");

  const sink = new InMemoryAnalyticsSink();
  await trackAnalyticsEvent(sink, "curation.degraded", { reason: "sse_failed", fallback: "polling" });

  assert.equal(sink.events[0]?.name, "curation.degraded");
  assert.equal(sink.events[0]?.properties.fallback, "polling");
});

test("browser worker fallback records degradation analytics in the runtime helper", () => {
  const sink = new InMemoryAnalyticsSink();
  const vector = embedText("quiet moon").vector;
  const artwork: WebArtwork = {
    id: "met-moon",
    title: "Moon Room",
    moodTags: ["quiet"],
    colorTags: [],
    subjectTags: ["moon"],
    compositionTags: [],
    emotionLabels: ["quiet"],
    keywordBoosts: ["moon"],
    searchText: "quiet moon",
    grade: "A",
    gradeLabel: "director-focus",
    motionProfile: "static",
    sceneAffinity: {
      sceneTypes: [],
      paletteModes: [],
      spatialModes: [],
      transitionTags: [],
    },
    imageUrl: "https://example.test/moon.jpg",
    detailHref: "/artwork/met-moon",
  };
  const catalog: WebReleaseCatalog = {
    manifestPath: "/tmp/manifest.json",
    releaseDir: "/tmp",
    releaseVersion: "test-release",
    releaseCreatedAt: "2026-05-05T00:00:00.000Z",
    manifest: {
      release: {
        corpusVersion: "test-release",
        backgroundCatalogVersion: "test-release",
        contractsVersion: "0.2.0",
        createdAt: "2026-05-05T00:00:00.000Z",
      },
      shards: {
        metadata: [],
        search: [],
        mediaIndex: [],
        backgroundScenes: [],
      },
    },
    artworkCount: 1,
    backgroundSceneCount: 0,
    artworks: [artwork],
    artworkById: new Map([[artwork.id, artwork]]),
    backgroundScenes: [],
    backgroundSceneEmbeddingRecords: [],
    embeddingRecords: [{
      id: artwork.id,
      source: "met",
      sourceArtworkId: "1",
      version: "test-release",
      theme: "quiet",
      model: "local-hash-embedding-v1",
      dimensions: vector.length,
      title: artwork.title,
      grade: "A",
      moodTags: ["quiet"],
      text: "quiet moon",
      tokenCount: 2,
      vector,
    }],
  };

  const result = searchGalleryWithRuntime({
    analyticsSink: sink,
    catalog,
    query: "quiet moon",
    runtimeMode: "worker-fail",
  });

  assert.equal(result.runtime, "server-fallback");
  assert.equal(sink.events[0]?.name, "curation.degraded");
  assert.equal(sink.events[0]?.properties.reason, "browser_worker_failed");
  assert.equal(sink.events[0]?.properties.fallback, "server-fallback");
});
