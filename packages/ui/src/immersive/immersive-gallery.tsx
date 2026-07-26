import { ImmersiveGalleryClient } from "./immersive-gallery-client";
import { buildImmersiveScenes, type ImmersiveGalleryUnit } from "./scene-orchestrator";
import type { TransitionRegistry } from "../transitions/registry";

export interface ImmersiveGalleryProps {
  units: ImmersiveGalleryUnit[];
  selectedUnitId?: string;
  registry?: TransitionRegistry;
  galleryHref: string;
  preface?: string;
  closing?: string;
  getSceneHref?: (unit: ImmersiveGalleryUnit, index: number) => string;
}

export function ImmersiveGallery({
  units,
  selectedUnitId,
  registry,
  galleryHref,
  preface,
  closing,
  getSceneHref,
}: ImmersiveGalleryProps) {
  const scenes = buildImmersiveScenes(units, { registry });
  const selectedIndex = Math.max(0, scenes.findIndex((scene) => scene.unit.id === selectedUnitId));
  const activeScene = scenes[selectedIndex] ?? scenes[0];

  if (!activeScene) {
    return (
      <main className="immersive-shell">
        <a className="immersive-back-link" href={galleryHref}>换一句愿望</a>
        <section className="immersive-empty">
          <h1>展厅尚未就绪</h1>
          <p>这次展览还没有可展示的作品。</p>
        </section>
      </main>
    );
  }

  const sceneHrefs = scenes.map((scene) => getSceneHref?.(scene.unit, scene.index));

  return (
    <ImmersiveGalleryClient
      closing={closing}
      galleryHref={galleryHref}
      initialIndex={activeScene.index}
      preface={preface}
      sceneHrefs={sceneHrefs}
      scenes={scenes}
    />
  );
}
