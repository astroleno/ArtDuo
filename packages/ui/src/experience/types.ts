import type {
  ArtworkRecord,
  BackgroundSceneRecord,
  ExhibitionUnit,
  GrowthStageRole,
  TransitionFamily,
  TransitionIntent,
} from "@artduo/contracts";

export const EXPERIENCE_RECIPE_VERSION = "experience-v1" as const;

export interface NarrativeBlock {
  text: string;
  source: "grounded" | "fallback";
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
  scene: BackgroundSceneRecord | null;
  stageId: string | null;
  caption: NarrativeBlock;
  rationale: NarrativeBlock;
  media: {
    previewUrl: string;
    fullUrl: string;
    backgroundUrl?: string;
    depthMapUrl?: string;
  };
  transitionFamily: TransitionFamily;
  displayCategory: "wall-painting" | "object-case" | "architecture-flat";
  retrievalEvidence: { score: number; matchedTokens: string[] };
}

export interface ExhibitionSnapshot {
  schemaVersion: 1;
  recipeVersion: typeof EXPERIENCE_RECIPE_VERSION;
  releaseVersion: string;
  exhibitionId: string;
  query: string;
  title: string;
  preface: NarrativeBlock;
  closing: NarrativeBlock;
  stages: ExperienceStage[];
  units: ExperienceUnit[];
  omittedUnitCount: number;
  /** Validated artwork order supplied by a URL; observations never enter URLs. */
  routeOrder?: string[];
}

export type ExperiencePosition =
  | { phase: "preface" }
  | { phase: "walk"; unitId: string }
  | { phase: "closing"; lastUnitId?: string };

export type ExperiencePhase = ExperiencePosition["phase"];
