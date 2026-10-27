import { constants, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { parseReleaseManifest, parseSemanticIndex } from "@artduo/contracts";
import { assertSafeReleaseVersion, loadReleaseManifest, resolveShardPath } from "@artduo/corpus";
import { isGalleryArtwork } from "@artduo/corpus/src/artwork-eligibility";
import { semanticFingerprint, semanticSourceFingerprint } from "@artduo/corpus/src/semantic-index";
import { loadSemanticIndex } from "@artduo/corpus/src/semantic-loader";
import { artworkToSemanticText, readReleaseArtworks } from "./semantic-release";

interface ImportedDepthRecord {
  artworkId: string;
  status: "imported" | "retained";
  sourceFilename: string | null;
  sourceAssetFingerprint: string;
  modelInputSha256: null;
  previousOutputSha256: string;
  outputSha256: string;
  url: string;
  width: number;
  height: number;
}

function writeArtifact(file: string, value: unknown) {
  const text = JSON.stringify(value, null, 2);
  writeFileSync(file, `${text}\n`);
  return { checksum: `sha256:${semanticFingerprint(text)}`, sizeBytes: Buffer.byteLength(text + "\n") };
}

function releaseFile(directory: string, relative: string): string {
  const filename = path.resolve(directory, relative);
  if (!filename.startsWith(path.resolve(directory) + path.sep) || /[?#\\]/u.test(relative)) throw new TypeError(`Invalid release asset path: ${relative}`);
  return filename;
}

/** Import supplied PNGs without inference, resampling, renormalization, or changing an existing release. */
export async function buildImportedDepthRelease(options: {
  rootDir: string; baseVersion: string; version: string; inputDir: string; modelId: string; expectedCount: number;
  excludedArtworkIds?: readonly string[];
}) {
  const base = loadReleaseManifest({ rootDir: options.rootDir, releaseVersion: options.baseVersion });
  const version = assertSafeReleaseVersion(options.version);
  const directory = path.join(options.rootDir, "data/curation/preview", version);
  if (existsSync(directory) || existsSync(path.join(options.rootDir, "data/releases", version))) throw new Error("Depth release already exists; refusing replacement");
  if (!Number.isSafeInteger(options.expectedCount) || options.expectedCount < 1 || !options.modelId.trim()) throw new TypeError("Provide an explicit positive expected count and model name");
  const sourceRecords = readReleaseArtworks(base.manifestPath, base.manifest);
  const excluded = new Set(options.excludedArtworkIds ?? []);
  if (excluded.size !== (options.excludedArtworkIds?.length ?? 0) || [...excluded].some(id => !sourceRecords.some(record => record.id === id))) throw new TypeError("Excluded artwork identities must be unique and present in the source release");
  const records = sourceRecords.filter(record => !excluded.has(record.id));
  if (!records.length) throw new TypeError("Cannot remove every artwork from a release");
  const index = loadSemanticIndex({ manifestPath: base.manifestPath, manifest: base.manifest,
    artworks: sourceRecords.map(record => ({ id: record.id, text: artworkToSemanticText(record) })) });
  if (!index) throw new TypeError("Depth import must preserve a verified semantic index");
  const eligible = records.filter(record => isGalleryArtwork({ id: record.id, ...record.metadata }));
  const byId = new Map(eligible.map(record => [record.id, record]));
  const previousReportPath = path.join(base.releaseDir, "depth-report.json");
  const previousReport = JSON.parse(readFileSync(previousReportPath, "utf8"));
  const previousDepths = new Map<string, { artworkId: string; outputSha256: string; width: number; height: number }>(
    previousReport.records.map((row: { artworkId: string }) => [row.artworkId, row]));
  const incoming = new Map<string, { filename: string; bytes: Buffer; width: number; height: number }>();
  for (const entry of readdirSync(options.inputDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === ".DS_Store") continue;
    if (!entry.isFile() || !entry.name.endsWith(".png")) throw new TypeError(`Expected a regular depth PNG: ${entry.name}`);
    const stem = entry.name.slice(0, -4);
    const id = byId.has(stem) ? stem : decodeURIComponent(stem);
    if (!byId.has(id) || incoming.has(id)) throw new TypeError(`Unknown or duplicate artwork depth: ${entry.name}`);
    const bytes = readFileSync(path.join(options.inputDir, entry.name));
    const metadata = await sharp(bytes).metadata();
    if (metadata.format !== "png" || metadata.channels !== 1 || metadata.depth !== "uchar" || !metadata.width || !metadata.height
      || Math.min(metadata.width, metadata.height) < 2 || Math.max(metadata.width, metadata.height) > 4096 || (metadata.orientation ?? 1) !== 1) {
      throw new TypeError(`Depth must be an 8-bit grayscale PNG with unambiguous geometry: ${id}`);
    }
    const channel = (await sharp(bytes).stats()).channels[0]!;
    if (channel.max - channel.min < 8) throw new TypeError(`Depth has no usable spatial variation: ${id}`);
    const previous = previousDepths.get(id);
    if (!previous || Math.abs(metadata.width / metadata.height / (previous.width / previous.height) - 1) >= .005) throw new TypeError(`Depth aspect ratio differs from the complete image: ${id}`);
    incoming.set(id, { filename: entry.name, bytes, width: metadata.width, height: metadata.height });
  }
  if (incoming.size !== options.expectedCount) throw new TypeError(`Expected ${options.expectedCount} imported depth maps, found ${incoming.size}`);

  // Check every previous asset and source binding before creating the candidate.
  const report: ImportedDepthRecord[] = eligible.map(record => {
    const ref = record.media.depthMap;
    const previous = previousDepths.get(record.id);
    if (!ref || ref.version !== base.releaseVersion || ref.sourceAssetFingerprint !== record.media.sourceAssetFingerprint || !previous) throw new TypeError(`Unbound previous depth: ${record.id}`);
    const previousOutputSha256 = semanticFingerprint(readFileSync(releaseFile(base.releaseDir, ref.url)));
    if (previousOutputSha256 !== previous.outputSha256) throw new TypeError(`Previous depth checksum mismatch: ${record.id}`);
    const replacement = incoming.get(record.id);
    return { artworkId: record.id, status: replacement ? "imported" : "retained", sourceFilename: replacement?.filename ?? null,
      sourceAssetFingerprint: ref.sourceAssetFingerprint, modelInputSha256: null, previousOutputSha256,
      outputSha256: replacement ? semanticFingerprint(replacement.bytes) : previousOutputSha256,
      url: ref.url, width: replacement?.width ?? previous.width, height: replacement?.height ?? previous.height };
  });
  const embeddedCredits = path.join(base.releaseDir, "creator-credits.json");
  const externalCredits = path.resolve(base.releaseDir, "../../curation/public-url-import", base.releaseVersion, "creator-credits.json");
  const creditFile = existsSync(embeddedCredits) ? embeddedCredits : externalCredits;
  const credits = existsSync(creditFile) ? JSON.parse(readFileSync(creditFile, "utf8")) : undefined;
  if (credits && (credits.schemaVersion !== 1 || credits.releaseVersion !== base.releaseVersion || !Array.isArray(credits.entries))) throw new TypeError("Invalid creator credit ledger");
  const legacyCredits = path.join(options.rootDir, "data/curation/public-url-import", version, "creator-credits.json");
  if (credits && existsSync(legacyCredits)) throw new Error("Creator credit ledger already exists; refusing replacement");

  const assets = (record: typeof sourceRecords[number]) => [record.media.baseImageUrl, record.media.imageUrlPreview, record.media.imageUrlFull, record.media.depthMap?.url]
    .filter((url): url is string => Boolean(url) && !/^https?:/u.test(url!)).map(url => releaseFile(base.releaseDir, url));
  const retainedAssets = new Set(records.flatMap(assets));
  const removedAssets = new Set(sourceRecords.filter(record => excluded.has(record.id)).flatMap(assets).filter(file => !retainedAssets.has(file)));
  const historicalArtifacts = new Set(["depth-history", "recovery-evidence", "verified-import-report.json"]);

  mkdirSync(path.dirname(directory), { recursive: true });
  // APFS clones keep original images immutable without duplicating their storage.
  // Old depth files are excluded; only the explicitly retained maps are copied below.
  cpSync(base.releaseDir, directory, { recursive: true, errorOnExist: true, force: false, mode: constants.COPYFILE_FICLONE,
    filter: source => path.relative(base.releaseDir, source) !== "depth" && path.basename(source) !== ".DS_Store"
      && !removedAssets.has(source) && !(excluded.size && historicalArtifacts.has(path.relative(base.releaseDir, source))) });
  for (const item of report) {
    const destination = releaseFile(directory, item.url);
    mkdirSync(path.dirname(destination), { recursive: true });
    const replacement = incoming.get(item.artworkId);
    if (replacement) writeFileSync(destination, replacement.bytes);
    else copyFileSync(releaseFile(base.releaseDir, item.url), destination, constants.COPYFILE_FICLONE);
    if (semanticFingerprint(readFileSync(destination)) !== item.outputSha256) throw new TypeError(`Copied depth checksum mismatch: ${item.artworkId}`);
  }
  const manifest = structuredClone(base.manifest);
  manifest.release.corpusVersion = version;
  manifest.release.createdAt = new Date().toISOString();
  const depths = new Map(report.map(item => [item.artworkId, item]));
  for (const kind of ["metadata", "search", "mediaIndex", "embeddings"] as const) {
    for (const shard of manifest.shards[kind] ?? []) {
      const file = releaseFile(directory, shard.url);
      const rows = JSON.parse(readFileSync(file, "utf8")).filter((row: { id: string }) => !excluded.has(row.id));
      for (const row of rows) {
        row.version = version;
        const depth = depths.get(row.id);
        if (kind === "mediaIndex" && depth) row.media.depthMap = { url: depth.url, version, method: "model", sourceAssetFingerprint: depth.sourceAssetFingerprint };
      }
      Object.assign(shard, writeArtifact(file, rows), { recordCount: rows.length });
    }
  }
  const nextIndex = parseSemanticIndex({ ...index, releaseVersion: version, sourceFingerprint: semanticSourceFingerprint(manifest),
    records: index.records.filter(record => !excluded.has(record.artworkId)) });
  Object.assign(manifest.shards.semanticEmbeddings![0]!, writeArtifact(releaseFile(directory, manifest.shards.semanticEmbeddings![0]!.url), nextIndex), { recordCount: nextIndex.records.length });
  const reviewsFile = path.join(directory, "visual-reviews.json");
  if (existsSync(reviewsFile)) {
    const reviews = JSON.parse(readFileSync(reviewsFile, "utf8"));
    if (reviews.releaseVersion !== base.releaseVersion) throw new TypeError("Visual review ledger version mismatch");
    writeArtifact(reviewsFile, { ...reviews, releaseVersion: version, reviews: reviews.reviews.filter((row: { artworkId: string }) => !excluded.has(row.artworkId)) });
  }
  // Make corrected creator credits portable with the release; preserve their evidence unchanged.
  if (credits) writeArtifact(path.join(directory, "creator-credits.json"), { ...credits, releaseVersion: version,
    entries: credits.entries.filter((row: { artworkId: string }) => !excluded.has(row.artworkId)) });
  let previousReportUrl = `../${base.releaseVersion}/depth-report.json`;
  if (!excluded.size) {
    const history = path.join(directory, "depth-history");
    mkdirSync(history, { recursive: true });
    copyFileSync(previousReportPath, path.join(history, `${base.releaseVersion}.json`), constants.COPYFILE_FICLONE);
    previousReportUrl = `depth-history/${base.releaseVersion}.json`;
  }
  const importedCount = report.filter(item => item.status === "imported").length;
  const summary = { schemaVersion: 2, baseVersion: base.releaseVersion, releaseVersion: version,
    createdAt: manifest.release.createdAt, baseManifestSha256: semanticFingerprint(readFileSync(base.manifestPath)),
    model: { id: options.modelId, provenance: "user-declared", revision: null, weightsSha256: null },
    representation: "relative-inverse-depth; lighter is nearer; no metric units",
    normalization: "unknown upstream; imported bytes preserved without conversion",
    sourceBinding: "artwork filename and complete-image aspect ratio; upstream inference input hashes/settings were not supplied",
    previousReport: previousReportUrl, previousReportSha256: semanticFingerprint(readFileSync(previousReportPath)),
    excludedArtworkIds: [...excluded].sort(), artworkCount: records.length,
    validation: "PNG decode, grayscale format, geometry, spatial variation and SHA-256; not a full visual review",
    count: report.length, importedCount, retainedCount: report.length - importedCount,
    retainedIds: report.filter(item => item.status === "retained").map(item => item.artworkId), records: report };
  writeArtifact(path.join(directory, "depth-report.json"), summary);
  writeArtifact(path.join(directory, "manifest.json"), parseReleaseManifest(manifest));
  const manifestPath = path.join(directory, "manifest.json");
  const verified = readReleaseArtworks(manifestPath, manifest);
  loadSemanticIndex({ manifestPath, manifest, artworks: verified.map(record => ({ id: record.id, text: artworkToSemanticText(record) })) });
  for (const shards of Object.values(manifest.shards)) for (const shard of shards ?? []) {
    const text = readFileSync(resolveShardPath(manifestPath, shard), "utf8");
    if (`sha256:${semanticFingerprint(text.trimEnd())}` !== shard.checksum || Buffer.byteLength(text) !== shard.sizeBytes) throw new TypeError(`Shard integrity mismatch: ${shard.id}`);
  }
  // Already-running older app builds still resolve this external ledger.
  if (credits) {
    mkdirSync(path.dirname(legacyCredits), { recursive: true });
    copyFileSync(path.join(directory, "creator-credits.json"), legacyCredits, constants.COPYFILE_FICLONE | constants.COPYFILE_EXCL);
  }
  return { directory, report: summary };
}
