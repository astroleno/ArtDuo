import assert from "node:assert/strict";
import test from "node:test";
import { createRoomLightingRenderer } from "./room-lighting-renderer";
import { roomLightProfile } from "./room-lighting";

test("room lighting preserves image alignment and resumes the latest input after visibility changes", async () => {
  const listeners = new Set<() => void>(), frames = new Map<number, FrameRequestCallback>();
  let frameId = 0, now = 0;
  let submitted: number[] = [];
  const scalars = new Map<string, number>();
  const documentStub = { visibilityState: "visible", addEventListener(_type: string, listener: () => void) { listeners.add(listener); }, removeEventListener(_type: string, listener: () => void) { listeners.delete(listener); } };
  class ImageStub {
    naturalWidth = 480; naturalHeight = 320;
    onload: (() => void) | null = null; onerror: (() => void) | null = null;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  }
  const context = new Proxy({}, { get(_target, property) {
    const name = String(property);
    if (name === "isContextLost") return () => false;
    if (name.startsWith("create")) return () => ({});
    if (name === "getUniformLocation") return (_program: unknown, uniform: string) => uniform;
    if (name === "uniform1f") return (uniform: string, value: number) => { scalars.set(uniform, value); };
    if (name === "getShaderParameter" || name === "getProgramParameter") return () => true;
    if (name === "getAttribLocation") return () => 0;
    if (name === "uniform2f") return (_location: unknown, x: number, y: number) => { submitted = [x, y]; };
    return /^[A-Z_\d]+$/u.test(name) ? 0 : () => {};
  } });
  const canvas = { clientWidth: 800, clientHeight: 600, width: 1, height: 1, dataset: {} as Record<string, string>, getContext: () => context };
  const replacements: Record<string, unknown> = {
    Image: ImageStub, location: new URL("https://gallery.test/"), document: documentStub, devicePixelRatio: 1,
    requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: (id: number) => { frames.delete(id); },
  };
  const previous = new Map(Object.keys(replacements).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const flush = () => { for (let step = 0; step < 80 && frames.size; step++) { const pending = [...frames.values()]; frames.clear(); now += 40; pending.forEach(callback => callback(now)); } };
  let controller: Awaited<ReturnType<typeof createRoomLightingRenderer>> | undefined;
  try {
    for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
    controller = await createRoomLightingRenderer({ canvas: canvas as unknown as HTMLCanvasElement, imageUrl: "/wall.jpg", profile: roomLightProfile("bg-004")! });
    assert.equal(scalars.get("u_image_y"), .5, "existing painting rooms retain their center cover projection");
    assert.equal(scalars.get("u_sculpture"), 0, "pointer relighting is opt-in and must not change painting defaults");
    documentStub.visibilityState = "hidden"; listeners.forEach(listener => listener());
    controller.setInput({ x: .8, y: -.6 });
    assert.equal(frames.size, 0);
    documentStub.visibilityState = "visible"; listeners.forEach(listener => listener()); flush();
    assert.ok(Number(canvas.dataset.lightX) > .79, "resume discarded the latest requested x");
    assert.ok(submitted[0] > .79 && submitted[1] < -.59, "draw did not submit the requested input to WebGL");
    controller.setInput({ x: -.8, y: .6 }); listeners.forEach(listener => listener()); flush();
    assert.ok(Number(canvas.dataset.lightX) < -.79);
    controller.destroy(); assert.equal(frames.size, 0); assert.equal(listeners.size, 0);
    controller = await createRoomLightingRenderer({ canvas: canvas as unknown as HTMLCanvasElement, imageUrl: "/wall.jpg", profile: roomLightProfile("bg-004")!, imageAlignment: "bottom", sculptureInteraction: true });
    assert.equal(scalars.get("u_image_y"), 1, "sculpture lighting must use the same floor-aligned crop as its backdrop");
    assert.equal(scalars.get("u_sculpture"), 1);
    controller.setInput({ x: -.7, y: -.4 }); flush();
    assert.ok(Number(canvas.dataset.pointerLight.split(",")[0]) < -.69, "the shared pointer light did not reach the requested side");
  } finally {
    controller?.destroy();
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
