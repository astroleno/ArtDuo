// Step 4 of the 2026-11-16 gap fill: help the assistant review every verified
// shortlist image by eye, then merge its decisions into accepted.json.
//   sheets:  tsx review.ts sheets   -> numbered contact sheets + a draft table
//   accept:  tsx review.ts accept   -> accepted.json from review-decisions.json
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { VISUAL_SUBJECTS } from "@artduo/contracts";
import type { Candidate, Gap } from "./discovery";
import type { ImageReceipt } from "./acquire";
import type { AcceptedReview } from "./build-release";
import type { Screening } from "./screen";

const ROOT = path.resolve(__dirname, "../../../..");
const DIR = path.join(ROOT, "data/sources/open-collections/2026-11-16");
const SHEETS = "/tmp/artduo-ux/review-sheets";
const LIMIT: Record<Gap, number> = { joy: 60, open: 30 };
const readLines = <T>(file: string): T[] => readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line) as T);

interface Decision { accept: boolean; facts?: Record<string, "present" | "absent" | "unknown">; spatialFraming?: AcceptedReview["spatialFraming"]; observation?: string; moodTags?: string[]; note?: string }

function load() {
  const candidates = new Map(readLines<Candidate>(path.join(DIR, "candidates.jsonl")).map((row) => [row.candidateId, row]));
  const screenings = new Map(readLines<Screening>(path.join(DIR, "screening.jsonl")).map((row) => [row.candidateId, row]));
  const shortlist = JSON.parse(readFileSync(path.join(DIR, "shortlist.json"), "utf8")) as Record<string, Gap>;
  const receipts = new Map(readLines<ImageReceipt>(path.join(DIR, "image-receipts.jsonl")).filter((row) => row.status === "verified").map((row) => [row.candidateId, row]));
  // Shortlist order is ranked fit; review in that order so acceptance keeps the best fitting works.
  const order = Object.entries(shortlist).filter(([id]) => receipts.has(id));
  return { candidates, screenings, receipts, order };
}

async function sheets(): Promise<void> {
  const { candidates, screenings, receipts, order } = load();
  mkdirSync(SHEETS, { recursive: true });
  const lines: string[] = [];
  for (let page = 0; page * 6 < order.length; page++) {
    const tiles: import("sharp").OverlayOptions[] = [];
    for (const [slot, [id, gap]] of order.slice(page * 6, page * 6 + 6).entries()) {
      const n = page * 6 + slot + 1;
      const image = await sharp(readFileSync(path.join(ROOT, receipts.get(id)!.path!))).resize(760, 560, { fit: "contain", background: "#1b1b1b" }).png().toBuffer();
      const label = Buffer.from(`<svg width="760" height="34"><rect width="760" height="34" fill="#000"/><text x="8" y="24" font-size="21" fill="#fff">${n}. ${id} [${gap}]</text></svg>`);
      tiles.push({ input: await sharp(image).composite([{ input: label, top: 0, left: 0 }]).png().toBuffer(), left: (slot % 2) * 760, top: Math.floor(slot / 2) * 560 });
      const c = candidates.get(id)!, s = screenings.get(id)!;
      const present = VISUAL_SUBJECTS.filter((subject) => s.facts[subject] === "present").join(",");
      const unknown = VISUAL_SUBJECTS.filter((subject) => s.facts[subject] === "unknown").join(",");
      lines.push(`${n}\t${id}\t${gap}\t${c.title.slice(0, 50)} / ${c.artist ?? "?"}\tframe=${s.spatialFraming}\tpresent=${present}\tunknown=${unknown}\tmood=${s.moodTags.join(",")}\t${s.observation}`);
    }
    await sharp({ create: { width: 1520, height: 1680, channels: 3, background: "#000" } }).composite(tiles).png().toFile(path.join(SHEETS, `sheet-${String(page + 1).padStart(2, "0")}.png`));
  }
  writeFileSync(path.join(SHEETS, "drafts.tsv"), lines.join("\n") + "\n");
  console.log(`${order.length} images on ${Math.ceil(order.length / 6)} sheets in ${SHEETS}`);
}

function accept(): void {
  const { screenings, order } = load();
  const decisionsPath = path.join(DIR, "review-decisions.json");
  if (!existsSync(decisionsPath)) throw new Error("Write review-decisions.json first");
  const decisions = JSON.parse(readFileSync(decisionsPath, "utf8")) as { reviewedAt: string; decisions: Record<string, Decision> };
  const taken: Record<Gap, number> = { joy: 0, open: 0 };
  const reviews: AcceptedReview[] = [];
  for (const [id, gap] of order) {
    const decision = decisions.decisions[id];
    if (!decision) throw new Error(`No review decision for ${id}`);
    if (!decision.accept || taken[gap] >= LIMIT[gap]) continue;
    const s = screenings.get(id)!;
    taken[gap]++;
    reviews.push({ candidateId: id, gap, facts: { ...s.facts, ...decision.facts }, spatialFraming: decision.spatialFraming ?? s.spatialFraming,
      observation: decision.observation ?? s.observation, moodTags: decision.moodTags ?? (s.moodTags.length ? s.moodTags : ["quiet"]) });
  }
  writeFileSync(path.join(DIR, "accepted.json"), JSON.stringify({ schemaVersion: 1, reviewedAt: decisions.reviewedAt, reviews }, null, 1) + "\n");
  console.log(JSON.stringify(taken));
}

void (process.argv[2] === "accept" ? Promise.resolve(accept()) : sheets()).catch((error) => { console.error(error); process.exitCode = 1; });
