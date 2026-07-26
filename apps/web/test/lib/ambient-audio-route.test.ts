import assert from "node:assert/strict";
import { test } from "node:test";

import { GET } from "../../app/ambient-audio/[...path]/route";

test("ambient audio route serves allowlisted root public tracks", async () => {
  const response = await GET(
    new Request("http://artduo.test/ambient-audio/Awakening.mp3"),
    { params: Promise.resolve({ path: ["Awakening.mp3"] }) },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "audio/mpeg");
  assert.ok((await response.arrayBuffer()).byteLength > 0);
});

test("ambient audio route rejects unknown public files", async () => {
  const response = await GET(
    new Request("http://artduo.test/ambient-audio/secret.mp3"),
    { params: Promise.resolve({ path: ["secret.mp3"] }) },
  );

  assert.equal(response.status, 404);
});
