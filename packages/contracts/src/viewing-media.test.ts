import assert from "node:assert/strict";
import test from "node:test";
import { hasExclusivePaintingRequest } from "./viewing-media";

test("exclusive requests cover the shared painting media vocabulary", () => {
  for (const query of ["只想看版画", "仅限水墨", "只要素描", "只看粉彩", "仅限蛋彩", "只接受水粉", "only watercolors", "watercolours only", "only charcoal drawings", "only frescoes", "paintings only"]) {
    assert.equal(hasExclusivePaintingRequest(query), true, query);
  }
  for (const query of ["版画也可以", "水墨与雕塑", "不要版画", "不只想看油画", "不想只看版画", "not only watercolors", "I don't want only watercolors", "绘画媒介不限"]) {
    assert.equal(hasExclusivePaintingRequest(query), false, query);
  }
});
