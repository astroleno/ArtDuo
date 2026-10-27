import assert from "node:assert/strict";
import test from "node:test";
import { roomImageCandidate, roomImageSrcSet } from "./room-assets";

test("hashed room variants use their explicit independent object addresses", () => {
  const large = "https://assets.aitoshuu.me/artduo/media-v1/objects/aaa/bg-004-1600.webp";
  const small = "https://assets.aitoshuu.me/artduo/media-v1/objects/bbb/bg-004-960.webp";
  assert.equal(roomImageSrcSet(large, small), `${small} 960w, ${large} 1600w`);
  assert.equal(roomImageSrcSet(large), undefined);
  assert.equal(roomImageCandidate(large, 390, 1, small), small);
  assert.equal(roomImageCandidate(large, 390, 2, small), large);
  assert.equal(roomImageCandidate(large, 1440, 1, small), large);
  assert.equal(roomImageCandidate(large, 390, 1), large);
});
