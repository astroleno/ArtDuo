import assert from "node:assert/strict";
import test from "node:test";
import { createShareCard, type ShareCardOptions } from "./share-card";

async function traceCard(options: ShareCardOptions) {
  const originalDocument = globalThis.document, originalImage = globalThis.Image;
  const text: Array<{ text: string; y: number; font: string }> = [], images: Array<{ source: string; y: number; height: number }> = [];
  const requests: Array<{ url: string; crossOrigin: string }> = [];
  const context = { font: "", fillStyle: "", strokeStyle: "", lineWidth: 1,
    measureText(value: string) { const size = Number(this.font.match(/(\d+)px/u)?.[1] ?? 16); return { width: Array.from(value).length * size * .62 }; },
    fillRect() {}, strokeRect() {}, fillText(value: string, _x: number, y: number) { text.push({ text: value, y, font: this.font }); },
    drawImage(image: { src: string }, _x: number, y: number, _width: number, height: number) { images.push({ source: image.src, y, height }); } };
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE9sAAAAASUVORK5CYII=", "base64");
  const canvas = { width: 0, height: 0, getContext: () => context, toBlob(callback: (value: Blob) => void) { callback(new Blob([png], { type: "image/png" })); } };
  class FixtureImage {
    crossOrigin = "";
    naturalWidth = 1600; naturalHeight = 1000; onload?: () => void; onerror?: () => void; private value = "";
    get src() { return this.value; }
    set src(value: string) { requests.push({ url: value, crossOrigin: this.crossOrigin }); this.value = value; if (value.includes("handwriting")) { this.naturalWidth = 720; this.naturalHeight = 4800; } queueMicrotask(() => this.onload?.()); }
  }
  try {
    Object.defineProperty(globalThis, "document", { configurable: true, value: { fonts: { ready: Promise.resolve() }, createElement: (tag: string) => { assert.equal(tag, "canvas"); return canvas; } } });
    Object.defineProperty(globalThis, "Image", { configurable: true, value: FixtureImage });
    const blob = await createShareCard(options);
    return { canvas, text, images, blob, requests };
  } finally {
    Object.defineProperty(globalThis, "document", { configurable: true, value: originalDocument });
    Object.defineProperty(globalThis, "Image", { configurable: true, value: originalImage });
  }
}

const source = "完整馆藏来源、捐赠与授权说明。".repeat(60);
const options = { imageUrl: "/verified-preview.jpg", artworkTitle: "一个需要完整换行的长作品标题。".repeat(25), artistLine: "Verified Artist · 1865", sourceLabel: source, closingLine: "继续看，也允许自己停一会。".repeat(30) };
test("CDN pixels use anonymous CORS before loading while private handwriting stays same-origin", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "location");
  try {
    Object.defineProperty(globalThis, "location", { configurable: true, value: new URL("https://tongye.me/ArtDuo") });
    const card = await traceCard({ ...options, imageUrl: "https://assets.aitoshuu.me/artduo/media-v1/objects/sha/preview.webp",
      handwritingLayer: { url: "/ArtDuo/api/handwriting/jobs/own/assets/layer", width: 720, height: 4800, label: "AI生成 · Inko", upstreamId: "fixture",
        aigc: { Label: "1", ContentProducer: "Inko", ProduceID: "fixture-p1", ContentPropagator: "inkotype.com", PropagateID: "fixture-p1" } },
      provenance: { exhibitionId: "ex-fixture", artworkId: "met-1", releaseVersion: "test" } });
    assert.equal(card.requests[0]!.crossOrigin, "anonymous");
    assert.equal(card.requests[1]!.crossOrigin, "");
    assert.equal(card.blob.type, "image/png");
  } finally {
    if (previous) Object.defineProperty(globalThis, "location", previous); else Reflect.deleteProperty(globalThis, "location");
  }
});
test("long titles, source credits and ordinary closing retain every character above the footer", async () => {
  const card = await traceCard(options);
  assert.equal(card.canvas.width, 1080); assert.ok(card.canvas.height > 1240);
  assert.equal(card.text.filter(row => row.font.includes("34px")).map(row => row.text).join(""), options.artworkTitle);
  assert.equal(card.text.filter(row => row.font.includes("17px")).map(row => row.text).join(""), source);
  assert.equal(card.text.filter(row => row.font.includes("29px")).map(row => row.text).join(""), options.closingLine);
  const footer = card.text.find(row => row.text === "ARTDUO · MOOD GALLERY")!;
  assert.ok(card.text.filter(row => row !== footer).every(row => row.y + 25 < footer.y));
});

test("a tall handwriting layer expands the card, preserves credits and stays clear of its footer", async () => {
  const card = await traceCard({ ...options, handwritingLayer: { url: "/handwriting.png", width: 720, height: 4800, label: "AI生成 · Inko", upstreamId: "fixture",
    aigc: { Label: "1", ContentProducer: "Inko", ProduceID: "fixture-p1", ContentPropagator: "inkotype.com", PropagateID: "fixture-p1" } },
    provenance: { exhibitionId: "ex-fixture", artworkId: "met-1", releaseVersion: "test" } });
  const writing = card.images.find(image => image.source.includes("handwriting"))!, footer = card.text.find(row => row.text === "ARTDUO · MOOD GALLERY")!;
  assert.ok(writing.height > 4800); assert.ok(writing.y + writing.height < footer.y - 20);
  assert.ok(card.text.filter(row => row.font.includes("17px")).every(row => row.y < writing.y));
  assert.equal(card.text.filter(row => row.font.includes("17px")).map(row => row.text).join(""), source);
  assert.equal(card.text.filter(row => row.font.includes("29px")).length, 0, "a handwritten export must not duplicate its message in printed text");
  assert.equal(card.blob.type, "image/png");
});
