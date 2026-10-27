const encoder = new TextEncoder();
const concat = (parts: Uint8Array[]) => { const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0)); let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; } return out; };
export function pngCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const b of bytes) { crc ^= b; for (let bit = 0; bit < 8; bit++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array) {
  const payload = concat([encoder.encode(type), data]), length = new Uint8Array(4), crc = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, data.length); new DataView(crc.buffer).setUint32(0, pngCrc32(payload));
  return concat([length, payload, crc]);
}
function internationalText(key: string, value: string) {
  return chunk("iTXt", concat([encoder.encode(key), new Uint8Array(5), encoder.encode(value)]));
}
const xml = (value: string) => value.replace(/[<>&"']/gu, character => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[character]!);

/** Add metadata after Canvas re-encoding without touching any image pixels. */
export function finalizeSharePng(png: Uint8Array, aigc: Record<string, string>, context: { exhibitionId: string; artworkId: string; releaseVersion: string; handwritingSourceIds?: string[] }): Uint8Array {
  if (png.length < 33 || png[0] !== 137 || String.fromCharCode(...png.slice(1, 4)) !== "PNG") throw new TypeError("Invalid PNG");
  for (const field of ["Label", "ContentProducer", "ProduceID", "ContentPropagator", "PropagateID"]) if (typeof aigc[field] !== "string" || !aigc[field]) throw new TypeError("Missing handwriting provenance");
  let offset = 8, end = -1;
  while (offset + 12 <= png.length) {
    const size = new DataView(png.buffer, png.byteOffset + offset, 4).getUint32(0);
    if (offset + size + 12 > png.length) throw new TypeError("Invalid PNG chunk");
    const type = String.fromCharCode(...png.slice(offset + 4, offset + 8));
    if (type === "IEND") { end = offset; break; }
    offset += size + 12;
  }
  if (end < 0) throw new TypeError("PNG has no IEND");
  const packet = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:TC260="http://www.tc260.org.cn/ns/AIGC/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/"><TC260:AIGC>${xml(JSON.stringify(aigc))}</TC260:AIGC><dc:creator><rdf:Seq><rdf:li>${xml(aigc.ContentProducer)}</rdf:li></rdf:Seq></dc:creator></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
  return concat([png.slice(0, end), internationalText("AIGC", JSON.stringify(aigc)), internationalText("XML:com.adobe.xmp", packet),
    internationalText("InkoEdited", "true"), internationalText("ArtDuo", JSON.stringify(context)), png.slice(end)]);
}
