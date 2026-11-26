import assert from "node:assert/strict";
import test from "node:test";
import { emptyExhibitionAlternative } from "../../lib/empty-exhibition-alternative";
import { loadWebReleaseCatalog } from "../../lib/release-catalog";
import { fallbackCurationIntent, eligibleCurationArtworks, selectForCurationStages } from "../../lib/semantic-selection";
import { matchesViewingIntent, parseViewingIntent } from "../../lib/viewing-intent";

const catalog = loadWebReleaseCatalog({ releaseVersion: "2026-11-19-open-gap-739" });

test("interior without people can explicitly switch to one supportable nearby subject", () => {
  assert.deepEqual(emptyExhibitionAlternative(catalog, "我想看画里的室内陈设，六件；不要有人。"),
    { kind: "unoccupied-still-life", query: "我想看画里的静物，六件；不要有人。", eligible: 9, requested: 6 });
  assert.deepEqual(emptyExhibitionAlternative(catalog, "想看室内画，不要有人和花"),
    { kind: "unoccupied-still-life", query: "想看静物，不要有人和花", eligible: 3, requested: 6 });
  assert.deepEqual(emptyExhibitionAlternative(catalog, "想看一幅室内画，不要有人和船"),
    { kind: "unoccupied-still-life", query: "想看一幅静物，不要有人和船", eligible: 9, requested: 1 });
});

test("the exact copper request stays empty and the opt-in request retains etching", () => {
  const original = "我想看六件铜版蚀刻";
  const alternative = "我想看六件版材未注明的蚀刻";
  assert.deepEqual(emptyExhibitionAlternative(catalog, original),
    { kind: "unrecorded-plate-etching", query: alternative, eligible: 58, requested: 6 });
  for (const [query, eligible] of [[original, 0], [alternative, 58], ["想看六件木版画", 14], ["想看六件石版画", 3]] as const) {
    const plan = fallbackCurationIntent(catalog, query);
    const pool = eligibleCurationArtworks(catalog, query, plan);
    assert.equal(pool.length, eligible, query);
    const selection = selectForCurationStages({ catalog, query, plan });
    assert.equal(selection.assignments.length, Math.min(eligible, 6), query);
    const eligibleIds = new Set(pool.map(work => work.id));
    assert.ok(selection.stagePools?.flat().every(choice => eligibleIds.has(choice.artworkId)), query);
    assert.ok(selection.assignments.every(choice => eligibleIds.has(choice.artworkId)), query);
  }
  for (const query of ["只看铜版蚀刻或石版画", "想看铜版蚀刻，不要蚀刻", "想看铜版蚀刻；不要钢版", "想看铜版蚀刻；不要干刻",
    "想看铜版蚀刻；画里有玻璃杯", "想看铜版蚀刻和石版画", "想看铜版蚀刻工人的画", "不要看铜版蚀刻", "想看铜版蚀刻的历史"])
    assert.equal(emptyExhibitionAlternative(catalog, query), undefined, query);
});

test("only museum medium that establishes etching without a recorded plate qualifies", () => {
  const intent = parseViewingIntent("版材未注明的蚀刻");
  const artwork = catalog.artworks[0]!;
  for (const medium of ["Etching", "Etching; ink on paper", "Etching, printed in brown ink", "Etching and drypoint; ink on paper"])
    assert.equal(matchesViewingIntent({ ...artwork, medium }, intent), true, medium);
  for (const medium of ["Copperplate etching", "Steel etching", "Etching on zinc", "Etching from a copper plate on paper",
    "Etching and steel engraving", "Etching; with unidentified support", "Photograph of an etching", "Possibly etching"])
    assert.equal(matchesViewingIntent({ ...artwork, medium }, intent), false, medium);
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
