// Step 6 of the 2026-11-16 gap fill: compose a new immutable release from the
// current one plus the reviewed open-collection works. Everything is written to
// a hidden staging directory first; it becomes a release (and the default, as
// the newest version) only after every check passes.
// Usage: tsx apps/web/scripts/open-collection/build-release.ts --version 2026-11-16-open-gap [--base 2026-10-24-da3-curated-630]
import { createHash } from "node:crypto";
import { constants, cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { parseArtworkRecord, VISUAL_SUBJECTS, type ArtworkRecord, type VerifiedRemoteImage } from "@artduo/contracts";
import { galleryArtworkDecision } from "@artduo/corpus/src/artwork-eligibility";
import { createLocalDepthEstimator, LOCAL_DEPTH_MODEL } from "@artduo/corpus/src/local-depth-provider";
import { createLocalSemanticEncoder } from "@artduo/corpus/src/local-semantic-provider";
import { cachePublicImage, PUBLIC_IMAGE_HOSTS } from "@artduo/corpus/src/public-image-cache";
import { semanticFingerprint, semanticSourceFingerprint } from "@artduo/corpus/src/semantic-index";
import { buildEmbeddingRecordsWithProvider } from "../../../pipeline/src/embedding-shards";
import { normalizeRelativeDepth } from "../../../pipeline/src/model-depth-release";
import { artworkToSemanticText } from "../../../pipeline/src/semantic-release";
import type { Candidate, Gap } from "./discovery";
import type { ImageReceipt } from "./acquire";
import type { Screening } from "./screen";

const ROOT = path.resolve(__dirname, "../../../..");
const SOURCE_DIR = path.join(ROOT, "data/sources/open-collections/2026-11-16");
const arg = (name: string, fallback?: string) => { const i = process.argv.indexOf(name); const v = i < 0 ? fallback : process.argv[i + 1]; if (!v) throw new TypeError(`Missing ${name}`); return v; };
const VERSION = arg("--version");
const BASE = arg("--base", "2026-10-24-da3-curated-630");
const sha = (bytes: Buffer | string) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, "utf8")) as T;
const readLines = <T>(file: string): T[] => readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line) as T);

export interface AcceptedReview {
  candidateId: string; gap: Gap; facts: Record<string, "present" | "absent" | "unknown">;
  spatialFraming: "open" | "framed" | "enclosed" | "not-applicable" | "unknown"; observation: string; moodTags: string[];
}

const level = <T extends string>(value: number, cuts: [number, number], names: [T, T, T]): T => value < cuts[0] ? names[0] : value < cuts[1] ? names[1] : names[2];

async function colourTags(image: Buffer): Promise<string[]> {
  const { dominant, channels } = await sharp(image).resize(96, 96, { fit: "inside" }).stats();
  const [r, g, b] = [dominant.r, dominant.g, dominant.b].map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const hue = delta === 0 ? 0 : max === r ? 60 * (((g - b) / delta) % 6) : max === g ? 60 * ((b - r) / delta + 2) : 60 * ((r - g) / delta + 4);
  const name = delta < .08 ? (max > .7 ? "white" : max < .25 ? "black" : "gray")
    : (hue + 360) % 360 < 20 || (hue + 360) % 360 >= 340 ? "red" : (hue + 360) % 360 < 45 ? "orange" : (hue + 360) % 360 < 70 ? "yellow"
    : (hue + 360) % 360 < 170 ? "green" : (hue + 360) % 360 < 260 ? "blue" : "purple";
  const spread = channels.slice(0, 3).reduce((sum, channel) => sum + channel.stdev, 0) / 3 / 255;
  return [name, delta > .35 ? "vivid" : delta < .15 ? "muted" : "balanced", ...(spread > .25 ? ["contrast"] : [])];
}

function sourceDetails(candidate: Candidate): { creditLine: string; department?: string; dimensions?: string; sourceApiUrl: string } {
  const raw = readJson<any>(path.join(ROOT, candidate.recordPath));
  if (candidate.source === "artic") {
    const data = raw.data;
    return { creditLine: `Art Institute of Chicago — ${data.credit_line ?? "Public domain"}`, department: data.department_title ?? undefined,
      dimensions: data.dimensions ?? undefined, sourceApiUrl: `https://api.artic.edu/api/v1/artworks/${candidate.sourceArtworkId}` };
  }
  if (candidate.source === "met") {
    return { creditLine: `The Metropolitan Museum of Art — ${raw.creditLine || "Public domain"}`, department: raw.department || undefined,
      dimensions: raw.dimensions || undefined, sourceApiUrl: `https://collectionapi.metmuseum.org/public/collection/v1/objects/${candidate.sourceArtworkId}` };
  }
  return { creditLine: `${candidate.title}; ${candidate.artist ?? "Unknown"}; ${candidate.sourceArtworkId}; SMK – Statens Museum for Kunst`,
    sourceApiUrl: `https://api.smk.dk/api/v1/art?object_number=${candidate.sourceArtworkId}` };
}

async function main(): Promise<void> {
  const baseDir = path.join(ROOT, "data/releases", BASE);
  const finalDir = path.join(ROOT, "data/releases", VERSION);
  const staging = path.join(ROOT, "data/releases", `.staging-${VERSION}`);
  if (existsSync(finalDir)) throw new TypeError("Release version already exists; releases are immutable");
  const accepted = readJson<{ schemaVersion: 1; reviewedAt: string; reviews: AcceptedReview[] }>(path.join(SOURCE_DIR, "accepted.json"));
  const candidates = new Map(readLines<Candidate>(path.join(SOURCE_DIR, "candidates.jsonl")).map((row) => [row.candidateId, row]));
  const screenings = new Map(readLines<Screening>(path.join(SOURCE_DIR, "screening.jsonl")).map((row) => [row.candidateId, row]));
  const receipts = new Map(readLines<ImageReceipt>(path.join(SOURCE_DIR, "image-receipts.jsonl")).filter((row) => row.status === "verified").map((row) => [row.candidateId, row]));
  const corrections = readJson<{ corrections: Array<{ artworkId: string; facts: Record<string, string>; note: string }>; reviewedAt: string }>(path.join(SOURCE_DIR, "existing-review-corrections.json"));

  rmSync(staging, { recursive: true, force: true });
  cpSync(baseDir, staging, { recursive: true, mode: constants.COPYFILE_FICLONE });
  const manifest = readJson<any>(path.join(staging, "manifest.json"));
  const shard = (kind: string) => path.join(staging, manifest.shards[kind][0].url.replace(/^\.\//u, ""));
  const metadata = readJson<any>(shard("metadata")), media = readJson<any>(shard("mediaIndex")), search = readJson<any>(shard("search"));
  const embeddings = readJson<any>(shard("embeddings")), semantic = readJson<any>(shard("semanticEmbeddings"));
  const rows = (value: any) => (value.records ?? value) as any[];
  const retag = (list: any[]) => list.map((row) => ({ ...row, version: VERSION, ...(row.media?.depthMap ? { media: { ...row.media, depthMap: { ...row.media.depthMap, version: VERSION } } } : {}) }));
  const existingIds = new Set(rows(metadata).map((row) => row.id));
  const existingImages = new Set(rows(media).map((row) => row.media.sourceAssetFingerprint));

  const records: ArtworkRecord[] = [];
  const reviewRows: any[] = [];
  const depthRows: any[] = [];
  const sources = new Map<string, Buffer>();
  mkdirSync(path.join(staging, "images"), { recursive: true });
  mkdirSync(path.join(staging, "depth"), { recursive: true });
  for (const review of accepted.reviews) {
    const candidate = candidates.get(review.candidateId), receipt = receipts.get(review.candidateId), screening = screenings.get(review.candidateId);
    if (!candidate || !receipt || !screening) throw new TypeError(`Incomplete evidence for ${review.candidateId}`);
    if (existingIds.has(candidate.candidateId) || existingImages.has(receipt.sha256)) throw new TypeError(`Duplicate of an existing artwork: ${candidate.candidateId}`);
    if (VISUAL_SUBJECTS.some((subject) => !["present", "absent", "unknown"].includes(review.facts[subject] ?? ""))) throw new TypeError(`Incomplete facts: ${candidate.candidateId}`);
    if (sha(readFileSync(path.join(ROOT, candidate.recordPath))) !== candidate.recordSha256) throw new TypeError(`Source record changed: ${candidate.candidateId}`);
    const bytes = readFileSync(path.join(ROOT, receipt.path!));
    if (sha(bytes) !== receipt.sha256) throw new TypeError(`Image changed since verification: ${candidate.candidateId}`);
    sources.set(candidate.candidateId, bytes);
    const local = !PUBLIC_IMAGE_HOSTS.has(new URL(receipt.url).hostname);
    const imagePath = local ? `images/${candidate.candidateId}-full.jpg` : receipt.url;
    if (local) writeFileSync(path.join(staging, imagePath), bytes);
    else cachePublicImage(ROOT, { url: receipt.url, sha256: receipt.sha256!, width: receipt.width!, height: receipt.height!, byteLength: receipt.bytes!,
      contentType: "image/jpeg", verifiedAt: receipt.at }, bytes);
    const details = sourceDetails(candidate);
    const subjects = VISUAL_SUBJECTS.filter((subject) => review.facts[subject] === "present");
    const remote: VerifiedRemoteImage | undefined = local ? undefined : { url: receipt.url, sha256: receipt.sha256!, width: receipt.width!, height: receipt.height!,
      byteLength: receipt.bytes!, contentType: "image/jpeg", verifiedAt: receipt.at };
    const aspect = receipt.width! / receipt.height!;
    const record = parseArtworkRecord({
      id: candidate.candidateId, source: candidate.source === "artic" ? "custom" : candidate.source, sourceArtworkId: candidate.sourceArtworkId, version: VERSION,
      metadata: { title: candidate.title, artistDisplayName: candidate.artist, yearLabel: candidate.date, medium: candidate.medium, department: details.department,
        dimensions: details.dimensions, creditLine: details.creditLine, objectUrl: candidate.objectUrl, sourceApiUrl: details.sourceApiUrl,
        descriptionClean: review.observation, storySnippet: review.observation, moodTags: review.moodTags, colorTags: await colourTags(bytes),
        subjectTags: ["Painting", ...subjects], compositionTags: [] },
      presentation: { grade: "A", gradeLabel: "director-focus", motionProfile: "parallax", narrationMode: "caption" },
      retrieval: { searchText: [candidate.title, candidate.artist, candidate.medium, "Painting", review.observation].filter(Boolean).join(". "),
        emotionLabels: review.moodTags, energyLevel: level(screening.arousal, [.35, .6], ["low", "medium", "high"]),
        valence: level(screening.valence, [.4, .65], ["dark", "mixed", "bright"]), pace: level(screening.arousal, [.3, .6], ["still", "gentle", "active"]),
        spaceSense: review.spatialFraming === "open" ? "open" : review.spatialFraming === "enclosed" ? "close" : "balanced" },
      media: { baseImageUrl: imagePath, imageUrlPreview: imagePath, imageUrlFull: imagePath, aspectRatioHint: aspect > 1.15 ? "landscape" : aspect < .87 ? "portrait" : "square",
        visualPresentation: { contentBounds: { x: 0, y: 0, width: 1, height: 1 }, contentAspectRatio: aspect, cropStrategy: "preserve-paper", confidence: 1,
          source: "decoded-preview-image", notes: ["Complete delivered image; no border trimming or artwork crop. Pixel ratio is not a physical size measurement."] },
        hasMotionAsset: false, mediaVersion: VERSION, sourceAssetFingerprint: receipt.sha256, ...(remote ? { verifiedRemoteImage: remote } : {}) },
    });
    if (galleryArtworkDecision({ id: record.id, ...record.metadata }).status !== "eligible") throw new TypeError(`Not gallery-eligible: ${record.id}`);
    records.push(record);
    reviewRows.push({ artworkId: record.id, imagePath, imageSha256: receipt.sha256, reviewedAt: accepted.reviewedAt, reviewer: "local-image-review",
      facts: Object.fromEntries(VISUAL_SUBJECTS.map((subject) => [subject, review.facts[subject]])), spatialFraming: review.spatialFraming, observation: review.observation });
  }

  // Depth from the bundled local model; each row names its model because the base used DA3Mono-Large.
  const estimator = await createLocalDepthEstimator(ROOT);
  const work = path.join(ROOT, ".cache/open-collections/2026-11-16/depth-input");
  mkdirSync(work, { recursive: true });
  try {
    for (const record of records) {
      const bytes = sources.get(record.id)!;
      const input = path.join(work, `${encodeURIComponent(record.id)}.png`);
      await sharp(bytes).rotate().resize({ width: 768, height: 768, fit: "inside", withoutEnlargement: true }).png({ compressionLevel: 1 }).toFile(input);
      const prediction = await estimator.predict(input);
      const normalised = normalizeRelativeDepth(prediction);
      const { width: sw = 0, height: sh = 0 } = await sharp(bytes).metadata();
      const scale = Math.min(1, 1024 / Math.max(sw, sh));
      const width = Math.max(1, Math.round(sw * scale)), height = Math.max(1, Math.round(sh * scale));
      const url = `depth/${encodeURIComponent(record.id)}.png`;
      await sharp(normalised.pixels, { raw: { width: prediction.width, height: prediction.height, channels: 1 } }).resize(width, height, { kernel: "cubic" }).png().toFile(path.join(staging, url));
      record.media.depthMap = { url, version: VERSION, sourceAssetFingerprint: record.media.sourceAssetFingerprint!, method: "model" };
      depthRows.push({ artworkId: record.id, status: "generated", model: { id: LOCAL_DEPTH_MODEL.id, weightsSha256: LOCAL_DEPTH_MODEL.weightsSha256 },
        sourceAssetFingerprint: record.media.sourceAssetFingerprint, modelInputSha256: sha(readFileSync(input)),
        outputSha256: sha(readFileSync(path.join(staging, url))).slice(7), url, width, height, normalization: { low: normalised.low, high: normalised.high } });
      console.log(`depth ${depthRows.length}/${records.length} ${record.id}`);
    }
  } finally { await estimator.dispose(); }

  // Metadata, media, search and hash embeddings carry every record's new version.
  const split = (record: ArtworkRecord) => ({ id: record.id, source: record.source, sourceArtworkId: record.sourceArtworkId, version: record.version });
  const put = (value: any, list: any[]) => Array.isArray(value) ? list : { ...value, records: list };
  writeFileSync(shard("metadata"), JSON.stringify(put(metadata, [...retag(rows(metadata)), ...records.map((r) => ({ ...split(r), metadata: r.metadata, presentation: r.presentation }))])));
  writeFileSync(shard("mediaIndex"), JSON.stringify(put(media, [...retag(rows(media)), ...records.map((r) => ({ ...split(r), media: r.media }))])));
  writeFileSync(shard("search"), JSON.stringify(put(search, [...retag(rows(search)), ...records.map((r) => ({ ...split(r), retrieval: r.retrieval }))])));
  const hashed = await buildEmbeddingRecordsWithProvider(records, { dimensions: rows(embeddings)[0].dimensions });
  writeFileSync(shard("embeddings"), JSON.stringify(put(embeddings, [...retag(rows(embeddings)), ...hashed])));

  // Visual review ledger: new reviews plus the eye-checked corrections to existing ones.
  const ledgerPath = path.join(staging, "visual-reviews.json");
  const ledger = readJson<any>(ledgerPath);
  const corrected = ledger.reviews.map((review: any) => {
    const fix = corrections.corrections.find((item) => item.artworkId === review.artworkId);
    return fix && Object.keys(fix.facts).length ? { ...review, facts: { ...review.facts, ...fix.facts }, reviewedAt: corrections.reviewedAt } : review;
  });
  writeFileSync(ledgerPath, JSON.stringify({ ...ledger, releaseVersion: VERSION, scope: `${ledger.scope} 2026-11-16: ${reviewRows.length} open-collection works added; ${corrections.corrections.length} boat works re-checked for people.`,
    reviews: [...corrected, ...reviewRows] }, null, 1) + "\n");

  // Ledgers bound to a release identity move with it; appearance is re-measured afterwards.
  for (const ledgerName of ["creator-credits.json", "appearance-v2.json"]) {
    const file = path.join(staging, ledgerName);
    if (existsSync(file)) writeFileSync(file, JSON.stringify({ ...readJson<any>(file), releaseVersion: VERSION }, null, 1) + "\n");
  }
  const depthReport = readJson<any>(path.join(staging, "depth-report.json"));
  writeFileSync(path.join(staging, "depth-report.json"), JSON.stringify({ ...depthReport, releaseVersion: VERSION, baseVersion: BASE, createdAt: new Date().toISOString(),
    count: depthReport.count + depthRows.length, artworkCount: depthReport.artworkCount + records.length,
    note: `Base rows keep their DA3Mono-Large maps. ${depthRows.length} added rows were generated locally with ${LOCAL_DEPTH_MODEL.id}; each row names its model.`,
    records: [...depthReport.records, ...depthRows] }, null, 1) + "\n");

  // Manifest, then the semantic index whose fingerprint depends on the new shards.
  const describe = (file: string) => { const body = readFileSync(file); return { checksum: sha(body), sizeBytes: body.length }; };
  manifest.release = { ...manifest.release, corpusVersion: VERSION, createdAt: new Date().toISOString() };
  for (const kind of ["metadata", "mediaIndex", "search", "embeddings"]) {
    const entry = manifest.shards[kind][0];
    manifest.shards[kind][0] = { ...entry, ...describe(shard(kind)), recordCount: existingIds.size + records.length };
  }
  const encoder = createLocalSemanticEncoder({ rootDir: ROOT, allowDownload: false });
  let vectors: number[][] = [];
  try { for (let i = 0; i < records.length; i += 8) vectors.push(...await encoder.embedDocuments(records.slice(i, i + 8).map(artworkToSemanticText))); }
  finally { await encoder.dispose(); }
  writeFileSync(shard("semanticEmbeddings"), JSON.stringify({ ...semantic, releaseVersion: VERSION, sourceFingerprint: semanticSourceFingerprint(manifest),
    records: [...semantic.records, ...records.map((record, i) => ({ artworkId: record.id, textFingerprint: semanticFingerprint(artworkToSemanticText(record)), vector: vectors[i] }))] }));
  const semanticEntry = manifest.shards.semanticEmbeddings[0];
  manifest.shards.semanticEmbeddings[0] = { ...semanticEntry, ...describe(shard("semanticEmbeddings")), recordCount: existingIds.size + records.length };
  writeFileSync(path.join(staging, "manifest.json"), JSON.stringify(manifest, null, 1) + "\n");
  writeFileSync(path.join(staging, "open-collection-report.json"), JSON.stringify({ schemaVersion: 1, releaseVersion: VERSION, baseVersion: BASE,
    added: records.map((record) => ({ id: record.id, gap: accepted.reviews.find((r) => r.candidateId === record.id)!.gap, title: record.metadata.title, artist: record.metadata.artistDisplayName })),
    correctedReviews: corrections.corrections.map((item) => item.artworkId), evidence: "data/sources/open-collections/2026-11-16" }, null, 1) + "\n");
  console.log(JSON.stringify({ staging, added: records.length, total: existingIds.size + records.length }));
  if (process.argv.includes("--activate")) { renameSync(staging, finalDir); console.log(`activated ${VERSION}`); }
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
