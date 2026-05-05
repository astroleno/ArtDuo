import { ImageLightbox } from "./image-lightbox";
import { ProgressIndicator } from "./progress-indicator";
import { buildImmersiveScenes, type ImmersiveGalleryUnit } from "./scene-orchestrator";
import type { TransitionRegistry } from "../transitions/registry";

export interface ImmersiveGalleryProps {
  units: ImmersiveGalleryUnit[];
  selectedUnitId?: string;
  registry?: TransitionRegistry;
  galleryHref: string;
}

export function ImmersiveGallery({ units, selectedUnitId, registry, galleryHref }: ImmersiveGalleryProps) {
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

  return (
    <main className={`immersive-shell ${activeScene.transition.className}`}>
      <header className="immersive-topbar">
        <a className="immersive-brand" href="/">ArtDuo</a>
        <a className="immersive-back-link" href={galleryHref}>Back to Gallery</a>
      </header>

      <section className="immersive-stage" aria-label="Immersive artwork">
        <ImageLightbox unit={activeScene.unit} />
        <aside className="immersive-caption">
          <p className="immersive-kicker">{activeScene.unit.sceneLabel ?? activeScene.transition.family}</p>
          <h1>{activeScene.unit.title}</h1>
          {activeByline ? <p>{activeByline}</p> : null}
        </aside>
      </section>

      <footer className="immersive-footer">
        <ProgressIndicator total={scenes.length} currentIndex={activeScene.index} />
      </footer>
    </main>
  );
}
