import assert from "node:assert/strict";
import { test } from "node:test";

import { EXPLANATION_CITATION_KINDS, EXPLANATION_STATUSES, parseArtworkExplanation } from "./artwork-explanation";
import { loadFixture } from "./test-helpers";

test("explanation statuses stay aligned with the v0.2 contract", () => {
  assert.deepEqual(EXPLANATION_STATUSES, ["pending", "ready", "failed"]);
  assert.deepEqual(EXPLANATION_CITATION_KINDS, ["user-intent", "artwork", "scene", "release", "retrieval"]);
});

test("artwork explanation exposes pending and ready shapes", () => {
  const pending = parseArtworkExplanation(loadFixture("artwork-explanation-pending.json"));
  const ready = parseArtworkExplanation(loadFixture("artwork-explanation-ready.json"));

  assert.equal(pending.status, "pending");
  assert.equal(ready.status, "ready");
  assert.equal(ready.content?.title.length ? true : false, true);
  assert.equal(ready.content?.evidence.grounding.artwork.id, ready.artworkId);
  assert.equal(ready.content?.evidence.grounding.artwork.medium, "Limestone");
  assert.equal(ready.content?.evidence.grounding.artwork.department, "Medieval Art");
  assert.match(ready.content?.evidence.grounding.artwork.description ?? "", /carved stone details/);
  assert.equal(ready.content?.evidence.grounding.releaseVersion, ready.releaseVersion);
  assert.ok(ready.content?.evidence.citations.some((citation) => citation.kind === "artwork"));
  assert.ok(ready.content?.evidence.citations.some((citation) => citation.kind === "release"));
});

test("ready artwork explanations require traceable evidence", () => {
  const ready = loadFixture("artwork-explanation-ready.json") as Record<string, unknown>;
  const content = ready.content as Record<string, unknown>;
  delete content.evidence;

  assert.throws(() => parseArtworkExplanation(ready), /content\.evidence: expected object/);
});
