import { resolveTransitionModule, type TransitionFamily, type TransitionModule, type TransitionRegistry } from "../transitions/registry";

export interface ImmersiveGalleryUnit {
  id: string;
  title: string;
  artistDisplayName?: string;
  yearLabel?: string;
  imageUrl: string;
  imageUrlFull?: string;
  backgroundSceneUrl?: string;
  sceneLabel?: string;
  stageLabel?: string;
  stageTone?: string;
  emotionalIntensity?: number;
  curatorNote?: string;
  transitionFamily?: TransitionFamily;
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
