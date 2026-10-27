import assert from "node:assert/strict";
import { test } from "node:test";
import { artworkMediumKinds } from "./artwork-evidence";

test("media remain grounded in metadata and mixed techniques retain their identity", () => {
  assert.deepEqual(artworkMediumKinds("Etching"), ["print"]);
  assert.deepEqual(artworkMediumKinds("Woodblock print; ink and color on paper"), ["print"]);
  assert.deepEqual(artworkMediumKinds("Oil on canvas"), ["oil"]);
  assert.deepEqual(artworkMediumKinds("Oil and tempera on wood"), ["oil", "tempera"]);
  assert.deepEqual(artworkMediumKinds("Pen and black ink, watercolor washes"), ["watercolor", "ink", "drawing"]);
  assert.deepEqual(artworkMediumKinds("Charcoal on paper"), ["drawing"]);
  assert.deepEqual(artworkMediumKinds("Unknown"), []);
  assert.deepEqual(artworkMediumKinds(undefined), []);
});
