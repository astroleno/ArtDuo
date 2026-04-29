import assert from "node:assert/strict";
import { test } from "node:test";

import { assertWithinBudget } from "../../src/services/curation/budget-guard";

test("budget guard throws when estimated tokens exceed max", () => {
  assert.throws(() => assertWithinBudget({ estimatedTokens: 1201, maxTokens: 1200 }), /Budget exceeded/);
  assert.doesNotThrow(() => assertWithinBudget({ estimatedTokens: 1200, maxTokens: 1200 }));
});
