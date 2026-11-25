import assert from "node:assert/strict";
import test from "node:test";
import type { BackgroundSceneRecord } from "@artduo/contracts";
import type { ExperienceSceneCandidate, ExperienceUnit, ExhibitionSnapshot } from "./types";
import { artworkAspectRatio, artworkPaletteFamilies, exhibitionChapters, matchArtworkScenes, scoreArtworkScene } from "./scene-matching";
import { snapshotForSession } from "./viewing-session";

function room(id: string, paletteFamilies: string[]): ExperienceSceneCandidate {
  return { imageUrl: `${id}.jpg`, paletteFamilies, lightDirection: "top", scene: {
    id, asset: { label_cn: id }, image_info: { width: 1600, height: 900 },
    visual_profile: { lighting: ["soft diffuse light"], mood: ["quiet"] },
    curation_profile: { artwork_composition_modes: ["centered"], emotion_ids: ["calm"] },
    ui_profile: { visual_busyness: 0.2 },
    stage_profile: { primary_mount_zone: { shape: "rect", rect: { x: 0.2, y: 0.15, width: 0.6, height: 0.6 } } },
  } as BackgroundSceneRecord };
}
function work(id: string, colors: string[]): ExperienceUnit {
  return { artwork: { id, metadata: { title: id, medium: "Oil on canvas", colorTags: colors, moodTags: ["quiet"], compositionTags: ["centered"] },
    media: { aspectRatioHint: "square" }, presentation: { sceneAffinity: { paletteModes: colors } } },
    media: { previewUrl: `${id}.jpg`, fullUrl: `${id}-full.jpg` }, stageId: "s1", scene: null,
    exhibition: { unitId: `unit-${id}`, artworkId: id, order: 0 },
  } as ExperienceUnit;
}
const rooms = [room("warm", ["warm", "earth", "muted"]), room("cool", ["cool", "muted", "dark", "monochrome"]), room("white", ["balanced", "contrast", "luminous", "neutral"])];

test("measured image proportions take precedence over broad orientation hints, including scrolls", () => {
  const unit = work("scroll", []);
  unit.artwork.media.visualPresentation = { contentAspectRatio: 12.75, cropStrategy: "preserve-paper" };
  assert.equal(artworkAspectRatio(unit), 12.75);
  unit.artwork.media.visualPresentation.contentAspectRatio = Number.NaN;
  assert.equal(artworkAspectRatio(unit), 1);
});

test("palette normalization joins hyphen and underscore variants without treating unknown or balanced colors as warm", () => {
  assert.deepEqual(artworkPaletteFamilies(work("a", ["cool_muted", "cool-muted"])), ["cool", "muted"]);
  assert.deepEqual(artworkPaletteFamilies(work("b", ["unknown-palette"])), []);
  assert.deepEqual(artworkPaletteFamilies(work("c", ["cool-warm-balance"])), ["balanced"]);
});

test("chapters keep a shared wall while individual geometry and artwork identity remain intact", () => {
  const works = [work("a", ["cool-muted"]), work("b", ["cool-muted"]), work("c", ["warm-rich"]), work("d", ["color-pop-friendly"])];
  const matched = matchArtworkScenes(works, rooms);
  assert.deepEqual(matched.map((unit) => unit.scene?.id), ["cool", "cool", "warm", "warm"]);
  assert.equal(matched[1]?.sceneMatch?.continuedRoom, true);
  for (const [i, unit] of matched.entries()) {
    assert.equal(unit.media.previewUrl, works[i]!.media.previewUrl);
    assert.equal(unit.exhibition.unitId, works[i]!.exhibition.unitId);
    assert.equal(unit.sceneMatch?.candidates.length, 3);
  }
});

test("a short exhibition uses one room and chapter entrances retain suitable light and wall geometry", () => {
  const neutral = room("a-neutral", ["cool"]);
  const best = room("z-cool", ["cool", "muted"]);
  const matched = matchArtworkScenes([work("a", ["cool-muted"]), work("b", ["cool"]), work("c", ["warm"])], [neutral, best, rooms[0]!]);
  assert.equal(matched[1]?.scene?.id, matched[0]?.scene?.id);
  assert.equal(matched[2]?.scene?.id, matched[0]?.scene?.id);
});

test("route replay preserves a viewed chapter even when a future work moves beside its anchor", () => {
  const units = matchArtworkScenes([work("a", ["cool"]), work("b", ["cool"]), work("c", ["warm"]), work("d", ["contrast"])], rooms);
  const base = { units, sceneCandidates: rooms } as ExhibitionSnapshot;
  const revised = snapshotForSession(base, { order: ["a", "c", "b", "d"] });
  assert.equal(revised.units[0]!.scene?.id, units[0]!.scene?.id);
  assert.equal(revised.units[1]!.scene?.id, units[0]!.scene?.id);
  assert.equal(revised.units[2]!.scene?.id, revised.units[3]!.scene?.id);
  assert.deepEqual(snapshotForSession(base, { order: revised.routeOrder! }).units, revised.units);
  assert.deepEqual(units.map((unit) => unit.artwork.id), ["a", "b", "c", "d"]);
});

test("six to eight works use balanced groups, favor stage boundaries, and avoid a single repeated suitable room", () => {
  const works = Array.from({ length: 6 }, (_, i) => ({ ...work(String(i), ["cool-muted"]), stageId: ["a", "b", "c", "c", "d", "d"][i]! }));
  assert.deepEqual(exhibitionChapters(works), [{ start: 0, end: 2 }, { start: 2, end: 4 }, { start: 4, end: 6 }]);
  const matched = matchArtworkScenes(works, rooms);
  assert.ok(new Set(matched.map(unit => unit.scene?.id)).size >= 2);
  for (const chapter of exhibitionChapters(works)) assert.equal(new Set(matched.slice(chapter.start, chapter.end).map(unit => unit.scene?.id)).size, 1);
  for (let count = 4; count <= 12; count++) {
    const chapters = exhibitionChapters(Array.from({ length: count }, (_, i) => work(String(i), [])));
    assert.equal(chapters.at(-1)!.end, count);
    assert.ok(chapters.every(chapter => chapter.end - chapter.start >= 2 && chapter.end - chapter.start <= 3));
  }
  assert.throws(() => matchArtworkScenes(works, [rooms[0]!]), /one prepared room per chapter/);
});

test("every chapter is unique through twelve works, even when every work prefers the same wall", () => {
  const available = Array.from({ length: 6 }, (_, i) => room(`room-${i}`, ["cool", "muted"]));
  for (let count = 1; count <= 12; count++) {
    const works = Array.from({ length: count }, (_, i) => ({ ...work(String(i), ["cool-muted"]), stageId: `stage-${Math.floor(i / 2)}` }));
    const result = matchArtworkScenes(works, available);
    const chapters = exhibitionChapters(works);
    assert.equal(new Set(chapters.map(chapter => result[chapter.start]!.scene!.id)).size, chapters.length);
    for (const chapter of chapters) assert.equal(new Set(result.slice(chapter.start, chapter.end).map(unit => unit.scene!.id)).size, 1);
    const base = { units: result, sceneCandidates: available } as ExhibitionSnapshot;
    const reordered = snapshotForSession(base, { order: [result[0]!.artwork.id, ...result.slice(1).reverse().map(unit => unit.artwork.id)] });
    assert.deepEqual(reordered.units.map(unit => unit.scene!.id), result.map(unit => unit.scene!.id));
    assert.deepEqual(reordered.units.map(unit => unit.sceneMatch!.chapter), result.map(unit => unit.sceneMatch!.chapter));
  }
});

test("scores explain material, lighting, shape and palette independently and remain finite for missing tags", () => {
  const unit = work("a", []);
  const painting = scoreArtworkScene(unit, rooms[0]!);
  const paper = scoreArtworkScene({ ...unit, artwork: { ...unit.artwork, metadata: { ...unit.artwork.metadata, medium: "Woodblock print on paper" } } }, rooms[0]!);
  assert.ok(paper.materialAndLight > painting.materialAndLight);
  assert.ok(painting.reasons.includes("palette:unknown-neutral-fallback"));
  assert.ok(Number.isFinite(painting.total));
  assert.deepEqual(matchArtworkScenes([unit], []), [unit]);
});

test("each chapter's room follows the tone its stage asks for", () => {
  const toned = (id: string, families: string[], tone: ExperienceSceneCandidate["tone"]) => ({ ...room(id, families), tone });
  const dim = toned("dim", ["neutral"], { brightness: .3, warmth: .35, view: "none" });
  const daylight = toned("daylight", ["neutral"], { brightness: .82, warmth: .5, view: "none" });
  const harbour = toned("harbour", ["neutral", "warm", "earth", "muted"], { brightness: .78, warmth: .65, view: "city" });
  const stage = (id: string, valence: number, arousal: number, tension: number) => ({ id, valence, arousal, tension, wonder: .3, intimacy: .5 });
  const units = (stageId: string) => ["a", "b"].map((id) => ({ ...work(`${stageId}-${id}`, ["warm", "earth"]), stageId }));
  const quiet = [stage("low", .3, .15, .25)], bright = [stage("high", .9, .8, .15)];
  assert.equal(matchArtworkScenes(units("low"), [daylight, dim, harbour], quiet)[0]!.scene!.id, "dim");
  assert.equal(matchArtworkScenes(units("high"), [dim, daylight], bright)[0]!.scene!.id, "daylight");
  // A warm palette would favour the harbour room; a still stage must not open onto a city.
  assert.notEqual(matchArtworkScenes(units("low"), [harbour, daylight], quiet)[0]!.scene!.id, "harbour");
  // Without stage targets the palette-only behaviour is unchanged.
  assert.equal(matchArtworkScenes(units("low"), [daylight, harbour])[0]!.scene!.id, "harbour");
});

test("a quiet stage never opens onto the city while another room is free, however strongly the palette favours it", () => {
  const toned = (id: string, families: string[], tone: ExperienceSceneCandidate["tone"]) => ({ ...room(id, families), tone });
  // The harbour room matches every palette family; the dim room matches none.
  const harbour = toned("harbour", ["warm", "earth", "muted", "luminous", "neutral"], { brightness: .3, warmth: .35, view: "city" });
  const dim = toned("dim", ["cool"], { brightness: .95, warmth: .9, view: "none" });
  const quiet = [{ id: "low", valence: .3, arousal: .15, tension: .25, wonder: .3, intimacy: .5 }];
  const units = ["a", "b"].map((id) => ({ ...work(id, ["warm", "earth", "muted"]), stageId: "low" }));
  assert.equal(matchArtworkScenes(units, [harbour, dim], quiet)[0]!.scene!.id, "dim");
  // When the city room is the only one left, the exhibition still gets a room.
  assert.equal(matchArtworkScenes(units, [harbour], quiet)[0]!.scene!.id, "harbour");
});

test("v4 compares the actual last artwork to the next chapter entrance without regrouping the route", () => {
  const framed = (id: string, stageId: string, spatialFraming?: ExperienceUnit["spatialFraming"]) =>
    ({ ...work(id, ["cool"]), stageId, spatialFraming });
  const works = [framed("a", "early", "enclosed"), framed("b", "early", "open"),
    framed("c", "late", "open"), framed("d", "late", "enclosed")];
  const early = { id: "early", valence: .4, arousal: .2, tension: .1, wonder: .3, intimacy: .5 };
  const late = { ...early, id: "late", valence: .55, arousal: .25 };
  const match = (units: ExperienceUnit[], stage = late) => matchArtworkScenes(units, rooms, [early, stage], "chapter-wall-v4");
  const continued = match(works);
  assert.deepEqual(continued.map(unit => unit.artwork.id), works.map(unit => unit.artwork.id));
  assert.deepEqual(continued.map(unit => unit.sceneMatch?.chapter?.index), [0, 0, 1, 1]);
  assert.equal(continued[2]?.sceneMatch?.chapter?.reason, "continued-stage");
  assert.equal(continued[2]?.sceneMatch?.continuedRoom, true);
  assert.equal(continued[0]?.scene?.id, continued[2]?.scene?.id);
  assert.equal(continued[0]?.sceneMatch?.chapter?.count, 2);
  assert.equal(match([{ ...works[0]! }, { ...works[1]!, spatialFraming: "enclosed" }, ...works.slice(2)])[2]?.sceneMatch?.chapter?.reason, "chapter-change");
  assert.equal(match([works[0]!, { ...works[1]!, spatialFraming: "framed" }, ...works.slice(2)])[2]?.sceneMatch?.chapter?.reason, "chapter-change");
  assert.equal(match(works, { ...late, arousal: .4 })[2]?.sceneMatch?.chapter?.reason, "chapter-change");
  assert.equal(match(works, { ...late, valence: .6 })[2]?.sceneMatch?.chapter?.reason, "chapter-change", ".6 - .4 rounds slightly below .20");
  assert.equal(match(works, { ...late, valence: .59999 })[2]?.sceneMatch?.chapter?.reason, "continued-stage");
  assert.equal(match(works.slice(0, 3))[2]?.sceneMatch?.chapter?.count, 1);
  assert.equal(matchArtworkScenes(works, rooms, [early, late])[2]?.sceneMatch?.chapter?.reason, "chapter-change");
});

test("v4 can stay within one stage, but not through opposed framing, a still city entrance or a return to a left room", () => {
  const high = { id: "high", valence: .65, arousal: .5, tension: .1, wonder: .4, intimacy: .65 };
  const calm = { ...high, id: "calm", arousal: .4 };
  const city = { ...room("city", ["cool"]), tone: { brightness: .67, warmth: .63, view: "city" as const } };
  const indoor = { ...room("indoor", ["warm"]), tone: { brightness: .15, warmth: .2, view: "none" as const } };
  const other = room("another", ["warm"]);
  const works = ["a", "b", "c", "d", "e", "f"].map((id, index) => ({
    ...work(id, ["cool"]), stageId: index < 2 ? "high" : index < 4 ? "calm" : "high", spatialFraming: "open" as const,
  }));
  const matched = matchArtworkScenes(works, [city, indoor, other], [high, calm], "chapter-wall-v4");
  assert.equal(matched[0]?.scene?.id, "city");
  assert.notEqual(matched[2]?.scene?.id, "city");
  assert.notEqual(matched[4]?.scene?.id, "city");
  const sameStage = works.slice(0, 4).map(unit => ({ ...unit, stageId: "high", spatialFraming: undefined }));
  assert.equal(matchArtworkScenes(sameStage, rooms, [high], "chapter-wall-v4")[2]?.sceneMatch?.chapter?.reason, "continued-stage");
  const opposite = sameStage.map((unit, index) => ({ ...unit, spatialFraming: index < 2 ? "open" as const : "enclosed" as const }));
  assert.equal(matchArtworkScenes(opposite, rooms, [high], "chapter-wall-v4")[2]?.sceneMatch?.chapter?.reason, "chapter-change");
});
