import assert from "node:assert/strict";
import test from "node:test";
import { boundedRoomLightInput, boundedRoomLightMood, NEUTRAL_ROOM_MOOD, roomLightMood, roomLightProfile } from "./room-lighting";

test("photographed windows, cove lights and track fixtures use distinct soft distributions", () => {
  assert.equal(roomLightProfile("bg-004")?.shape, "window-wash");
  assert.equal(roomLightProfile("bg-027")?.shape, "linear-wash");
  assert.equal(roomLightProfile("bg-034")?.shape, "oval-spots");
  for (const id of ["bg-004", "bg-012", "bg-015", "bg-022", "bg-027", "bg-034"]) {
    assert.match(roomLightProfile(id)!.depthUrl, /lighting\/v2\//u);
    assert.ok(roomLightProfile(id)!.lights.length > 0);
  }
  assert.equal(roomLightProfile("unknown"), undefined);
  assert.equal(roomLightProfile(undefined), undefined);
});

test("curatorial targets change the room smoothly within safe bounds", () => {
  const quiet = roomLightMood({ valence: .6, arousal: .15, tension: .1, wonder: .3, intimacy: .8 });
  const tense = roomLightMood({ valence: .2, arousal: .8, tension: .85, wonder: .6, intimacy: .2 });
  assert.ok(quiet.exposure > tense.exposure);
  assert.ok(quiet.softness > tense.softness);
  assert.ok(quiet.motionScale < tense.motionScale);
  assert.ok(quiet.audioGain < tense.audioGain);
  assert.deepEqual(roomLightMood(), NEUTRAL_ROOM_MOOD);
  for (const value of Object.values(roomLightMood({ valence: NaN, arousal: Infinity, tension: -100, wonder: 100, intimacy: NaN }))) assert.ok(Number.isFinite(value));
  assert.equal(boundedRoomLightMood({ ...quiet, exposure: 10, warmth: -10 }).exposure, 1.08);
});

test("invalid or extreme pointer and sensor input never reaches lighting uniforms", () => {
  assert.deepEqual(boundedRoomLightInput({ x: Infinity, y: NaN }), { x: 0, y: 0 });
  assert.deepEqual(boundedRoomLightInput({ x: 9, y: -9 }), { x: 1, y: -1 });
});
