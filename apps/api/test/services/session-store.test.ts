import assert from "node:assert/strict";
import { test } from "node:test";

import type { CurationSession } from "@artduo/contracts";

import { InMemoryCurationSessionStore } from "../../src/services/curation/session-store";

function fixtureSession(id: string): CurationSession {
  return {
    id,
    status: "pending",
    releaseVersion: "2026-04-25-curation-b",
    sourceVersions: {
      corpusVersion: "2026-04-25-curation-b",
      backgroundCatalogVersion: "2026-04-25-curation-b",
      contractsVersion: "0.2.0",
    },
    unitIds: ["unit_1"],
    ownership: {
      token: "token",
      expiresAt: "2026-04-30T00:00:00.000Z",
    },
    createdAt: "2026-04-29T00:00:00.000Z",
    updatedAt: "2026-04-29T00:00:00.000Z",
  };
}

test("session store creates and gets sessions by id", () => {
  const store = new InMemoryCurationSessionStore();
  store.create(fixtureSession("session_1"));

  const session = store.get("session_1");
  assert.equal(session?.id, "session_1");
});

test("session store updates existing sessions and rejects unknown ids", () => {
  const store = new InMemoryCurationSessionStore();
  store.create(fixtureSession("session_1"));
  const updated = store.update("session_1", { status: "ready" });

  assert.equal(updated.status, "ready");
  assert.throws(() => store.update("missing", { status: "failed" }), /Curation session not found/);
});
