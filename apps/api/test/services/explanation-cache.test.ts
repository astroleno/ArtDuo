import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { ArtworkExplanationContent } from "@artduo/contracts";

import { InMemoryExplanationCache, PersistentExplanationCache, buildExplanationCacheKey } from "../../src/services/explanations/explanation-cache";

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

test("cache stores ready content, survives restart, and revalidates current evidence", async () => {
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
    evidence: {
      grounding: {
        userText: "quiet meditative reflection",
        releaseVersion: "2026-04-25-curation-b",
        artwork: {
          id: "met-474091",
          title: "Cloister",
        },
        retrievalScore: 0.3,
        matchedTokens: ["quiet", "meditative"],
        sourceVersions: {
          corpusVersion: "2026-04-25-curation-b",
          backgroundCatalogVersion: "2026-04-25-curation-b",
          contractsVersion: "0.2.0",
        },
      },
      citations: [
        {
          kind: "artwork",
          sourceId: "met-474091",
          label: "Cloister",
        },
      ],
    },
  };

  cache.set(key, content);
  assert.deepEqual(cache.get(key), content);
  const root = await mkdtemp(path.join(os.tmpdir(), "artduo-explanation-"));
  try {
    new PersistentExplanationCache(root, "model:recipe", () => {}).set(key, content);
    assert.equal(new PersistentExplanationCache(root, "model:recipe", () => {}).get(key)?.detailText, content.detailText);
    assert.equal(new PersistentExplanationCache(root, "other-model:recipe", () => {}).get(key), undefined);
    assert.equal(new PersistentExplanationCache(root, "model:recipe", () => { throw new Error("Evidence changed"); }).get(key), undefined);
  } finally { await rm(root, { recursive: true, force: true }); }
});
