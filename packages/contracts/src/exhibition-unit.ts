import {
  expectObject,
  parseArray,
  readLiteral,
  readNumber,
  readOptionalLiteral,
  readOptionalNumber,
  readOptionalObject,
  readString,
} from "./internal/validation";

export const EXHIBITION_ROLES = ["opening", "bridge", "focus", "closing"] as const;
export const DISPLAY_MODES = ["static-frame", "motion-frame", "director-focus"] as const;
export const TRANSITION_FAMILIES = [
  "fade",
  "dissolve",
  "match-cut",
  "depth-push",
  "lateral-pan",
  "light-swell",
  "scale-focus",
] as const;
export const TRANSITION_INTENSITIES = ["soft", "moderate", "dramatic"] as const;
export const IMPLEMENTATION_HINTS = ["auto", "css", "motion", "video", "webgl", "three"] as const;

export type ExhibitionRole = (typeof EXHIBITION_ROLES)[number];
export type DisplayMode = (typeof DISPLAY_MODES)[number];
export type TransitionFamily = (typeof TRANSITION_FAMILIES)[number];
export type TransitionIntensity = (typeof TRANSITION_INTENSITIES)[number];
export type ImplementationHint = (typeof IMPLEMENTATION_HINTS)[number];

export interface TransitionHint {
  family: TransitionFamily;
  durationMs?: number;
  intensity?: TransitionIntensity;
  implementationHint?: ImplementationHint;
}

export interface ExhibitionUnit {
  unitId: string;
  artworkId: string;
  backgroundSceneId: string;
  order: number;
  role: ExhibitionRole;
  displayMode: DisplayMode;
  transitionIn?: TransitionHint;
  transitionOut?: TransitionHint;
}

function parseTransitionHint(value: unknown, path: string): TransitionHint {
  const hint = expectObject(value, path);

  return {
    family: readLiteral(hint, "family", TRANSITION_FAMILIES, path),
    durationMs: readOptionalNumber(hint, "durationMs", path),
    intensity: readOptionalLiteral(hint, "intensity", TRANSITION_INTENSITIES, path),
    implementationHint: readOptionalLiteral(hint, "implementationHint", IMPLEMENTATION_HINTS, path),
  };
}

export function parseExhibitionUnit(value: unknown, path = "ExhibitionUnit"): ExhibitionUnit {
  const unit = expectObject(value, path);
  const transitionIn = readOptionalObject(unit, "transitionIn", path);
  const transitionOut = readOptionalObject(unit, "transitionOut", path);

  return {
    unitId: readString(unit, "unitId", path),
    artworkId: readString(unit, "artworkId", path),
    backgroundSceneId: readString(unit, "backgroundSceneId", path),
    order: readNumber(unit, "order", path),
    role: readLiteral(unit, "role", EXHIBITION_ROLES, path),
    displayMode: readLiteral(unit, "displayMode", DISPLAY_MODES, path),
    transitionIn: transitionIn ? parseTransitionHint(transitionIn, `${path}.transitionIn`) : undefined,
    transitionOut: transitionOut ? parseTransitionHint(transitionOut, `${path}.transitionOut`) : undefined,
  };
}

export function parseExhibitionUnits(value: unknown, path = "ExhibitionUnit[]"): ExhibitionUnit[] {
  return parseArray(value, (entry, entryPath) => parseExhibitionUnit(entry, entryPath), path);
}
