import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCreateCurationRequest } from "../../lib/session-state";

test("buildCreateCurationRequest preserves release/source versions and selected unit ids", () => {
  const request = buildCreateCurationRequest({
    query: "quiet moonlit room",
    catalog: {
      releaseVersion: "2026-04-25-curation-b",
      manifest: {
        release: {
          corpusVersion: "2026-04-25-curation-b",
          backgroundCatalogVersion: "2026-04-25-curation-b",
          contractsVersion: "0.2.0",
          createdAt: "2026-04-25T00:00:00.000Z",
        },
        shards: { metadata: [], search: [], mediaIndex: [], backgroundScenes: [] },
      },
    } as never,
    search: {
      results: [
        {
          rank: 1,
          combinedScore: 0.91,
          artwork: { id: "met-1" },
          scene: { id: "scene-a" },
        },
        {
          rank: 2,
          combinedScore: 0.81,
          artwork: { id: "met-2" },
        },
      ],
    } as never,
  });

  assert.equal(request.releaseVersion, "2026-04-25-curation-b");
  assert.equal(request.sourceVersions.corpusVersion, "2026-04-25-curation-b");
  assert.deepEqual(request.exhibitionSnapshot.map((unit) => unit.artworkId), ["met-1", "met-2"]);
});
