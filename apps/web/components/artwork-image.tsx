"use client";

import { useEffect, useRef, useState } from "react";

interface ArtworkImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
  fallbackMeta?: string;
  decoding?: "async" | "auto" | "sync";
  fetchPriority?: "high" | "low" | "auto";
  loading?: "eager" | "lazy";
}

export function ArtworkImage({
  src,
  alt,
  className = "",
  fallbackLabel = "图像暂不可用",
  fallbackMeta,
  decoding = "async",
  fetchPriority,
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
        className={`artwork-image-fallback ${className}`}
        data-testid="image-fallback"
      >
        <div
          aria-label={`${fallbackLabel}. 图像暂不可用. ${fallbackMeta ?? ""}`}
          className="fallback-copy"
          role="img"
        >
          <span className="fallback-status">图像暂不可用</span>
          <span className="fallback-title">{fallbackLabel}</span>
          {fallbackMeta ? <span className="fallback-meta">{fallbackMeta}</span> : null}
        </div>
        <button type="button" onClick={() => setFailed(false)}>重试图像</button>
      </div>
    );
  }

  return (
    <img
      alt={alt}
      className={className}
      decoding={decoding}
      fetchPriority={fetchPriority}
      loading={loading}
      onError={() => setFailed(true)}
      ref={imageRef}
      src={src}
    />
  );
}
