import assert from "node:assert/strict";
import { test } from "node:test";
import { artworkMediumKinds, artworkPrintDetails } from "./artwork-evidence";

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
test("museum print details distinguish plate, process, compounds and uncertainty", () => {
  assert.equal(artworkPrintDetails("Etching after Rembrandt").etching, "present");
  assert.equal(artworkPrintDetails("Etching").copperplate, "unknown");
  assert.equal(artworkPrintDetails("Copper engraving").etching, "absent");
  assert.equal(artworkPrintDetails("Copper engraving").copperplate, "present");
  assert.equal(artworkPrintDetails("Etched on copper").copperplate, "present");
  assert.equal(artworkPrintDetails("Etching and engraving").engraving, "present");
  assert.equal(artworkPrintDetails("Wood engraving").woodblock, "present");
  assert.equal(artworkPrintDetails("Oil on copper").copperplate, "absent");
  assert.equal(artworkPrintDetails("Print").woodblock, "unknown");
  assert.equal(artworkPrintDetails("木板油画").woodblock, "absent");
  assert.equal(artworkPrintDetails("Photograph of a woodcut").woodblock, "unknown");
  assert.equal(artworkPrintDetails("Etching or engraving").engraving, "unknown");
  assert.equal(artworkPrintDetails(undefined).etching, "unknown");
});
