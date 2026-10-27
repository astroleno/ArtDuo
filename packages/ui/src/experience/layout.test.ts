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

test("phone labels stay under the painting and leave the floor and navigation visible", () => {
  for (const width of [320, 390]) for (const ratio of [0.65, 1, 1.8]) {
    const height = width === 320 ? 568 : 844;
    const layout = calculateRoomLayout({ viewport: { width, height }, sceneSize: { width: 1672, height: 941 },
      mountZone: { shape: "rect", rect: { x: 0.18, y: 0.18, width: 0.64, height: 0.5 } }, artworkAspectRatio: ratio, plaqueHeight: 106 });
    assert.ok(layout.plaque.y >= layout.frame.y + layout.frame.height + 12);
    assert.ok(layout.plaque.y + layout.plaque.height <= height - 88);
    assert.ok(layout.plaque.x >= 20 && layout.plaque.x + layout.plaque.width <= width - 20);
    assert.ok(layout.plaque.width <= 210);
  }
});

test("reduced motion removes spatial transitions and unsupported WebGL hints degrade to fade", () => {
  const reduced = createMotionPolicy({ reducedMotion: true, webglAvailable: true });
  assert.equal(motionDuration(1000, reduced), 0);
  assert.equal(resolvedTransitionFamily("lateral-pan", reduced), "fade");
  assert.equal(resolvedTransitionFamily("depth-push", createMotionPolicy({ webglAvailable: false })), "fade");
  assert.equal(resolvedTransitionFamily("dissolve", createMotionPolicy({ webglAvailable: false })), "dissolve");
});

test("phone route, full emotional note and navigation never cover narrow or wide artworks", () => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
    for (const ratio of [333 / 1962, .65, 1, 1.8, 2400 / 257]) {
      for (const wallTop of [.18, .6]) {
        const layout = calculateRoomLayout({ viewport, sceneSize: { width: 1672, height: 941 },
          mountZone: { shape: "rect", rect: { x: .18, y: wallTop, width: .64, height: .3 } },
          artworkAspectRatio: ratio, frameInset: 16, navigationHeight: 136, plaqueHeight: 176 });
        assert.ok(layout.frame.y >= 136);
        assert.ok(layout.frame.width > 0 && layout.frame.height > 0);
        assert.ok(layout.plaque.y >= layout.frame.y + layout.frame.height + 12);
        assert.ok(layout.plaque.y + layout.plaque.height <= viewport.height - 88);
      }
    }
  }
});

test("matting stays outside narrow and wide image geometry", () => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    for (const ratio of [333 / 1962, 2400 / 257, 1]) {
      const layout = calculateRoomLayout({ viewport, sceneSize: { width: 1672, height: 941 },
        artworkAspectRatio: ratio, frameInset: 32 });
      const width = layout.frame.width - layout.frameInset * 2;
      const height = layout.frame.height - layout.frameInset * 2;
      assert.ok(width > 0 && height > 0);
      assert.ok(Math.abs(width / height - ratio) < 0.00001);
      assert.ok(layout.frame.x >= 0 && layout.frame.x + layout.frame.width <= viewport.width);
      assert.ok(layout.frame.y >= 0 && layout.frame.y + layout.frame.height <= viewport.height - 70);
    }
  }
});

function assertLabelClear(layout: ReturnType<typeof calculateRoomLayout>, viewport: { width: number; height: number }) {
  const { frame, plaque } = layout;
  const overlapWidth = Math.max(0, Math.min(frame.x + frame.width, plaque.x + plaque.width) - Math.max(frame.x, plaque.x));
  const overlapHeight = Math.max(0, Math.min(frame.y + frame.height, plaque.y + plaque.height) - Math.max(frame.y, plaque.y));
  assert.equal(overlapWidth * overlapHeight, 0, `label overlaps artwork at ${viewport.width}×${viewport.height}`);
  assert.ok(plaque.x >= 20 && plaque.x + plaque.width <= viewport.width - 20 + .001);
  assert.ok(plaque.y >= 72 && plaque.y + plaque.height <= viewport.height - 88 + .001);
  assert.ok(layout.compactPlaqueWidth <= 124 && layout.compactPlaqueWidth <= plaque.width);
  assert.ok(frame.width > layout.frameInset * 2 && frame.height > layout.frameInset * 2);
}

const galleryWall = { shape: "rect" as const, rect: { x: .18, y: .18, width: .64, height: .5 } };

test("desktop reserves the complete expanded label on the wall side of the artwork", () => {
  const viewport = { width: 1440, height: 900 };
  const layout = calculateRoomLayout({ viewport, sceneSize: { width: 1672, height: 941 }, mountZone: galleryWall,
    artworkAspectRatio: 1.57, frameInset: 6, plaqueSize: { width: 188, height: 123 } });
  assert.equal(layout.plaquePlacement, "right");
  assert.ok(layout.plaque.x >= layout.frame.x + layout.frame.width + 20 - .001);
  assert.equal(layout.plaque.width, 188);
  assertLabelClear(layout, viewport);
});

test("adjacent tablet widths move the label below instead of clamping it over the image", () => {
  for (const width of [767, 768]) {
    const viewport = { width, height: 1024 };
    const layout = calculateRoomLayout({ viewport, sceneSize: { width: 1672, height: 941 }, mountZone: galleryWall,
      artworkAspectRatio: 1.57, frameInset: 6, plaqueSize: { width: 188, height: 123 } });
    assert.equal(layout.plaquePlacement, "below");
    assert.ok(layout.plaque.y >= layout.frame.y + layout.frame.height + 12 - .001);
    assertLabelClear(layout, viewport);
  }
});

test("phone return focus has space for the long label's real height without covering the work", () => {
  const viewport = { width: 320, height: 568 };
  const layout = calculateRoomLayout({ viewport, sceneSize: { width: 1672, height: 941 }, mountZone: galleryWall,
    artworkAspectRatio: 1.57, frameInset: 6, navigationHeight: 80, plaqueSize: { width: 188, height: 123 } });
  assert.equal(layout.plaquePlacement, "below");
  assert.equal(layout.plaque.height, 123);
  assert.ok(layout.frame.width >= 280, "a longer label should not unnecessarily shrink a wide painting");
  assertLabelClear(layout, viewport);
});

test("label budgets remain separate for long text, off-centre mounts, paper and landscape phones", () => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 667, height: 375 }, { width: 844, height: 390 }, { width: 1024, height: 768 }]) {
    for (const ratio of [.17, .65, 1, 1.8, 9.3]) {
      for (const mountZone of [galleryWall, { shape: "rect" as const, rect: { x: .6, y: .6, width: .25, height: .3 } }]) {
        const layout = calculateRoomLayout({ viewport, sceneSize: { width: 1672, height: 941 }, mountZone,
          artworkAspectRatio: ratio, frameInset: 32, navigationHeight: viewport.width < 768 ? 80 : 76, plaqueSize: { width: 188, height: 230 } });
        assertLabelClear(layout, viewport);
      }
    }
  }
});
