import {
  JsonObject,
  expectObject,
  parseArray,
  readBoolean,
  readLiteral,
  readNumber,
  readObject,
  readOptionalLiteral,
  readOptionalNumber,
  readOptionalObject,
  readOptionalString,
  readOptionalStringArray,
  readString,
  readStringArray,
} from "./internal/validation";

export const ARTWORK_SOURCES = ["met", "custom"] as const;
export const ENERGY_LEVELS = ["low", "medium", "high"] as const;
export const VALENCE_LEVELS = ["dark", "mixed", "bright"] as const;
export const PACE_LEVELS = ["still", "gentle", "active"] as const;
export const SPACE_SENSE_LEVELS = ["close", "balanced", "open"] as const;
export const ASPECT_RATIO_HINTS = ["portrait", "landscape", "square"] as const;
export const GRADE_VALUES = ["A", "B", "C"] as const;
export const GRADE_LABELS = ["director-focus", "emotional-pillar", "ambient-bridge"] as const;
export const MOTION_PROFILES = [
  "static",
  "ambient-loop",
  "parallax",
  "zoom",
  "push-in",
  "out-of-frame",
] as const;
export const NARRATION_MODES = ["none", "caption", "voiceover"] as const;

export type ArtworkSource = (typeof ARTWORK_SOURCES)[number];
export type EnergyLevel = (typeof ENERGY_LEVELS)[number];
export type ValenceLevel = (typeof VALENCE_LEVELS)[number];
export type PaceLevel = (typeof PACE_LEVELS)[number];
export type SpaceSense = (typeof SPACE_SENSE_LEVELS)[number];
export type AspectRatioHint = (typeof ASPECT_RATIO_HINTS)[number];
export type ArtworkGrade = (typeof GRADE_VALUES)[number];
export type ArtworkGradeLabel = (typeof GRADE_LABELS)[number];
export type MotionProfile = (typeof MOTION_PROFILES)[number];
export type NarrationMode = (typeof NARRATION_MODES)[number];

export interface ArtworkMetadata {
  title: string;
  artistDisplayName?: string;
  yearLabel?: string;
  medium?: string;
  culture?: string;
  department?: string;
  dimensions?: string;
  creditLine?: string;
  objectUrl?: string;
  sourceApiUrl?: string;
  descriptionRaw?: string;
  descriptionClean?: string;
  storySnippet?: string;
  moodTags: string[];
  colorTags: string[];
  subjectTags: string[];
  compositionTags: string[];
}

export interface ArtworkRetrieval {
  searchText: string;
  searchTextShort?: string;
  emotionLabels: string[];
  energyLevel?: EnergyLevel;
  valence?: ValenceLevel;
  pace?: PaceLevel;
  spaceSense?: SpaceSense;
  keywordBoosts?: string[];
  embeddingRef?: string;
  embedding?: number[];
}

export interface ArtworkMediaRefs {
  baseImageUrl?: string;
  imageUrlPreview?: string;
  imageUrlFull?: string;
  videoUrlMain?: string;
  videoUrlVertical?: string;
  videoUrlCloseup?: string;
  videoPosterUrl?: string;
  aspectRatioHint?: AspectRatioHint;
  hasMotionAsset: boolean;
  mediaVersion?: string;
  sourceAssetFingerprint?: string;
}

export interface FocusTarget {
  x: number;
  y: number;
  radius?: number;
}

export interface SceneAffinity {
  sceneTypes?: string[];
  paletteModes?: string[];
  spatialModes?: string[];
  transitionTags?: string[];
}

export interface ArtworkPresentation {
  grade: ArtworkGrade;
  gradeLabel: ArtworkGradeLabel;
  motionProfile: MotionProfile;
  focusTarget?: FocusTarget;
  narrationMode?: NarrationMode;
  gestureOverlayRef?: string;
  highlightMaskRef?: string;
  sceneAffinity?: SceneAffinity;
}

export interface ArtworkRecord {
  id: string;
  source: ArtworkSource;
  sourceArtworkId: string;
  version: string;
  locale?: string;
  metadata: ArtworkMetadata;
  retrieval: ArtworkRetrieval;
  media: ArtworkMediaRefs;
  presentation: ArtworkPresentation;
}

function parseFocusTarget(value: unknown, path: string): FocusTarget {
  const target = expectObject(value, path);

  return {
    x: readNumber(target, "x", path),
    y: readNumber(target, "y", path),
    radius: readOptionalNumber(target, "radius", path),
  };
}

function parseSceneAffinity(value: unknown, path: string): SceneAffinity {
  const affinity = expectObject(value, path);

  return {
    sceneTypes: readOptionalStringArray(affinity, "sceneTypes", path),
    paletteModes: readOptionalStringArray(affinity, "paletteModes", path),
    spatialModes: readOptionalStringArray(affinity, "spatialModes", path),
    transitionTags: readOptionalStringArray(affinity, "transitionTags", path),
  };
}

function parseArtworkMetadata(value: unknown, path: string): ArtworkMetadata {
  const metadata = expectObject(value, path);

  return {
    title: readString(metadata, "title", path),
    artistDisplayName: readOptionalString(metadata, "artistDisplayName", path),
    yearLabel: readOptionalString(metadata, "yearLabel", path),
    medium: readOptionalString(metadata, "medium", path),
    culture: readOptionalString(metadata, "culture", path),
    department: readOptionalString(metadata, "department", path),
    dimensions: readOptionalString(metadata, "dimensions", path),
    creditLine: readOptionalString(metadata, "creditLine", path),
    objectUrl: readOptionalString(metadata, "objectUrl", path),
    sourceApiUrl: readOptionalString(metadata, "sourceApiUrl", path),
    descriptionRaw: readOptionalString(metadata, "descriptionRaw", path),
    descriptionClean: readOptionalString(metadata, "descriptionClean", path),
    storySnippet: readOptionalString(metadata, "storySnippet", path),
    moodTags: readStringArray(metadata, "moodTags", path),
    colorTags: readStringArray(metadata, "colorTags", path),
    subjectTags: readStringArray(metadata, "subjectTags", path),
    compositionTags: readStringArray(metadata, "compositionTags", path),
  };
}

function parseArtworkRetrieval(value: unknown, path: string): ArtworkRetrieval {
  const retrieval = expectObject(value, path);

  return {
    searchText: readString(retrieval, "searchText", path),
    searchTextShort: readOptionalString(retrieval, "searchTextShort", path),
    emotionLabels: readStringArray(retrieval, "emotionLabels", path),
    energyLevel: readOptionalLiteral(retrieval, "energyLevel", ENERGY_LEVELS, path),
    valence: readOptionalLiteral(retrieval, "valence", VALENCE_LEVELS, path),
    pace: readOptionalLiteral(retrieval, "pace", PACE_LEVELS, path),
    spaceSense: readOptionalLiteral(retrieval, "spaceSense", SPACE_SENSE_LEVELS, path),
    keywordBoosts: readOptionalStringArray(retrieval, "keywordBoosts", path),
    embeddingRef: readOptionalString(retrieval, "embeddingRef", path),
    embedding: (() => {
      const value = retrieval.embedding;
      if (value === undefined) {
        return undefined;
      }

      return parseArray(value, (entry, entryPath) => readNumber({ value: entry }, "value", entryPath), `${path}.embedding`);
    })(),
  };
}

function parseArtworkMediaRefs(value: unknown, path: string): ArtworkMediaRefs {
  const media = expectObject(value, path);

  const parsed: ArtworkMediaRefs = {
    baseImageUrl: readOptionalString(media, "baseImageUrl", path),
    imageUrlPreview: readOptionalString(media, "imageUrlPreview", path),
    imageUrlFull: readOptionalString(media, "imageUrlFull", path),
    videoUrlMain: readOptionalString(media, "videoUrlMain", path),
    videoUrlVertical: readOptionalString(media, "videoUrlVertical", path),
    videoUrlCloseup: readOptionalString(media, "videoUrlCloseup", path),
    videoPosterUrl: readOptionalString(media, "videoPosterUrl", path),
    aspectRatioHint: readOptionalLiteral(media, "aspectRatioHint", ASPECT_RATIO_HINTS, path),
    hasMotionAsset: readBoolean(media, "hasMotionAsset", path),
    mediaVersion: readOptionalString(media, "mediaVersion", path),
    sourceAssetFingerprint: readOptionalString(media, "sourceAssetFingerprint", path),
  };

  if (!parsed.baseImageUrl && !parsed.imageUrlPreview && !parsed.imageUrlFull) {
    throw new TypeError(`${path}: expected at least one image URL`);
  }

  if (!parsed.mediaVersion && !parsed.sourceAssetFingerprint) {
    throw new TypeError(`${path}: expected mediaVersion or sourceAssetFingerprint`);
  }

  return parsed;
}

function parseArtworkPresentation(value: unknown, path: string): ArtworkPresentation {
  const presentation = expectObject(value, path);

  return {
    grade: readLiteral(presentation, "grade", GRADE_VALUES, path),
    gradeLabel: readLiteral(presentation, "gradeLabel", GRADE_LABELS, path),
    motionProfile: readLiteral(presentation, "motionProfile", MOTION_PROFILES, path),
    focusTarget: (() => {
      const focusTarget = readOptionalObject(presentation, "focusTarget", path);
      return focusTarget ? parseFocusTarget(focusTarget, `${path}.focusTarget`) : undefined;
    })(),
    narrationMode: readOptionalLiteral(presentation, "narrationMode", NARRATION_MODES, path),
    gestureOverlayRef: readOptionalString(presentation, "gestureOverlayRef", path),
    highlightMaskRef: readOptionalString(presentation, "highlightMaskRef", path),
    sceneAffinity: (() => {
      const affinity = readOptionalObject(presentation, "sceneAffinity", path);
      return affinity ? parseSceneAffinity(affinity, `${path}.sceneAffinity`) : undefined;
    })(),
  };
}

export function parseArtworkRecord(value: unknown, path = "ArtworkRecord"): ArtworkRecord {
  const record = expectObject(value, path);

  return {
    id: readString(record, "id", path),
    source: readLiteral(record, "source", ARTWORK_SOURCES, path),
    sourceArtworkId: readString(record, "sourceArtworkId", path),
    version: readString(record, "version", path),
    locale: readOptionalString(record, "locale", path),
    metadata: parseArtworkMetadata(readObject(record, "metadata", path), `${path}.metadata`),
    retrieval: parseArtworkRetrieval(readObject(record, "retrieval", path), `${path}.retrieval`),
    media: parseArtworkMediaRefs(readObject(record, "media", path), `${path}.media`),
    presentation: parseArtworkPresentation(readObject(record, "presentation", path), `${path}.presentation`),
  };
}

export function parseArtworkRecords(value: unknown, path = "ArtworkRecord[]"): ArtworkRecord[] {
  return parseArray(value, (entry, entryPath) => parseArtworkRecord(entry, entryPath), path);
}
