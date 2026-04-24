import type { ArtworkRecord } from "./artwork";
import { GRADE_VALUES, parseArtworkRecord } from "./artwork";
import type { BackgroundSceneRecord } from "./background-scene";
import { parseBackgroundSceneRecord } from "./background-scene";
import { EXHIBITION_ROLES, type ExhibitionRole } from "./exhibition-unit";
import {
  expectObject,
  parseArray,
  readLiteral,
  readNumber,
  readOptionalObject,
  readOptionalStringArray,
  readString,
  readStringArray,
} from "./internal/validation";

export interface LocationSignals {
  countries?: string[];
  cities?: string[];
  regions?: string[];
}

export interface ExhibitionFeatures {
  emotion_ids: string[];
  palette_modes: string[];
  composition_modes: string[];
  orientation_modes: string[];
  artwork_grades: string[];
  source_keys?: string[];
  museum_keys?: string[];
  location_signals?: LocationSignals;
  role?: ExhibitionRole;
}

export interface BackgroundScoreBreakdown {
  emotionScore: number;
  paletteScore: number;
  compositionScore: number;
  orientationScore: number;
  gradeScore: number;
  sourceScore: number;
  locationScore: number;
  uiScore: number;
  stageScore: number;
}

export interface BackgroundMatch {
  sceneId: string;
  role: ExhibitionRole;
  score: number;
  breakdown: BackgroundScoreBreakdown;
  rationale?: string[];
}

export interface BackgroundMatchInput {
  artworks: ArtworkRecord[];
  exhibitionFeatures: ExhibitionFeatures;
  candidateScenes: BackgroundSceneRecord[];
  role: ExhibitionRole;
}

export type BackgroundMatchResult = BackgroundMatch;

function parseLocationSignals(value: unknown, path: string): LocationSignals {
  const location = expectObject(value, path);

  return {
    countries: readOptionalStringArray(location, "countries", path),
    cities: readOptionalStringArray(location, "cities", path),
    regions: readOptionalStringArray(location, "regions", path),
  };
}

export function parseExhibitionFeatures(value: unknown, path = "ExhibitionFeatures"): ExhibitionFeatures {
  const features = expectObject(value, path);
  const locationSignals = readOptionalObject(features, "location_signals", path);

  const artworkGrades = readStringArray(features, "artwork_grades", path);
  artworkGrades.forEach((grade, index) => {
    if (!GRADE_VALUES.includes(grade as (typeof GRADE_VALUES)[number])) {
      throw new TypeError(`${path}.artwork_grades[${index}]: expected one of ${GRADE_VALUES.join(", ")}`);
    }
  });

  return {
    emotion_ids: readStringArray(features, "emotion_ids", path),
    palette_modes: readStringArray(features, "palette_modes", path),
    composition_modes: readStringArray(features, "composition_modes", path),
    orientation_modes: readStringArray(features, "orientation_modes", path),
    artwork_grades: artworkGrades,
    source_keys: readOptionalStringArray(features, "source_keys", path),
    museum_keys: readOptionalStringArray(features, "museum_keys", path),
    location_signals: locationSignals ? parseLocationSignals(locationSignals, `${path}.location_signals`) : undefined,
    role: features.role === undefined ? undefined : readLiteral(features, "role", EXHIBITION_ROLES, path),
  };
}

export function parseBackgroundScoreBreakdown(value: unknown, path = "BackgroundScoreBreakdown"): BackgroundScoreBreakdown {
  const breakdown = expectObject(value, path);

  return {
    emotionScore: readNumber(breakdown, "emotionScore", path),
    paletteScore: readNumber(breakdown, "paletteScore", path),
    compositionScore: readNumber(breakdown, "compositionScore", path),
    orientationScore: readNumber(breakdown, "orientationScore", path),
    gradeScore: readNumber(breakdown, "gradeScore", path),
    sourceScore: readNumber(breakdown, "sourceScore", path),
    locationScore: readNumber(breakdown, "locationScore", path),
    uiScore: readNumber(breakdown, "uiScore", path),
    stageScore: readNumber(breakdown, "stageScore", path),
  };
}

export function parseBackgroundMatch(value: unknown, path = "BackgroundMatch"): BackgroundMatch {
  const match = expectObject(value, path);

  return {
    sceneId: readString(match, "sceneId", path),
    role: readLiteral(match, "role", EXHIBITION_ROLES, path),
    score: readNumber(match, "score", path),
    breakdown: parseBackgroundScoreBreakdown(expectObject(match.breakdown, `${path}.breakdown`), `${path}.breakdown`),
    rationale: readOptionalStringArray(match, "rationale", path),
  };
}

export function parseBackgroundMatchInput(value: unknown, path = "BackgroundMatchInput"): BackgroundMatchInput {
  const input = expectObject(value, path);

  return {
    artworks: parseArray(input.artworks, (entry, entryPath) => parseArtworkRecord(entry, entryPath), `${path}.artworks`),
    exhibitionFeatures: parseExhibitionFeatures(input.exhibitionFeatures, `${path}.exhibitionFeatures`),
    candidateScenes: parseArray(
      input.candidateScenes,
      (entry, entryPath) => parseBackgroundSceneRecord(entry, entryPath),
      `${path}.candidateScenes`,
    ),
    role: readLiteral(input, "role", EXHIBITION_ROLES, path),
  };
}
