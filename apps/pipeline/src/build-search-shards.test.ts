import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { buildReleaseArtifactToTempDir } from "./release-artifact";

test("search shard build writes retrieval payloads", () => {
  const result = buildReleaseArtifactToTempDir({ limit: 5 });
  const records = JSON.parse(readFileSync(result.searchPath, "utf8")) as Array<Record<string, unknown>>;

  assert.ok(records.length > 0);
  assert.ok(records[0]?.retrieval);
});
