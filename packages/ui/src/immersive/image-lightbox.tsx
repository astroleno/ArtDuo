import type { ImmersiveGalleryUnit } from "./scene-orchestrator";

export interface ImageLightboxProps {
  unit: ImmersiveGalleryUnit;
  className?: string;
}

export function ImageLightbox({ unit, className = "" }: ImageLightboxProps) {
  const byline = [unit.artistDisplayName, unit.yearLabel].filter(Boolean).join(", ");

  return (
    <figure className={`immersive-lightbox ${className}`}>
      <div className="immersive-artwork-frame">
        <img alt={`${unit.title} artwork`} src={unit.imageUrlFull ?? unit.imageUrl} />
        <span className="immersive-canvas-grain" aria-hidden="true" />
      </div>
      <figcaption>
        <strong>{unit.title}</strong>
        {byline ? <span>{byline}</span> : null}
      </figcaption>
    </figure>
  );
}
