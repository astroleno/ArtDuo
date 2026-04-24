import assert from "node:assert/strict";
import { test } from "node:test";

import { parseReleaseManifest } from "@artduo/contracts";

import { buildReleaseArtifactToTempDir } from "./release-artifact";

test("release manifest build emits a valid Phase 1 artifact", () => {
  const result = buildReleaseArtifactToTempDir({ limit: 5, corpusVersion: "2026-04-24-test" });
  const manifest = parseReleaseManifest(result.manifest);

  assert.equal(manifest.release.contractsVersion, "0.1.0");
  assert.equal(manifest.shards.metadata[0]?.recordCount, result.records.metadata.length);
  assert.equal(manifest.shards.search[0]?.recordCount, result.records.search.length);
  assert.equal(manifest.shards.mediaIndex[0]?.recordCount, result.records.mediaIndex.length);
  assert.equal(manifest.shards.backgroundScenes[0]?.recordCount, result.records.backgroundScenes.length);
  assert.equal(manifest.shards.embeddings, undefined);
});
