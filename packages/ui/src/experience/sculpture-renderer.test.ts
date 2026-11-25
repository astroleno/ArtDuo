import assert from "node:assert/strict";
import test from "node:test";
import { createSculptureRenderer } from "./sculpture-renderer";
import { handleSculptureContextLoss } from "./sculpture-canvas";
import type { SculptureRoomScene, SculptureWork } from "./sculpture-types";

function options(canvas: HTMLCanvasElement, signal = new AbortController().signal) {
  return { canvas, signal, url: "/fixture.glb", onPoster() {}, room: {} as SculptureRoomScene, work: {} as SculptureWork };
}

test("a missing or lost display context never downloads the sculpture", async t => {
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("Model request unexpectedly started"); });
  for (const context of [null, { isContextLost: () => true }]) {
    const canvas = { getContext: () => context } as HTMLCanvasElement;
    await assert.rejects(createSculptureRenderer(options(canvas)), /WebGL2 unavailable/u);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test("a usable canvas starts exactly one abortable model request after acquiring its display context", async t => {
  const activity: string[] = [];
  const canvas = { getContext(kind: string, attributes: WebGLContextAttributes) {
    activity.push(kind);
    assert.deepEqual(attributes, { alpha: true, antialias: true });
    return { isContextLost: () => false };
  } } as HTMLCanvasElement;
  const controller = new AbortController();
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    activity.push("fetch");
    assert.equal(url, "/fixture.glb");
    assert.equal(init.signal, controller.signal);
    assert.equal(init.referrerPolicy, "no-referrer");
    return new Response(null, { status: 503 });
  });
  await assert.rejects(createSculptureRenderer(options(canvas, controller.signal)), /Sculpture unavailable \(503\)/u);
  controller.abort();
  await assert.rejects(createSculptureRenderer(options(canvas, controller.signal)), { name: "AbortError" });
  assert.deepEqual(activity, ["webgl2", "fetch"]);
});

test("losing the display context aborts a sculpture download before showing the poster", async t => {
  const canvas = { dataset: {}, getContext: () => ({ isContextLost: () => false }) } as unknown as HTMLCanvasElement;
  const controller = new AbortController();
  let activeSignal: AbortSignal | null | undefined;
  t.mock.method(globalThis, "fetch", (_url: string, init: RequestInit) => {
    activeSignal = init.signal;
    return new Promise<Response>((_resolve, reject) => activeSignal!.addEventListener("abort", () => reject(activeSignal!.reason), { once: true }));
  });
  const loading = createSculptureRenderer(options(canvas, controller.signal));
  assert.equal(activeSignal, controller.signal);
  const event = new Event("webglcontextlost", { cancelable: true });
  let poster = false;
  handleSculptureContextLoss(event, canvas, controller, () => {
    assert.equal(activeSignal?.aborted, true);
    poster = true;
  });
  await assert.rejects(loading, { name: "AbortError" });
  assert.equal(event.defaultPrevented, true);
  assert.equal(canvas.dataset.loadError, "WebGL context lost");
  assert.equal(poster, true);
});

test("a cancelled response body is never decoded, including with a basic abort signal", async t => {
  const canvas = { getContext: () => ({ isContextLost: () => false }) } as HTMLCanvasElement;
  const signal = { aborted: false };
  t.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    async arrayBuffer() {
      signal.aborted = true;
      // The bytes would yield a format error if decoding started.
      return new Uint8Array([1, 2, 3, 4]).buffer;
    },
  }));
  await assert.rejects(createSculptureRenderer(options(canvas, signal as AbortSignal)), { name: "AbortError" });
  assert.equal(signal.aborted, true, "the basic signal allowed the request to reach body loading");
});
