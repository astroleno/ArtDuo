import assert from "node:assert/strict";
import test from "node:test";
import { finalizeSharePng, pngCrc32 } from "./finalize-share-png";

const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE9sAAAAASUVORK5CYII=", "base64"));
const aigc = { Label: "1", ContentProducer: "Inko", ProduceID: "upstream-p1", ContentPropagator: "inkotype.com", PropagateID: "upstream-p1", ReservedCode1: "original", ReservedCode2: "" };
test("PNG finalization preserves image chunks and original AIGC fields with valid chunk checksums", () => {
  const result = finalizeSharePng(png, aigc, { exhibitionId: "ex-one", artworkId: "met-1", releaseVersion: "release" });
  assert.deepEqual(result.slice(0, png.length - 12), png.slice(0, -12));
  assert.deepEqual(result.slice(-12), png.slice(-12));
  const text = new TextDecoder().decode(result);
  assert.ok(text.includes(JSON.stringify(aigc))); assert.ok(text.includes("InkoEdited")); assert.ok(text.includes('"artworkId":"met-1"'));
  assert.ok(text.includes('xmlns:TC260="http://www.tc260.org.cn/ns/AIGC/1.0/"'));
  const xmpJson = text.match(/<TC260:AIGC>(.*?)<\/TC260:AIGC>/su)![1].replace(/&quot;/gu, '"').replace(/&apos;/gu, "'").replace(/&lt;/gu, "<").replace(/&gt;/gu, ">").replace(/&amp;/gu, "&");
  assert.deepEqual(JSON.parse(xmpJson), aigc);
  let at = png.length - 12;
  while (at < result.length - 12) {
    const view = new DataView(result.buffer, result.byteOffset + at), length = view.getUint32(0);
    assert.equal(view.getUint32(length + 8), pngCrc32(result.slice(at + 4, at + 8 + length))); at += length + 12;
  }
});
test("unprovenanced handwriting or truncated PNG cannot become a completed download", () => {
  const context = { exhibitionId: "ex-one", artworkId: "met-1", releaseVersion: "release" };
  assert.throws(() => finalizeSharePng(png, {}, context)); assert.throws(() => finalizeSharePng(png.slice(0, -5), aigc, context));
});
