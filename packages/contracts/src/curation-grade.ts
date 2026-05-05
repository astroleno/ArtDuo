import {
  GRADE_LABELS,
  GRADE_VALUES,
  MOTION_PROFILES,
  type ArtworkGrade,
  type ArtworkGradeLabel,
  type FocusTarget,
  type MotionProfile,
} from "./artwork";
import {
  DISPLAY_MODES,
  TRANSITION_INTENSITIES,
  type DisplayMode,
  type TransitionIntensity,
} from "./exhibition-unit";
import {
  expectObject,
  readBoolean,
  readLiteral,
  readNumber,
  readOptionalNumber,
  readOptionalObject,
  readOptionalString,
  readString,
  readStringArray,
} from "./internal/validation";

export interface CurationGradeProfile {
  artworkId: string;
  grade: ArtworkGrade;
  gradeLabel: ArtworkGradeLabel;
  displayStrategy: DisplayMode;
  rank: number;
  score: number;
  reasons: string[];
}

export interface MotionPlaybackProfile {
  artworkId: string;
  grade: ArtworkGrade;
  motionProfile: MotionProfile;
  displayStrategy: DisplayMode;
  transitionIntensity: TransitionIntensity;
  usesDynamicMedia: boolean;
  mediaUrl?: string;
  posterUrl?: string;
  focusTarget?: FocusTarget;
}

function parseFocusTarget(value: unknown, path: string): FocusTarget {
  const target = expectObject(value, path);

  return {
    x: readNumber(target, "x", path),
    y: readNumber(target, "y", path),
    radius: readOptionalNumber(target, "radius", path),
  };
}

export function parseCurationGradeProfile(value: unknown, path = "CurationGradeProfile"): CurationGradeProfile {
  const profile = expectObject(value, path);

  return {
    artworkId: readString(profile, "artworkId", path),
    grade: readLiteral(profile, "grade", GRADE_VALUES, path),
    gradeLabel: readLiteral(profile, "gradeLabel", GRADE_LABELS, path),
    displayStrategy: readLiteral(profile, "displayStrategy", DISPLAY_MODES, path),
    rank: readNumber(profile, "rank", path),
    score: readNumber(profile, "score", path),
    reasons: readStringArray(profile, "reasons", path),
  };
}

export function parseMotionPlaybackProfile(value: unknown, path = "MotionPlaybackProfile"): MotionPlaybackProfile {
  const profile = expectObject(value, path);
  const focusTarget = readOptionalObject(profile, "focusTarget", path);

  return {
    artworkId: readString(profile, "artworkId", path),
    grade: readLiteral(profile, "grade", GRADE_VALUES, path),
    motionProfile: readLiteral(profile, "motionProfile", MOTION_PROFILES, path),
    displayStrategy: readLiteral(profile, "displayStrategy", DISPLAY_MODES, path),
    transitionIntensity: readLiteral(profile, "transitionIntensity", TRANSITION_INTENSITIES, path),
    usesDynamicMedia: readBoolean(profile, "usesDynamicMedia", path),
    mediaUrl: readOptionalString(profile, "mediaUrl", path),
    posterUrl: readOptionalString(profile, "posterUrl", path),
    focusTarget: focusTarget ? parseFocusTarget(focusTarget, `${path}.focusTarget`) : undefined,
  };
}
