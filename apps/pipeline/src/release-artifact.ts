import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ArtworkGrade, ArtworkGradeLabel, ArtworkRecord, MotionProfile, NarrationMode } from "@artduo/contracts";
import {
  parseArtworkRecords,
  parseBackgroundSceneRecords,
  parseReleaseManifest,
  type BackgroundSceneRecord,
  type ReleaseManifest,
  type ShardInfo,
} from "@artduo/contracts";

type LegacyMetadataRecord = {
  id: string;
  title?: string | null;
  artist?: string | null;
  year?: string | null;
  medium?: string | null;
  culture?: string | null;
  department?: string | null;
  classification?: string | null;
  objectName?: string | null;
  objectType?: string | null;
  dimensions?: string | null;
  creditLine?: string | null;
  description?: string | null;
  tags?: Array<{ term?: string | null }> | null;
  qualityScore?: number | null;
  emotion?: {
    id?: string | null;
    en?: string | null;
    keywords?: string[] | null;
  } | null;
};

type LegacySearchRecord = {
  id: string;
  title?: string | null;
  artist?: string | null;
  description?: string | null;
  searchText?: string | null;
  year?: string | null;
  medium?: string | null;
  qualityWeight?: number | null;
  emotion?: {
    id?: string | null;
    en?: string | null;
    keywords?: string[] | null;
  } | null;
};

type LegacyImageRecord = {
  id: string;
  primary?: string | null;
  alternatives?: string[] | null;
  thumbnail?: string | null;
  additionalImages?: string[] | null;
};

export type ArtworkMetadataShardRecord = Pick<
  ArtworkRecord,
  "id" | "source" | "sourceArtworkId" | "version" | "locale" | "metadata" | "presentation"
>;

export type ArtworkSearchShardRecord = Pick<
  ArtworkRecord,
  "id" | "source" | "sourceArtworkId" | "version" | "retrieval"
>;

export type ArtworkMediaIndexRecord = Pick<
  ArtworkRecord,
  "id" | "source" | "sourceArtworkId" | "version" | "media"
>;

export interface ReleaseBuildOptions {
  rootDir?: string;
  outputRoot?: string;
  corpusPath?: string;
  corpusVersion?: string;
  backgroundCatalogVersion?: string;
  contractsVersion?: string;
  limit?: number;
}

export interface ReleaseBuildResult {
  outputDir: string;
  manifestPath: string;
  metadataPath: string;
  searchPath: string;
  mediaIndexPath: string;
  backgroundScenesPath: string;
  records: {
    artworks: ArtworkRecord[];
    metadata: ArtworkMetadataShardRecord[];
    search: ArtworkSearchShardRecord[];
    mediaIndex: ArtworkMediaIndexRecord[];
    backgroundScenes: BackgroundSceneRecord[];
  };
  manifest: ReleaseManifest;
}

const DEFAULT_CONTRACTS_VERSION = "0.1.0";

function resolveRootDir(rootDir?: string): string {
  return rootDir ? path.resolve(rootDir) : path.resolve(process.cwd(), "../..");
}

function resolveOutputRoot(rootDir: string, outputRoot?: string): string {
  return outputRoot ? path.resolve(outputRoot) : path.join(rootDir, "data", "releases");
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function ensureDir(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true });
}

function compactText(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const compacted = String(value).replace(/\s+/g, " ").trim();
  return compacted || undefined;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function inferSourceArtworkId(id: string): string {
  return id.startsWith("met-") ? id.slice(4) : id;
}

function deriveQualityWeight(
  metadata: LegacyMetadataRecord | undefined,
  search: LegacySearchRecord | undefined,
): number {
  return search?.qualityWeight ?? metadata?.qualityScore ?? 0.5;
}

function deriveGrade(weight: number): ArtworkGrade {
  if (weight >= 0.8) {
    return "A";
  }
  if (weight >= 0.6) {
    return "B";
  }
  return "C";
}

function deriveGradeLabel(grade: ArtworkGrade): ArtworkGradeLabel {
  if (grade === "A") {
    return "director-focus";
  }
  if (grade === "B") {
    return "emotional-pillar";
  }
  return "ambient-bridge";
}

function deriveMotionProfile(grade: ArtworkGrade): MotionProfile {
  return grade === "A" ? "ambient-loop" : "static";
}

function deriveNarrationMode(description: string | undefined): NarrationMode {
  return description ? "caption" : "none";
}

function deriveEnergyLevel(emotionId: string | undefined): "low" | "medium" | "high" {
  if (!emotionId) {
    return "medium";
  }

  const high = new Set(["anger", "awe", "desire", "drama", "euphoria", "fear", "surprise", "tension"]);
  const low = new Set(["apathy", "calm", "contemplation", "contentment", "grief", "melancholy", "serenity", "silence"]);

  if (high.has(emotionId)) {
    return "high";
  }
  if (low.has(emotionId)) {
    return "low";
  }
  return "medium";
}

function deriveValence(emotionId: string | undefined): "dark" | "mixed" | "bright" {
  if (!emotionId) {
    return "mixed";
  }

  const dark = new Set(["anger", "despair", "fear", "grief", "loneliness", "melancholy", "regret", "shame"]);
  const bright = new Set(["admiration", "awe", "contentment", "gratitude", "hope", "joy", "love", "relief", "wonder"]);

  if (dark.has(emotionId)) {
    return "dark";
  }
  if (bright.has(emotionId)) {
    return "bright";
  }
  return "mixed";
}

function derivePace(energyLevel: "low" | "medium" | "high"): "still" | "gentle" | "active" {
  if (energyLevel === "low") {
    return "still";
  }
  if (energyLevel === "high") {
    return "active";
  }
  return "gentle";
}

function deriveSpaceSense(description: string | undefined): "close" | "balanced" | "open" {
  if (!description) {
    return "balanced";
  }

  const normalized = description.toLowerCase();
  if (normalized.includes("landscape") || normalized.includes("harbor") || normalized.includes("hall")) {
    return "open";
  }
  if (normalized.includes("portrait") || normalized.includes("close")) {
    return "close";
  }
  return "balanced";
}

function extractColorTags(text: string): string[] {
  const normalized = text.toLowerCase();
  const paletteTerms = [
    "amber",
    "beige",
    "black",
    "blue",
    "brown",
    "charcoal",
    "cream",
    "gold",
    "green",
    "ivory",
    "mahogany",
    "marble",
    "ochre",
    "red",
    "sage",
    "sepia",
    "silver",
    "stone",
    "taupe",
    "terracotta",
    "umber",
    "walnut",
    "white",
    "wood",
    "yellow",
  ];

  const tags = paletteTerms.filter((term) => normalized.includes(term));
  return tags.length > 0 ? tags : ["unknown-palette"];
}

function deriveSubjectTags(metadata: LegacyMetadataRecord): string[] {
  const tagTerms = (metadata.tags ?? [])
    .map((tag) => compactText(tag.term ?? undefined))
    .filter((tag): tag is string => Boolean(tag))
    .slice(0, 5);

  const fallbacks = [metadata.objectName, metadata.objectType, metadata.classification]
    .map((value) => compactText(value ?? undefined))
    .filter((value): value is string => Boolean(value));

  return unique([...tagTerms, ...fallbacks]).slice(0, 6);
}

function deriveCompositionTags(metadata: LegacyMetadataRecord): string[] {
  const tags = deriveSubjectTags(metadata);
  if (tags.length >= 3) {
    return ["dense-figure", "narrative", "single-subject"];
  }
  return ["single-subject", "centered"];
}

function deriveStorySnippet(
  title: string,
  description: string | undefined,
  artistDisplayName: string,
): string {
  if (description) {
    const firstSentence = description.split(/[.!?]/).map((part) => part.trim()).find(Boolean);
    if (firstSentence) {
      return firstSentence.length > 140 ? `${firstSentence.slice(0, 137)}...` : firstSentence;
    }
  }

  return `${title} by ${artistDisplayName}`;
}

function inferAspectRatioHint(dimensions: string | undefined): "portrait" | "landscape" | "square" | undefined {
  if (!dimensions) {
    return undefined;
  }

  const matches = [...dimensions.matchAll(/(\d+(?:\.\d+)?)/g)].map((match) => Number.parseFloat(match[1]));
  if (matches.length < 2) {
    return undefined;
  }

  const [height, width] = matches;
  if (!Number.isFinite(height) || !Number.isFinite(width) || height <= 0 || width <= 0) {
    return undefined;
  }

  const ratio = width / height;
  if (ratio > 1.1) {
    return "landscape";
  }
  if (ratio < 0.9) {
    return "portrait";
  }
  return "square";
}

function buildSourceAssetFingerprint(image: LegacyImageRecord | undefined): string | undefined {
  const source = [
    image?.primary,
    image?.thumbnail,
    ...(image?.alternatives ?? []),
    ...(image?.additionalImages ?? []),
  ]
    .filter((value): value is string => Boolean(value))
    .join("|");

  if (!source) {
    return undefined;
  }

  return `sha256:${createHash("sha256").update(source).digest("hex")}`;
}

function isUsableArtwork(record: ArtworkRecord): boolean {
  return Boolean(
    record.metadata.title &&
      (record.media.baseImageUrl || record.media.imageUrlPreview || record.media.imageUrlFull) &&
      (record.metadata.artistDisplayName || record.metadata.descriptionClean),
  );
}

export function createArtworkRecord(
  metadata: LegacyMetadataRecord,
  search: LegacySearchRecord | undefined,
  image: LegacyImageRecord | undefined,
  version: string,
): ArtworkRecord {
  const sourceArtworkId = inferSourceArtworkId(metadata.id);
  const title = compactText(metadata.title) ?? compactText(search?.title) ?? "Untitled";
  const artistDisplayName = compactText(metadata.artist) ?? compactText(search?.artist) ?? "Unknown Artist";
  const description = compactText(metadata.description) ?? compactText(search?.description);
  const emotionId = compactText(metadata.emotion?.id) ?? compactText(search?.emotion?.id);
  const emotionKeywords = unique(
    [emotionId, metadata.emotion?.en, ...(metadata.emotion?.keywords ?? []), ...(search?.emotion?.keywords ?? [])]
      .map((value) => compactText(value ?? undefined))
      .filter((value): value is string => Boolean(value)),
  );
  const energyLevel = deriveEnergyLevel(emotionId);
  const qualityWeight = deriveQualityWeight(metadata, search);
  const grade = deriveGrade(qualityWeight);
  const medium = compactText(metadata.medium) ?? compactText(search?.medium);
  const searchText =
    compactText(search?.searchText) ??
    [title, artistDisplayName, description, ...emotionKeywords].filter(Boolean).join(" ");
  const sourceAssetFingerprint = buildSourceAssetFingerprint(image);

  return {
    id: metadata.id,
    source: "met",
    sourceArtworkId,
    version,
    metadata: {
      title,
      artistDisplayName,
      yearLabel: compactText(metadata.year) ?? compactText(search?.year),
      medium,
      culture: compactText(metadata.culture),
      department: compactText(metadata.department),
      dimensions: compactText(metadata.dimensions),
      creditLine: compactText(metadata.creditLine),
      objectUrl: `https://www.metmuseum.org/art/collection/search/${sourceArtworkId}`,
      sourceApiUrl: `https://collectionapi.metmuseum.org/public/collection/v1/objects/${sourceArtworkId}`,
      descriptionRaw: description,
      descriptionClean: description,
      storySnippet: deriveStorySnippet(title, description, artistDisplayName),
      moodTags: emotionKeywords.length > 0 ? emotionKeywords.slice(0, 4) : ["unknown-mood"],
      colorTags: extractColorTags([title, medium, description].filter(Boolean).join(" ")),
      subjectTags: deriveSubjectTags(metadata),
      compositionTags: deriveCompositionTags(metadata),
    },
    retrieval: {
      searchText,
      searchTextShort: [title, artistDisplayName].filter(Boolean).join(" "),
      emotionLabels: emotionKeywords.length > 0 ? emotionKeywords.slice(0, 4) : ["unknown-mood"],
      energyLevel,
      valence: deriveValence(emotionId),
      pace: derivePace(energyLevel),
      spaceSense: deriveSpaceSense(description),
      keywordBoosts: deriveSubjectTags(metadata).slice(0, 4),
    },
    media: {
      baseImageUrl: compactText(image?.thumbnail) ?? compactText(image?.primary),
      imageUrlPreview: compactText(image?.thumbnail) ?? compactText(image?.primary),
      imageUrlFull: compactText(image?.primary) ?? compactText(image?.alternatives?.[0]),
      aspectRatioHint: inferAspectRatioHint(compactText(metadata.dimensions)),
      hasMotionAsset: false,
      mediaVersion: version,
      sourceAssetFingerprint,
    },
    presentation: {
      grade,
      gradeLabel: deriveGradeLabel(grade),
      motionProfile: deriveMotionProfile(grade),
      narrationMode: deriveNarrationMode(description),
    },
  };
}

export function toMetadataShardRecord(record: ArtworkRecord): ArtworkMetadataShardRecord {
  return {
    id: record.id,
    source: record.source,
    sourceArtworkId: record.sourceArtworkId,
    version: record.version,
    locale: record.locale,
    metadata: record.metadata,
    presentation: record.presentation,
  };
}

export function toSearchShardRecord(record: ArtworkRecord): ArtworkSearchShardRecord {
  return {
    id: record.id,
    source: record.source,
    sourceArtworkId: record.sourceArtworkId,
    version: record.version,
    retrieval: record.retrieval,
  };
}

export function toMediaIndexRecord(record: ArtworkRecord): ArtworkMediaIndexRecord {
  return {
    id: record.id,
    source: record.source,
    sourceArtworkId: record.sourceArtworkId,
    version: record.version,
    media: record.media,
  };
}

export function loadBackgroundScenes(rootDir: string): BackgroundSceneRecord[] {
  const scenesDir = path.join(rootDir, "public", "artduo-gallery", "scenes");
  const fileNames = readdirSync(scenesDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .sort();

  const scenes = fileNames.map((fileName) => readJsonFile<unknown>(path.join(scenesDir, fileName)));
  return parseBackgroundSceneRecords(scenes);
}

export function loadCuratedArtworkRecords(corpusPath: string, version: string, limit?: number): ArtworkRecord[] {
  const curatedRecords = parseArtworkRecords(readJsonFile<unknown>(corpusPath), corpusPath);
  const source = typeof limit === "number" ? curatedRecords.slice(0, limit) : curatedRecords;

  return source.map((record) => ({
    ...record,
    version,
  }));
}

export function loadArtworkRecords(rootDir: string, version: string, limit?: number, corpusPath?: string): ArtworkRecord[] {
  if (corpusPath) {
    return loadCuratedArtworkRecords(corpusPath, version, limit);
  }

  const metadataPath = path.join(rootDir, "data", "met", "processed", "artworks-metadata.json");
  const searchPath = path.join(rootDir, "data", "met", "processed", "artworks-search.json");
  const imagesPath = path.join(rootDir, "data", "met", "processed", "artworks-images.json");

  const metadataRecords = readJsonFile<LegacyMetadataRecord[]>(metadataPath);
  const searchRecords = new Map(
    readJsonFile<LegacySearchRecord[]>(searchPath).map((record) => [record.id, record] as const),
  );
  const imageRecords = new Map(
    readJsonFile<LegacyImageRecord[]>(imagesPath).map((record) => [record.id, record] as const),
  );

  const source = typeof limit === "number" ? metadataRecords.slice(0, limit) : metadataRecords;
  return source
    .map((metadata) => createArtworkRecord(metadata, searchRecords.get(metadata.id), imageRecords.get(metadata.id), version))
    .filter(isUsableArtwork);
}

function writeJsonFile(filePath: string, data: unknown): ShardInfo {
  const serialized = JSON.stringify(data, null, 2);
  writeFileSync(filePath, `${serialized}\n`);

  return {
    id: path.basename(filePath, path.extname(filePath)),
    url: `./${path.basename(filePath)}`,
    checksum: `sha256:${createHash("sha256").update(serialized).digest("hex")}`,
    sizeBytes: Buffer.byteLength(`${serialized}\n`),
    recordCount: Array.isArray(data) ? data.length : 1,
  };
}

export function buildReleaseArtifact(options: ReleaseBuildOptions = {}): ReleaseBuildResult {
  const rootDir = resolveRootDir(options.rootDir);
  const outputRoot = resolveOutputRoot(rootDir, options.outputRoot);
  const corpusVersion = options.corpusVersion ?? new Date().toISOString().slice(0, 10);
  const backgroundCatalogVersion = options.backgroundCatalogVersion ?? corpusVersion;
  const contractsVersion = options.contractsVersion ?? DEFAULT_CONTRACTS_VERSION;
  const outputDir = path.join(outputRoot, corpusVersion);
  ensureDir(outputDir);

  const artworks = loadArtworkRecords(rootDir, corpusVersion, options.limit, options.corpusPath);
  const backgroundScenes = loadBackgroundScenes(rootDir);
  const metadata = artworks.map(toMetadataShardRecord);
  const search = artworks.map(toSearchShardRecord);
  const mediaIndex = artworks.map(toMediaIndexRecord);

  const metadataPath = path.join(outputDir, "metadata-01.json");
  const searchPath = path.join(outputDir, "search-01.json");
  const mediaIndexPath = path.join(outputDir, "media-01.json");
  const backgroundScenesPath = path.join(outputDir, "background-scenes-01.json");

  const metadataShard = writeJsonFile(metadataPath, metadata);
  const searchShard = writeJsonFile(searchPath, search);
  const mediaIndexShard = writeJsonFile(mediaIndexPath, mediaIndex);
  const backgroundScenesShard = writeJsonFile(backgroundScenesPath, backgroundScenes);

  const manifest: ReleaseManifest = {
    release: {
      corpusVersion,
      backgroundCatalogVersion,
      contractsVersion,
      createdAt: new Date().toISOString(),
    },
    shards: {
      metadata: [{ ...metadataShard, id: "metadata-01" }],
      search: [{ ...searchShard, id: "search-01" }],
      mediaIndex: [{ ...mediaIndexShard, id: "media-01" }],
      backgroundScenes: [{ ...backgroundScenesShard, id: "background-scenes-01" }],
    },
  };

  parseReleaseManifest(manifest);

  const manifestPath = path.join(outputDir, "manifest.json");
  writeJsonFile(manifestPath, manifest);

  return {
    outputDir,
    manifestPath,
    metadataPath,
    searchPath,
    mediaIndexPath,
    backgroundScenesPath,
    records: {
      artworks,
      metadata,
      search,
      mediaIndex,
      backgroundScenes,
    },
    manifest,
  };
}

export function buildReleaseArtifactToTempDir(options: Omit<ReleaseBuildOptions, "outputRoot"> = {}): ReleaseBuildResult {
  const tempDir = path.join(os.tmpdir(), "artduo-pipeline-tests", `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  return buildReleaseArtifact({
    ...options,
    outputRoot: tempDir,
  });
}
