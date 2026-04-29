import assert from "node:assert/strict";
import { test } from "node:test";

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

test("create returns 201 and idempotency returns the same session id", () => {
  resetCurationRouteState();
  const first = createCurationSession(request, { "Idempotency-Key": "create-1" });
  const second = createCurationSession(request, { "Idempotency-Key": "create-1" });

  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(first.body.id, second.body.id);
  assert.equal(first.body.ownership.token.length > 0, true);
});

test("get returns 200 for owner, 403 for wrong token, and 404 for unknown session", () => {
  resetCurationRouteState();
  const created = createCurationSession(request, { "Idempotency-Key": "create-2" });

  const ok = getCurationSession(created.body.id, {
    Authorization: `Bearer ${created.body.ownership.token}`,
  });
  assert.equal(ok.status, 200);

  const forbidden = getCurationSession(created.body.id, {
    Authorization: "Bearer wrong-token",
  });
  assert.equal(forbidden.status, 403);

  const missing = getCurationSession("missing-session", {
    Authorization: `Bearer ${created.body.ownership.token}`,
  });
  assert.equal(missing.status, 404);
});
