import assert from "node:assert/strict";
import { test } from "node:test";

import { parseArtworkRecords } from "./artwork";
import { parseBackgroundSceneRecords } from "./background-scene";
import { parseReleaseManifest } from "./corpus";
import { loadFixture } from "./test-helpers";

test("manifest fixture matches the bootstrap fixture counts", () => {
  const manifest = parseReleaseManifest(loadFixture("corpus-manifest.json"));
  const artworks = parseArtworkRecords(loadFixture("artworks.json"));
  const scenes = parseBackgroundSceneRecords(loadFixture("background-scenes.json"));

  assert.equal(manifest.release.contractsVersion, "0.1.0");
  assert.equal(manifest.shards.metadata[0]?.recordCount, artworks.length);
  assert.equal(manifest.shards.search[0]?.recordCount, artworks.length);
  assert.equal(manifest.shards.mediaIndex[0]?.recordCount, artworks.length);
  assert.equal(manifest.shards.backgroundScenes[0]?.recordCount, scenes.length);
  assert.equal(manifest.shards.embeddings, undefined);
});

test("manifest parser accepts optional embedding shards", () => {
  const manifest = parseReleaseManifest({
    release: {
      corpusVersion: "2026-04-25-curation-b",
      backgroundCatalogVersion: "2026-04-25-curation-b",
      contractsVersion: "0.1.0",
      createdAt: "2026-04-25T00:00:00.000Z",
    },
    shards: {
      metadata: [{ id: "metadata-01", url: "./metadata-01.json", checksum: "sha256:test", sizeBytes: 100, recordCount: 3 }],
      search: [{ id: "search-01", url: "./search-01.json", checksum: "sha256:test", sizeBytes: 100, recordCount: 3 }],
      mediaIndex: [{ id: "media-01", url: "./media-01.json", checksum: "sha256:test", sizeBytes: 100, recordCount: 3 }],
      backgroundScenes: [{ id: "background-scenes-01", url: "./background-scenes-01.json", checksum: "sha256:test", sizeBytes: 100, recordCount: 2 }],
      embeddings: [{ id: "embeddings-01", url: "./embeddings-01.json", checksum: "sha256:test", sizeBytes: 100, recordCount: 3 }],
    },
  });

  assert.equal(manifest.shards.embeddings?.[0]?.id, "embeddings-01");
  assert.equal(manifest.shards.embeddings?.[0]?.recordCount, 3);
});
