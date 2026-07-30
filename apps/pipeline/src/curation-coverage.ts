import { createHash } from "node:crypto";

import type {
  AspectRatioHint,
  ArtworkRecord,
  BackgroundMatch,
  BackgroundSceneRecord,
  BackgroundScoreBreakdown,
  SceneAffinity,
} from "@artduo/contracts";
import { capImageSceneScoreValues, IMAGE_SCENE_SCORE_CARDINALITY_LIMITS } from "@artduo/contracts";

const DEFAULT_FETCH_TIMEOUT_MS = 15_000;
const DEFAULT_SCENE_MATCH_THRESHOLD = 0.58;
const IMAGE_RANGE_HEADER = "bytes=0-65535";

type ThemeSceneHints = {
  emotionTokens: string[];
  paletteTokens: string[];
  compositionTokens: string[];
};

export interface ImageProbeResult {
  width: number;
  height: number;
  aspectRatioHint: AspectRatioHint;
}

export type ImageProbe = (url: string) => Promise<ImageProbeResult | undefined>;

export interface EnrichedArtworkMatch {
  record: ArtworkRecord;
  matched: boolean;
  topMatches: BackgroundMatch[];
}

export interface OrientationCoverage {
  portrait: number;
  landscape: number;
  square: number;
  unknown: number;
  portraitPercent: number;
  landscapePercent: number;
  squarePercent: number;
  unknownPercent: number;
}

export interface SceneCoverageSummary {
  matchedCount: number;
  matchedPercent: number;
  orientationCoverage: OrientationCoverage;
  sceneMatchThreshold: number;
  sampledMatches: Array<{
    sourceArtworkId: string;
    sceneId: string;
    score: number;
    aspectRatioHint?: AspectRatioHint;
  }>;
}

const THEME_SCENE_HINTS: Record<string, ThemeSceneHints> = {
  contemplation: {
    emotionTokens: ["contemplation", "meditation", "quiet", "introspective", "depth", "balance", "calm"],
    paletteTokens: ["cool-dark", "muted", "warm-neutral", "earthy", "stone", "white", "brown", "silver"],
    compositionTokens: ["centered", "formal", "single-subject", "flat-wall", "open-space"],
  },
  desire: {
    emotionTokens: ["desire", "confidence", "awe", "dramatic", "luxurious", "intimate"],
    paletteTokens: ["jewel-tone", "high-contrast", "warm-metallic", "gold", "emerald", "champagne", "red"],
    compositionTokens: ["centered", "single-subject", "monumental", "layered-room", "framed-wall"],
  },
  hope: {
    emotionTokens: ["hope", "light", "renewal", "warmth", "airy", "calm"],
    paletteTokens: ["gold", "cream", "beige", "light", "warm", "neutral", "pastel"],
    compositionTokens: ["centered", "hero-work", "single-subject", "open", "framed-wall"],
  },
  joy: {
    emotionTokens: ["joy", "playfulness", "optimism", "novelty", "warmth", "cheerful", "welcoming"],
    paletteTokens: ["neutral", "pastel-friendly", "color-pop-friendly", "warm-neutral", "cream", "coral", "red", "pink", "terracotta"],
    compositionTokens: ["centered", "single-subject", "open-space", "flat-wall", "single-hero"],
  },
  wonder: {
    emotionTokens: ["wonder", "awe", "light", "focus", "airy", "amazement"],
    paletteTokens: ["gold", "cream", "blue", "light", "neutral", "bright"],
    compositionTokens: ["centered", "hero-work", "single-subject", "open", "framed-wall"],
  },
  melancholy: {
    emotionTokens: ["melancholy", "calm", "quiet", "intimate", "solemn", "still"],
    paletteTokens: ["umber", "brown", "taupe", "charcoal", "earthy", "muted", "walnut"],
    compositionTokens: ["centered", "single-subject", "close", "framed-wall", "scene-bias"],
  },
  mystery: {
    emotionTokens: ["mystery", "awe", "gravity", "dramatic", "solemn", "focus"],
    paletteTokens: ["charcoal", "umber", "taupe", "marble", "neutral", "low-saturation"],
    compositionTokens: ["centered", "single-subject", "monumental", "scene-bias", "layered-room"],
  },
  serenity: {
    emotionTokens: ["serenity", "calm", "clarity", "peaceful", "warmth", "tranquil"],
    paletteTokens: ["neutral", "monochrome", "pastel-soft", "high-key", "warm-neutral", "luminous", "ivory", "cream", "white", "soft-gray", "beige", "stone"],
    compositionTokens: ["centered", "open-space", "single-subject", "flat-wall", "layered-room"],
  },
};

function compactText(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const compacted = String(value).replace(/\s+/g, " ").trim();
  return compacted || undefined;
}

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function toPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return Number(((numerator / denominator) * 100).toFixed(1));
}

function inferAspectRatioHint(width: number, height: number): AspectRatioHint {
  const ratio = width / height;
  if (ratio > 1.1) {
    return "landscape";
  }
  if (ratio < 0.9) {
    return "portrait";
  }
  return "square";
}

function readPngDimensions(bytes: Uint8Array): ImageProbeResult | undefined {
  if (bytes.length < 24) {
    return undefined;
  }

  const signature = "89504e470d0a1a0a";
  const actualSignature = Buffer.from(bytes.slice(0, 8)).toString("hex");
  if (actualSignature !== signature) {
    return undefined;
  }

  const width = bytes[16] * 2 ** 24 + bytes[17] * 2 ** 16 + bytes[18] * 2 ** 8 + bytes[19];
  const height = bytes[20] * 2 ** 24 + bytes[21] * 2 ** 16 + bytes[22] * 2 ** 8 + bytes[23];
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }

  return {
    width,
    height,
    aspectRatioHint: inferAspectRatioHint(width, height),
  };
}

function readJpegDimensions(bytes: Uint8Array): ImageProbeResult | undefined {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return undefined;
  }

  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    const blockLength = bytes[offset + 2] * 2 ** 8 + bytes[offset + 3];
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);

    if (isStartOfFrame && offset + 8 < bytes.length) {
      const height = bytes[offset + 5] * 2 ** 8 + bytes[offset + 6];
      const width = bytes[offset + 7] * 2 ** 8 + bytes[offset + 8];
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return undefined;
      }

      return {
        width,
        height,
        aspectRatioHint: inferAspectRatioHint(width, height),
      };
    }

    if (!Number.isFinite(blockLength) || blockLength < 2) {
      return undefined;
    }

    offset += 2 + blockLength;
  }

  return undefined;
}

export function parseImageProbeResult(bytes: Uint8Array): ImageProbeResult | undefined {
  return readPngDimensions(bytes) ?? readJpegDimensions(bytes);
}

export async function fetchRemoteImageProbe(url: string): Promise<ImageProbeResult | undefined> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Range: IMAGE_RANGE_HEADER,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return undefined;
    }

    const buffer = new Uint8Array(await response.arrayBuffer());
    return parseImageProbeResult(buffer);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeoutId);
  }
}

function tokenOverlapScore(actual: string[], desired: string[]): number {
  if (desired.length === 0) {
    return 1;
  }
  if (actual.length === 0) {
    return 0;
  }

  const actualSet = new Set(actual);
  const matched = desired.filter((token) => actualSet.has(token));
  return Number((matched.length / desired.length).toFixed(3));
}

function tokenSupportScore(actual: string[], supported: string[]): number {
  if (actual.length === 0) {
    return 0;
  }
  if (supported.length === 0) {
    return 1;
  }

  const supportedSet = new Set(supported);
  const matched = actual.filter((token) => supportedSet.has(token));
  return Number((matched.length / actual.length).toFixed(3));
}

function appendNormalized(values: string[], extras: Array<string | undefined>): string[] {
  return unique(
    [...values, ...extras]
      .map((value) => compactText(value))
      .filter((value): value is string => Boolean(value))
      .map(normalizeToken)
      .filter(Boolean),
  );
}

function getThemeHints(theme: string): ThemeSceneHints {
  return THEME_SCENE_HINTS[normalizeToken(theme)] ?? {
    emotionTokens: [normalizeToken(theme)],
    paletteTokens: [],
    compositionTokens: [],
  };
}

function buildArtworkSceneTokens(record: ArtworkRecord, theme: string) {
  const hints = getThemeHints(theme);

  return {
    emotionTokens: appendNormalized(
      [],
      [...record.retrieval.emotionLabels, ...record.metadata.moodTags, ...hints.emotionTokens],
    ),
    paletteTokens: appendNormalized(
      [],
      [...record.metadata.colorTags, ...hints.paletteTokens],
    ),
    compositionTokens: appendNormalized(
      [],
      [...record.metadata.compositionTags, ...hints.compositionTokens],
    ),
    orientationTokens: record.media.aspectRatioHint ? [normalizeToken(record.media.aspectRatioHint)] : [],
    sourceTokens: [normalizeToken(record.source)],
    gradeTokens: [normalizeToken(record.presentation.grade)],
  };
}

function buildSceneTokens(scene: BackgroundSceneRecord) {
  return {
    emotionTokens: appendNormalized([], [
      ...(scene.curation_profile.emotion_ids ?? []),
      ...(scene.visual_profile.mood ?? []),
    ]),
    paletteTokens: appendNormalized([], [
      ...(scene.curation_profile.artwork_palette_modes ?? []),
      ...(scene.visual_profile.palette ?? []),
    ]),
    compositionTokens: appendNormalized([], [
      ...(scene.curation_profile.artwork_composition_modes ?? []),
      ...(scene.visual_profile.composition ?? []),
      scene.stage_profile.depth_strategy,
    ]),
    orientationTokens: appendNormalized([], [
      ...(scene.curation_profile.artwork_orientation_modes ?? []),
      scene.image_info.orientation,
    ]),
    sourceTokens: appendNormalized([], scene.curation_profile.sources ?? []),
    gradeTokens: appendNormalized([], scene.curation_profile.supported_artwork_grades ?? []),
  };
}

function normalizeOverlayScore(scene: BackgroundSceneRecord): number {
  const readability = scene.ui_profile.overlay_readability === "high"
    ? 1
    : scene.ui_profile.overlay_readability === "medium"
      ? 0.82
      : 0.64;
  const busynessPenalty = Math.min(scene.ui_profile.visual_busyness, 0.8) * 0.25;
  return Number(Math.max(0.35, readability - busynessPenalty).toFixed(3));
}

function normalizeStageScore(scene: BackgroundSceneRecord, grade: string): number {
  const preferredScale = scene.stage_profile.preferred_artwork_scale;
  if (!preferredScale) {
    return 0.75;
  }

  if (grade === "A") {
    return preferredScale === "large" ? 1 : 0.8;
  }

  if (grade === "B") {
    return preferredScale === "medium" || preferredScale === "large" ? 0.92 : 0.75;
  }

  return preferredScale === "small" ? 0.92 : 0.68;
}

function buildBreakdown(record: ArtworkRecord, theme: string, scene: BackgroundSceneRecord): BackgroundScoreBreakdown {
  const artworkTokens = buildArtworkSceneTokens(record, theme);
  const sceneTokens = buildSceneTokens(scene);

  const emotionScore = tokenOverlapScore(artworkTokens.emotionTokens, sceneTokens.emotionTokens);
  const paletteScore = tokenOverlapScore(artworkTokens.paletteTokens, sceneTokens.paletteTokens);
  const compositionScore = tokenOverlapScore(artworkTokens.compositionTokens, sceneTokens.compositionTokens);
  const orientationScore = artworkTokens.orientationTokens.length === 0
    ? 0
    : tokenSupportScore(artworkTokens.orientationTokens, sceneTokens.orientationTokens);
  const gradeScore = sceneTokens.gradeTokens.length === 0
    ? 1
    : tokenSupportScore(artworkTokens.gradeTokens, sceneTokens.gradeTokens);
  const sourceScore = sceneTokens.sourceTokens.length === 0
    ? 1
    : tokenSupportScore(artworkTokens.sourceTokens, sceneTokens.sourceTokens);
  const locationScore = 0.5;
  const uiScore = normalizeOverlayScore(scene);
  const stageScore = normalizeStageScore(scene, record.presentation.grade);

  return {
    emotionScore,
    paletteScore,
    compositionScore,
    orientationScore,
    gradeScore,
    sourceScore,
    locationScore,
    uiScore,
    stageScore,
  };
}

function averageScore(breakdown: BackgroundScoreBreakdown): number {
  const weighted =
    breakdown.emotionScore * 0.22 +
    breakdown.paletteScore * 0.14 +
    breakdown.compositionScore * 0.14 +
    breakdown.orientationScore * 0.16 +
    breakdown.gradeScore * 0.08 +
    breakdown.sourceScore * 0.04 +
    breakdown.locationScore * 0.04 +
    breakdown.uiScore * 0.08 +
    breakdown.stageScore * 0.1;

  return Number(weighted.toFixed(3));
}

function buildRationale(breakdown: BackgroundScoreBreakdown, scene: BackgroundSceneRecord): string[] {
  const reasons: string[] = [];

  if (breakdown.emotionScore >= 0.5) {
    reasons.push(`${scene.id} aligns with the current emotion lane`);
  }
  if (breakdown.orientationScore >= 1) {
    reasons.push(`${scene.id} supports the artwork orientation directly`);
  }
  if (breakdown.uiScore >= 0.8) {
    reasons.push(`${scene.id} preserves readable overlay space`);
  }
  if (breakdown.stageScore >= 0.85) {
    reasons.push(`${scene.id} has a compatible mount zone for the current artwork grade`);
  }

  return reasons;
}

function buildSceneAffinity(matches: BackgroundMatch[], scenesById: Map<string, BackgroundSceneRecord>): SceneAffinity | undefined {
  if (matches.length === 0) {
    return undefined;
  }

  const scenes = matches
    .map((match) => scenesById.get(match.sceneId))
    .filter((scene): scene is BackgroundSceneRecord => Boolean(scene));
  if (scenes.length === 0) {
    return undefined;
  }

  return {
    sceneTypes: capImageSceneScoreValues(
      unique(scenes.map((scene) => scene.visual_profile.scene_type)),
      IMAGE_SCENE_SCORE_CARDINALITY_LIMITS.artworkSceneTypes,
    ),
    paletteModes: capImageSceneScoreValues(
      unique(
        scenes.flatMap((scene) => [
          ...(scene.curation_profile.artwork_palette_modes ?? []),
          ...(scene.visual_profile.palette ?? []),
        ]).map(normalizeToken),
      ),
      IMAGE_SCENE_SCORE_CARDINALITY_LIMITS.artworkPaletteModes,
    ),
    spatialModes: unique(
      scenes.map((scene) => compactText(scene.stage_profile.depth_strategy)).filter((value): value is string => Boolean(value)),
    ).map(normalizeToken).slice(0, 3),
    transitionTags: unique(
      scenes.flatMap((scene) => scene.transition_profile.entry_families ?? []).map(normalizeToken),
    ).slice(0, 4),
  };
}

function maybeUpdateCompositionTags(record: ArtworkRecord, aspectRatioHint?: AspectRatioHint): ArtworkRecord {
  if (!aspectRatioHint) {
    return record;
  }

  const compositionTags = record.metadata.compositionTags.filter(
    (tag) => !["unknown-aspect-ratio", "curated-promote"].includes(normalizeToken(tag)),
  );

  if (aspectRatioHint === "landscape") {
    compositionTags.push("wide-frame", "scene-bias");
  } else if (aspectRatioHint === "portrait") {
    compositionTags.push("single-subject", "portrait-bias");
  } else {
    compositionTags.push("centered", "square-frame");
  }

  return {
    ...record,
    metadata: {
      ...record.metadata,
      compositionTags: unique(compositionTags),
    },
    retrieval: {
      ...record.retrieval,
      spaceSense: aspectRatioHint === "landscape"
        ? "open"
        : aspectRatioHint === "portrait"
          ? "close"
          : "balanced",
    },
  };
}

export function matchArtworkToScenes(
  record: ArtworkRecord,
  theme: string,
  scenes: BackgroundSceneRecord[],
): BackgroundMatch[] {
  return scenes
    .map((scene) => {
      const breakdown = buildBreakdown(record, theme, scene);

      return {
        sceneId: scene.id,
        role: "focus" as const,
        score: averageScore(breakdown),
        breakdown,
        rationale: buildRationale(breakdown, scene),
      };
    })
    .sort((left, right) => right.score - left.score);
}

export async function enrichArtworkForCuration(
  record: ArtworkRecord,
  theme: string,
  scenes: BackgroundSceneRecord[],
  options: {
    imageProbe?: ImageProbe;
    sceneMatchThreshold?: number;
  } = {},
): Promise<EnrichedArtworkMatch> {
  const probe = options.imageProbe ?? fetchRemoteImageProbe;
  const sceneMatchThreshold = options.sceneMatchThreshold ?? DEFAULT_SCENE_MATCH_THRESHOLD;
  const imageUrl = record.media.imageUrlPreview ?? record.media.baseImageUrl ?? record.media.imageUrlFull;
  const probed = !record.media.aspectRatioHint && imageUrl ? await probe(imageUrl) : undefined;
  const aspectRatioHint = record.media.aspectRatioHint ?? probed?.aspectRatioHint;

  let enrichedRecord = aspectRatioHint
    ? {
        ...record,
        media: {
          ...record.media,
          aspectRatioHint,
        },
      }
    : record;

  enrichedRecord = maybeUpdateCompositionTags(enrichedRecord, aspectRatioHint);

  const matches = matchArtworkToScenes(enrichedRecord, theme, scenes);
  const topMatches = matches.slice(0, 3);
  const matched = (topMatches[0]?.score ?? 0) >= sceneMatchThreshold;
  const scenesById = new Map(scenes.map((scene) => [scene.id, scene] as const));

  if (topMatches.length > 0) {
    enrichedRecord = {
      ...enrichedRecord,
      presentation: {
        ...enrichedRecord.presentation,
        sceneAffinity: buildSceneAffinity(topMatches, scenesById),
      },
    };
  }

  return {
    record: enrichedRecord,
    matched,
    topMatches,
  };
}

export function summarizeSceneCoverage(
  records: ArtworkRecord[],
  matches: EnrichedArtworkMatch[],
  sceneMatchThreshold = DEFAULT_SCENE_MATCH_THRESHOLD,
): SceneCoverageSummary {
  const orientationCoverage = records.reduce<OrientationCoverage>((acc, record) => {
    const aspectRatioHint = record.media.aspectRatioHint;
    if (aspectRatioHint === "portrait") {
      acc.portrait += 1;
    } else if (aspectRatioHint === "landscape") {
      acc.landscape += 1;
    } else if (aspectRatioHint === "square") {
      acc.square += 1;
    } else {
      acc.unknown += 1;
    }

    return acc;
  }, {
    portrait: 0,
    landscape: 0,
    square: 0,
    unknown: 0,
    portraitPercent: 0,
    landscapePercent: 0,
    squarePercent: 0,
    unknownPercent: 0,
  });

  const denominator = records.length;
  orientationCoverage.portraitPercent = toPercent(orientationCoverage.portrait, denominator);
  orientationCoverage.landscapePercent = toPercent(orientationCoverage.landscape, denominator);
  orientationCoverage.squarePercent = toPercent(orientationCoverage.square, denominator);
  orientationCoverage.unknownPercent = toPercent(orientationCoverage.unknown, denominator);

  const matchedRows = matches.filter((entry) => (entry.topMatches[0]?.score ?? 0) >= sceneMatchThreshold);
  return {
    matchedCount: matchedRows.length,
    matchedPercent: toPercent(matchedRows.length, records.length),
    orientationCoverage,
    sceneMatchThreshold,
    sampledMatches: matchedRows.slice(0, 10).map((entry) => ({
      sourceArtworkId: entry.record.sourceArtworkId,
      sceneId: entry.topMatches[0]?.sceneId ?? "none",
      score: entry.topMatches[0]?.score ?? 0,
      aspectRatioHint: entry.record.media.aspectRatioHint,
    })),
  };
}

export function buildMatchFingerprint(record: ArtworkRecord, match: BackgroundMatch | undefined): string | undefined {
  if (!match) {
    return undefined;
  }

  return `sha256:${createHash("sha256").update(`${record.id}:${match.sceneId}:${match.score}`).digest("hex")}`;
}
