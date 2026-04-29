import assert from "node:assert/strict";
import { test } from "node:test";

import { InMemoryIdempotencyStore } from "../../src/services/http/idempotency-store";

test("idempotency store reuses the same value for the same key", () => {
  const store = new InMemoryIdempotencyStore<{ id: string }>();
  const first = store.getOrSet("same-key", () => ({ id: "one" }));
  const second = store.getOrSet("same-key", () => ({ id: "two" }));

  assert.equal(first.id, "one");
  assert.equal(second.id, "one");
});

test("idempotency store rejects empty keys", () => {
  const store = new InMemoryIdempotencyStore<string>();

  assert.throws(() => store.get(""), /Idempotency key is required/);
  assert.throws(() => store.set(" ", "x"), /Idempotency key is required/);
});
