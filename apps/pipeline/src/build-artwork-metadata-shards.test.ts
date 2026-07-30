import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { parseArtworkRecord } from "@artduo/contracts";

import { buildReleaseArtifactToTempDir, createArtworkRecord } from "./release-artifact";

test("metadata shard build writes frontend-consumable metadata records", () => {
  const result = buildReleaseArtifactToTempDir({ limit: 5 });
  const records = JSON.parse(readFileSync(result.metadataPath, "utf8")) as Array<Record<string, unknown>>;

  assert.ok(records.length > 0);
  assert.ok(records[0]?.metadata);
  assert.ok(records[0]?.presentation);
});

test("legacy release producer stably truncates score-bearing emotion and color arrays before contract parsing", () => {
  const record = createArtworkRecord(
    {
      id: "met-999",
      title: "Amber Beige Black Blue Brown Study",
      description: "A red, green, gold, ochre, silver, white, and yellow composition.",
      emotion: {
        id: "contemplation",
        en: "reflection",
        keywords: ["stillness", "wonder", "joy", "hope"],
      },
    },
    {
      id: "met-999",
      emotion: { keywords: ["desire", "melancholy"] },
    },
    {
      id: "met-999",
      primary: "https://images.example.test/met-999.jpg",
    },
    "legacy-cap-test",
  );

  assert.deepEqual(record.metadata.moodTags, ["contemplation", "reflection", "stillness"]);
  assert.deepEqual(record.retrieval.emotionLabels, ["contemplation", "reflection", "stillness"]);
  assert.deepEqual(record.metadata.colorTags, ["amber", "beige", "black"]);
  assert.doesNotThrow(() => parseArtworkRecord(record, "legacy-cap-test"));
});
