import assert from "node:assert/strict";
import { test } from "node:test";

import type { CurationSession } from "@artduo/contracts";

import { createCurationSession, getCurationSession, resetCurationRouteState } from "../../src/routes/curations";

const request = {
  userText: "quiet meditative reflection in a cloister",
  releaseVersion: "2026-04-25-curation-b",
  sourceVersions: {
    corpusVersion: "2026-04-25-curation-b",
    backgroundCatalogVersion: "2026-04-25-curation-b",
    contractsVersion: "0.2.0",
  },
  exhibitionSnapshot: [{ unitId: "u1", artworkId: "met-474091", backgroundSceneId: "scene-1", rank: 1, score: 0.9 }],
};

function requireCreatedSession(response: ReturnType<typeof createCurationSession>): CurationSession {
  assert.equal(response.status, 201);
  if (response.status !== 201) {
    throw new Error("Expected created session response");
  }

  return response.body as CurationSession;
}

test("create returns 201 and idempotency returns the same session id", () => {
  resetCurationRouteState();
  const first = createCurationSession(request, { "Idempotency-Key": "create-1" });
  const second = createCurationSession(request, { "Idempotency-Key": "create-1" });
  const firstSession = requireCreatedSession(first);
  const secondSession = requireCreatedSession(second);

  assert.equal(firstSession.id, secondSession.id);
  assert.equal(firstSession.ownership.token.length > 0, true);
});

test("get returns 200 for owner, 403 for wrong token, and 404 for unknown session", () => {
  resetCurationRouteState();
  const created = createCurationSession(request, { "Idempotency-Key": "create-2" });
  const createdSession = requireCreatedSession(created);

  const ok = getCurationSession(createdSession.id, {
    Authorization: `Bearer ${createdSession.ownership.token}`,
  });
  assert.equal(ok.status, 200);

  const forbidden = getCurationSession(createdSession.id, {
    Authorization: "Bearer wrong-token",
  });
  assert.equal(forbidden.status, 403);

  const missing = getCurationSession("missing-session", {
    Authorization: `Bearer ${createdSession.ownership.token}`,
  });
  assert.equal(missing.status, 404);
});

test("same idempotency key with different request body returns 409", () => {
  resetCurationRouteState();
  const first = createCurationSession(request, { "Idempotency-Key": "create-3" });
  const firstSession = requireCreatedSession(first);
  const changedRequest = {
    ...request,
    userText: "different intent for same key",
    exhibitionSnapshot: [
      { unitId: "u2", artworkId: "met-470314", backgroundSceneId: "scene-2", rank: 1, score: 0.87 },
    ],
  };

  const conflict = createCurationSession(changedRequest, { "Idempotency-Key": "create-3" });
  assert.equal(conflict.status, 409);

  const original = getCurationSession(firstSession.id, {
    Authorization: `Bearer ${firstSession.ownership.token}`,
  });
  assert.equal(original.status, 200);
  if (original.status === 200) {
    assert.deepEqual((original.body as CurationSession).unitIds, ["u1"]);
  }
});

test("create session is rate-limited by idempotency key or client identity", () => {
  resetCurationRouteState();

  const headers = { "X-Forwarded-For": "203.0.113.8" };
  const first = createCurationSession(request, headers);
  const second = createCurationSession(request, headers);
  const third = createCurationSession(request, headers);

  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(third.status, 429);
});
