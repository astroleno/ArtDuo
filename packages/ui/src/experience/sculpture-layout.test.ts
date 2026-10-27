import assert from "node:assert/strict";
import test from "node:test";
import { sculptureRoomLayout } from "./sculpture-layout";

const sculptures = [
  { height: 2.65, width: 1.1, depth: .75, pedestalHeight: .1, pedestalWidth: 1.25, pedestalDepth: .92 },
  { height: 1.36, width: .91, depth: .95, pedestalHeight: .68, pedestalWidth: .79, pedestalDepth: .79 },
];

test("sculpture framing stays clear of the header, plaque and navigation", () => {
  for (const [width, height] of [[320, 640], [390, 844], [844, 390], [1440, 900]]) {
    for (const work of sculptures) {
      const layout = sculptureRoomLayout(width, height, work);
      assert.ok(layout.centerX - layout.displayWidth / 2 > 0, "keep the sculpture silhouette within the viewport");
      assert.ok(layout.centerX + layout.displayWidth / 2 < width);
      assert.ok(layout.floorY - layout.displayHeight > 64, "keep the head below the header");
      assert.ok(layout.floorY < height - (width < 768 ? 90 : 48), "keep the foot clear of navigation and the phone plaque");
    }
  }
});
