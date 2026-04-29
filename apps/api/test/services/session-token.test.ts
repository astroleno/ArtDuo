import assert from "node:assert/strict";
import { test } from "node:test";

import { createSessionToken, verifySessionToken } from "../../src/services/auth/session-token";

test("session token is created with a token and expiry", () => {
  const now = new Date("2026-04-29T00:00:00.000Z");
  const record = createSessionToken("session_1", now);

  assert.equal(record.token.length > 0, true);
  assert.equal(record.expiresAt, "2026-04-30T00:00:00.000Z");
});

test("session token verification accepts owner before expiry and rejects cross-session", () => {
  const now = new Date("2026-04-29T00:00:00.000Z");
  const record = createSessionToken("session_1", now);

  assert.equal(verifySessionToken(record.token, "session_1", now), true);
  assert.equal(verifySessionToken(record.token, "session_2", now), false);
});
