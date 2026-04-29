import assert from "node:assert/strict";
import { test } from "node:test";

import { EXPLANATION_STATUSES, parseArtworkExplanation } from "./artwork-explanation";
import { loadFixture } from "./test-helpers";

test("explanation statuses stay aligned with the v0.2 contract", () => {
  assert.deepEqual(EXPLANATION_STATUSES, ["pending", "ready", "failed"]);
});

test("artwork explanation exposes pending and ready shapes", () => {
  const pending = parseArtworkExplanation(loadFixture("artwork-explanation-pending.json"));
  const ready = parseArtworkExplanation(loadFixture("artwork-explanation-ready.json"));

  assert.equal(pending.status, "pending");
  assert.equal(ready.status, "ready");
  assert.equal(ready.content?.title.length ? true : false, true);
});
