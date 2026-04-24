import assert from "node:assert/strict";
import { test } from "node:test";

import { parseArtworkRecords } from "./artwork";
import { loadFixture } from "./test-helpers";

test("artwork fixtures satisfy the Phase 1 display/data baseline", () => {
  const records = parseArtworkRecords(loadFixture("artworks.json"));

  assert.equal(records.length, 3);

  for (const record of records) {
    assert.ok(record.metadata.storySnippet, `${record.id} should carry a fixture story snippet`);
    assert.ok(record.retrieval.searchText.length > 0, `${record.id} should be searchable`);
    assert.ok(record.media.baseImageUrl || record.media.imageUrlPreview, `${record.id} should expose a primary image`);
    assert.ok(record.media.mediaVersion || record.media.sourceAssetFingerprint, `${record.id} should be replayable`);
  }
});
