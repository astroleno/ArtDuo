import { resolveTransitionModule, type TransitionFamily, type TransitionModule, type TransitionRegistry } from "../transitions/registry";

export interface ImmersiveAffectState {
  valence: number;
  arousal: number;
  tension: number;
  wonder: number;
  intimacy: number;
}

export type ImmersiveGrowthStageRole = "threshold" | "mirror" | "turn" | "release" | "afterglow";
export type ImmersiveTransitionIntent = "fade" | "drift" | "push" | "hold" | "return";

export interface ImmersiveGalleryUnit {
  id: string;
  title: string;
  detailHref?: string;
  artistDisplayName?: string;
  yearLabel?: string;
  imageUrl: string;
  imageUrlFull?: string;
  aspectRatioHint?: string;
  backgroundSceneUrl?: string;
  sceneLabel?: string;
  sceneMatchReason?: string;
  sceneRouteLabel?: string;
  stageLabel?: string;
  stageTone?: string;
  emotionalIntensity?: number;
  growthStageId?: string;
  growthStageRole?: ImmersiveGrowthStageRole;
  affectState?: ImmersiveAffectState;
  transitionIntent?: ImmersiveTransitionIntent;
  curatorNote?: string;
  transitionFamily?: TransitionFamily;
  displayMode?: "object-case" | "wall-painting" | "architecture-flat";
  visualPresentation?: {
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
  };
}

export interface ImmersiveScene {
  unit: ImmersiveGalleryUnit;
  index: number;
  transition: TransitionModule;
}

export function buildImmersiveScenes(
  units: ImmersiveGalleryUnit[],
  options: { registry?: TransitionRegistry } = {},
): ImmersiveScene[] {
  return units.map((unit, index) => ({
    unit,
    index,
    transition: resolveTransitionModule(unit.transitionFamily, options.registry),
  }));
}

export function getInitialImmersiveScene(
  units: ImmersiveGalleryUnit[],
  input: { selectedUnitId?: string; registry?: TransitionRegistry } = {},
): ImmersiveScene | undefined {
  const scenes = buildImmersiveScenes(units, { registry: input.registry });
  return scenes.find((scene) => scene.unit.id === input.selectedUnitId) ?? scenes[0];
}
