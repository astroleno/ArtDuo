// Step 3 of the 2026-11-16 gap fill: rank screened candidates against the two
// gaps, then download and verify the full images of the shortlist.
// Usage: tsx apps/web/scripts/open-collection/acquire.ts [--joy 80] [--open 45]
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { AffectState } from "@artduo/contracts";
import { stageFit } from "../../lib/artwork-offering";
import { loadWebReleaseCatalog } from "../../lib/release-catalog";
import type { Candidate, Gap } from "./discovery";
import type { Screening } from "./screen";

const ROOT = path.resolve(__dirname, "../../../..");
const BATCH = process.argv.includes("--batch") ? process.argv[process.argv.indexOf("--batch") + 1]! : "2026-11-16";
if (!/^\d{4}-\d{2}-\d{2}$/u.test(BATCH)) throw new TypeError("--batch must be a date");
const DIR = path.join(ROOT, "data/sources/open-collections", BATCH);
const IMAGES = path.join(ROOT, ".cache/open-collections", BATCH, "images");
const USER_AGENT = "ArtDuo-curation/1.0 (open collection research)";
const option = (name: string, fallback: number) => { const i = process.argv.indexOf(name); const value = i < 0 ? fallback : Number(process.argv[i + 1]); if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a whole number`); return value; };
const TARGET: Record<Gap, number> = { joy: option("--joy", 80), open: option("--open", 45) };
const ARTIST_CAP = 4;
const MIN_LONG = 1600, MIN_SHORT = 320, MAX_BYTES = 30_000_000; // the public image cache limit

// The same archetype centres the corpus gap report uses.
const CENTRE: Record<Gap, AffectState> = {
  joy: { valence: .88, arousal: .75, tension: .12, wonder: .5, intimacy: .35 },
  open: { valence: .55, arousal: .25, tension: .1, wonder: .6, intimacy: .3 },
};
const HEAVY = new Set(["war", "death", "mourning", "threat", "ruin", "storm"]);

export interface ImageReceipt { candidateId: string; status: "verified" | "rejected" | "failed"; url: string; reason?: string;
  sha256?: string; bytes?: number; width?: number; height?: number; contentType?: string; path?: string; at: string }

function eligible(gap: Gap, screening: Screening): boolean {
  if (screening.presentation !== "flat-artwork") return false;
  if (gap === "joy") return screening.valence >= .65 && screening.arousal >= .4 && !screening.themes.some((theme) => HEAVY.has(theme));
  return screening.spatialFraming === "open" && !screening.themes.some((theme) => theme === "war" || theme === "death");
}

const normalise = (value?: string) => (value ?? "").toLowerCase().replace(/[^a-z0-9一-鿿]+/gu, " ").trim();

export function shortlist(candidates: Candidate[], screenings: Map<string, Screening>, existingArtists: Map<string, number>, existingTitles: Set<string>) {
  const chosen = new Map<string, Gap>();
  const artists = new Map(existingArtists);
  for (const gap of ["joy", "open"] as Gap[]) {
    const ranked = candidates.filter((candidate) => candidate.gaps.includes(gap) && !chosen.has(candidate.candidateId))
      .flatMap((candidate) => {
        const screening = screenings.get(candidate.candidateId);
        return screening && eligible(gap, screening) ? [{ candidate, fit: stageFit(screening, CENTRE[gap]) }] : [];
      })
      .sort((a, b) => b.fit - a.fit || a.candidate.candidateId.localeCompare(b.candidate.candidateId));
    let taken = 0;
    for (const { candidate } of ranked) {
      if (taken >= TARGET[gap]) break;
      const artist = normalise(candidate.artist) || "unknown";
      if (existingTitles.has(`${artist}|${normalise(candidate.title)}`)) continue;
      if (artist !== "unknown" && (artists.get(artist) ?? 0) >= ARTIST_CAP) continue;
      artists.set(artist, (artists.get(artist) ?? 0) + 1);
      chosen.set(candidate.candidateId, gap);
      taken++;
    }
  }
  return chosen;
}

async function acquire(candidate: Candidate, stoppedHosts: Set<string>): Promise<ImageReceipt> {
  const at = new Date().toISOString();
  const host = new URL(candidate.imageUrl).hostname;
  if (stoppedHosts.has(host)) return { candidateId: candidate.candidateId, status: "failed", url: candidate.imageUrl, reason: "source-access-stopped", at };
  try {
    const response = await fetch(candidate.imageUrl, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(180_000) });
    if ([401, 403, 429].includes(response.status)) { stoppedHosts.add(host); return { candidateId: candidate.candidateId, status: "failed", url: candidate.imageUrl, reason: `HTTP ${response.status}; host stopped`, at }; }
    if (!response.ok) return { candidateId: candidate.candidateId, status: "failed", url: candidate.imageUrl, reason: `HTTP ${response.status}`, at };
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_BYTES) return { candidateId: candidate.candidateId, status: "rejected", url: candidate.imageUrl, reason: "oversized", bytes: bytes.length, at };
    const { width = 0, height = 0, format } = await sharp(bytes, { limitInputPixels: 300_000_000 }).metadata();
    await sharp(bytes, { limitInputPixels: 300_000_000 }).resize(64).toBuffer(); // full decode check
    const sha256 = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    if (Math.max(width, height) < MIN_LONG || Math.min(width, height) < MIN_SHORT)
      return { candidateId: candidate.candidateId, status: "rejected", url: candidate.imageUrl, reason: `too small ${width}x${height}`, sha256, bytes: bytes.length, width, height, at };
    const file = path.join(IMAGES, `${candidate.candidateId}.${format === "png" ? "png" : "jpg"}`);
    writeFileSync(file, bytes);
    return { candidateId: candidate.candidateId, status: "verified", url: candidate.imageUrl, sha256, bytes: bytes.length, width, height,
      contentType: response.headers.get("content-type") ?? undefined, path: path.relative(ROOT, file), at };
  } catch (error) {
    return { candidateId: candidate.candidateId, status: "failed", url: candidate.imageUrl, reason: String(error).slice(0, 160), at };
  }
}

async function main(): Promise<void> {
  mkdirSync(IMAGES, { recursive: true });
  const candidates = readFileSync(path.join(DIR, "candidates.jsonl"), "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line) as Candidate);
  const screenings = new Map(readFileSync(path.join(DIR, "screening.jsonl"), "utf8").split("\n").filter(Boolean)
    .map((line) => JSON.parse(line) as Screening).map((row) => [row.candidateId, row] as const));
  const catalog = loadWebReleaseCatalog({ rootDir: ROOT });
  const existingArtists = new Map<string, number>();
  const existingTitles = new Set<string>();
  for (const artwork of catalog.artworks) {
    const artist = normalise(artwork.artistDisplayName) || "unknown";
    existingArtists.set(artist, (existingArtists.get(artist) ?? 0) + 1);
    existingTitles.add(`${artist}|${normalise(artwork.title)}`);
  }
  const chosen = shortlist(candidates, screenings, existingArtists, existingTitles);
  writeFileSync(path.join(DIR, "shortlist.json"), JSON.stringify(Object.fromEntries(chosen), null, 1) + "\n");
  const receiptsPath = path.join(DIR, "image-receipts.jsonl");
  const done = new Set(existsSync(receiptsPath) ? readFileSync(receiptsPath, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line))
    .filter((row: ImageReceipt) => row.status !== "failed").map((row: ImageReceipt) => row.candidateId) : []);
  const knownImages = new Set(catalog.artworkRecords.map((record) => record.media.sourceAssetFingerprint).filter(Boolean));
  const stoppedHosts = new Set<string>();
  const todo = candidates.filter((candidate) => chosen.has(candidate.candidateId) && !done.has(candidate.candidateId));
  console.log(`shortlist joy=${[...chosen.values()].filter((g) => g === "joy").length} open=${[...chosen.values()].filter((g) => g === "open").length}; ${todo.length} images to fetch`);
  for (const candidate of todo) {
    let receipt = await acquire(candidate, stoppedHosts);
    if (receipt.status === "verified" && knownImages.has(receipt.sha256)) receipt = { ...receipt, status: "rejected", reason: "duplicate image of an existing artwork" };
    if (receipt.sha256) knownImages.add(receipt.sha256);
    appendFileSync(receiptsPath, JSON.stringify(receipt) + "\n");
    console.log(`${receipt.status} ${candidate.candidateId} ${receipt.reason ?? `${receipt.width}x${receipt.height}`}`);
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  console.log(JSON.stringify({ stoppedHosts: [...stoppedHosts] }));
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
