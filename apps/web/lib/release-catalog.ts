import { readFileSync } from "node:fs";

import {
  embedText,
  loadEmbeddingShards,
  loadReleaseManifest,
  rerankVectorResults,
  resolveShardPath,
  searchVectorIndex,
  type ReleaseLoaderOptions,
} from "@artduo/corpus";
import type { EmbeddingShardRecord, ReleaseManifest } from "@artduo/contracts";

export interface WebArtwork {
  id: string;
  title: string;
  artistDisplayName?: string;
  yearLabel?: string;
  medium?: string;
  department?: string;
  objectUrl?: string;
  description?: string;
  storySnippet?: string;
  moodTags: string[];
  colorTags: string[];
  subjectTags: string[];
  compositionTags: string[];
  emotionLabels: string[];
  keywordBoosts: string[];
  searchText: string;
  grade: string;
  gradeLabel: string;
  motionProfile: string;
  sceneAffinity: {
    sceneTypes: string[];
    paletteModes: string[];
    spatialModes: string[];
    transitionTags: string[];
  };
  imageUrl: string;
  imageUrlFull?: string;
  aspectRatioHint?: string;
  detailHref: string;
}

export interface WebBackgroundScene {
  id: string;
  label: string;
  imageUrl?: string;
  sceneType?: string;
  moods: string[];
  palette: string[];
  emotionIds: string[];
  artworkPaletteModes: string[];
  searchText: string;
}

export interface WebReleaseCatalog {
  manifestPath: string;
  releaseDir: string;
  releaseVersion: string;
  releaseCreatedAt: string;
  manifest: ReleaseManifest;
  artworkCount: number;
  backgroundSceneCount: number;
  artworks: WebArtwork[];
  artworkById: Map<string, WebArtwork>;
  backgroundScenes: WebBackgroundScene[];
  embeddingRecords: EmbeddingShardRecord[];
}

export interface WebSearchResult {
  query: string;
  normalizedQuery: string;
  model: string;
  dimensions: number;
  results: Array<{
    rank: number;
    vectorScore: number;
    lexicalScore: number;
    combinedScore: number;
    matchedTokens: string[];
    artwork: WebArtwork;
    scene?: WebBackgroundScene;
  }>;
}

interface MetadataShardRecord {
  id: string;
  metadata: {
    title: string;
    artistDisplayName?: string;
    yearLabel?: string;
    medium?: string;
    department?: string;
    objectUrl?: string;
    descriptionClean?: string;
    storySnippet?: string;
    moodTags?: string[];
    colorTags?: string[];
    subjectTags?: string[];
    compositionTags?: string[];
  };
  presentation: {
    grade?: string;
    gradeLabel?: string;
    motionProfile?: string;
    sceneAffinity?: {
      sceneTypes?: string[];
      paletteModes?: string[];
      spatialModes?: string[];
      transitionTags?: string[];
    };
  };
}

interface SearchShardRecord {
  id: string;
  retrieval: {
    searchText: string;
    searchTextShort?: string;
    emotionLabels?: string[];
    keywordBoosts?: string[];
  };
}

interface MediaShardRecord {
  id: string;
  media: {
    baseImageUrl?: string;
    imageUrlPreview?: string;
    imageUrlFull?: string;
    aspectRatioHint?: string;
  };
}

function expectObject(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path}: expected object`);
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${path}: expected non-empty string`);
  }

  return value;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "");
}

function readJsonArray(filePath: string): unknown[] {
  const value = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  if (!Array.isArray(value)) {
    throw new TypeError(`${filePath}: expected array`);
  }

  return value;
}

function readShardArrays(
  manifestPath: string,
  shardKind: keyof ReleaseManifest["shards"],
  shards: ReleaseManifest["shards"][keyof ReleaseManifest["shards"]],
): unknown[] {
  return (shards ?? []).flatMap((shard) => {
    try {
      return readJsonArray(resolveShardPath(manifestPath, shard));
    } catch (error) {
      const details = error instanceof Error ? `: ${error.message}` : "";
      throw new Error(`Failed to load ${shardKind} shard ${shard.id}${details}`);
    }
  });
}

function parseMetadataRecord(value: unknown, path: string): MetadataShardRecord {
  const record = expectObject(value, path);
  const metadata = expectObject(record.metadata, `${path}.metadata`);
  const presentation = expectObject(record.presentation, `${path}.presentation`);
  const sceneAffinityValue = presentation.sceneAffinity;
  const sceneAffinity = sceneAffinityValue && typeof sceneAffinityValue === "object" && !Array.isArray(sceneAffinityValue)
    ? sceneAffinityValue as Record<string, unknown>
    : {};

  return {
    id: readString(record.id, `${path}.id`),
    metadata: {
      title: readString(metadata.title, `${path}.metadata.title`),
      artistDisplayName: readOptionalString(metadata.artistDisplayName),
      yearLabel: readOptionalString(metadata.yearLabel),
      medium: readOptionalString(metadata.medium),
      department: readOptionalString(metadata.department),
      objectUrl: readOptionalString(metadata.objectUrl),
      descriptionClean: readOptionalString(metadata.descriptionClean),
      storySnippet: readOptionalString(metadata.storySnippet),
      moodTags: readStringArray(metadata.moodTags),
      colorTags: readStringArray(metadata.colorTags),
      subjectTags: readStringArray(metadata.subjectTags),
      compositionTags: readStringArray(metadata.compositionTags),
    },
    presentation: {
      grade: readOptionalString(presentation.grade),
      gradeLabel: readOptionalString(presentation.gradeLabel),
      motionProfile: readOptionalString(presentation.motionProfile),
      sceneAffinity: {
        sceneTypes: readStringArray(sceneAffinity.sceneTypes),
        paletteModes: readStringArray(sceneAffinity.paletteModes),
        spatialModes: readStringArray(sceneAffinity.spatialModes),
        transitionTags: readStringArray(sceneAffinity.transitionTags),
      },
    },
  };
}

function parseSearchRecord(value: unknown, path: string): SearchShardRecord {
  const record = expectObject(value, path);
  const retrieval = expectObject(record.retrieval, `${path}.retrieval`);

  return {
    id: readString(record.id, `${path}.id`),
    retrieval: {
      searchText: readString(retrieval.searchText, `${path}.retrieval.searchText`),
      searchTextShort: readOptionalString(retrieval.searchTextShort),
      emotionLabels: readStringArray(retrieval.emotionLabels),
      keywordBoosts: readStringArray(retrieval.keywordBoosts),
    },
  };
}

function parseMediaRecord(value: unknown, path: string): MediaShardRecord {
  const record = expectObject(value, path);
  const media = expectObject(record.media, `${path}.media`);

  return {
    id: readString(record.id, `${path}.id`),
    media: {
      baseImageUrl: readOptionalString(media.baseImageUrl),
      imageUrlPreview: readOptionalString(media.imageUrlPreview),
      imageUrlFull: readOptionalString(media.imageUrlFull),
      aspectRatioHint: readOptionalString(media.aspectRatioHint),
    },
  };
}

function parseBackgroundScene(value: unknown, path: string): WebBackgroundScene {
  const record = expectObject(value, path);
  const asset = expectObject(record.asset, `${path}.asset`);
  const visualProfile = expectObject(record.visual_profile, `${path}.visual_profile`);
  const curationProfile = expectObject(record.curation_profile, `${path}.curation_profile`);
  const retrievalProfile = expectObject(record.retrieval_profile, `${path}.retrieval_profile`);

  return {
    id: readString(record.id, `${path}.id`),
    label: readOptionalString(asset.label_cn) ?? readString(record.id, `${path}.id`),
    imageUrl: readOptionalString(asset.local_public_path),
    sceneType: readOptionalString(visualProfile.scene_type),
    moods: readStringArray(visualProfile.mood),
    palette: readStringArray(visualProfile.palette),
    emotionIds: readStringArray(curationProfile.emotion_ids),
    artworkPaletteModes: readStringArray(curationProfile.artwork_palette_modes),
    searchText: readOptionalString(retrievalProfile.search_text) ?? "",
  };
}

function indexById<T extends { id: string }>(records: T[]): Map<string, T> {
  return new Map(records.map((record) => [record.id, record]));
}

function toDetailHref(id: string, query?: string): string {
  if (!query) {
    return `/artwork/${encodeURIComponent(id)}`;
  }

  const params = new URLSearchParams({ query });
  return `/artwork/${encodeURIComponent(id)}?${params.toString()}`;
}

function toArtwork(record: MetadataShardRecord, search: SearchShardRecord, media: MediaShardRecord): WebArtwork {
  const imageUrl = media.media.imageUrlPreview ?? media.media.baseImageUrl ?? media.media.imageUrlFull;
  if (!imageUrl) {
    throw new TypeError(`${record.id}: expected at least one image URL`);
  }

  const sceneAffinity = record.presentation.sceneAffinity ?? {};

  return {
    id: record.id,
    title: record.metadata.title,
    artistDisplayName: record.metadata.artistDisplayName,
    yearLabel: record.metadata.yearLabel,
    medium: record.metadata.medium,
    department: record.metadata.department,
    objectUrl: record.metadata.objectUrl,
    description: record.metadata.descriptionClean,
    storySnippet: record.metadata.storySnippet,
    moodTags: record.metadata.moodTags ?? [],
    colorTags: record.metadata.colorTags ?? [],
    subjectTags: record.metadata.subjectTags ?? [],
    compositionTags: record.metadata.compositionTags ?? [],
    emotionLabels: search.retrieval.emotionLabels ?? [],
    keywordBoosts: search.retrieval.keywordBoosts ?? [],
    searchText: search.retrieval.searchText,
    grade: record.presentation.grade ?? "C",
    gradeLabel: record.presentation.gradeLabel ?? "ambient-bridge",
    motionProfile: record.presentation.motionProfile ?? "static",
    sceneAffinity: {
      sceneTypes: sceneAffinity.sceneTypes ?? [],
      paletteModes: sceneAffinity.paletteModes ?? [],
      spatialModes: sceneAffinity.spatialModes ?? [],
      transitionTags: sceneAffinity.transitionTags ?? [],
    },
    imageUrl,
    imageUrlFull: media.media.imageUrlFull,
    aspectRatioHint: media.media.aspectRatioHint,
    detailHref: toDetailHref(record.id),
  };
}

function intersectionSize(left: string[], right: string[]): number {
  const rightSet = new Set(right.map((value) => value.toLowerCase()));
  return left.filter((value) => rightSet.has(value.toLowerCase())).length;
}

export function selectBackgroundScene(
  artwork: WebArtwork,
  backgroundScenes: WebBackgroundScene[],
): WebBackgroundScene | undefined {
  return backgroundScenes
    .map((scene) => ({
      scene,
      score:
        intersectionSize(artwork.moodTags, scene.emotionIds) * 4 +
        intersectionSize(artwork.emotionLabels, scene.emotionIds) * 4 +
        intersectionSize(artwork.sceneAffinity.paletteModes, scene.artworkPaletteModes) * 2 +
        (scene.sceneType && artwork.sceneAffinity.sceneTypes.includes(scene.sceneType) ? 2 : 0) +
        intersectionSize(artwork.colorTags, scene.palette),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.scene.id.localeCompare(right.scene.id);
    })
    .at(0)?.scene;
}

export function loadWebReleaseCatalog(options: ReleaseLoaderOptions = {}): WebReleaseCatalog {
  const loaded = loadReleaseManifest(options);
  const embeddings = loadEmbeddingShards(options);
  const metadata = readShardArrays(loaded.manifestPath, "metadata", loaded.manifest.shards.metadata).map((entry, index) =>
    parseMetadataRecord(entry, `metadata[${index}]`),
  );
  const search = indexById(
    readShardArrays(loaded.manifestPath, "search", loaded.manifest.shards.search).map((entry, index) =>
      parseSearchRecord(entry, `search[${index}]`),
    ),
  );
  const media = indexById(
    readShardArrays(loaded.manifestPath, "mediaIndex", loaded.manifest.shards.mediaIndex).map((entry, index) =>
      parseMediaRecord(entry, `media[${index}]`),
    ),
  );
  const backgroundScenes = readShardArrays(loaded.manifestPath, "backgroundScenes", loaded.manifest.shards.backgroundScenes).map((entry, index) =>
    parseBackgroundScene(entry, `backgroundScenes[${index}]`),
  );

  const artworks = metadata.map((record) => {
    const searchRecord = search.get(record.id);
    const mediaRecord = media.get(record.id);

    if (!searchRecord) {
      throw new Error(`${record.id}: missing search shard record`);
    }
    if (!mediaRecord) {
      throw new Error(`${record.id}: missing media shard record`);
    }

    return toArtwork(record, searchRecord, mediaRecord);
  });

  return {
    manifestPath: loaded.manifestPath,
    releaseDir: loaded.releaseDir,
    releaseVersion: loaded.releaseVersion,
    releaseCreatedAt: loaded.manifest.release.createdAt,
    manifest: loaded.manifest,
    artworkCount: artworks.length,
    backgroundSceneCount: backgroundScenes.length,
    artworks,
    artworkById: indexById(artworks),
    backgroundScenes,
    embeddingRecords: embeddings.records,
  };
}

export function searchReleaseCatalog(
  catalog: WebReleaseCatalog,
  query: string,
  options: {
    limit?: number;
    vectorCandidateCount?: number;
  } = {},
): WebSearchResult {
  const limit = options.limit ?? 12;
  const vectorCandidateCount = options.vectorCandidateCount ?? Math.max(limit * 4, 24);
  const dimensions = catalog.embeddingRecords[0]?.dimensions;
  const embedded = embedText(query, { dimensions });

  if (embedded.tokens.length === 0) {
    return {
      query,
      normalizedQuery: embedded.normalizedText,
      model: embedded.model,
      dimensions: embedded.dimensions,
      results: [],
    };
  }

  const vectorResults = searchVectorIndex(embedded.vector, catalog.embeddingRecords, {
    limit: vectorCandidateCount,
  });
  const reranked = rerankVectorResults(query, vectorResults, {
    getText: (record) => record.text,
    getGrade: (record) => record.grade,
    limit,
  });

  return {
    query,
    normalizedQuery: embedded.normalizedText,
    model: embedded.model,
    dimensions: embedded.dimensions,
    results: reranked.flatMap((entry) => {
      const artwork = catalog.artworkById.get(entry.item.id);
      if (!artwork) {
        return [];
      }

      const hydratedArtwork = {
        ...artwork,
        detailHref: toDetailHref(artwork.id, query),
      };

      return [{
        rank: entry.rank,
        vectorScore: entry.score,
        lexicalScore: entry.lexicalScore,
        combinedScore: entry.combinedScore,
        matchedTokens: entry.matchedTokens,
        artwork: hydratedArtwork,
        scene: selectBackgroundScene(artwork, catalog.backgroundScenes),
      }];
    }),
  };
}

export function getArtworkDetail(
  catalog: WebReleaseCatalog,
  id: string,
  query?: string,
): {
  artwork: WebArtwork;
  scene?: WebBackgroundScene;
} | undefined {
  const artwork = catalog.artworkById.get(id);
  if (!artwork) {
    return undefined;
  }

  return {
    artwork: {
      ...artwork,
      detailHref: toDetailHref(id, query),
    },
    scene: selectBackgroundScene(artwork, catalog.backgroundScenes),
  };
}
