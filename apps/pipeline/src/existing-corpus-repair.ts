import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { parseArtworkRecord, parseReleaseManifest, type ArtworkRecord, type ReleaseManifest } from "@artduo/contracts";
import { assertSafeReleaseVersion, galleryArtworkDecision, loadReleaseManifest, resolveShardPath } from "@artduo/corpus";

type JsonRecord = Record<string, any>;
interface SourceEvidence {
  id: string;
  file: string;
  dimensions?: string;
  classification?: string;
  objectName?: string;
}
interface ImageMeasurement {
  width: number;
  height: number;
  format: string;
  sha256: string;
}
export interface RepairOptions {
  rootDir: string;
  baseVersion: string;
  version: string;
  fetchExisting?: boolean;
}

const readJson = (file: string): any => JSON.parse(readFileSync(file, "utf8"));
const hash = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");
const text = (value: unknown): string | undefined => typeof value === "string" && value.trim() ? value.trim() : undefined;
function writeJson(file: string, value: unknown): { checksum: string; sizeBytes: number } {
  const serialized = JSON.stringify(value, null, 2);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, serialized + "\n");
  return { checksum: `sha256:${hash(serialized)}`, sizeBytes: Buffer.byteLength(serialized + "\n") };
}

export function normalizeSourceEvidence(value: JsonRecord, file: string): SourceEvidence | undefined {
  const response = value.response ?? value;
  const record = response.data ?? response;
  const isArtic = typeof value.sourceUrl === "string" && value.sourceUrl.startsWith("https://api.artic.edu/");
  const id = isArtic ? `artic-${record.id}` : record.objectID != null ? `met-${record.objectID}` : record.id;
  if (typeof id !== "string" || !/^(met|artic)-\d+$/.test(id)) return undefined;
  return { id, file, dimensions: text(record.dimensions),
    classification: text(record.classification ?? record.artwork_type_title), objectName: text(record.objectName) };
}

function readEvidence(root: string, cache: string): Map<string, SourceEvidence[]> {
  const result = new Map<string, SourceEvidence[]>();
  const add = (entry: SourceEvidence | undefined) => {
    if (entry) result.set(entry.id, [...(result.get(entry.id) ?? []), entry]);
  };
  // Later evidence has priority. All source files remain intact and are cited in the report.
  const legacy = path.join(root, "data/met/artworks");
  if (existsSync(legacy)) for (const filename of readdirSync(legacy).filter((name) => name.endsWith(".json")).sort()) {
    const file = path.join(legacy, filename);
    const data = readJson(file);
    for (const row of Array.isArray(data) ? data : data.artworks ?? []) add(normalizeSourceEvidence(row, path.relative(root, file)));
  }
  for (const directory of [path.join(root, "data/curation/painting-refresh/2026-10-06-paintings/sources"), cache]) {
    if (!existsSync(directory)) continue;
    for (const filename of readdirSync(directory).filter((name) => name.endsWith(".json")).sort()) {
      const file = path.join(directory, filename);
      add(normalizeSourceEvidence(readJson(file), path.relative(root, file)));
    }
  }
  return result;
}

export function backfillDimensions(record: ArtworkRecord, evidence: SourceEvidence[]): { record: ArtworkRecord; source?: string; conflicts: SourceEvidence[] } {
  const next = structuredClone(record);
  const candidates = evidence.filter((entry) => entry.id === record.id && entry.dimensions);
  const selected = candidates.at(-1);
  if (selected) next.metadata.dimensions = selected.dimensions;
  // Preserve the complete museum string: image, sheet, frame and multi-part measurements.
  return { record: next, source: selected?.file,
    conflicts: candidates.filter((entry) => entry.dimensions !== selected?.dimensions) };
}

export async function measureImage(buffer: Buffer): Promise<ImageMeasurement> {
  const decoder = sharp(buffer, { limitInputPixels: 100_000_000 });
  const metadata = await decoder.metadata();
  // Metadata alone can succeed on truncated images. Force a complete decode as well.
  await decoder.clone().stats();
  if (!metadata.width || !metadata.height || !metadata.format) throw new Error("Image dimensions unavailable");
  const rotated = [5, 6, 7, 8].includes(metadata.orientation ?? 1);
  return { width: rotated ? metadata.height : metadata.width, height: rotated ? metadata.width : metadata.height,
    format: metadata.format, sha256: hash(buffer) };
}

export function applyImageMeasurement(record: ArtworkRecord, measured: ImageMeasurement, relativeUrl: string): void {
  const ratio = measured.width / measured.height;
  record.media.baseImageUrl = relativeUrl;
  record.media.imageUrlPreview = relativeUrl;
  record.media.sourceAssetFingerprint = `sha256:${measured.sha256}`;
  record.media.aspectRatioHint = ratio > 1.12 ? "landscape" : ratio < 0.88 ? "portrait" : "square";
  record.media.visualPresentation = {
    contentBounds: { x: 0, y: 0, width: 1, height: 1 }, contentAspectRatio: ratio,
    cropStrategy: "preserve-paper", confidence: 1, source: "decoded-preview-image",
    notes: ["Complete delivered image; no border trimming or artwork crop. Pixel ratio is not a physical size measurement."],
  };
  // A new preview fingerprint cannot retain an unverified depth map association.
  if (record.media.depthMap?.sourceAssetFingerprint !== record.media.sourceAssetFingerprint) delete record.media.depthMap;
}

async function fetchBytes(url: string, kind: "source" | "image"): Promise<Buffer> {
  const parsed = new URL(url);
  const allowed = kind === "source" ? ["collectionapi.metmuseum.org", "api.artic.edu"] : ["images.metmuseum.org"];
  if (parsed.protocol !== "https:" || !allowed.includes(parsed.hostname)) throw new Error("Unapproved existing-source URL");
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(20_000),
    headers: { "User-Agent": "ArtDuo-existing-corpus-quality/1.0" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (kind === "image" && !contentType.startsWith("image/")) throw new Error(`Expected image, received ${contentType}`);
  const maxBytes = kind === "image" ? 25_000_000 : 2_000_000;
  if (Number(response.headers.get("content-length")) > maxBytes) throw new Error("Source exceeds size limit");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body ?? []) {
    size += chunk.length;
    if (size > maxBytes) throw new Error("Source exceeds size limit");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** Repair only identities already present in the base release. Never search for new artworks. */
export async function repairExistingCorpus(options: RepairOptions) {
  const root = path.resolve(options.rootDir);
  const version = assertSafeReleaseVersion(options.version);
  if (version === options.baseVersion) throw new Error("An immutable release cannot be repaired in place");
  if (existsSync(path.join(root, "data/releases", version))) throw new Error("Repair version already exists as a release");
  const loaded = loadReleaseManifest({ rootDir: root, releaseVersion: options.baseVersion });
  const work = path.join(root, "data/curation/existing-quality", version);
  const sources = path.join(work, "sources");
  const images = path.join(work, "images");
  mkdirSync(images, { recursive: true });
  mkdirSync(sources, { recursive: true });
  const evidence = readEvidence(root, sources);
  const shard = (kind: "metadata" | "mediaIndex" | "search" | "embeddings") =>
    (loaded.manifest.shards[kind] ?? []).flatMap((info) => readJson(resolveShardPath(loaded.manifestPath, info))) as JsonRecord[];
  const metadata = shard("metadata");
  const media = new Map(shard("mediaIndex").map((row) => [row.id, row]));
  const search = new Map(shard("search").map((row) => [row.id, row]));
  const originalIds = metadata.map((row) => row.id);
  if (new Set(originalIds).size !== originalIds.length) throw new Error("Duplicate base artwork identity");
  const records = metadata.map((row) => parseArtworkRecord({ ...row, media: media.get(row.id)?.media, retrieval: search.get(row.id)?.retrieval }));
  const audit: JsonRecord[] = [];
  const repaired: ArtworkRecord[] = [];
  for (const record of records) {
    let entries = evidence.get(record.id) ?? [];
    const failures: string[] = [];
    if (!entries.some((entry) => entry.dimensions) && options.fetchExisting && record.metadata.sourceApiUrl) {
      try {
        const bytes = await fetchBytes(record.metadata.sourceApiUrl, "source");
        const response = JSON.parse(bytes.toString("utf8"));
        const file = path.join(sources, `${record.id}.json`);
        const wrapped = { sourceUrl: record.metadata.sourceApiUrl, retrievedAt: new Date().toISOString(), response };
        const entry = normalizeSourceEvidence(wrapped, path.relative(root, file));
        if (entry?.id !== record.id) throw new Error("Museum response identity does not match the existing record");
        writeJson(file, wrapped);
        entries = [...entries, entry];
      } catch (error) { failures.push(`source: ${String(error)}`); }
    }
    const filled = backfillDimensions(record, entries);
    const next = filled.record;
    next.version = version;
    const decision = galleryArtworkDecision({ id: record.id, ...record.metadata });
    const previewUrl = record.media.imageUrlPreview ?? record.media.baseImageUrl;
    let measured: ImageMeasurement | undefined;
    let fullMeasured: ImageMeasurement | undefined;
    // Preserve all existing relative assets, including records excluded from default exhibition.
    for (const url of new Set([record.media.baseImageUrl, record.media.imageUrlPreview, record.media.imageUrlFull])) {
      if (!url || /^https?:/.test(url)) continue;
      const source = path.resolve(loaded.releaseDir, url);
      if (!source.startsWith(loaded.releaseDir + path.sep)) throw new Error("Image is outside the base release");
      const target = path.join(work, url);
      mkdirSync(path.dirname(target), { recursive: true });
      copyFileSync(source, target);
    }
    if (previewUrl && (decision.status === "eligible" || !/^https?:/.test(previewUrl))) {
      try {
        const relativeUrl = /^https?:/.test(previewUrl) ? `images/${record.id}-preview.jpg` : previewUrl;
        const file = path.join(work, relativeUrl);
        // A cached preview must match the exact source URL before being reused.
        const receiptFile = `${file}.source.json`;
        const cacheMatches = existsSync(file) && existsSync(receiptFile) && readJson(receiptFile).url === previewUrl;
        const receipt = cacheMatches ? readJson(receiptFile) : undefined;
        let bytes: Buffer;
        if (!/^https?:/.test(previewUrl) || cacheMatches) bytes = readFileSync(file);
        else if (options.fetchExisting) bytes = await fetchBytes(previewUrl, "image");
        else throw new Error("Existing preview has not been measured; network disabled");
        measured = await measureImage(bytes);
        let upgradedFrom: string | undefined;
        const remoteFull = record.media.imageUrlFull;
        if ((Math.min(measured.width, measured.height) < 250 || receipt?.upgradedFrom)
          && remoteFull?.startsWith("https://images.metmuseum.org/")) {
          const fullRelative = `images/${record.id}-full.jpg`;
          const fullFile = path.join(work, fullRelative);
          const fullReceipt = `${fullFile}.source.json`;
          const fullCached = existsSync(fullFile) && existsSync(fullReceipt) && readJson(fullReceipt).url === remoteFull;
          const fullBytes = fullCached ? readFileSync(fullFile)
            : options.fetchExisting ? await fetchBytes(remoteFull, "image") : undefined;
          if (!fullBytes) throw new Error("Low-resolution preview needs its existing full image");
          fullMeasured = await measureImage(fullBytes);
          const difference = Math.abs((measured.width / measured.height) / (fullMeasured.width / fullMeasured.height) - 1);
          // Tiny thumbnail dimensions have greater integer rounding error.
          if (difference > 0.015) throw new Error(`Preview/full aspect mismatch: ${difference}`);
          writeFileSync(fullFile, fullBytes);
          writeJson(fullReceipt, { url: remoteFull, ...fullMeasured });
          bytes = await sharp(fullBytes).rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
          measured = await measureImage(bytes);
          upgradedFrom = remoteFull;
          next.media.imageUrlFull = fullRelative;
        }
        writeFileSync(file, bytes);
        writeJson(receiptFile, { url: previewUrl, upgradedFrom, ...measured });
        applyImageMeasurement(next, measured, relativeUrl);
        next.media.mediaVersion = version;
        const full = next.media.imageUrlFull;
        if (full && !/^https?:/.test(full)) {
          fullMeasured = await measureImage(readFileSync(path.join(work, full)));
          const difference = Math.abs((measured.width / measured.height) / (fullMeasured.width / fullMeasured.height) - 1);
          if (difference > 0.005) throw new Error(`Preview/full aspect mismatch: ${difference}`);
        }
      } catch (error) { failures.push(`image: ${String(error)}`); }
    }
    repaired.push(parseArtworkRecord(next));
    const recentSource = entries.at(-1);
    audit.push({ id: record.id, title: record.metadata.title, decision,
      sourceClassification: recentSource?.classification, sourceObjectName: recentSource?.objectName,
      dimensions: next.metadata.dimensions ?? null, dimensionsSource: filled.source ?? null,
      dimensionConflicts: filled.conflicts, imageSourceUrl: previewUrl, measured: measured ?? null,
      fullMeasured: fullMeasured ?? null, fullImageStatus: fullMeasured ? "decoded" : "not-revalidated",
      multipart: /\b(?:album|handscroll|panels|pair of|set of|hanging scrolls)\b/i.test(record.metadata.medium ?? ""),
      failures });
    if (audit.length % 20 === 0) console.log(`Checked ${audit.length}/${records.length} existing records`);
  }
  const corpusPath = path.join(work, "corpus.json");
  writeJson(corpusPath, repaired);
  const report = { baseVersion: options.baseVersion, version, createdAt: new Date().toISOString(),
    scope: "Existing artwork identities only; no new artworks or source institutions",
    counts: { records: repaired.length, dimensions: repaired.filter((r) => r.metadata.dimensions).length,
      measuredPreviews: audit.filter((r) => r.measured).length,
      eligible: audit.filter((r) => r.decision.status === "eligible").length,
      specialistOnly: audit.filter((r) => r.decision.status === "specialist-only").length,
      failures: audit.filter((r) => r.failures.length).length }, records: audit };
  writeJson(path.join(work, "quality-report.json"), report);
  return { work, corpusPath, records: repaired, report, loaded };
}

/** Preserve search vectors and background catalog: this repair changes metadata and media only. */
export function buildRepairedRelease(result: Awaited<ReturnType<typeof repairExistingCorpus>>, outputRoot: string): string {
  if (result.report.records.some((r) => r.decision.status === "eligible" && (!r.measured || r.failures.some((failure: string) => failure.startsWith("image:"))))) {
    throw new Error("Cannot build a release with unverified or inconsistent default exhibit images");
  }
  const { loaded, records } = result;
  const version = result.report.version;
  const target = path.join(outputRoot, version);
  if (existsSync(target)) throw new Error("Never overwrite an existing release or preview");
  const byId = new Map(records.map((r) => [r.id, r]));
  const manifest: ReleaseManifest = structuredClone(loaded.manifest);
  manifest.release = { ...manifest.release, corpusVersion: version, createdAt: result.report.createdAt };
  mkdirSync(target, { recursive: true });
  for (const [kind, shards] of Object.entries(manifest.shards)) for (const info of shards ?? []) {
    const original = readJson(resolveShardPath(loaded.manifestPath, info));
    const rows = kind === "backgroundScenes" ? original : original.map((row: JsonRecord) => {
      const record = byId.get(row.id);
      if (!record) throw new Error(`Unexpected shard identity: ${row.id}`);
      return { ...row, version, ...(kind === "metadata" ? { metadata: record.metadata } : {}),
        ...(kind === "mediaIndex" ? { media: record.media } : {}) };
    });
    Object.assign(info, writeJson(path.join(target, info.url), rows), { recordCount: rows.length });
  }
  for (const record of records) for (const url of new Set([record.media.baseImageUrl, record.media.imageUrlPreview, record.media.imageUrlFull])) {
    if (!url || /^https?:/.test(url)) continue;
    const destination = path.join(target, url);
    mkdirSync(path.dirname(destination), { recursive: true });
    copyFileSync(path.join(result.work, url), destination);
  }
  writeJson(path.join(target, "quality-report.json"), result.report);
  // Manifest is written last so incomplete preview builds are never presented as complete releases.
  writeJson(path.join(target, "manifest.json"), parseReleaseManifest(manifest));
  return target;
}

export function activateRepairedRelease(preview: string, releasesRoot: string): string {
  const target = path.join(releasesRoot, path.basename(preview));
  if (existsSync(target)) throw new Error("Cannot replace an immutable release");
  verifyRepairedRelease(preview);
  renameSync(preview, target);
  return target;
}

export function verifyRepairedRelease(directory: string): void {
  const manifest = parseReleaseManifest(readJson(path.join(directory, "manifest.json")));
  const identities = new Map<string, string[]>();
  for (const [kind, shards] of Object.entries(manifest.shards)) {
    if (!shards?.length) continue;
    const ids: string[] = [];
    for (const info of shards ?? []) {
      const bytes = readFileSync(path.join(directory, info.url));
      const rows = JSON.parse(bytes.toString("utf8"));
      if (bytes.length !== info.sizeBytes || `sha256:${hash(bytes.toString("utf8").replace(/\n$/, ""))}` !== info.checksum
        || rows.length !== info.recordCount) throw new Error(`Shard integrity failed: ${kind}`);
      if (kind !== "backgroundScenes") for (const row of rows) {
        if (row.version !== manifest.release.corpusVersion) throw new Error(`Wrong artwork version: ${row.id}`);
        ids.push(row.id);
      }
      if (kind === "mediaIndex") for (const row of rows) {
        for (const url of [row.media.baseImageUrl, row.media.imageUrlPreview, row.media.imageUrlFull]) {
          if (!url || /^https?:/.test(url)) continue;
          const file = path.resolve(directory, url);
          if (!file.startsWith(path.resolve(directory) + path.sep)) throw new Error(`Image outside release: ${url}`);
          if (!existsSync(file)) throw new Error(`Missing image: ${url}`);
        }
        const preview = row.media.imageUrlPreview ?? row.media.baseImageUrl;
        if (preview && !/^https?:/.test(preview) && row.media.visualPresentation?.source === "decoded-preview-image"
          && `sha256:${hash(readFileSync(path.join(directory, preview)))}` !== row.media.sourceAssetFingerprint) {
          throw new Error(`Image integrity failed: ${row.id}`);
        }
      }
    }
    if (kind !== "backgroundScenes") {
      if (new Set(ids).size !== ids.length) throw new Error(`Duplicate identities: ${kind}`);
      identities.set(kind, ids.sort());
    }
  }
  const expected = JSON.stringify(identities.get("metadata"));
  for (const [kind, ids] of identities) if (JSON.stringify(ids) !== expected) throw new Error(`Shard identities differ: ${kind}`);
}
