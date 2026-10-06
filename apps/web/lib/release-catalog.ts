import { readFileSync } from "node:fs";
import { isGalleryArtwork } from "./artwork-eligibility";
import { matchesViewingIntent, parseViewingIntent, viewingIntentEvidence } from "./viewing-intent";
import { artworkHardConflict } from "./affective-negotiation";

import {
  embedText,
  buildUserAffectAgent,
  loadEmbeddingShards,
  loadReleaseManifest,
  rerankVectorResults,
  resolveShardPath,
  searchVectorIndex,
  type ReleaseLoaderOptions,
} from "@artduo/corpus";
import {
  parseArtworkRecord,
  parseBackgroundSceneRecord,
  type ArtworkRecord,
  type BackgroundSceneRecord,
  type EmbeddingShardRecord,
  type ReleaseManifest,
} from "@artduo/contracts";

export type ExperienceArtworkRecord = Pick<ArtworkRecord, "id" | "source" | "metadata" | "media" | "presentation">;

export interface WebArtworkVisualPresentation {
  contentBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  contentAspectRatio?: number;
  whiteBorderRatio?: number;
  cropStrategy?: "preserve-paper" | "trim-border" | "focus-subject";
  confidence?: number;
  source?: string;
  notes?: string[];
}

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
  visualPresentation?: WebArtworkVisualPresentation;
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
  searchTerms?: string[];
  embeddingText?: string;
}

export interface WebBackgroundSceneEmbeddingRecord {
  id: string;
  sceneId: string;
  model: string;
  dimensions: number;
  text: string;
  vector: number[];
  scene: WebBackgroundScene;
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
  artworkRecords: ExperienceArtworkRecord[];
  artworkRecordById: Map<string, ExperienceArtworkRecord>;
  backgroundScenes: WebBackgroundScene[];
  backgroundSceneRecords: BackgroundSceneRecord[];
  backgroundSceneRecordById: Map<string, BackgroundSceneRecord>;
  backgroundSceneEmbeddingRecords: WebBackgroundSceneEmbeddingRecord[];
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

export interface WebSceneSearchResult {
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
    scene: WebBackgroundScene;
  }>;
}

interface MetadataShardRecord {
  id: string;
  source: string;
  sourceArtworkId: string;
  version: string;
  locale?: string;
  metadata: Record<string, unknown>;
  presentation: Record<string, unknown>;
}

interface SearchShardRecord {
  id: string;
  source: string;
  sourceArtworkId: string;
  version: string;
  retrieval: Record<string, unknown>;
}

interface MediaShardRecord {
  id: string;
  source: string;
  sourceArtworkId: string;
  version: string;
  media: Record<string, unknown>;
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

  return {
    id: readString(record.id, `${path}.id`),
    source: readString(record.source, `${path}.source`),
    sourceArtworkId: readString(record.sourceArtworkId, `${path}.sourceArtworkId`),
    version: readString(record.version, `${path}.version`),
    locale: readOptionalString(record.locale),
    metadata,
    presentation,
  };
}

function parseSearchRecord(value: unknown, path: string): SearchShardRecord {
  const record = expectObject(value, path);
  const retrieval = expectObject(record.retrieval, `${path}.retrieval`);

  return {
    id: readString(record.id, `${path}.id`),
    source: readString(record.source, `${path}.source`),
    sourceArtworkId: readString(record.sourceArtworkId, `${path}.sourceArtworkId`),
    version: readString(record.version, `${path}.version`),
    retrieval,
  };
}

function parseMediaRecord(value: unknown, path: string): MediaShardRecord {
  const record = expectObject(value, path);
  const media = expectObject(record.media, `${path}.media`);

  return {
    id: readString(record.id, `${path}.id`),
    source: readString(record.source, `${path}.source`),
    sourceArtworkId: readString(record.sourceArtworkId, `${path}.sourceArtworkId`),
    version: readString(record.version, `${path}.version`),
    media,
  };
}

function toBackgroundSceneView(scene: BackgroundSceneRecord): WebBackgroundScene {
  const searchText = scene.retrieval_profile?.search_text ?? scene.retrieval_profile?.embedding_text ?? "";
  const searchTerms = scene.retrieval_profile?.search_terms ?? [];
  const embeddingText = scene.retrieval_profile?.embedding_text ?? [
    scene.asset.label_cn,
    scene.visual_profile.scene_type,
    ...scene.visual_profile.mood,
    ...scene.visual_profile.palette,
    ...scene.curation_profile.emotion_ids,
    ...(scene.curation_profile.artwork_palette_modes ?? []),
    searchText,
    ...searchTerms,
  ].filter(Boolean).join(" ");

  return {
    id: scene.id,
    label: scene.asset.label_cn,
    imageUrl: scene.asset.local_public_path,
    sceneType: scene.visual_profile.scene_type,
    moods: scene.visual_profile.mood,
    palette: scene.visual_profile.palette,
    emotionIds: scene.curation_profile.emotion_ids,
    artworkPaletteModes: scene.curation_profile.artwork_palette_modes ?? [],
    searchText,
    searchTerms,
    embeddingText,
  };
}

function indexById<T extends { id: string }>(records: T[]): Map<string, T> {
  const indexed = new Map<string, T>();
  for (const record of records) {
    if (indexed.has(record.id)) {
      throw new TypeError(`Duplicate release record id: ${record.id}`);
    }
    indexed.set(record.id, record);
  }
  return indexed;
}

function toDetailHref(id: string, query?: string, releaseVersion?: string): string {
  const params = new URLSearchParams();
  if (query) {
    params.set("query", query);
  }
  if (releaseVersion) {
    params.set("releaseVersion", releaseVersion);
  }
  const suffix = params.size > 0 ? `?${params.toString()}` : "";

  return `/artwork/${encodeURIComponent(id)}${suffix}`;
}

function assertShardIdentity(
  metadata: MetadataShardRecord,
  shard: SearchShardRecord | MediaShardRecord,
): void {
  if (
    metadata.id !== shard.id ||
    metadata.source !== shard.source ||
    metadata.sourceArtworkId !== shard.sourceArtworkId ||
    metadata.version !== shard.version
  ) {
    throw new TypeError(`${metadata.id}: release shard identity does not match`);
  }
}

function toArtwork(record: ArtworkRecord, releaseVersion: string): WebArtwork {
  const imageUrl = record.media.imageUrlPreview ?? record.media.baseImageUrl ?? record.media.imageUrlFull;
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
    emotionLabels: record.retrieval.emotionLabels,
    keywordBoosts: record.retrieval.keywordBoosts ?? [],
    searchText: record.retrieval.searchText,
    grade: record.presentation.grade,
    gradeLabel: record.presentation.gradeLabel,
    motionProfile: record.presentation.motionProfile,
    sceneAffinity: {
      sceneTypes: sceneAffinity.sceneTypes ?? [],
      paletteModes: sceneAffinity.paletteModes ?? [],
      spatialModes: sceneAffinity.spatialModes ?? [],
      transitionTags: sceneAffinity.transitionTags ?? [],
    },
    imageUrl,
    imageUrlFull: record.media.imageUrlFull,
    aspectRatioHint: record.media.aspectRatioHint,
    visualPresentation: record.media.visualPresentation,
    detailHref: toDetailHref(record.id, undefined, releaseVersion),
  };
}

function toBackgroundSceneEmbeddingRecord(
  scene: WebBackgroundScene,
  dimensions?: number,
): WebBackgroundSceneEmbeddingRecord {
  const text = [
    scene.embeddingText,
    scene.searchText,
    ...(scene.searchTerms ?? []),
    scene.label,
    scene.sceneType,
    ...scene.moods,
    ...scene.palette,
    ...scene.emotionIds,
    ...scene.artworkPaletteModes,
  ].filter((entry): entry is string => Boolean(entry)).join(" ");
  const embedded = embedText(text, { dimensions });

  return {
    id: scene.id,
    sceneId: scene.id,
    model: embedded.model,
    dimensions: embedded.dimensions,
    text,
    vector: embedded.vector,
    scene,
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
    parseBackgroundSceneRecord(entry, `backgroundScenes[${index}]`),
  );
  const backgroundSceneViews = backgroundScenes.map(toBackgroundSceneView);
  const backgroundSceneEmbeddingRecords = backgroundSceneViews.map((scene) =>
    toBackgroundSceneEmbeddingRecord(scene, embeddings.records[0]?.dimensions),
  );

  const artworkRecords = metadata.map((record) => {
    const searchRecord = search.get(record.id);
    const mediaRecord = media.get(record.id);

    if (!searchRecord) {
      throw new Error(`${record.id}: missing search shard record`);
    }
    if (!mediaRecord) {
      throw new Error(`${record.id}: missing media shard record`);
    }

    assertShardIdentity(record, searchRecord);
    assertShardIdentity(record, mediaRecord);

    return parseArtworkRecord({
      ...record,
      retrieval: searchRecord.retrieval,
      media: mediaRecord.media,
    }, `artwork[${record.id}]`);
  });
  const experienceArtworkRecords = artworkRecords.map(({ id, source, metadata, media, presentation }) => ({
    id,
    source,
    metadata,
    media,
    presentation,
  } satisfies ExperienceArtworkRecord));
  const artworks = artworkRecords.map((record) => toArtwork(record, loaded.releaseVersion));

  return {
    manifestPath: loaded.manifestPath,
    releaseDir: loaded.releaseDir,
    releaseVersion: loaded.releaseVersion,
    releaseCreatedAt: loaded.manifest.release.createdAt,
    manifest: loaded.manifest,
    artworkCount: artworks.length,
    backgroundSceneCount: backgroundSceneViews.length,
    artworks,
    artworkById: indexById(artworks),
    artworkRecords: experienceArtworkRecords,
    artworkRecordById: indexById(experienceArtworkRecords),
    backgroundScenes: backgroundSceneViews,
    backgroundSceneRecords: backgroundScenes,
    backgroundSceneRecordById: indexById(backgroundScenes),
    backgroundSceneEmbeddingRecords,
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
  const vectorCandidateCount = options.vectorCandidateCount ?? Math.max(limit * 8, 96);
  const dimensions = catalog.embeddingRecords[0]?.dimensions;
  const intent = parseViewingIntent(query);
  const embedded = embedText(intent.retrievalText, { dimensions });
  const normalizedQuery = embedText(query, { dimensions }).normalizedText;
  const affect = buildUserAffectAgent(query);
  const hardSignals = [...affect.resistances.map((signal) => signal.value), ...affect.visualConstraints.filter((constraint) => constraint.severity === "hard" && constraint.polarity === "avoid").map((constraint) => constraint.value)];

  if (embedded.tokens.length === 0) {
    return {
      query,
      normalizedQuery,
      model: embedded.model,
      dimensions: embedded.dimensions,
      results: [],
    };
  }

  // Filter before candidate truncation: excluded objects must neither fill the
  // exhibition nor consume slots that belong to eligible drawings/paintings.
  const pictureRecords = catalog.embeddingRecords.filter((record) => {
    const artwork = catalog.artworkById.get(record.id);
    return artwork && isGalleryArtwork(artwork) && matchesViewingIntent(artwork, intent) && !artworkHardConflict(artwork, hardSignals);
  });
  const vectorResults = searchVectorIndex(embedded.vector, pictureRecords, {
    limit: pictureRecords.length,
  }).filter((entry, index) => index < vectorCandidateCount || matchesCatalogName(catalog.artworkById.get(entry.item.id)!, query));
  const reranked = rerankVectorResults(intent.retrievalText, vectorResults, {
    getText: (record) => record.text,
    getGrade: (record) => record.grade,
    limit: vectorResults.length,
  }).map((entry) => {
    const artwork = catalog.artworkById.get(entry.item.id)!;
    const evidence = viewingIntentEvidence(artwork, intent);
    const nameMatch = matchesCatalogName(artwork, query);
    return { ...entry, combinedScore: entry.combinedScore + evidence.length * 0.2 + (nameMatch ? 1 : 0), matchedTokens: [...entry.matchedTokens, ...evidence, ...(nameMatch ? ["catalog:name"] : [])] };
  }).sort((a, b) => b.combinedScore - a.combinedScore || a.item.id.localeCompare(b.item.id)).slice(0, Math.max(0, limit)).map((entry, index) => ({ ...entry, rank: index + 1 }));

  return {
    query,
    normalizedQuery,
    model: embedded.model,
    dimensions: embedded.dimensions,
    results: reranked.flatMap((entry) => {
      const artwork = catalog.artworkById.get(entry.item.id);
      if (!artwork) {
        return [];
      }

      const hydratedArtwork = {
        ...artwork,
        detailHref: toDetailHref(artwork.id, query, catalog.releaseVersion),
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

function matchesCatalogName(artwork: WebArtwork, query: string): boolean {
  const name = query.trim().toLocaleLowerCase();
  if (name.length < 2) return false;
  return artwork.title.toLocaleLowerCase() === name || artwork.artistDisplayName?.toLocaleLowerCase() === name
    || artwork.keywordBoosts.some((alias) => alias.toLocaleLowerCase() === name);
}

export function searchBackgroundScenes(
  catalog: WebReleaseCatalog,
  query: string,
  options: {
    limit?: number;
    vectorCandidateCount?: number;
  } = {},
): WebSceneSearchResult {
  const limit = options.limit ?? 12;
  const vectorCandidateCount = options.vectorCandidateCount ?? Math.max(limit * 6, 48);
  const dimensions = catalog.backgroundSceneEmbeddingRecords[0]?.dimensions ?? catalog.embeddingRecords[0]?.dimensions;
  const embedded = embedText(query, { dimensions });

  if (embedded.tokens.length === 0 || catalog.backgroundSceneEmbeddingRecords.length === 0) {
    return {
      query,
      normalizedQuery: embedded.normalizedText,
      model: embedded.model,
      dimensions: embedded.dimensions,
      results: [],
    };
  }

  const vectorResults = searchVectorIndex(embedded.vector, catalog.backgroundSceneEmbeddingRecords, {
    limit: vectorCandidateCount,
  });
  const reranked = rerankVectorResults(query, vectorResults, {
    getText: (record) => record.text,
    limit,
  });

  return {
    query,
    normalizedQuery: embedded.normalizedText,
    model: embedded.model,
    dimensions: embedded.dimensions,
    results: reranked.map((entry) => ({
      rank: entry.rank,
      vectorScore: entry.score,
      lexicalScore: entry.lexicalScore,
      combinedScore: entry.combinedScore,
      matchedTokens: entry.matchedTokens,
      scene: entry.item.scene,
    })),
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
      detailHref: toDetailHref(id, query, catalog.releaseVersion),
    },
    scene: selectBackgroundScene(artwork, catalog.backgroundScenes),
  };
}
