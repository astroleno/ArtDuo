import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { buildReleaseArtifactToTempDir } from "./release-artifact";

test("media index build keeps remote media references instead of binaries", () => {
  const result = buildReleaseArtifactToTempDir({ limit: 5 });
  const records = JSON.parse(readFileSync(result.mediaIndexPath, "utf8")) as Array<Record<string, unknown>>;
  const media = records[0]?.media as Record<string, unknown>;

  assert.ok(records.length > 0);
  assert.equal(typeof media?.imageUrlFull, "string");
  assert.equal(typeof media?.sourceAssetFingerprint, "string");
});
