import assert from "node:assert/strict";
import test from "node:test";
import { createRoomOrientationFilter } from "./room-motion";

test("room motion waits for valid calibration samples and does not jump at the resting grip", () => {
  const filter = createRoomOrientationFilter();
  assert.equal(filter.sample({ beta: null, gamma: NaN }), undefined);
  for (let i = 0; i < 4; i++) assert.equal(filter.sample({ beta: 42, gamma: 3 })?.calibrated, false);
  assert.deepEqual(filter.sample({ beta: 42, gamma: 3 }), { calibrated: true, x: 0, y: 0 });
  for (let i = 0; i < 10; i++) assert.deepEqual(filter.sample({ beta: 42.5, gamma: 3.4 }), { calibrated: true, x: 0, y: 0 });
  let result;
  for (let i = 0; i < 20; i++) result = filter.sample({ beta: 42, gamma: 16 });
  assert.ok(result!.x > .8 && result!.x <= 1);
  assert.equal(result!.y, 0);
});

test("screen rotation maps sensor axes into the display and recalibrates rather than jumping", () => {
  const filter = createRoomOrientationFilter();
  for (let i = 0; i < 5; i++) filter.sample({ beta: 0, gamma: 0 }, 90);
  let result;
  for (let i = 0; i < 20; i++) result = filter.sample({ beta: 12, gamma: 0 }, 90);
  assert.ok(result!.x < -.8);
  assert.ok(Math.abs(result!.y) < .001);
  assert.deepEqual(filter.sample({ beta: 12, gamma: 0 }, 0), { calibrated: false, x: 0, y: 0 });
});
