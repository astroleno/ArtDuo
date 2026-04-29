import assert from "node:assert/strict";
import { test } from "node:test";

import type { ArtworkExplanationContent } from "@artduo/contracts";

import { InMemoryExplanationCache, buildExplanationCacheKey } from "../../src/services/explanations/explanation-cache";

test("cache key includes release, artwork, and stable context hash", () => {
  const key1 = buildExplanationCacheKey({
    releaseVersion: "2026-04-25-curation-b",
    artworkId: "met-474091",
    contextText: "quiet meditative reflection",
  });
  const key2 = buildExplanationCacheKey({
    releaseVersion: "2026-04-25-curation-b",
    artworkId: "met-474091",
    contextText: "quiet meditative reflection",
  });
  const key3 = buildExplanationCacheKey({
    releaseVersion: "2026-04-25-curation-b",
    artworkId: "met-474091",
    contextText: "different context",
  });

  assert.equal(key1, key2);
  assert.notEqual(key1, key3);
  assert.equal(key1.startsWith("2026-04-25-curation-b:met-474091:"), true);
});

test("cache stores and returns explanation by key", () => {
  const cache = new InMemoryExplanationCache();
  const key = buildExplanationCacheKey({
    releaseVersion: "2026-04-25-curation-b",
    artworkId: "met-474091",
    contextText: "quiet meditative reflection",
  });
  const content: ArtworkExplanationContent = {
    title: "Quiet Cloister",
    shortText: "A meditative lane.",
    detailText: "Longer detail",
    generatedAt: "2026-04-29T00:00:00.000Z",
  };

  cache.set(key, content);
  assert.deepEqual(cache.get(key), content);
});
