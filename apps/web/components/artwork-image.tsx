"use client";

import { useEffect, useRef, useState } from "react";

interface ArtworkImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
  loading?: "eager" | "lazy";
}

export function ArtworkImage({
  src,
  alt,
  className = "",
  fallbackLabel = "Image unavailable",
  loading = "lazy",
}: ArtworkImageProps) {
  const [failed, setFailed] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth === 0) {
      setFailed(true);
    }
  }, []);

  if (failed) {
    return (
      <div
        aria-label={`${alt} unavailable`}
        className={`artwork-image-fallback ${className}`}
        data-testid="image-fallback"
        role="img"
      >
        <span>{fallbackLabel}</span>
      </div>
    );
  }

  return (
    <img
      alt={alt}
      className={className}
      loading={loading}
      onError={() => setFailed(true)}
      ref={imageRef}
      src={src}
    />
  );
}
