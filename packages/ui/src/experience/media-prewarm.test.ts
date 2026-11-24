import assert from "node:assert/strict";
import test from "node:test";
import { adjacentWarmUrls, createPrewarmQueue } from "./media-prewarm";
import { roomImageCandidate } from "./room-assets";

test("prewarm decodes the selected responsive source while retaining its logical identity", async () => {
  const loaded: string[] = [];
  const queue = createPrewarmQueue(async url => { loaded.push(url); return url; });
  assert.equal(await queue.warm("large-logical-url", undefined, "small-content-hash-url"), true);
  assert.equal(queue.get("large-logical-url"), "small-content-hash-url");
  assert.deepEqual(loaded, ["small-content-hash-url"]);
});

const next = { previewUrl: "/next?releaseVersion=new", depthMapUrl: "/next?variant=depth&releaseVersion=new", backgroundUrl: "/next-wall" };
const previous = { previewUrl: "/back", depthMapUrl: "/back-depth", backgroundUrl: "/back-wall" };
const motion = { reducedMotion: false, mouseMotion: true };
const essentialUrls = [next.previewUrl, next.backgroundUrl, previous.previewUrl, previous.backgroundUrl];

test("adjacent previews and changed walls precede both versioned depth requests", () => {
  assert.deepEqual(adjacentWarmUrls(next, previous, motion), [...essentialUrls, next.depthMapUrl, previous.depthMapUrl]);
  assert.deepEqual(adjacentWarmUrls(next, previous, { ...motion, currentBackground: next.backgroundUrl }), [
    next.previewUrl, previous.previewUrl, previous.backgroundUrl, next.depthMapUrl, previous.depthMapUrl,
  ]);
  assert.deepEqual(adjacentWarmUrls(next, next, motion), [next.previewUrl, next.backgroundUrl, next.depthMapUrl]);
  assert.deepEqual(adjacentWarmUrls(undefined, undefined, motion), []);
});

test("system reduced motion or turning off light motion keeps only previews and changed walls", () => {
  assert.deepEqual(adjacentWarmUrls(next, previous, { ...motion, reducedMotion: true }), essentialUrls);
  assert.deepEqual(adjacentWarmUrls(next, previous, { ...motion, mouseMotion: false }), essentialUrls);
});

test("slow and metered connections never compete with the visible artwork for speculative images", () => {
  assert.deepEqual(adjacentWarmUrls(next, previous, { ...motion, connection: { saveData: true, effectiveType: "3g" } }), []);
  for (const effectiveType of ["2g", "slow-2g"]) {
    assert.deepEqual(adjacentWarmUrls(next, previous, { ...motion, connection: { effectiveType } }), []);
  }
  assert.deepEqual(adjacentWarmUrls(next, previous, { ...motion, connection: { effectiveType: "3g" } }), [next.previewUrl]);
  assert.deepEqual(adjacentWarmUrls(undefined, previous, { ...motion, connection: { effectiveType: "3g" } }), []);
});

test("rapid navigation stays within a shared concurrency bound, deduplicates, and skips cancelled queued work", async () => {
  const pending: Array<() => void> = [], started: string[] = [];
  const queue = createPrewarmQueue(url => new Promise<void>(resolve => { started.push(url); pending.push(resolve); }));
  const first = queue.warm("first"), duplicate = queue.warm("first"), second = queue.warm("second");
  const controller = new AbortController(); const stale = queue.warm("stale", controller.signal);
  const fresh = queue.warm("fresh"); controller.abort();
  assert.equal(first, duplicate); assert.deepEqual(started, ["first", "second"]);
  pending.shift()!(); await first; await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(started, ["first", "second", "fresh"]); assert.equal(await stale, false);
  pending.splice(0).forEach(resolve => resolve()); await Promise.all([second, fresh]);
  assert.equal(queue.ready("first"), true);
});

test("turning motion off preserves pending essential images and cancels queued depth", async () => {
  const started: string[] = [];
  let releaseActive!: () => void;
  const queue = createPrewarmQueue(async url => {
    started.push(url);
    if (url === next.previewUrl) await new Promise<void>(resolve => { releaseActive = resolve; });
  }, 1);
  const enabled = new AbortController();
  const original = adjacentWarmUrls(next, previous, motion).map(url => queue.warm(url, enabled.signal));
  enabled.abort();
  const disabled = new AbortController();
  const rescheduled = adjacentWarmUrls(next, previous, { ...motion, mouseMotion: false }).map(url => queue.warm(url, disabled.signal));
  releaseActive();
  assert.deepEqual(await Promise.all(original), [true, true, true, true, false, false]);
  assert.deepEqual(await Promise.all(rescheduled), [true, true, true, true]);
  assert.deepEqual(started, essentialUrls);
});

test("a failed image can be retried without a permanent failed cache entry", async () => {
  let attempts = 0;
  const queue = createPrewarmQueue(async () => { if (++attempts === 1) throw new Error("offline"); });
  assert.equal(await queue.warm("a"), false);
  assert.equal(await queue.warm("a"), true);
  assert.equal(attempts, 2);
});

test("navigation receives the retained resource and evicts only unprotected least recently used images", async () => {
  const released: string[] = [];
  const queue = createPrewarmQueue(async url => ({ source: `blob:${url}` }), 2, 2, resource => released.push(resource.source));
  queue.retain(["current"]);
  await queue.warm("current"); await queue.warm("old");
  const current = queue.get("current");
  await queue.warm("next");
  assert.equal(queue.get("current"), current);
  assert.equal(queue.get("next")?.source, "blob:next");
  assert.equal(queue.ready("old"), false);
  assert.deepEqual(released, ["blob:old"]);
  queue.retain(["next"]);
  await queue.warm("following");
  assert.equal(queue.ready("current"), false);
  assert.deepEqual(released, ["blob:old", "blob:current"]);
  assert.equal(queue.get("next")?.source, "blob:next");
});

test("prewarmed walls use the same responsive candidate as the visible room", () => {
  const wall = "/artduo-gallery/lighting/v2/bg-004-1600.webp";
  assert.equal(roomImageCandidate(wall, 390, 1), wall.replace("1600", "960"));
  assert.equal(roomImageCandidate(wall, 390, 2), wall);
  assert.equal(roomImageCandidate(wall, 1440, 1), wall);
  assert.equal(roomImageCandidate("/artwork?releaseVersion=new", 390, 1), "/artwork?releaseVersion=new");
});
