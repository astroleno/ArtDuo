import assert from "node:assert/strict";
import test from "node:test";
import { readBoundedRequestJson, RuntimeLimitError } from "../../lib/public-runtime";

test("explanation body is bounded even without a content-length header", async () => {
  const request = new Request("http://local/api", { method: "POST", body: new ReadableStream({ start(controller) {
    controller.enqueue(new TextEncoder().encode('{"text":"' + "界".repeat(10))); controller.close();
  } }), duplex: "half" } as RequestInit);
  await assert.rejects(readBoundedRequestJson(request, 20), error => error instanceof RuntimeLimitError && error.status === 413);
  assert.deepEqual(await readBoundedRequestJson(new Request("http://local/api", { method: "POST", body: '{"valid":true}' })), { valid: true });
});
