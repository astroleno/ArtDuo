import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { parseBackgroundSceneRecords } from "@artduo/contracts";

import { buildReleaseArtifactToTempDir } from "./release-artifact";

test("background scene build preserves the scene catalog contract", () => {
  const result = buildReleaseArtifactToTempDir({ limit: 5 });
  const records = JSON.parse(readFileSync(result.backgroundScenesPath, "utf8"));
  const scenes = parseBackgroundSceneRecords(records);

  assert.equal(scenes.length, 50);
});
