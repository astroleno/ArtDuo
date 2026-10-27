import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import sharp from "sharp";
import { keepsakeWritingText } from "@artduo/contracts";
import { finalizeSharePng, pngCrc32 } from "../../../../packages/ui/src/experience/finalize-share-png";
import { HANDWRITING_INK, HandwritingError } from "./config";

const invalid = () => new HandwritingError("scene-invalid", "笔迹素材不完整，请重新制作。", 422);

/** Read only bounded scene members in memory; no archive paths are extracted. */
export function readSceneArchive(zip: Buffer): Map<string, Buffer> {
  let end = -1;
  for (let n = zip.length - 22; n >= Math.max(0, zip.length - 65_557); n--) if (zip.readUInt32LE(n) === 0x06054b50) { end = n; break; }
  if (end < 0 || zip.readUInt16LE(end + 4) !== 0 || zip.readUInt16LE(end + 6) !== 0) throw invalid();
  const count = zip.readUInt16LE(end + 10), members = new Map<string, Buffer>(); let cursor = zip.readUInt32LE(end + 16), total = 0;
  if (count < 2 || count > 128) throw invalid();
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > zip.length || zip.readUInt32LE(cursor) !== 0x02014b50) throw invalid();
    const flags = zip.readUInt16LE(cursor + 8), method = zip.readUInt16LE(cursor + 10), crc = zip.readUInt32LE(cursor + 16);
    const compressed = zip.readUInt32LE(cursor + 20), size = zip.readUInt32LE(cursor + 24), nameLength = zip.readUInt16LE(cursor + 28);
    const name = zip.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8"), local = zip.readUInt32LE(cursor + 42);
    cursor += 46 + nameLength + zip.readUInt16LE(cursor + 30) + zip.readUInt16LE(cursor + 32);
    if (flags & 1 || ![0, 8].includes(method) || !name || name.includes("..") || /[\\\u0000]/u.test(name) || name.startsWith("/") || size > 60_000_000) throw invalid();
    total += size; if (total > 160_000_000) throw invalid();
    if (!/^(scene\.json|label\.png|sprites\/page-\d+\.png)$/u.test(name)) continue;
    if (members.has(name) || local + 30 > zip.length || zip.readUInt32LE(local) !== 0x04034b50) throw invalid();
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    if (start + compressed > zip.length) throw invalid();
    const packed = zip.subarray(start, start + compressed);
    const data = method === 0 ? packed : inflateRawSync(packed, { maxOutputLength: Math.max(1, size) });
    if (data.length !== size || pngCrc32(data) !== crc) throw invalid(); members.set(name, data);
  }
  if (!members.has("scene.json") || !members.has("label.png")) throw invalid();
  return members;
}

async function tintPixels(image: Buffer, label = false) {
  // greyscale().raw() can drop alpha while reporting hasAlpha=true. Explicit
  // RGBA keeps the official label's transparent background intact.
  const { data, info } = await sharp(image, { limitInputPixels: 80_000_000 }).toColourspace("srgb").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) throw invalid();
  let alphaMask = false;
  if (label) for (let i = 3; i < data.length; i += 4) if (data[i] < 255) { alphaMask = true; break; }
  const rgb = [1, 3, 5].map(start => parseInt(HANDWRITING_INK.slice(start, start + 2), 16)), rgba = Buffer.alloc(info.width * info.height * 4);
  for (let pixel = 0; pixel < info.width * info.height; pixel++) {
    rgba[pixel * 4] = rgb[0]; rgba[pixel * 4 + 1] = rgb[1]; rgba[pixel * 4 + 2] = rgb[2];
    const darkness = 1 - (data[pixel * 4] * 0.2126 + data[pixel * 4 + 1] * 0.7152 + data[pixel * 4 + 2] * 0.0722) / 255;
    const coverage = alphaMask ? 1 : Math.min(1, Math.max(0, darkness) * 1.7);
    rgba[pixel * 4 + 3] = Math.round(coverage * data[pixel * 4 + 3]);
  }
  return { data: rgba, width: info.width as number, height: info.height as number };
}
async function tintInk(image: Buffer) {
  const pixels = await tintPixels(image, true);
  return sharp(pixels.data, { raw: { width: pixels.width, height: pixels.height, channels: 4 } }).png().toBuffer();
}

export async function prepareSceneLayer(zip: Buffer, context: { exhibitionId: string; artworkId: string; releaseVersion: string; closingText?: string; viewerSignature?: string }, upstreamId: string) {
  const members = readSceneArchive(zip), raw = members.get("scene.json")!;
  if (raw.length > 8_000_000) throw invalid();
  const scene = JSON.parse(raw.toString("utf8"));
  if (scene.format !== "inko-scene" || scene.version !== 1 || !Array.isArray(scene.pages) || scene.pages.length < 1 || scene.pages.length > 4
    || scene.label?.mode !== "visible") throw invalid();
  if (context.closingText !== undefined) {
    const expected = keepsakeWritingText({ closingText: context.closingText, viewerSignature: context.viewerSignature }).replace(/\s/gu, "");
    const actual = scene.pages.flatMap((page: { glyphs?: Array<{ c?: unknown }> }) => page.glyphs ?? []).map((glyph: { c?: unknown }) => typeof glyph.c === "string" ? glyph.c : "").join("").replace(/\s/gu, "");
    if (expected !== actual) throw new HandwritingError("writing-incomplete", "返回的笔迹与确认文字不完整对应，原文已保留，请重试。", 422);
  }
  const pages: Array<{ images: string[]; minY: number; maxY: number }> = [];
  let minX = Infinity, maxX = -Infinity;
  for (const page of scene.pages) {
    const [w, h] = page.size ?? [];
    if (![w, h].every(n => Number.isInteger(n) && n > 0 && n <= 6000) || w * h > 24_000_000 || !Array.isArray(page.glyphs) || !page.glyphs.length || page.glyphs.length > 2500) throw invalid();
    const images: string[] = [], atlases = new Map<string, Awaited<ReturnType<typeof tintPixels>>>();
    let minY = Infinity, maxY = -Infinity;
    for (const glyph of page.glyphs) {
      const sprite = glyph.sprite, matrix: number[] = glyph.m;
      if (!sprite || !/^sprites\/page-\d+\.png$/u.test(sprite.atlas) || !members.has(sprite.atlas) || !Array.isArray(sprite.rect)
        || sprite.rect.length !== 4 || !sprite.rect.every((n: unknown) => Number.isInteger(n) && Number(n) >= 0)
        || !Array.isArray(matrix) || matrix.length !== 6 || !matrix.every(n => Number.isFinite(n) && Math.abs(n) <= 10_000)) throw invalid();
      const [x, y, sw, sh] = sprite.rect;
      if (sw < 1 || sh < 1 || sw * sh > 4_000_000) throw invalid();
      let atlas = atlases.get(sprite.atlas);
      if (!atlas) { atlas = await tintPixels(members.get(sprite.atlas)!); atlases.set(sprite.atlas, atlas); }
      if (x + sw > atlas.width || y + sh > atlas.height) throw invalid();
      const crop = Buffer.alloc(sw * sh * 4);
      for (let row = 0; row < sh; row++) atlas.data.copy(crop, row * sw * 4, ((y + row) * atlas.width + x) * 4, ((y + row) * atlas.width + x + sw) * 4);
      const image = await sharp(crop, { raw: { width: sw, height: sh, channels: 4 } }).png().toBuffer();
      // Inko stores row-major 2x3; SVG orders a,b,c,d,e,f by columns.
      const transform = [matrix[0], matrix[3], matrix[1], matrix[4], matrix[2], matrix[5]].join(" ");
      images.push(`<image width="${sw}" height="${sh}" transform="matrix(${transform})" href="data:image/png;base64,${image.toString("base64")}"/>`);
      for (const [cx, cy] of [[0, 0], [sw, 0], [0, sh], [sw, sh]]) {
        const px = matrix[0] * cx + matrix[1] * cy + matrix[2], py = matrix[3] * cx + matrix[4] * cy + matrix[5];
        minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py);
      }
    }
    pages.push({ images, minY: Math.floor(minY) - 2, maxY: Math.ceil(maxY) + 2 });
  }
  const left = Math.floor(minX) - 2, width = Math.ceil(maxX) + 2 - left;
  if (width < 1 || width > 6000) throw invalid();
  const rendered: Buffer[] = [];
  for (const page of pages) {
    const height = page.maxY - page.minY;
    if (height < 1 || height > 6000 || width * height > 24_000_000) throw invalid();
    // One shared horizontal origin keeps a signature on the right even when
    // it is the only writing on the final page. A4 paper is never included.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${left} ${page.minY} ${width} ${height}">${page.images.join("")}</svg>`;
    rendered.push(await sharp(Buffer.from(svg), { limitInputPixels: 24_000_000 }).png().toBuffer());
  }
  const padding = Math.max(24, Math.ceil(width * 0.025)), pieces: Array<{ input: Buffer; left: number; top: number }> = []; let top = padding;
  for (const image of rendered) {
    const info = await sharp(image).metadata(); pieces.push({ input: image, left: padding, top }); top += (info.height ?? 0) + padding;
  }
  const label = await sharp(await tintInk(members.get("label.png")!)).trim({ threshold: 0 }).resize({ height: Math.ceil(width * 0.075), fit: "inside", width }).png().toBuffer();
  const labelInfo = await sharp(label).metadata(); pieces.push({ input: label, left: padding, top: top + padding }); top += padding + (labelInfo.height ?? 0) + padding;
  const totalWidth = width + padding * 2;
  if (top > 24_000 || totalWidth * top > 80_000_000) throw invalid();
  const png = await sharp({ create: { width: totalWidth, height: top, channels: 4, background: "#00000000" } }).composite(pieces).png().toBuffer();
  const id = scene.pages[0].aigc_id ?? `${upstreamId}-p1`, source = scene.aigc ?? {};
  if (typeof source.ContentProducer !== "string" || !source.ContentProducer) throw invalid();
  const aigc: Record<string, string> = { Label: String(source.Label ?? "1"), ContentProducer: source.ContentProducer, ProduceID: id,
    ReservedCode1: createHash("sha256").update(`${source.ContentProducer}|${id}`).digest("hex"),
    ContentPropagator: String(source.ContentPropagator ?? "inkotype.com"), PropagateID: id, ReservedCode2: String(source.ReservedCode2 ?? "") };
  const sourceProduceIds = scene.pages.map((page: { aigc_id?: string }, index: number) => page.aigc_id ?? `${upstreamId}-p${index + 1}`);
  return { png: Buffer.from(finalizeSharePng(png, aigc, { ...context, handwritingSourceIds: sourceProduceIds })),
    layer: { width: totalWidth, height: top, aigc, sourceProduceIds, upstreamId, label: "AI生成 · Inko" as const } };
}
