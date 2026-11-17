// Step 1 of the 2026-11-16 gap fill: query official open-collection APIs for
// public-domain paintings that may fill the "bright and joyful" and "open vista"
// gaps. Stores each raw API record with its SHA-256 as rights and data evidence.
// No full images are downloaded here.
// Usage: tsx apps/web/scripts/open-collection/discovery.ts [--per-query 30]
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../../..");
const BATCH = process.argv.includes("--batch") ? process.argv[process.argv.indexOf("--batch") + 1]! : "2026-11-16";
if (!/^\d{4}-\d{2}-\d{2}$/u.test(BATCH)) throw new TypeError("--batch must be a date");
const OUT = path.join(ROOT, "data/sources/open-collections", BATCH);
const only = (name: string) => process.argv.includes(name) ? new Set(process.argv[process.argv.indexOf(name) + 1]!.split(",")) : undefined;
const SOURCES = only("--sources"), GAPS = only("--gaps");
const USER_AGENT = "ArtDuo-curation/1.0 (open collection research)";
const perQuery = Number(process.argv[process.argv.indexOf("--per-query") + 1] ?? 30) || 30;
const MIN_LONG = 1600, MIN_SHORT = 320;

export type Gap = "joy" | "open";
const QUERIES: Record<Gap, string[]> = {
  joy: ["festival", "celebration", "dance", "dancing", "garden flowers", "bouquet", "summer", "picnic", "boating", "regatta", "carnival",
    "holiday", "children playing", "sunlight", "blossom spring", "parade", "music party", "fair", "beach bathers", "fete"],
  open: ["panorama landscape", "plain", "valley view", "coast", "calm sea", "river landscape", "distant view", "meadow", "fields horizon",
    "mountain view", "lake landscape", "dunes"],
};

export interface Candidate {
  candidateId: string; source: "artic" | "met" | "smk" | "cma"; sourceArtworkId: string; gaps: Gap[]; queries: string[];
  title: string; artist?: string; date?: string; medium?: string; classification?: string;
  rights: string; imageUrl: string; previewUrl: string; width?: number; height?: number; objectUrl: string;
  recordPath: string; recordSha256: string;
}

const sha = (body: string) => `sha256:${createHash("sha256").update(body).digest("hex")}`;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getText(url: string, init?: RequestInit): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { ...init, headers: { "User-Agent": USER_AGENT, "AIC-User-Agent": USER_AGENT, ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(40_000) });
      if ([401, 403, 429].includes(response.status)) throw Object.assign(new Error(`HTTP ${response.status} ${url}`), { stop: true });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
      return await response.text();
    } catch (error) {
      // Access refusals stop that source; they are never retried around.
      if ((error as { stop?: boolean }).stop || attempt >= 4) throw error;
      await pause(attempt * 2500);
    }
  }
}

function saveRecord(candidateId: string, body: string): { recordPath: string; recordSha256: string } {
  const file = path.join(OUT, "records", `${candidateId}.json`);
  if (!existsSync(file)) writeFileSync(file, body);
  const stored = readFileSync(file, "utf8");
  return { recordPath: path.relative(ROOT, file), recordSha256: sha(stored) };
}

const sizeOk = (width?: number, height?: number) => Boolean(width && height && Math.max(width, height) >= MIN_LONG && Math.min(width, height) >= MIN_SHORT);

async function searchArtic(query: string): Promise<Candidate[]> {
  const fields = ["id", "title", "artist_title", "date_display", "medium_display", "is_public_domain", "image_id", "artwork_type_title", "thumbnail", "classification_titles"];
  const body = JSON.stringify({ q: query, limit: perQuery, fields, query: { bool: { filter: [{ term: { is_public_domain: true } }, { term: { artwork_type_id: 1 } }] } } });
  const result = JSON.parse(await getText("https://api.artic.edu/api/v1/artworks/search", { method: "POST", headers: { "Content-Type": "application/json" }, body })) as { data: any[] };
  const found: Candidate[] = [];
  for (const row of result.data) {
    if (!row.is_public_domain || !row.image_id || !sizeOk(row.thumbnail?.width, row.thumbnail?.height)) continue;
    const candidateId = `artic-${row.id}`;
    const record = await getText(`https://api.artic.edu/api/v1/artworks/${row.id}`);
    await pause(300);
    const image = `https://www.artic.edu/iiif/2/${row.image_id}`;
    found.push({ candidateId, source: "artic", sourceArtworkId: String(row.id), gaps: [], queries: [], title: row.title, artist: row.artist_title ?? undefined,
      date: row.date_display ?? undefined, medium: row.medium_display ?? undefined, classification: row.artwork_type_title, rights: "https://creativecommons.org/publicdomain/zero/1.0/",
      imageUrl: `${image}/full/1686,/0/default.jpg`, previewUrl: `${image}/full/843,/0/default.jpg`, width: row.thumbnail.width, height: row.thumbnail.height,
      objectUrl: `https://www.artic.edu/artworks/${row.id}`, ...saveRecord(candidateId, record) });
  }
  return found;
}

async function searchMet(query: string): Promise<Candidate[]> {
  const params = new URLSearchParams({ hasImages: "true", isPublicDomain: "true", q: query, limit: String(perQuery * 3), offset: "0" });
  const result = JSON.parse(await getText(`https://collectionapi.metmuseum.org/public/collection/v1.1/search?${params}`)) as { objectIDs?: number[] };
  const found: Candidate[] = [];
  for (const id of result.objectIDs ?? []) {
    if (found.length >= perQuery) break;
    // A withdrawn object (404) is skipped; access refusals still stop the source.
    let body: string;
    try { body = await getText(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`); }
    catch (error) { if (/HTTP 404/u.test(String(error))) continue; throw error; }
    await pause(900); // the Met refused access at a faster pace on 2026-11-16
    const row = JSON.parse(body);
    if (!row.isPublicDomain || !row.primaryImage || row.classification !== "Paintings") continue;
    const candidateId = `met-${id}`;
    found.push({ candidateId, source: "met", sourceArtworkId: String(id), gaps: [], queries: [], title: row.title, artist: row.artistDisplayName || undefined,
      date: row.objectDate || undefined, medium: row.medium || undefined, classification: row.classification, rights: "https://creativecommons.org/publicdomain/zero/1.0/",
      imageUrl: row.primaryImage, previewUrl: row.primaryImageSmall || row.primaryImage, objectUrl: row.objectURL, ...saveRecord(candidateId, body) });
  }
  return found;
}

async function searchSmk(query: string): Promise<Candidate[]> {
  const params = new URLSearchParams({ keys: query, offset: "0", rows: String(perQuery), lang: "en" });
  const filters = "&filters=%5Bpublic_domain%3Atrue%5D,%5Bhas_image%3Atrue%5D,%5Bobject_names%3APainting%5D";
  const result = JSON.parse(await getText(`https://api.smk.dk/api/v1/art/search/?${params}${filters}`)) as { items?: any[] };
  const found: Candidate[] = [];
  for (const row of result.items ?? []) {
    if (!row.public_domain || !row.image_iiif_id || !sizeOk(row.image_width, row.image_height)) continue;
    const candidateId = `smk-${row.object_number}`;
    const title = row.titles?.find((item: any) => item.language === "engelsk")?.title ?? row.titles?.[0]?.title;
    found.push({ candidateId, source: "smk", sourceArtworkId: row.object_number, gaps: [], queries: [], title,
      artist: row.production?.[0]?.creator ?? undefined, date: row.production_date?.[0]?.period ?? undefined, medium: row.techniques?.join("; ") ?? undefined,
      classification: row.object_names?.[0]?.name, rights: row.rights, imageUrl: `${row.image_iiif_id}/full/!4000,4000/0/native.jpg`,
      previewUrl: `${row.image_iiif_id}/full/!800,800/0/native.jpg`, width: row.image_width, height: row.image_height,
      objectUrl: `https://open.smk.dk/artwork/image/${row.object_number}`, ...saveRecord(candidateId, JSON.stringify(row)) });
  }
  return found;
}

async function searchCma(query: string): Promise<Candidate[]> {
  const params = new URLSearchParams({ q: query, cc0: "1", has_image: "1", type: "Painting", limit: String(perQuery) });
  const result = JSON.parse(await getText(`https://openaccess-api.clevelandart.org/api/artworks/?${params}`)) as { data?: any[] };
  const found: Candidate[] = [];
  for (const row of result.data ?? []) {
    const print = row.images?.print, web = row.images?.web;
    if (row.share_license_status !== "CC0" || !print?.url || !web?.url || !sizeOk(Number(print.width), Number(print.height))) continue;
    const candidateId = `cma-${row.id}`;
    found.push({ candidateId, source: "cma", sourceArtworkId: String(row.id), gaps: [], queries: [], title: row.title,
      artist: row.creators?.[0]?.description?.replace(/\s*\(.*$/u, "") || undefined, date: row.creation_date || undefined, medium: row.technique || undefined,
      classification: row.type, rights: "https://creativecommons.org/publicdomain/zero/1.0/", imageUrl: print.url, previewUrl: web.url,
      width: Number(print.width), height: Number(print.height), objectUrl: row.url, ...saveRecord(candidateId, JSON.stringify(row)) });
  }
  return found;
}

async function main(): Promise<void> {
  mkdirSync(path.join(OUT, "records"), { recursive: true });
  // Skip everything already in the newest release, including earlier gap-fill batches.
  const existing = new Set<string>();
  const releases = readdirSync(path.join(ROOT, "data/releases"), { withFileTypes: true }).filter((entry) => entry.isDirectory() && /^[A-Za-z0-9]/u.test(entry.name)).map((entry) => entry.name).sort();
  const meta = JSON.parse(readFileSync(path.join(ROOT, "data/releases", releases.at(-1)!, "metadata-01.json"), "utf8"));
  for (const record of meta.records ?? meta) existing.add(record.id);
  // Works the assistant already rejected in an earlier batch are not offered again.
  const batches = path.join(ROOT, "data/sources/open-collections");
  for (const batch of readdirSync(batches)) {
    const decisions = path.join(batches, batch, "review-decisions.json");
    if (batch === BATCH || !existsSync(decisions)) continue;
    for (const [id, decision] of Object.entries(JSON.parse(readFileSync(decisions, "utf8")).decisions as Record<string, { accept: boolean }>)) if (!decision.accept) existing.add(id);
  }
  const byId = new Map<string, Candidate>();
  const stopped = new Set<string>();
  const log: string[] = [];
  for (const [gap, queries] of Object.entries(QUERIES) as Array<[Gap, string[]]>) {
    if (GAPS && !GAPS.has(gap)) continue;
    for (const query of queries) {
      for (const [source, search] of [["artic", searchArtic], ["met", searchMet], ["smk", searchSmk], ["cma", searchCma]] as const) {
        if (stopped.has(source) || SOURCES && !SOURCES.has(source)) continue;
        try {
          const rows = await search(query);
          for (const row of rows) {
            if (existing.has(row.candidateId)) continue;
            const current = byId.get(row.candidateId) ?? row;
            byId.set(row.candidateId, { ...current, gaps: [...new Set([...current.gaps, gap])], queries: [...new Set([...current.queries, query])] });
          }
          log.push(`${gap} | ${query} | ${source} | ${rows.length}`);
        } catch (error) {
          log.push(`${gap} | ${query} | ${source} | error ${String(error).slice(0, 160)}`);
          if ((error as { stop?: boolean }).stop) stopped.add(source);
        }
        await pause(400);
      }
      console.log(`${gap} "${query}": ${byId.size} unique candidates so far`);
    }
  }
  const rows = [...byId.values()].sort((a, b) => a.candidateId.localeCompare(b.candidateId));
  writeFileSync(path.join(OUT, "candidates.jsonl"), rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
  writeFileSync(path.join(OUT, "discovery-log.txt"), log.join("\n") + "\n");
  console.log(JSON.stringify({ candidates: rows.length, bySource: Object.fromEntries(["artic", "met", "smk", "cma"].map((s) => [s, rows.filter((r) => r.source === s).length])),
    byGap: { joy: rows.filter((r) => r.gaps.includes("joy")).length, open: rows.filter((r) => r.gaps.includes("open")).length }, stopped: [...stopped] }));
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
