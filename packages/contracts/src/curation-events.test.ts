import assert from "node:assert/strict";
import { test } from "node:test";

import { parseCurationEvent } from "./curation-events";
import { loadFixture } from "./test-helpers";

test("curation events include session and explanation lifecycle updates", () => {
  const session = loadFixture("curation-session-ready.json");
  const explanation = loadFixture("artwork-explanation-ready.json");

  const created = parseCurationEvent({ type: "session.created", session });
  const updated = parseCurationEvent({ type: "session.updated", session });
  const explanationUpdated = parseCurationEvent({ type: "explanation.updated", explanation });
  const failed = parseCurationEvent({
    type: "session.failed",
    sessionId: "session_fail_001",
    error: "generation timeout",
    occurredAt: "2026-04-29T00:00:00.000Z",
  });

  assert.equal(created.type, "session.created");
  assert.equal(updated.type, "session.updated");
  assert.equal(explanationUpdated.type, "explanation.updated");
  assert.equal(failed.type, "session.failed");
});
