import { constants, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { parseReleaseManifest, parseSemanticIndex, type ShardInfo } from "@artduo/contracts";
import { assertSafeReleaseVersion, loadReleaseManifest, resolveShardPath } from "@artduo/corpus";
import { isGalleryArtwork } from "@artduo/corpus/src/artwork-eligibility";
import { createLocalDepthEstimator, LOCAL_DEPTH_MODEL, type DepthEstimator, type DepthPrediction } from "@artduo/corpus/src/local-depth-provider";
import { semanticFingerprint, semanticSourceFingerprint } from "@artduo/corpus/src/semantic-index";
import { loadSemanticIndex } from "@artduo/corpus/src/semantic-loader";
import { artworkToSemanticText, readReleaseArtworks } from "./semantic-release";

export function normalizeRelativeDepth(prediction: DepthPrediction): { pixels: Buffer; low: number; high: number } {
  const { values, width, height } = prediction;
  if (width < 2 || height < 2 || values.length !== width * height || values.some((value) => !Number.isFinite(value))) throw new TypeError("Invalid relative depth field");
  const sorted = Float32Array.from(values).sort();
  const low = sorted[Math.floor(sorted.length * .02)];
  const high = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .98))];
  if (high - low < 1e-6) throw new TypeError("Depth prediction contains no usable spatial variation");
  return { pixels: Buffer.from(values.map((value) => Math.round(Math.max(0, Math.min(1, (value - low) / (high - low))) * 255))), low, high };
}

function writeArtifact(file: string, value: unknown) {
  const text = JSON.stringify(value, null, 2);
  writeFileSync(file, `${text}\n`);
  return { checksum: `sha256:${semanticFingerprint(text)}`, sizeBytes: Buffer.byteLength(text + "\n") };
}
export async function buildModelDepthRelease(options: { rootDir: string; baseVersion: string; version: string; resume?: boolean; estimator?: DepthEstimator; onProgress?: (done: number, total: number, artworkId: string) => void }) {
  const base = loadReleaseManifest({ rootDir: options.rootDir, releaseVersion: options.baseVersion });
  const version = assertSafeReleaseVersion(options.version);
  const directory = path.join(options.rootDir, "data/curation/preview", version);
  if (existsSync(directory) && !options.resume || existsSync(path.join(options.rootDir, "data/releases", version))) throw new Error("Depth release already exists; refusing replacement");
  const progressFile = path.join(directory, "depth-progress.json");
  const baseFingerprint = semanticFingerprint(readFileSync(base.manifestPath));
  const progress = existsSync(progressFile) ? JSON.parse(readFileSync(progressFile, "utf8")) : undefined;
  if (progress && (progress.baseFingerprint !== baseFingerprint || progress.model !== LOCAL_DEPTH_MODEL.weightsSha256 || progress.version !== version)) throw new TypeError("Cannot resume depth from a different source or model");
  if (existsSync(directory) && semanticFingerprint(readFileSync(path.join(directory, "manifest.json"))) !== baseFingerprint) throw new TypeError("Cannot resume after release finalization has begun");
  const records = readReleaseArtworks(base.manifestPath, base.manifest);
  const index = loadSemanticIndex({ manifestPath: base.manifestPath, manifest: base.manifest, artworks: records.map((record) => ({ id: record.id, text: artworkToSemanticText(record) })) });
  if (!index) throw new TypeError("Depth release must preserve a verified semantic index");
  const eligible = records.filter((record) => isGalleryArtwork({ id: record.id, ...record.metadata }));
  const inputs = eligible.map((record) => {
    const url = record.media.imageUrlPreview ?? record.media.baseImageUrl;
    if (!url || /^https?:|^\/|\\|(?:^|\/)\.\.(?:\/|$)/u.test(url)) throw new TypeError(`Depth requires a local, complete preview: ${record.id}`);
    const inputPath = path.resolve(base.releaseDir, url);
    const fingerprint = `sha256:${semanticFingerprint(readFileSync(inputPath))}`;
    if (fingerprint !== record.media.sourceAssetFingerprint) throw new TypeError(`Depth input fingerprint mismatch: ${record.id}`);
    return { record, inputPath, fingerprint };
  });
  const estimator = options.estimator ?? await createLocalDepthEstimator(options.rootDir);
  mkdirSync(path.dirname(directory), { recursive: true });
  // Copy-on-write preserves immutable source files and avoids duplicating large images on APFS.
  if (!existsSync(directory)) cpSync(base.releaseDir, directory, { recursive: true, errorOnExist: true, force: false, mode: constants.COPYFILE_FICLONE });
  mkdirSync(path.join(directory, "depth"), { recursive: true });
  const report: Array<{ artworkId: string; inputSha256: string; outputSha256: string; url: string; width: number; height: number; low: number; high: number }> = [];
  const checkpoint = () => writeArtifact(progressFile, { version, baseFingerprint, model: LOCAL_DEPTH_MODEL.weightsSha256, records: report });
  try {
    for (const { record, inputPath, fingerprint } of inputs) {
      const previous = progress?.records?.find((item: typeof report[number]) => item.artworkId === record.id) as typeof report[number] | undefined;
      if (previous && previous.inputSha256 === fingerprint && previous.url === `depth/${record.id}.png`
        && existsSync(path.join(directory, previous.url)) && semanticFingerprint(readFileSync(path.join(directory, previous.url))) === previous.outputSha256) {
        report.push(previous);
        options.onProgress?.(report.length, inputs.length, `${record.id} (verified existing)`);
        continue;
      }
      const prediction = await estimator.predict(inputPath);
      const { pixels, low, high } = normalizeRelativeDepth(prediction);
      const original = await sharp(inputPath).metadata();
      if (!original.width || !original.height || (original.orientation ?? 1) !== 1) throw new TypeError(`Ambiguous source image geometry: ${record.id}`);
      const url = `depth/${record.id}.png`;
      const outputPath = path.join(directory, url);
      await sharp(pixels, { raw: { width: prediction.width, height: prediction.height, channels: 1 } })
        .resize(original.width, original.height, { kernel: "cubic" }).png().toFile(outputPath);
      const outputSha256 = semanticFingerprint(readFileSync(outputPath));
      report.push({ artworkId: record.id, inputSha256: fingerprint, outputSha256, url, width: original.width, height: original.height, low, high });
      checkpoint();
      options.onProgress?.(report.length, inputs.length, record.id);
    }
  } finally { if (!options.estimator) await estimator.dispose(); }
  const manifest = structuredClone(base.manifest);
  manifest.release.corpusVersion = version;
  manifest.release.createdAt = new Date().toISOString();
  const depths = new Map(report.map((item) => [item.artworkId, item]));
  for (const kind of ["metadata", "search", "mediaIndex", "embeddings"] as const) {
    for (const shard of manifest.shards[kind] ?? []) {
      const file = resolveShardPath(path.join(directory, "manifest.json"), shard);
      const rows = JSON.parse(readFileSync(file, "utf8"));
      for (const row of rows) {
        row.version = version;
        const depth = depths.get(row.id);
        if (kind === "mediaIndex" && depth) row.media.depthMap = { url: depth.url, version, method: "model", sourceAssetFingerprint: depth.inputSha256 };
      }
      Object.assign(shard, writeArtifact(file, rows));
    }
  }
  const nextIndex = parseSemanticIndex({ ...index, releaseVersion: version, sourceFingerprint: semanticSourceFingerprint(manifest) });
  const semanticShard = manifest.shards.semanticEmbeddings![0] as ShardInfo;
  Object.assign(semanticShard, writeArtifact(resolveShardPath(path.join(directory, "manifest.json"), semanticShard), nextIndex));
  writeArtifact(path.join(directory, "manifest.json"), parseReleaseManifest(manifest));
  writeArtifact(path.join(directory, "depth-report.json"), { schemaVersion: 1, baseVersion: options.baseVersion, releaseVersion: version,
    model: LOCAL_DEPTH_MODEL, normalization: "per-image 2nd–98th percentile, complete original image, cubic resize, no crop", count: report.length, records: report });
  // Re-read every contract and semantic identity before making this candidate activatable.
  const verified = readReleaseArtworks(path.join(directory, "manifest.json"), manifest);
  loadSemanticIndex({ manifestPath: path.join(directory, "manifest.json"), manifest, artworks: verified.map((record) => ({ id: record.id, text: artworkToSemanticText(record) })) });
  return { directory, report };
}
