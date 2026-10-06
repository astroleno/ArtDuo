import assert from "node:assert/strict";
import test from "node:test";

import { calculateRoomLayout } from "./layout";
import { createMotionPolicy, motionDuration, resolvedTransitionFamily } from "./motion-policy";

test("room layout projects mount zones through cover crop and keeps phone frame inside the viewport", () => {
  const layout = calculateRoomLayout({
    viewport: { width: 320, height: 568 },
    sceneSize: { width: 1600, height: 900 },
    mountZone: { shape: "rect", rect: { x: 0.28, y: 0.2, width: 0.46, height: 0.58 } },
    artworkAspectRatio: 0.72,
    navigationHeight: 70,
    plaqueHeight: 136,
  });
  assert.equal(layout.mobilePlaque, true);
  assert.equal(layout.staticFallback, false);
  assert.ok(layout.frame.x >= 0 && layout.frame.y >= 0);
  assert.ok(layout.frame.x + layout.frame.width <= 320);
  assert.ok(layout.frame.y + layout.frame.height <= 568);
  assert.ok(layout.plaque.x >= 0 && layout.plaque.x + layout.plaque.width <= 320);
});

test("room layout uses a safe inscribed region for polygon mounts and falls back when coordinates are invalid", () => {
  const polygon = calculateRoomLayout({
    viewport: { width: 1440, height: 900 }, sceneSize: { width: 1600, height: 900 }, artworkAspectRatio: 1.4,
    mountZone: { shape: "polygon", points: [{ x: 0.25, y: 0.2 }, { x: 0.74, y: 0.25 }, { x: 0.64, y: 0.84 }, { x: 0.33, y: 0.8 }] },
  });
  assert.ok(polygon.frame.width > 0 && polygon.frame.height > 0);
  assert.equal(polygon.staticFallback, false);
  const invalid = calculateRoomLayout({
    viewport: { width: 1440, height: 900 }, sceneSize: { width: 1600, height: 900 }, artworkAspectRatio: 1.3,
    mountZone: { shape: "rect", rect: { x: 1.4, y: 0.4, width: 0.3, height: 0.5 } },
  });
  assert.equal(invalid.staticFallback, true);
});

test("distinct valid wall mounts produce distinct pixel frames inside their projected bounds", () => {
  const layoutAt = (x: number) => calculateRoomLayout({
    viewport: { width: 1440, height: 900 }, sceneSize: { width: 1600, height: 900 }, artworkAspectRatio: 1,
    mountZone: { shape: "rect", rect: { x, y: 0.2, width: 0.2, height: 0.5 } },
  });
  const left = layoutAt(0.1);
  const right = layoutAt(0.6);
  for (const [layout, x] of [[left, 80], [right, 880]] as const) {
    assert.equal(layout.staticFallback, false);
    assert.deepEqual(layout.mount, { x, y: 180, width: 320, height: 450 });
    assert.ok(layout.frame.x >= layout.mount.x);
    assert.ok(layout.frame.x + layout.frame.width <= layout.mount.x + layout.mount.width);
    assert.ok(layout.frame.y >= layout.mount.y);
    assert.ok(layout.frame.y + layout.frame.height <= layout.mount.y + layout.mount.height);
  }
  assert.equal(right.frame.x - left.frame.x, 800);
});

test("missing and fully cropped mount zones fall back to safe viewport bounds", () => {
  for (const mountZone of [undefined, { shape: "rect" as const, rect: { x: 0, y: 0, width: 0.1, height: 0.1 } }]) {
    const layout = calculateRoomLayout({ viewport: { width: 320, height: 568 }, sceneSize: { width: 1600, height: 900 }, artworkAspectRatio: 1, mountZone });
    assert.equal(layout.staticFallback, true);
    assert.ok(layout.frame.x >= 0 && layout.frame.x + layout.frame.width <= 320);
  }
});

test("reduced motion removes spatial transitions and unsupported WebGL hints degrade to fade", () => {
  const reduced = createMotionPolicy({ reducedMotion: true, webglAvailable: true });
  assert.equal(motionDuration(1000, reduced), 0);
  assert.equal(resolvedTransitionFamily("lateral-pan", reduced), "fade");
  assert.equal(resolvedTransitionFamily("depth-push", createMotionPolicy({ webglAvailable: false })), "fade");
  assert.equal(resolvedTransitionFamily("dissolve", createMotionPolicy({ webglAvailable: false })), "dissolve");
});
