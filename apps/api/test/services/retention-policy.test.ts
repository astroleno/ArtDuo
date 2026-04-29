import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_RETENTION_POLICY } from "../../src/services/privacy/retention-policy";

test("retention policy keeps short raw ttl and longer redacted ttl", () => {
  assert.equal(DEFAULT_RETENTION_POLICY.rawUserTextTtlHours, 24);
  assert.equal(DEFAULT_RETENTION_POLICY.redactedLogTtlDays, 30);
  assert.equal(DEFAULT_RETENTION_POLICY.redactedLogTtlDays > DEFAULT_RETENTION_POLICY.rawUserTextTtlHours / 24, true);
});
