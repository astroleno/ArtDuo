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
