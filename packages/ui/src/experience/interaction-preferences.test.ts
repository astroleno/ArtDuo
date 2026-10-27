import assert from "node:assert/strict";
import test from "node:test";
import { readMouseMotionPreference } from "./interaction-preferences";
import { nearGalleryControls } from "./use-idle-chrome";

test("the opt-out survives stored preferences while corrupt storage uses the default", () => {
  assert.equal(readMouseMotionPreference('{"version":1,"mouseMotion":false}'), false);
  assert.equal(readMouseMotionPreference('{"version":1,"mouseMotion":true}'), true);
  for (const raw of [null, "{", "null", '{"version":2,"mouseMotion":false}', '{"version":1,"mouseMotion":"false"}']) {
    assert.equal(readMouseMotionPreference(raw), true);
  }
});

test("viewing the central picture does not reveal chrome while its control edges do", () => {
  assert.equal(nearGalleryControls(720, 450, 1440, 900), false);
  assert.equal(nearGalleryControls(195, 422, 390, 844), false);
  for (const [x, y] of [[20, 450], [1420, 450], [720, 30], [720, 870]]) assert.equal(nearGalleryControls(x!, y!, 1440, 900), true);
});
