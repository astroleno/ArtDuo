import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { SCULPTURE_PREVIEW_SCENES, SCULPTURE_PREVIEW_WORKS } from "../../lib/sculpture-preview";
import sources from "../../public/artduo-sculptures/sources.json";

test("preview ships isolated, bounded GLBs with the verified source attribution", async () => {
  assert.equal(SCULPTURE_PREVIEW_WORKS.length, 18);
  for (const source of sources.models) {
    const work = SCULPTURE_PREVIEW_WORKS.find(candidate => candidate.id === source.id)!;
    assert.equal(work.reading.artwork.metadata.objectUrl, source.source);
    assert.ok(work.reading.artwork.metadata.creditLine!.includes(source.rights));
    assert.ok(work.reading.artwork.metadata.creditLine!.includes(source.rightsUrl));
    if ("museum" in source && source.museum) {
      assert.ok(source.museum.public_domain);
      assert.match(work.reading.artwork.metadata.medium!, /石膏翻模/);
    } else {
      assert.match(work.reading.artwork.metadata.medium!, /扫描/);
      assert.doesNotMatch(work.reading.artwork.metadata.creditLine!, /SMK|PDM 1\.0/);
    }
    assert.ok(source.cleanup.cleanedTriangles > 0);
    for (const quality of ["compact", "reference"] as const) {
      const file = await readFile(path.resolve(__dirname, `../../public/artduo-sculptures/${source.id}-${quality}.glb`));
      assert.equal(file.readUInt32LE(0), 0x46546c67);
      assert.equal(file.readUInt32LE(4), 2);
      assert.equal(file.readUInt32LE(8), file.byteLength);
      assert.equal(file.byteLength, quality === "compact" ? source.compactBytes : source.referenceBytes);
      const json = JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)).toString("utf8"));
      assert.equal(json.extras.rights, source.rights);
      assert.equal(json.extras.rightsUrl, source.rightsUrl);
      assert.equal(json.meshes.length, 1, "the scan must contain a single isolated sculpture");
      assert.equal(json.images?.length ?? 0, 0, "no photographed environment should accompany the model");
      assert.ok(json.extensionsRequired.includes("EXT_meshopt_compression"));
      if (quality === "compact") assert.ok(file.byteLength < 1_000_000);
    }
  }
});

test("trial room backgrounds and relighting maps exist together", async () => {
  for (const room of SCULPTURE_PREVIEW_SCENES) {
    for (const url of [room.imageUrl, room.smallImageUrl, room.depthUrl, room.normalUrl]) {
      const file = await readFile(path.resolve(__dirname, "../../../../public", url.replace(/^.*\/artduo-gallery\//, "artduo-gallery/")));
      assert.ok(file.byteLength > 0);
    }
  }
});
