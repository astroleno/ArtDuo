import assert from "node:assert/strict";
import test from "node:test";
import { emptyExhibitionAlternative } from "../../lib/empty-exhibition-alternative";
import { loadWebReleaseCatalog } from "../../lib/release-catalog";

const catalog = loadWebReleaseCatalog({ releaseVersion: "2026-11-19-open-gap-739" });

test("interior without people can explicitly switch to one supportable nearby subject", () => {
  assert.deepEqual(emptyExhibitionAlternative(catalog, "我想看画里的室内陈设，六件；不要有人。"),
    { query: "我想看画里的静物，六件；不要有人。", eligible: 9, requested: 6 });
  assert.deepEqual(emptyExhibitionAlternative(catalog, "想看室内画，不要有人和花"),
    { query: "想看静物，不要有人和花", eligible: 3, requested: 6 });
  assert.deepEqual(emptyExhibitionAlternative(catalog, "想看一幅室内画，不要有人和船"),
    { query: "想看一幅静物，不要有人和船", eligible: 9, requested: 1 });
});

test("a restrictive, contradictory, or ambiguous empty request keeps its existing exits", () => {
  for (const query of [
    "想看室内木版画，不要有人。",
    "只看莫奈的室内画，不要有人",
    "想看室内或森林，不要有人",
    "想看室内，不要有人；不要静物",
    "想看室内画，不要有人和动物",
    "想看室内画，不要有人；必须戴帽子",
    "想看室内画，不要有人；必须有透明玻璃杯和花",
    "想看室内画，不要有人；画里有透明玻璃",
    "想看室内画，不要有人；画里要有透明玻璃",
    "想看室内陈设和透明玻璃杯，不要有人",
    "想看室内陈设与花及透明玻璃杯，不要有人",
    "想看透明玻璃杯和室内陈设，不要有人",
    "想看室内画，不要有人；里面摆着一只玻璃杯",
    "想看室内画，不要有人；前景摆着花和一只玻璃杯",
    "想看室内画，不要有人；蓝色玻璃杯",
    "想看室内画，不要有人；画面中得有透明玻璃杯",
    "想看室内画，不要有人；希望能看到玻璃杯",
    "想看室内画 有玻璃杯，不要有人",
    "想看摆着玻璃杯的室内画，不要有人",
    "想看室内画，不要有拿玻璃杯的人",
    "想看室内画，不要有人或透明玻璃杯",
    "想看室内画，不要有人和放在桌上的花",
    "我在室内加班，想看森林，不要有人",
    "只看《室内陈设》，不要有人",
  ]) assert.equal(emptyExhibitionAlternative(catalog, query), undefined, query);
});
