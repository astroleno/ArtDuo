import {
  JsonObject,
  expectObject,
  parseArray,
  readBoolean,
  readLiteral,
  readNumber,
  readObject,
  readOptionalBoolean,
  readOptionalLiteral,
  readOptionalNumber,
  readOptionalObject,
  readOptionalString,
  readOptionalStringArray,
  readString,
  readStringArray,
} from "./internal/validation";
import { IMPLEMENTATION_HINTS, TRANSITION_FAMILIES, type ImplementationHint, type TransitionFamily } from "./exhibition-unit";

export const BACKGROUND_SCENE_TYPES = [
  "gallery_interior",
  "museum_hall",
  "architectural_space",
  "editorial_space",
  "abstract_atmosphere",
] as const;
export const BACKGROUND_ASPECT_RATIOS = ["16:9", "3:2", "4:3", "1:1", "9:16", "custom"] as const;
export const BACKGROUND_ORIENTATIONS = ["landscape", "portrait", "square"] as const;
export const BACKGROUND_DENSITIES = ["low", "medium", "high"] as const;
export const OVERLAY_READABILITIES = ["low", "medium", "high"] as const;
export const MOBILE_CROP_TOLERANCES = ["poor", "fair", "good", "excellent"] as const;
export const PREFERRED_ARTWORK_SCALES = ["small", "medium", "large"] as const;
export const DEPTH_STRATEGIES = ["flat-wall", "layered-room", "corridor", "window-lit"] as const;
export const DOMINANT_AXES = ["center", "left-to-right", "right-to-left", "forward-depth"] as const;
export const TRANSITION_TEMPOS = ["slow", "medium", "fast"] as const;
export const BACKGROUND_TRANSITION_INTENSITIES = ["soft", "moderate", "dramatic"] as const;
export const PARSED_BY_VALUES = ["vlm", "manual", "hybrid"] as const;

export type BackgroundSceneType = (typeof BACKGROUND_SCENE_TYPES)[number];
export type BackgroundAspectRatio = (typeof BACKGROUND_ASPECT_RATIOS)[number];
export type BackgroundOrientation = (typeof BACKGROUND_ORIENTATIONS)[number];
export type BackgroundDensity = (typeof BACKGROUND_DENSITIES)[number];
export type OverlayReadability = (typeof OVERLAY_READABILITIES)[number];
export type MobileCropTolerance = (typeof MOBILE_CROP_TOLERANCES)[number];
export type PreferredArtworkScale = (typeof PREFERRED_ARTWORK_SCALES)[number];
export type DepthStrategy = (typeof DEPTH_STRATEGIES)[number];
export type DominantAxis = (typeof DOMINANT_AXES)[number];
export type TransitionTempo = (typeof TRANSITION_TEMPOS)[number];
export type BackgroundTransitionIntensity = (typeof BACKGROUND_TRANSITION_INTENSITIES)[number];
export type ParsedBy = (typeof PARSED_BY_VALUES)[number];

export interface BackgroundSceneAsset {
  original_filename: string;
  suggested_filename?: string;
  local_public_path: string;
  label_cn: string;
  label_en?: string;
  asset_group?: string;
  metadata_version?: string;
}

export interface BackgroundImageInfo {
  width?: number;
  height?: number;
  aspect_ratio?: BackgroundAspectRatio;
  orientation?: BackgroundOrientation;
}

export interface BackgroundVisualProfile {
  scene_type: BackgroundSceneType;
  styles: string[];
  materials: string[];
  lighting: string[];
  mood: string[];
  palette: string[];
  composition: string[];
  negative_space_level?: BackgroundDensity;
  space_depth?: "flat" | "layered" | "deep";
  focal_density?: BackgroundDensity;
  reference_inference?: string[];
}

export interface BackgroundLocationAffinity {
  countries?: string[];
  cities?: string[];
  regions?: string[];
}

export interface BackgroundCurationProfile {
  emotion_ids: string[];
  art_styles?: string[];
  art_style_ids?: string[];
  time_periods?: string[];
  time_period_ids?: string[];
  media_types?: string[];
  cultural_contexts?: string[];
  departments?: string[];
  classifications?: string[];
  sources?: string[];
  museum_keys?: string[];
  location_affinity?: BackgroundLocationAffinity;
  artwork_subject_modes?: string[];
  artwork_palette_modes?: string[];
  artwork_composition_modes?: string[];
  artwork_orientation_modes?: string[];
  supported_artwork_grades?: string[];
  preferred_unit_roles?: string[];
  avoid?: string[];
}

export interface BackgroundUiProfile {
  overlay_readability: OverlayReadability;
  safe_text_zones: string[];
  mobile_crop_tolerance: MobileCropTolerance;
  visual_busyness: number;
}

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface NormalizedZone {
  shape: "rect" | "polygon";
  rect?: NormalizedRect;
  points?: NormalizedPoint[];
}

export interface BackgroundStageProfile {
  primary_mount_zone: NormalizedZone;
  secondary_mount_zones?: NormalizedZone[];
  preferred_artwork_scale?: PreferredArtworkScale;
  wall_visibility?: BackgroundDensity;
  depth_strategy?: DepthStrategy;
  dominant_axis?: DominantAxis;
  vanishing_point?: NormalizedPoint;
}

export interface BackgroundTransitionBias {
  palette_bridge?: boolean;
  light_bridge?: boolean;
  axis_bridge?: boolean;
  depth_bridge?: boolean;
}

export interface BackgroundTransitionProfile {
  entry_families: TransitionFamily[];
  exit_families: TransitionFamily[];
  transition_tempo?: TransitionTempo;
  transition_intensity?: BackgroundTransitionIntensity;
  implementation_hint?: ImplementationHint;
  continuity_bias?: BackgroundTransitionBias;
  bridge_tokens?: string[];
}

export interface BackgroundRetrievalProfile {
  search_text?: string;
  search_terms?: string[];
  embedding_text?: string;
}

export interface BackgroundParseMeta {
  parsed_by?: ParsedBy;
  parser_model?: string;
  parsed_at?: string;
  needs_review?: boolean;
}

export interface BackgroundSceneRecord {
  id: string;
  asset: BackgroundSceneAsset;
  image_info: BackgroundImageInfo;
  visual_profile: BackgroundVisualProfile;
  curation_profile: BackgroundCurationProfile;
  ui_profile: BackgroundUiProfile;
  stage_profile: BackgroundStageProfile;
  transition_profile: BackgroundTransitionProfile;
  retrieval_profile?: BackgroundRetrievalProfile;
  parse_meta?: BackgroundParseMeta;
  confidence?: number;
}

function parsePoint(value: unknown, path: string): NormalizedPoint {
  const point = expectObject(value, path);

  return {
    x: readNumber(point, "x", path),
    y: readNumber(point, "y", path),
  };
}

function parseRect(value: unknown, path: string): NormalizedRect {
  const rect = expectObject(value, path);

  return {
    x: readNumber(rect, "x", path),
    y: readNumber(rect, "y", path),
    width: readNumber(rect, "width", path),
    height: readNumber(rect, "height", path),
  };
}

function parseZone(value: unknown, path: string): NormalizedZone {
  const zone = expectObject(value, path);
  const shape = readLiteral(zone, "shape", ["rect", "polygon"] as const, path);
  const rect = readOptionalObject(zone, "rect", path);
  const points = zone.points === undefined ? undefined : parseArray(zone.points, (entry, entryPath) => parsePoint(entry, entryPath), `${path}.points`);

  if (shape === "rect" && !rect) {
    throw new TypeError(`${path}: rect zones require rect coordinates`);
  }

  if (shape === "polygon" && (!points || points.length < 3)) {
    throw new TypeError(`${path}: polygon zones require at least 3 points`);
  }

  return {
    shape,
    rect: rect ? parseRect(rect, `${path}.rect`) : undefined,
    points,
  };
}

function parseAsset(value: unknown, path: string): BackgroundSceneAsset {
  const asset = expectObject(value, path);

  return {
    original_filename: readString(asset, "original_filename", path),
    suggested_filename: readOptionalString(asset, "suggested_filename", path),
    local_public_path: readString(asset, "local_public_path", path),
    label_cn: readString(asset, "label_cn", path),
    label_en: readOptionalString(asset, "label_en", path),
    asset_group: readOptionalString(asset, "asset_group", path),
    metadata_version: readOptionalString(asset, "metadata_version", path),
  };
}

function parseImageInfo(value: unknown, path: string): BackgroundImageInfo {
  const imageInfo = expectObject(value, path);

  return {
    width: readOptionalNumber(imageInfo, "width", path),
    height: readOptionalNumber(imageInfo, "height", path),
    aspect_ratio: readOptionalLiteral(imageInfo, "aspect_ratio", BACKGROUND_ASPECT_RATIOS, path),
    orientation: readOptionalLiteral(imageInfo, "orientation", BACKGROUND_ORIENTATIONS, path),
  };
}

function parseVisualProfile(value: unknown, path: string): BackgroundVisualProfile {
  const visual = expectObject(value, path);

  return {
    scene_type: readLiteral(visual, "scene_type", BACKGROUND_SCENE_TYPES, path),
    styles: readStringArray(visual, "styles", path),
    materials: readStringArray(visual, "materials", path),
    lighting: readStringArray(visual, "lighting", path),
    mood: readStringArray(visual, "mood", path),
    palette: readStringArray(visual, "palette", path),
    composition: readStringArray(visual, "composition", path),
    negative_space_level: readOptionalLiteral(visual, "negative_space_level", BACKGROUND_DENSITIES, path),
    space_depth: readOptionalLiteral(visual, "space_depth", ["flat", "layered", "deep"] as const, path),
    focal_density: readOptionalLiteral(visual, "focal_density", BACKGROUND_DENSITIES, path),
    reference_inference: readOptionalStringArray(visual, "reference_inference", path),
  };
}

function parseLocationAffinity(value: unknown, path: string): BackgroundLocationAffinity {
  const location = expectObject(value, path);

  return {
    countries: readOptionalStringArray(location, "countries", path),
    cities: readOptionalStringArray(location, "cities", path),
    regions: readOptionalStringArray(location, "regions", path),
  };
}

function parseCurationProfile(value: unknown, path: string): BackgroundCurationProfile {
  const curation = expectObject(value, path);
  const locationAffinity = readOptionalObject(curation, "location_affinity", path);

  return {
    emotion_ids: readStringArray(curation, "emotion_ids", path),
    art_styles: readOptionalStringArray(curation, "art_styles", path),
    art_style_ids: readOptionalStringArray(curation, "art_style_ids", path),
    time_periods: readOptionalStringArray(curation, "time_periods", path),
    time_period_ids: readOptionalStringArray(curation, "time_period_ids", path),
    media_types: readOptionalStringArray(curation, "media_types", path),
    cultural_contexts: readOptionalStringArray(curation, "cultural_contexts", path),
    departments: readOptionalStringArray(curation, "departments", path),
    classifications: readOptionalStringArray(curation, "classifications", path),
    sources: readOptionalStringArray(curation, "sources", path),
    museum_keys: readOptionalStringArray(curation, "museum_keys", path),
    location_affinity: locationAffinity ? parseLocationAffinity(locationAffinity, `${path}.location_affinity`) : undefined,
    artwork_subject_modes: readOptionalStringArray(curation, "artwork_subject_modes", path),
    artwork_palette_modes: readOptionalStringArray(curation, "artwork_palette_modes", path),
    artwork_composition_modes: readOptionalStringArray(curation, "artwork_composition_modes", path),
    artwork_orientation_modes: readOptionalStringArray(curation, "artwork_orientation_modes", path),
    supported_artwork_grades: readOptionalStringArray(curation, "supported_artwork_grades", path),
    preferred_unit_roles: readOptionalStringArray(curation, "preferred_unit_roles", path),
    avoid: readOptionalStringArray(curation, "avoid", path),
  };
}

function parseUiProfile(value: unknown, path: string): BackgroundUiProfile {
  const ui = expectObject(value, path);

  return {
    overlay_readability: readLiteral(ui, "overlay_readability", OVERLAY_READABILITIES, path),
    safe_text_zones: readStringArray(ui, "safe_text_zones", path),
    mobile_crop_tolerance: readLiteral(ui, "mobile_crop_tolerance", MOBILE_CROP_TOLERANCES, path),
    visual_busyness: readNumber(ui, "visual_busyness", path),
  };
}

function parseStageProfile(value: unknown, path: string): BackgroundStageProfile {
  const stage = expectObject(value, path);
  const secondaryZones = stage.secondary_mount_zones === undefined
    ? undefined
    : parseArray(stage.secondary_mount_zones, (entry, entryPath) => parseZone(entry, entryPath), `${path}.secondary_mount_zones`);
  const vanishingPoint = readOptionalObject(stage, "vanishing_point", path);

  return {
    primary_mount_zone: parseZone(readObject(stage, "primary_mount_zone", path), `${path}.primary_mount_zone`),
    secondary_mount_zones: secondaryZones,
    preferred_artwork_scale: readOptionalLiteral(stage, "preferred_artwork_scale", PREFERRED_ARTWORK_SCALES, path),
    wall_visibility: readOptionalLiteral(stage, "wall_visibility", BACKGROUND_DENSITIES, path),
    depth_strategy: readOptionalLiteral(stage, "depth_strategy", DEPTH_STRATEGIES, path),
    dominant_axis: readOptionalLiteral(stage, "dominant_axis", DOMINANT_AXES, path),
    vanishing_point: vanishingPoint ? parsePoint(vanishingPoint, `${path}.vanishing_point`) : undefined,
  };
}

function parseTransitionBias(value: unknown, path: string): BackgroundTransitionBias {
  const bias = expectObject(value, path);

  return {
    palette_bridge: readOptionalBoolean(bias, "palette_bridge", path),
    light_bridge: readOptionalBoolean(bias, "light_bridge", path),
    axis_bridge: readOptionalBoolean(bias, "axis_bridge", path),
    depth_bridge: readOptionalBoolean(bias, "depth_bridge", path),
  };
}

function parseTransitionFamilies(source: JsonObject, key: string, path: string): TransitionFamily[] {
  return readStringArray(source, key, path).map((family, index) => {
    if (!TRANSITION_FAMILIES.includes(family as TransitionFamily)) {
      throw new TypeError(`${path}.${key}[${index}]: expected one of ${TRANSITION_FAMILIES.join(", ")}`);
    }

    return family as TransitionFamily;
  });
}

function parseTransitionProfile(value: unknown, path: string): BackgroundTransitionProfile {
  const transition = expectObject(value, path);
  const continuityBias = readOptionalObject(transition, "continuity_bias", path);

  return {
    entry_families: parseTransitionFamilies(transition, "entry_families", path),
    exit_families: parseTransitionFamilies(transition, "exit_families", path),
    transition_tempo: readOptionalLiteral(transition, "transition_tempo", TRANSITION_TEMPOS, path),
    transition_intensity: readOptionalLiteral(
      transition,
      "transition_intensity",
      BACKGROUND_TRANSITION_INTENSITIES,
      path,
    ),
    implementation_hint: readOptionalLiteral(transition, "implementation_hint", IMPLEMENTATION_HINTS, path),
    continuity_bias: continuityBias ? parseTransitionBias(continuityBias, `${path}.continuity_bias`) : undefined,
    bridge_tokens: readOptionalStringArray(transition, "bridge_tokens", path),
  };
}

function parseRetrievalProfile(value: unknown, path: string): BackgroundRetrievalProfile {
  const retrieval = expectObject(value, path);

  return {
    search_text: readOptionalString(retrieval, "search_text", path),
    search_terms: readOptionalStringArray(retrieval, "search_terms", path),
    embedding_text: readOptionalString(retrieval, "embedding_text", path),
  };
}

function parseParseMeta(value: unknown, path: string): BackgroundParseMeta {
  const meta = expectObject(value, path);

  return {
    parsed_by: readOptionalLiteral(meta, "parsed_by", PARSED_BY_VALUES, path),
    parser_model: readOptionalString(meta, "parser_model", path),
    parsed_at: readOptionalString(meta, "parsed_at", path),
    needs_review: readOptionalBoolean(meta, "needs_review", path),
  };
}

export function parseBackgroundSceneRecord(value: unknown, path = "BackgroundSceneRecord"): BackgroundSceneRecord {
  const scene = expectObject(value, path);
  const retrieval = readOptionalObject(scene, "retrieval_profile", path);
  const parseMeta = readOptionalObject(scene, "parse_meta", path);

  return {
    id: readString(scene, "id", path),
    asset: parseAsset(readObject(scene, "asset", path), `${path}.asset`),
    image_info: parseImageInfo(readObject(scene, "image_info", path), `${path}.image_info`),
    visual_profile: parseVisualProfile(readObject(scene, "visual_profile", path), `${path}.visual_profile`),
    curation_profile: parseCurationProfile(readObject(scene, "curation_profile", path), `${path}.curation_profile`),
    ui_profile: parseUiProfile(readObject(scene, "ui_profile", path), `${path}.ui_profile`),
    stage_profile: parseStageProfile(readObject(scene, "stage_profile", path), `${path}.stage_profile`),
    transition_profile: parseTransitionProfile(readObject(scene, "transition_profile", path), `${path}.transition_profile`),
    retrieval_profile: retrieval ? parseRetrievalProfile(retrieval, `${path}.retrieval_profile`) : undefined,
    parse_meta: parseMeta ? parseParseMeta(parseMeta, `${path}.parse_meta`) : undefined,
    confidence: readOptionalNumber(scene, "confidence", path),
  };
}

export function parseBackgroundSceneRecords(value: unknown, path = "BackgroundSceneRecord[]"): BackgroundSceneRecord[] {
  return parseArray(value, (entry, entryPath) => parseBackgroundSceneRecord(entry, entryPath), path);
}
