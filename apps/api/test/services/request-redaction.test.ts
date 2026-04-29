import assert from "node:assert/strict";
import { test } from "node:test";

import { redactUserText } from "../../src/services/privacy/request-redaction";

test("redaction replaces raw user text", () => {
  const payload = {
    userText: "my private thoughts",
    nested: {
      userText: "another one",
    },
  };

  const redacted = redactUserText(payload) as { userText: string; nested: { userText: string } };
  assert.equal(redacted.userText, "[REDACTED_USER_TEXT]");
  assert.equal(redacted.nested.userText, "[REDACTED_USER_TEXT]");
});
