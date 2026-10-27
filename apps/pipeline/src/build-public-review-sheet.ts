import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { readCachedPublicImage } from "@artduo/corpus/src/public-image-cache";
import { readPublicImageArtifacts } from "./public-url-intake";

const root = path.resolve(__dirname, "../../.."), args = process.argv.slice(2);
const arg = (name: string, fallback: string) => { const n = args.indexOf(name); return n < 0 ? fallback : args[n + 1]; };
const version = arg("--version", "2026-10-21-verified-public-url");
const offset = Number(arg("--offset", "0")), count = Number(arg("--count", "24"));
const work = path.join(root, "data/curation/public-url-import", version);
const output = path.join(root, ".cache/artduo-public-import/review-sheets");
const xml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
async function main() {
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(count) || count < 1 || count > 36) throw new TypeError("Invalid review range");
  const receiptMap = new Map([...readPublicImageArtifacts(path.join(work, "image-receipts.jsonl"))].map(([id, artifacts]) => [id, artifacts[0]]));
  const receipts = [...receiptMap.values()].filter(row => row.status === "fetched");
  mkdirSync(output, { recursive: true });
  const orderFile = path.join(output, "review-order.json");
  const firstSheet = path.join(output, "sheet-0000.json");
  const order: string[] = existsSync(orderFile) ? JSON.parse(readFileSync(orderFile, "utf8"))
    : existsSync(firstSheet) ? JSON.parse(readFileSync(firstSheet, "utf8")).rows.map((row: any) => row.candidateId) : [];
  const seen = new Set(order);
  for (const receipt of receipts) if (!seen.has(receipt.candidateId)) { order.push(receipt.candidateId); seen.add(receipt.candidateId); }
  writeFileSync(orderFile, JSON.stringify(order, null, 2) + "\n");
  const intake = JSON.parse(readFileSync(path.join(work, "intake.json"), "utf8"));
  const byId = new Map<string, any>(intake.candidates.map((row: any) => [row.candidateId, row]));
  const selected = order.slice(offset, offset + count).map(id => receiptMap.get(id)!);
  if (!selected.length) throw new TypeError("No fetched images in the requested range");
  const tileWidth = 480, imageHeight = 336, tileHeight = 394, columns = Math.min(6, selected.length);
  const composites: Array<{ input: Buffer; left: number; top: number }> = [], rows = [];
  sharp.cache({ memory: 64, files: 16, items: 32 });
  for (let i = 0; i < selected.length; i++) {
    const receipt = selected[i], ref = receipt.ref!, candidate = byId.get(receipt.candidateId);
    const bytes = readCachedPublicImage(root, ref);
    if (!bytes) throw new TypeError("Reviewed source bytes are missing");
    const thumb = await sharp(bytes).rotate().resize(tileWidth, imageHeight, { fit: "contain", background: "#282828" }).jpeg({ quality: 92 }).toBuffer();
    const left = i % columns * tileWidth, top = Math.floor(i / columns) * tileHeight;
    const title = String(candidate.facts.titleOriginal).slice(0, 70), artist = candidate.facts.creators.map((x: any) => x.nameOriginal).join("; ").slice(0, 55);
    const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tileWidth}" height="58"><rect width="100%" height="100%" fill="#f5f2e9"/><g font-family="Arial,sans-serif" fill="#171717"><text x="8" y="16" font-size="13" font-weight="bold">[${offset + i}] ${xml(receipt.candidateId)} — ${ref.width}×${ref.height}</text><text x="8" y="34" font-size="12">${xml(title)}</text><text x="8" y="50" font-size="11">${xml(artist)} · ${xml(String(candidate.facts.dateDisplay))}</text></g></svg>`);
    composites.push({ input: thumb, left, top }, { input: label, left, top: top + imageHeight });
    rows.push({ index: offset + i, candidateId: receipt.candidateId, sourceImageSha256: ref.sha256,
      width: ref.width, height: ref.height, sourceUrl: ref.url, title: candidate.facts.titleOriginal, artist, date: candidate.facts.dateDisplay,
      medium: candidate.facts.medium, objectType: candidate.facts.objectType, dimensions: candidate.facts.dimensionsRaw,
      presentationMode: candidate.presentationMode });
  }
  mkdirSync(output, { recursive: true });
  const basename = `sheet-${String(offset).padStart(4, "0")}`;
  const image = path.join(output, basename + ".jpg");
  await sharp({ create: { width: columns * tileWidth, height: Math.ceil(selected.length / columns) * tileHeight, channels: 3, background: "#282828" } })
    .composite(composites).jpeg({ quality: 94 }).toFile(image);
  writeFileSync(path.join(output, basename + ".json"), JSON.stringify({ version, offset, rows }, null, 2) + "\n");
  console.log(JSON.stringify({ image, manifest: path.join(output, basename + ".json"), count: rows.length, fetched: receipts.length }));
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
