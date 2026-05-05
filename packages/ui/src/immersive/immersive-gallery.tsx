import type { CSSProperties } from "react";

import { ImageLightbox } from "./image-lightbox";
import { ProgressIndicator } from "./progress-indicator";
import { buildImmersiveScenes, type ImmersiveGalleryUnit } from "./scene-orchestrator";
import type { TransitionRegistry } from "../transitions/registry";

export interface ImmersiveGalleryProps {
  units: ImmersiveGalleryUnit[];
  selectedUnitId?: string;
  registry?: TransitionRegistry;
  galleryHref: string;
  getSceneHref?: (unit: ImmersiveGalleryUnit, index: number) => string;
}

export function ImmersiveGallery({ units, selectedUnitId, registry, galleryHref, getSceneHref }: ImmersiveGalleryProps) {
  const scenes = buildImmersiveScenes(units, { registry });
  const selectedIndex = Math.max(0, scenes.findIndex((scene) => scene.unit.id === selectedUnitId));
  const activeScene = scenes[selectedIndex] ?? scenes[0];

  if (!activeScene) {
    return (
      <main className="immersive-shell">
        <a className="immersive-back-link" href={galleryHref}>Back to Gallery</a>
        <section className="immersive-empty">
          <h1>Immersive gallery unavailable</h1>
          <p>No exhibition units are ready yet.</p>
        </section>
      </main>
    );
  }

  const activeByline = [activeScene.unit.artistDisplayName, activeScene.unit.yearLabel].filter(Boolean).join(", ");
  const sceneHrefs = scenes.map((scene) => getSceneHref?.(scene.unit, scene.index));
  const previousScene = scenes[activeScene.index - 1];
  const nextScene = scenes[activeScene.index + 1];
  const shellStyle: CSSProperties | undefined = activeScene.unit.backgroundSceneUrl
    ? {
      backgroundImage: `linear-gradient(90deg, rgba(16, 13, 11, 0.86), rgba(16, 13, 11, 0.46)), url(${activeScene.unit.backgroundSceneUrl})`,
    }
    : undefined;

  return (
    <main className={`immersive-shell ${activeScene.transition.className}`} style={shellStyle}>
      <header className="immersive-topbar">
        <a className="immersive-brand" href="/">ArtDuo</a>
        <a className="immersive-back-link" href={galleryHref}>Back to Gallery</a>
      </header>

      <section className="immersive-stage" aria-label="Immersive artwork">
        <ImageLightbox unit={activeScene.unit} />
        <aside className="immersive-caption">
          <p className="immersive-kicker">{activeScene.unit.sceneLabel ?? activeScene.transition.family}</p>
          <h1 data-testid="immersive-scene-title">{activeScene.unit.title}</h1>
          {activeByline ? <p>{activeByline}</p> : null}
          {scenes.length > 1 ? (
            <nav className="immersive-scene-nav" aria-label="Immersive scene navigation">
              {previousScene && sceneHrefs[previousScene.index] ? (
                <a href={sceneHrefs[previousScene.index]}>Previous scene</a>
              ) : null}
              {nextScene && sceneHrefs[nextScene.index] ? (
                <a href={sceneHrefs[nextScene.index]}>Next scene</a>
              ) : null}
            </nav>
          ) : null}
        </aside>
      </section>

      <footer className="immersive-footer">
        <ProgressIndicator total={scenes.length} currentIndex={activeScene.index} itemHrefs={sceneHrefs} />
      </footer>
    </main>
  );
}
