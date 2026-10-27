import assert from "node:assert/strict";
import test from "node:test";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { getExhibitionSculptures, getSculptureCollection } from "../../lib/sculpture-catalog";

test("verified CDN catalog resolves eighteen sculptures and both complete room dependency sets", () => {
  const collection = getSculptureCollection({ mode: "cdn" });
  assert.equal(collection.works.length, 18);
  for (const work of collection.works) for (const url of [work.compactUrl, work.referenceUrl, work.posterUrl]) assert.match(url, /^https:\/\/assets\.aitoshuu\.me\/artduo\/media-v1\/objects\/[a-f0-9]{64}\//u);
  assert.match(collection.scenes.find(scene => scene.id === "bg-034")!.normalUrl, /sculpture-bg-034-normal\.png$/u);
  assert.match(collection.works.find(work => work.id === "michelangelo-portrait")!.reading.artwork.metadata.artistDisplayName!, /洛伦齐/);
  assert.equal(collection.works.filter(work => work.tags?.includes("人的生活")).length, 6);
  assert.deepEqual(collection.works.slice(12).map(work => work.id), ["calais", "thinker", "discobolus", "socrates", "balzac", "beethoven"]);
  const calais = collection.works.find(work => work.id === "calais")!;
  assert.match(calais.reading.caption.text, /六位城市显要市民/);
  assert.match(calais.reading.artwork.metadata.creditLine!, /CC BY-NC-SA 4\.0/);
  assert.match(calais.reading.artwork.metadata.creditLine!, /非商业使用/);
  assert.doesNotMatch(calais.reading.artwork.metadata.creditLine!, /SMK|PDM/);
  const balzac = collection.works.find(work => work.id === "balzac")!;
  assert.match(balzac.reading.artwork.metadata.creditLine!, /pattarrian/);
  assert.doesNotMatch(balzac.reading.artwork.metadata.medium!, /翻模/);
  assert.match(collection.works.find(work => work.id === "beethoven")!.reading.artwork.metadata.artistDisplayName!, /Weigl/);
});

test("a changed source catalog disables an optional encounter instead of supplying unverified URLs", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "artduo-sculpture-catalog-"));
  const destination = path.join(rootDir, "apps/web/public/artduo-sculptures"), source = path.resolve(__dirname, "../../public/artduo-sculptures");
  try {
    await mkdir(destination, { recursive: true });
    for (const filename of ["sources.json", "media-manifest.json", "delivery.json"]) await copyFile(path.join(source, filename), path.join(destination, filename));
    assert.equal(getSculptureCollection({ rootDir, mode: "cdn" }).works.length, 18);
    await writeFile(path.join(destination, "sources.json"), (await readFile(path.join(destination, "sources.json"), "utf8")) + " ");
    assert.throws(() => getSculptureCollection({ rootDir, mode: "cdn" }), /not verified/u);
    assert.deepEqual(getExhibitionSculptures({ rootDir, mode: "cdn" }), { works: [], scenes: [] });
  } finally { await rm(rootDir, { recursive: true, force: true }); }
});

test("external scans retain their own identity, attribution and derivative license", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "artduo-sculpture-attribution-"));
  const directory = path.join(rootDir, "apps/web/public/artduo-sculptures");
  const source = JSON.parse(await readFile(path.resolve(__dirname, "../../public/artduo-sculptures/sources.json"), "utf8"));
  const model = { ...source.models[0], id: "external-scan", museumId: undefined, museum: undefined,
    catalogId: "commons-sculpture-external", source: "https://commons.wikimedia.org/wiki/File:Example.stl",
    sourceCredit: "Original sculptor · Scan the World / Jonathan Beck", collection: "Scan the World · 雕塑数字档案",
    displayMedium: "雕塑扫描；数字石膏材质", provenance: "扫描与原作作者分别标注。", factSources: ["https://www.musee-rodin.fr/"],
    rights: "CC BY-SA 4.0", rightsUrl: "https://creativecommons.org/licenses/by-sa/4.0/", objectMetadata: { materials: ["bronze"] } };
  const save = async () => writeFile(path.join(directory, "sources.json"), JSON.stringify({ models: [model] }));
  try {
    await mkdir(directory, { recursive: true });
    await save();
    const metadata = getSculptureCollection({ rootDir, mode: "local" }).works[0]!.reading.artwork.metadata;
    assert.equal(metadata.department, model.collection);
    assert.equal(metadata.medium, model.displayMedium);
    assert.match(metadata.creditLine!, /Scan the World \/ Jonathan Beck/u);
    assert.match(metadata.creditLine!, /处理后的模型及其渲染图按 CC BY-SA 4\.0 提供/u);
    assert.doesNotMatch(metadata.creditLine!, /SMK|PDM 1\.0/u);
    assert.equal(getSculptureCollection({ rootDir, mode: "local" }).works[0]!.reading.artwork.id, model.catalogId);

    model.sourceCredit = "";
    await save();
    assert.throws(() => getSculptureCollection({ rootDir, mode: "local" }), /grant or attribution/u);
    model.sourceCredit = "Credited scanner";
    model.rights = "CC BY-NC-SA 4.0";
    model.rightsUrl = "https://creativecommons.org/licenses/by-nc-sa/4.0/";
    await save();
    const noncommercial = getSculptureCollection({ rootDir, mode: "local" }).works[0]!.reading.artwork.metadata;
    assert.match(noncommercial.creditLine!, /非商业使用/u);
    assert.match(noncommercial.creditLine!, /处理后的模型及其渲染图按 CC BY-NC-SA 4\.0 提供/u);
    model.rights = "CC BY-ND 4.0";
    model.rightsUrl = "https://creativecommons.org/licenses/by-nd/4.0/";
    await save();
    assert.throws(() => getSculptureCollection({ rootDir, mode: "local" }), /grant or attribution/u);
    assert.deepEqual(getExhibitionSculptures({ rootDir, mode: "local" }), { works: [], scenes: [] });
  } finally { await rm(rootDir, { recursive: true, force: true }); }
});
