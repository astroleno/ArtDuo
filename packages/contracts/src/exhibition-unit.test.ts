import assert from "node:assert/strict";
import { test } from "node:test";

import { parseArtworkRecords } from "./artwork";
import { parseBackgroundSceneRecords } from "./background-scene";
import { parseExhibitionUnits } from "./exhibition-unit";
import { loadFixture } from "./test-helpers";

test("exhibition units only reference frozen v0.1 artworks and scenes", () => {
  const artworks = new Set(parseArtworkRecords(loadFixture("artworks.json")).map((record) => record.id));
  const scenes = new Set(parseBackgroundSceneRecords(loadFixture("background-scenes.json")).map((scene) => scene.id));
  const units = parseExhibitionUnits(loadFixture("exhibition-units.json"));

  assert.deepEqual(
    units.map((unit) => unit.order),
    [0, 1, 2],
  );

  for (const unit of units) {
    assert.ok(artworks.has(unit.artworkId), `${unit.unitId} should point to a known artwork`);
    assert.ok(scenes.has(unit.backgroundSceneId), `${unit.unitId} should point to a known scene`);
  }
});
