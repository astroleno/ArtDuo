import assert from "node:assert/strict";
import { test } from "node:test";

import { parseApiErrors } from "./errors";
import { loadFixture } from "./test-helpers";

test("error fixtures conform to the shared ApiError shape", () => {
  const errors = parseApiErrors(loadFixture("errors.json"));

  assert.equal(errors.length, 3);
  assert.ok(errors.some((error) => error.retryable === true));
  assert.ok(errors.some((error) => error.retryable === false));
});
