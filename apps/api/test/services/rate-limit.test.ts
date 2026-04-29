import assert from "node:assert/strict";
import { test } from "node:test";

import { InMemoryRateLimit } from "../../src/services/http/rate-limit";

test("rate limit allows first N requests and rejects N+1 in same window", () => {
  const limiter = new InMemoryRateLimit({ limit: 2, windowMs: 60_000 });
  const now = new Date("2026-04-29T00:00:00.000Z");

  const first = limiter.check("k1", now);
  const second = limiter.check("k1", now);
  const third = limiter.check("k1", now);

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
  assert.equal(third.remaining, 0);
});
