import type { ImmersiveGalleryUnit } from "./scene-orchestrator";

export interface ImageLightboxProps {
  unit: ImmersiveGalleryUnit;
  className?: string;
}

export function ImageLightbox({ unit, className = "" }: ImageLightboxProps) {
  const byline = [unit.artistDisplayName, unit.yearLabel].filter(Boolean).join(", ");

  return (
    <figure className={`immersive-lightbox ${className}`}>
      <img alt={`${unit.title} artwork`} src={unit.imageUrlFull ?? unit.imageUrl} />
      <figcaption>
        <strong>{unit.title}</strong>
        {byline ? <span>{byline}</span> : null}
      </figcaption>
    </figure>
  );
}
