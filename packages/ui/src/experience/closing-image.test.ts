import assert from "node:assert/strict";
import test from "node:test";
import { observeClosingImage, type ClosingImageState } from "./closing-image";

class Image extends EventTarget {
  complete = false;
  naturalWidth = 0;
  naturalHeight = 0;
}

test("an image completed before hydration immediately publishes its actual aspect ratio", () => {
  const image = Object.assign(new Image(), { complete: true, naturalWidth: 1600, naturalHeight: 945 });
  const states: ClosingImageState[] = [];
  const dispose = observeClosingImage(image, value => states.push(value));
  assert.deepEqual(states, [{ state: "ready", ratio: 1600 / 945 }]);
  dispose();
});

test("pending images settle through native events and unmount removes both listeners", () => {
  const image = new Image(), states: ClosingImageState[] = [];
  const dispose = observeClosingImage(image, value => states.push(value));
  assert.deepEqual(states, []);
  image.naturalWidth = 300; image.naturalHeight = 600;
  image.dispatchEvent(new Event("load"));
  image.dispatchEvent(new Event("error"));
  assert.deepEqual(states, [{ state: "ready", ratio: .5 }, { state: "failed" }]);
  dispose(); image.dispatchEvent(new Event("load")); image.dispatchEvent(new Event("error"));
  assert.equal(states.length, 2);
});

test("a cached broken image immediately exposes failure instead of an endless loading frame", () => {
  const image = Object.assign(new Image(), { complete: true });
  let state: ClosingImageState | undefined;
  observeClosingImage(image, value => { state = value; })();
  assert.deepEqual(state, { state: "failed" });
});
