import assert from "node:assert/strict";
import test from "node:test";
import { adjacentWarmUrls, artworkWarmUrls, createPrewarmQueue } from "./media-prewarm";
import { roomImageCandidate } from "./room-assets";

test("prewarm decodes the selected responsive source while retaining its logical identity", async () => {
  const loaded: string[] = [];
  const queue = createPrewarmQueue(async url => { loaded.push(url); return url; });
  assert.equal(await queue.warm("large-logical-url", undefined, "small-content-hash-url"), true);
  assert.equal(queue.get("large-logical-url"), "small-content-hash-url");
  assert.deepEqual(loaded, ["small-content-hash-url"]);
});

test("adjacent artwork prewarming includes the matching versioned depth without repeating the current wall", () => {
  const media = { previewUrl: "/image?releaseVersion=new", depthMapUrl: "/image?variant=depth&releaseVersion=new", backgroundUrl: "/wall" };
  const urls = artworkWarmUrls(media, "/wall");
  assert.deepEqual(adjacentWarmUrls(urls, []), [media.previewUrl, media.depthMapUrl]);
  assert.deepEqual(adjacentWarmUrls(urls, [], { effectiveType: "3g" }), [media.previewUrl]);
  assert.deepEqual(adjacentWarmUrls(urls, [], { saveData: true }), []);
  assert.deepEqual(artworkWarmUrls(undefined), []);
});

test("slow and metered connections never compete with the visible artwork for speculative images", () => {
  assert.deepEqual(adjacentWarmUrls(["next", "wall"], ["back"], { saveData: true }), []);
  assert.deepEqual(adjacentWarmUrls(["next", "wall"], ["back"], { effectiveType: "2g" }), []);
  assert.deepEqual(adjacentWarmUrls(["next", "wall"], ["back"], { effectiveType: "3g" }), ["next"]);
  assert.deepEqual(adjacentWarmUrls(["next", "wall"], ["back", "wall"]), ["next", "wall", "back"]);
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
