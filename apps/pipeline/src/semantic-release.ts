import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArtworkRecord, parseReleaseManifest, parseSemanticIndex, type ArtworkRecord, type ReleaseManifest, type SemanticIndex, type ShardInfo } from "@artduo/contracts";
import { assertSafeReleaseVersion, loadReleaseManifest, resolveShardPath } from "@artduo/corpus";
import { createLocalSemanticEncoder, type SemanticEncoder } from "@artduo/corpus/src/local-semantic-provider";
import { semanticArtworkText, semanticFingerprint, semanticSourceFingerprint } from "@artduo/corpus/src/semantic-index";
import { loadSemanticIndex } from "@artduo/corpus/src/semantic-loader";

function writeArtifact(file: string, value: unknown): { checksum: string; sizeBytes: number } {
  const serialized = JSON.stringify(value, null, 2);
  writeFileSync(file, `${serialized}\n`);
  return { checksum: `sha256:${semanticFingerprint(serialized)}`, sizeBytes: Buffer.byteLength(serialized + "\n") };
}
function readArray(manifestPath: string, shards: ShardInfo[]): Array<Record<string, unknown>> {
  return shards.flatMap((shard) => {
    const file = resolveShardPath(manifestPath, shard);
    const raw = JSON.parse(readFileSync(file, "utf8")) as unknown;
    if (!Array.isArray(raw)) throw new TypeError("Expected artwork shard array");
    return raw as Array<Record<string, unknown>>;
  });
}
export function readReleaseArtworks(manifestPath: string, manifest: ReleaseManifest): ArtworkRecord[] {
  const metadata = readArray(manifestPath, manifest.shards.metadata);
  const search = new Map(readArray(manifestPath, manifest.shards.search).map((item) => [item.id, item]));
  const media = new Map(readArray(manifestPath, manifest.shards.mediaIndex).map((item) => [item.id, item]));
  const seen = new Set<string>();
  return metadata.map((item) => {
    const retrieval = search.get(item.id);
    const image = media.get(item.id);
    if (!retrieval || !image || retrieval.version !== item.version || image.version !== item.version) throw new TypeError("Artwork shards do not share one identity and version");
    const artwork = parseArtworkRecord({ ...item, retrieval: retrieval.retrieval, media: image.media });
    if (seen.has(artwork.id)) throw new TypeError("Duplicate artwork identity");
    seen.add(artwork.id);
    return artwork;
  });
}
export function artworkToSemanticText(record: ArtworkRecord): string {
  return semanticArtworkText({ ...record.metadata, description: record.metadata.descriptionClean ?? record.metadata.storySnippet });
}
export async function buildSemanticRelease(options: {
  rootDir: string; baseVersion: string; version: string; outputRoot?: string;
  encoder?: SemanticEncoder; onProgress?: (completed: number, total: number) => void;
}): Promise<{ directory: string; index: SemanticIndex }> {
  const base = loadReleaseManifest({ rootDir: options.rootDir, releaseVersion: options.baseVersion });
  const version = assertSafeReleaseVersion(options.version);
  const directory = path.join(options.outputRoot ?? path.join(options.rootDir, "data", "curation", "preview"), version);
  if (existsSync(directory)) throw new Error("Candidate release already exists; do not overwrite an immutable version");
  const records = readReleaseArtworks(base.manifestPath, base.manifest);
  const texts = records.map(artworkToSemanticText);
  const encoder = options.encoder ?? createLocalSemanticEncoder({ rootDir: options.rootDir, allowDownload: true });
  const vectors: number[][] = [];
  try {
    for (let offset = 0; offset < texts.length; offset += 8) {
      const batch = texts.slice(offset, offset + 8);
      const encoded = await encoder.embedDocuments(batch);
      if (encoded.length !== batch.length) throw new TypeError("Semantic document batch count mismatch");
      vectors.push(...encoded);
      options.onProgress?.(vectors.length, texts.length);
    }
  } finally { if (!options.encoder) await encoder.dispose(); }
  // Validate all inference output before writing any candidate files.
  parseSemanticIndex({ schemaVersion: 1, releaseVersion: version, sourceFingerprint: "pending", model: encoder.model,
    records: records.map((record, position) => ({ artworkId: record.id, textFingerprint: semanticFingerprint(texts[position]), vector: vectors[position] })) });
  mkdirSync(path.dirname(directory), { recursive: true });
  cpSync(base.releaseDir, directory, { recursive: true, errorOnExist: true, force: false });
  const manifest = structuredClone(base.manifest);
  manifest.release.corpusVersion = version;
  manifest.release.createdAt = new Date().toISOString();
  // Keep the previous hash index intact as a separate, model-compatible fallback.
  for (const kind of ["metadata", "search", "mediaIndex", "embeddings"] as const) {
    for (const shard of manifest.shards[kind] ?? []) {
      const destination = resolveShardPath(path.join(directory, "manifest.json"), shard);
      if (!destination.startsWith(directory + path.sep)) throw new TypeError("Shard is outside the candidate release");
      const rows = JSON.parse(readFileSync(destination, "utf8")) as Array<Record<string, unknown>>;
      for (const row of rows) row.version = version;
      Object.assign(shard, writeArtifact(destination, rows));
    }
  }
  const index = parseSemanticIndex({
    schemaVersion: 1, releaseVersion: version, sourceFingerprint: semanticSourceFingerprint(manifest), model: encoder.model,
    records: records.map((record, position) => ({ artworkId: record.id, textFingerprint: semanticFingerprint(texts[position]), vector: vectors[position] })),
  });
  const artifact = writeArtifact(path.join(directory, "semantic-index.json"), index);
  manifest.shards.semanticEmbeddings = [{ id: "semantic-index", url: "./semantic-index.json", ...artifact, recordCount: index.records.length }];
  writeArtifact(path.join(directory, "manifest.json"), parseReleaseManifest(manifest));
  writeArtifact(path.join(directory, "semantic-report.json"), {
    baseVersion: options.baseVersion, releaseVersion: version, model: encoder.model, records: records.length,
    sourceFingerprint: index.sourceFingerprint, indexChecksum: artifact.checksum,
    oldEmbeddingModels: [...new Set(readArray(base.manifestPath, base.manifest.shards.embeddings ?? []).map((record) => record.model))],
    textVersion: encoder.model.textVersion, createdAt: new Date().toISOString(),
  });
  return { directory, index };
}
export function activateSemanticRelease(directory: string, releasesRoot: string): string {
  const manifest = parseReleaseManifest(JSON.parse(readFileSync(path.join(directory, "manifest.json"), "utf8")));
  const records = readReleaseArtworks(path.join(directory, "manifest.json"), manifest);
  const index = loadSemanticIndex({ manifestPath: path.join(directory, "manifest.json"), manifest,
    artworks: records.map((record) => ({ id: record.id, text: artworkToSemanticText(record) })) });
  if (!index) throw new TypeError("Candidate has no semantic index");
  const destination = path.join(releasesRoot, assertSafeReleaseVersion(index.releaseVersion));
  if (existsSync(destination)) throw new Error("Release already exists; refusing replacement");
  renameSync(directory, destination);
  return destination;
}
