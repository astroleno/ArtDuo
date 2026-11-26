import type {
  ArtworkRecord,
  BackgroundSceneRecord,
  ExhibitionUnit,
  GrowthStageRole,
  SpatialFraming,
  TransitionFamily,
  TransitionIntent,
} from "@artduo/contracts";

export const EXPERIENCE_RECIPE_VERSION = "experience-v1" as const;
export type SculptureBridgeTheme = "music" | "drapery";

export interface NarrativeBlock {
  text: string;
  source: "grounded" | "fallback";
}

export interface DetailNavigation {
  slow: boolean;
  onCancel: () => void;
}

/** Display roles verified against source metadata; null means no author is confirmed. */
export interface ArtworkDisplayCredits {
  artistDisplayName: string | null;
  publishers: string[];
}

export interface ExperienceStage {
  id: string;
  role: GrowthStageRole;
  label: string;
  valence: number;
  arousal: number;
  tension: number;
  wonder: number;
  intimacy: number;
  intensity: number;
  transitionIntent: TransitionIntent;
}

export interface ExperienceUnit {
  exhibition: ExhibitionUnit;
  artwork: Pick<ArtworkRecord, "id" | "source" | "metadata" | "media" | "presentation">;
  displayCredits?: ArtworkDisplayCredits;
  appearance?: { meanLightness: number; chroma: number };
  scene: BackgroundSceneRecord | null;
  stageId: string | null;
  caption: NarrativeBlock;
  rationale: NarrativeBlock;
  /** Frozen artwork-specific narrative, independent from adaptive route rationale. */
  curatorNote?: NarrativeBlock;
  /** Exact-image observation that can close a reordered exhibition. */
  closingObservation?: NarrativeBlock;
  media: {
    previewUrl: string;
    fullUrl: string;
    backgroundUrl?: string;
    backgroundUrlSmall?: string;
    roomLightMaps?: { depthUrl: string; normalUrl: string };
    depthMapUrl?: string;
  };
  transitionFamily: TransitionFamily;
  displayCategory: "wall-painting" | "object-case" | "architecture-flat";
  retrievalEvidence: { score: number; matchedTokens: string[] };
  /** Framing from the exact-image observation, when verified. */
  spatialFraming?: SpatialFraming;
  sculptureBridgeThemes?: SculptureBridgeTheme[];
  sceneMatch?: SceneMatchEvidence;
}

export interface ExperienceSceneCandidate {
  scene: BackgroundSceneRecord;
  imageUrl: string;
  imageUrlSmall?: string;
  lightMaps?: { depthUrl: string; normalUrl: string };
  /** Curated from the existing room photograph, not inferred from a visitor. */
  paletteFamilies: string[];
  lightDirection: "left" | "right" | "top";
  /** Hand-tagged from the room photograph: overall light, colour temperature and what the windows show. */
  tone?: { brightness: number; warmth: number; view: "none" | "garden" | "city" };
}

export interface SceneMatchScore {
  sceneId: string;
  total: number;
  palette: number;
  materialAndLight: number;
  composition: number;
  wallSpace: number;
  atmosphere: number;
  reasons: string[];
}

export interface SceneMatchEvidence {
  version: "wall-fit-v1" | "chapter-wall-v2" | "chapter-wall-v3" | "chapter-wall-v4";
  selectedSceneId: string;
  lightDirection: ExperienceSceneCandidate["lightDirection"];
  continuedRoom: boolean;
  candidates: SceneMatchScore[];
  chapter?: { index: number; count: number; start: number; end: number; reason: "opening" | "chapter-change" | "only-suitable-room" | "continued-stage" };
}

export interface ExhibitionSnapshot {
  schemaVersion: 1;
  recipeVersion: typeof EXPERIENCE_RECIPE_VERSION | "experience-v2";
  curationId?: string;
  narrativeComplete?: boolean;
  narrativePending?: boolean;
  releaseVersion: string;
  exhibitionId: string;
  query: string;
  /** Audience wording for confirmed etching; links and identifiers still use the saved query. */
  presentationQuery?: string;
  title: string;
  preface: NarrativeBlock;
  closing: NarrativeBlock;
  stages: ExperienceStage[];
  units: ExperienceUnit[];
  omittedUnitCount: number;
  /** Request/count feedback, separate from the exhibition's generated prose. */
  selectionNotice?: string;
  emptyAlternative?: { kind: "unoccupied-still-life" | "unrecorded-plate-etching"; query: string; eligible: number; requested: number };
  /** Validated artwork order supplied by a URL; observations never enter URLs. */
  routeOrder?: string[];
  sceneCandidates?: ExperienceSceneCandidate[];
  audioTracks?: string[];
}

export type ExperiencePosition =
  | { phase: "preface" }
  | { phase: "walk"; unitId: string }
  | { phase: "closing"; lastUnitId?: string };

export type ExperiencePhase = ExperiencePosition["phase"];
