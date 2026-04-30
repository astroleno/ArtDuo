import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { createArtworkExplanationRoute } from "../../src/routes/artworks";

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
    JSON.stringify([{ id: "met-474091", metadata: { title: "Cloister" } }], null, 2),
  );
  writeFileSync(path.join(releaseDir, "search-01.json"), "[]");
  writeFileSync(path.join(releaseDir, "media-01.json"), "[]");
  writeFileSync(path.join(releaseDir, "background-scenes-01.json"), "[]");

  return releasesRoot;
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

test("generator returns ready explanation and is cached", async () => {
  const releasesRoot = createFixtureRelease();
  let calls = 0;
  const route = createArtworkExplanationRoute({
    releasesRoot,
    generator: () => {
      calls += 1;
      return {
        title: "Quiet Cloister",
        shortText: "A meditative lane.",
        detailText: "Longer detail",
        generatedAt: "2026-04-29T00:00:00.000Z",
      };
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
    generator: () => ({
      title: "Quiet Cloister",
      shortText: "A meditative lane.",
      detailText: "Longer detail",
      generatedAt: "2026-04-29T00:00:00.000Z",
    }),
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
    generator: () => {
      calls += 1;
      return {
        title: "Quiet Cloister",
        shortText: "A meditative lane.",
        detailText: "Longer detail",
        generatedAt: "2026-04-29T00:00:00.000Z",
      };
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
