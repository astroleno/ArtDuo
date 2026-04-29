import assert from "node:assert/strict";
import { test } from "node:test";

import { parseCurationSession, parseCreateCurationRequest, SESSION_STATUSES } from "./curation-session";
import { loadFixture } from "./test-helpers";

test("session statuses stay aligned with the v0.2 contract", () => {
  assert.deepEqual(SESSION_STATUSES, ["pending", "partial", "ready", "failed"]);
});

test("create curation request includes required v0.2 fields", () => {
  const request = parseCreateCurationRequest(loadFixture("curation-session-pending.json"));

  assert.equal(request.userText.length > 0, true);
  assert.equal(request.releaseVersion, "2026-04-25-curation-b");
  assert.equal(request.exhibitionSnapshot.length > 0, true);
});

test("curation session carries status/source/unit/ownership fields", () => {
  const session = parseCurationSession(loadFixture("curation-session-ready.json"));

  assert.equal(session.status, "ready");
  assert.equal(session.unitIds.length > 0, true);
  assert.equal(session.ownership.token.length > 0, true);
});
