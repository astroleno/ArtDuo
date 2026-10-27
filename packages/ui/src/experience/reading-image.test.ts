import assert from "node:assert/strict";
import test from "node:test";
import { prepareReadingImage } from "./reading-image";

test("reading waits for decoded pixels and falls back to text on a broken image", async () => {
  const signal = new AbortController().signal;
  assert.equal(await prepareReadingImage({ naturalWidth: 400, decode: async () => {} }, signal), "ready");
  assert.equal(await prepareReadingImage({ naturalWidth: 0, decode: async () => {} }, signal), "failed");
  assert.equal(await prepareReadingImage({ naturalWidth: 400, decode: async () => { throw new Error("decode failed"); } }, signal), "failed");
});

test("a stalled image cannot indefinitely hide the reading text", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let decoded!: () => void;
  const pending = prepareReadingImage({ naturalWidth: 400, decode: () => new Promise<void>(resolve => { decoded = resolve; }) }, new AbortController().signal);
  await Promise.resolve();
  context.mock.timers.tick(5000);
  assert.equal(await pending, "failed");
  decoded();
  assert.equal(await pending, "failed", "a late decode must not change the fallback already shown");
});

test("cancelling reading suppresses a late decode and removes its timeout", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const controller = new AbortController();
  let decoded!: () => void;
  const pending = prepareReadingImage({ naturalWidth: 400, decode: () => new Promise<void>(resolve => { decoded = resolve; }) }, controller.signal);
  await Promise.resolve();
  controller.abort();
  assert.equal(await pending, undefined);
  decoded();
  context.mock.timers.tick(10000);
  assert.equal(await pending, undefined);
});
