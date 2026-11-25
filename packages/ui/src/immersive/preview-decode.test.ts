import assert from "node:assert/strict";
import test from "node:test";
import { decodePreview } from "./preview-decode";

test("a late first A is stale after A→B→A, and only the second A can reveal", async () => {
  let sequence = 1;
  let release!: () => void;
  const delayed = { currentSrc: "a", naturalWidth: 48, naturalHeight: 64, decode: () => new Promise<void>(resolve => { release = resolve; }) };
  const first = decodePreview(delayed, "a", () => sequence === 1);
  sequence = 2;
  sequence = 3;
  release();
  assert.deepEqual(await first, { state: "stale" });
  const current = { ...delayed, decode: async () => {} };
  assert.deepEqual(await decodePreview(current, "a", () => sequence === 3), { state: "ready", width: 48, height: 64 });
  assert.deepEqual(await decodePreview(current, "old-source", () => sequence === 3), { state: "stale" });
});

test("a failed preview remains retryable, and a rejected older attempt cannot report failure", async () => {
  let attempt = 0;
  const image = { currentSrc: "a", naturalWidth: 48, naturalHeight: 64, decode: async () => { if (attempt === 0) throw new Error("decode failure"); } };
  assert.deepEqual(await decodePreview(image, "a", () => attempt === 0), { state: "error" });
  const stale = decodePreview(image, "a", () => attempt === 0);
  attempt++;
  assert.deepEqual(await stale, { state: "stale" });
  assert.equal((await decodePreview(image, "a", () => attempt === 1)).state, "ready");
});
