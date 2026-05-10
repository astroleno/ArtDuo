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
  const isFirstScene = activeScene.index === 0;
  const isLastScene = activeScene.index === scenes.length - 1;
  const narrativeText = isFirstScene && preface
    ? preface
    : isLastScene && closing
      ? closing
      : activeScene.unit.curatorNote;
  const shellStyle: CSSProperties | undefined = activeScene.unit.backgroundSceneUrl
    ? {
      backgroundImage: `linear-gradient(90deg, rgba(16, 13, 11, 0.86), rgba(16, 13, 11, 0.46)), url(${activeScene.unit.backgroundSceneUrl})`,
    }
    : undefined;

  return (
    <main className={`immersive-shell ${activeScene.transition.className}`} style={shellStyle}>
      <div className="immersive-atmosphere" aria-hidden="true">
        <span className="immersive-spotlight-source" />
        <span className="immersive-spotlight-cone" />
        <span className="immersive-wall-wash" />
        <span className="immersive-floor-wash" />
        <span className="immersive-noise" />
      </div>
      <header className="immersive-topbar">
        <a className="immersive-brand" href="/">ArtDuo</a>
        <a className="immersive-back-link" href={galleryHref}>Back to Gallery</a>
      </header>

      <section className="immersive-stage" aria-label="Immersive artwork">
        <ImageLightbox unit={activeScene.unit} />
        <aside className="immersive-caption">
          <p className="immersive-kicker">
            {activeScene.unit.stageLabel ?? `Scene ${activeScene.index + 1}`} · {activeScene.unit.sceneLabel ?? activeScene.transition.family}
          </p>
          <h1 data-testid="immersive-scene-title">{activeScene.unit.title}</h1>
          {activeByline ? <p>{activeByline}</p> : null}
          {narrativeText ? (
            <p
              className="immersive-narrative"
              data-testid={isFirstScene ? "immersive-preface" : isLastScene ? "immersive-closing" : "immersive-note"}
            >
              {narrativeText}
            </p>
          ) : null}
          <div className="immersive-emotion-strip" aria-label="Emotional curve" data-testid="immersive-emotion-curve">
            {scenes.map((scene) => {
              const intensity = Math.max(0.18, Math.min(0.94, scene.unit.emotionalIntensity ?? 0.45));

              return (
                <span
                  aria-current={scene.index === activeScene.index ? "step" : undefined}
                  className={scene.index === activeScene.index ? "is-active" : ""}
                  key={scene.unit.id}
                  style={{ "--curve-intensity": intensity } as CSSProperties}
                  title={scene.unit.stageTone ?? scene.unit.stageLabel}
                />
              );
            })}
          </div>
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
