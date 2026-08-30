"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ImmersiveDetailStage, type ImmersiveDetailOrigin } from "./immersive-detail-stage";
import type { ImmersiveGalleryUnit } from "./scene-orchestrator";

export interface ImageLightboxProps {
  unit: ImmersiveGalleryUnit;
  className?: string;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  onExpandedChange?: (isExpanded: boolean) => void;
}

function normalizeAspectHint(value: string | undefined): "landscape" | "portrait" | "square" {
  if (value === "portrait" || value === "square") {
    return value;
  }

  return "landscape";
}

function shouldTrimBorder(unit: ImmersiveGalleryUnit): boolean {
  const visual = unit.visualPresentation;

  return Boolean(
    visual?.cropStrategy === "trim-border" &&
    visual.contentBounds &&
    visual.contentAspectRatio &&
    (visual.confidence ?? 0) >= 0.62,
  );
}

function cropFrameStyle(unit: ImmersiveGalleryUnit): CSSProperties | undefined {
  if (!shouldTrimBorder(unit)) {
    return undefined;
  }

  const bounds = unit.visualPresentation?.contentBounds;
  const contentAspectRatio = unit.visualPresentation?.contentAspectRatio;
  if (!bounds || !contentAspectRatio) {
    return undefined;
  }

  return {
    "--immersive-content-aspect-ratio": String(contentAspectRatio),
    "--crop-image-left": `${(-bounds.x / bounds.width) * 100}%`,
    "--crop-image-top": `${(-bounds.y / bounds.height) * 100}%`,
    "--crop-image-width": `${(1 / bounds.width) * 100}%`,
    "--crop-image-height": `${(1 / bounds.height) * 100}%`,
  } as CSSProperties;
}

export function ImageLightbox({
  unit,
  className = "",
  hasPrevious = false,
  hasNext = false,
  onPrevious,
  onNext,
  onExpandedChange,
}: ImageLightboxProps) {
  const byline = [unit.artistDisplayName, unit.yearLabel].filter(Boolean).join(", ");
  const previewSrc = unit.imageUrl;
  const fullSrc = unit.imageUrlFull && unit.imageUrlFull !== previewSrc ? unit.imageUrlFull : undefined;
  const aspectHint = normalizeAspectHint(unit.aspectRatioHint);
  const cropStyle = cropFrameStyle(unit);
  const isBorderTrimmed = Boolean(cropStyle);
  const [imageState, setImageState] = useState<"loading" | "ready" | "error">("loading");
  const [expandedImageSrc, setExpandedImageSrc] = useState(previewSrc);
  const [isExpanded, setIsExpanded] = useState(false);
  const [entryOrigin, setEntryOrigin] = useState<ImmersiveDetailOrigin | undefined>();
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const artworkFrameRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    setImageState("loading");
    setExpandedImageSrc(previewSrc);
  }, [fullSrc, previewSrc, unit.id]);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    onExpandedChange?.(isExpanded);

    return () => {
      if (isExpanded) {
        onExpandedChange?.(false);
      }
    };
  }, [isExpanded, onExpandedChange]);

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.dataset.immersiveLightbox = "open";

    return () => {
      document.body.style.overflow = previousOverflow;
      delete document.body.dataset.immersiveLightbox;
    };
  }, [isExpanded]);

  useEffect(() => {
    if (!isExpanded || !fullSrc) {
      return;
    }

    let cancelled = false;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (!cancelled) {
        setExpandedImageSrc(fullSrc);
      }
    };
    image.src = fullSrc;

    if (image.complete && image.naturalWidth > 0 && !cancelled) {
      setExpandedImageSrc(fullSrc);
    }

    return () => {
      cancelled = true;
    };
  }, [fullSrc, isExpanded]);

  useEffect(() => {
    let cancelled = false;

    function syncImageState() {
      const image = imageRef.current;
      if (!image?.complete || cancelled) {
        return;
      }

      setImageState(image.naturalWidth > 0 ? "ready" : "error");
    }

    syncImageState();
    const quickCheck = window.setTimeout(syncImageState, 120);
    const finalCheck = window.setTimeout(syncImageState, 900);

    imageRef.current?.decode?.().then(syncImageState).catch(syncImageState);

    return () => {
      cancelled = true;
      window.clearTimeout(quickCheck);
      window.clearTimeout(finalCheck);
    };
  }, [previewSrc]);

  function openImmersiveDetail() {
    const bounds = artworkFrameRef.current?.getBoundingClientRect();
    const viewportWidth = Math.max(1, window.innerWidth);
    const viewportHeight = Math.max(1, window.innerHeight);

    setEntryOrigin({
      scale: bounds
        ? Math.max(0.16, Math.min(0.88, Math.min(bounds.width / viewportWidth, bounds.height / viewportHeight)))
        : 0.72,
      x: bounds ? bounds.left + bounds.width / 2 : viewportWidth / 2,
      y: bounds ? bounds.top + bounds.height / 2 : viewportHeight / 2,
    });
    setIsExpanded(true);
  }

  return (
    <figure
      className={`immersive-lightbox ${className}`}
      data-aspect-ratio={aspectHint}
      data-detail-state={isExpanded ? "immersive" : "idle"}
      data-display-mode={unit.displayMode ?? "wall-painting"}
      data-image-state={imageState}
      data-lightbox-open={isExpanded ? "true" : "false"}
      data-visual-crop={isBorderTrimmed ? "trim-border" : "none"}
    >
      <button
        aria-label={`放大《${unit.title}》并进入沉浸体验`}
        className="immersive-lightbox-trigger"
        onClick={openImmersiveDetail}
        type="button"
      >
        <span className="immersive-artwork-frame" ref={artworkFrameRef}>
          {isBorderTrimmed ? (
            <span className="immersive-image-crop" style={cropStyle}>
              <img
                alt={`${unit.title} artwork`}
                className="immersive-preview-image"
                decoding="async"
                fetchPriority="high"
                onError={() => setImageState("error")}
                onLoad={() => setImageState("ready")}
                ref={imageRef}
                src={previewSrc}
              />
            </span>
          ) : (
            <img
              alt={`${unit.title} artwork`}
              className="immersive-preview-image"
              decoding="async"
              fetchPriority="high"
              onError={() => setImageState("error")}
              onLoad={() => setImageState("ready")}
              ref={imageRef}
              src={previewSrc}
            />
          )}
          {imageState === "loading" ? (
            <span className="immersive-image-state" aria-live="polite">作品图像正在显影</span>
          ) : null}
          {imageState === "error" ? (
            <span className="immersive-image-state is-error" aria-live="polite">画面稍后归位</span>
          ) : null}
          <span className="immersive-canvas-grain" aria-hidden="true" />
          <span className="immersive-enter-cue" aria-hidden="true">
            <span>放大</span>
            进入画中
          </span>
        </span>
      </button>
      {isExpanded && portalRoot ? createPortal(
        <ImmersiveDetailStage
          entryOrigin={entryOrigin}
          hasNext={hasNext}
          hasPrevious={hasPrevious}
          imageSrc={expandedImageSrc}
          onClose={() => setIsExpanded(false)}
          onNext={onNext}
          onPrevious={onPrevious}
          unit={unit}
        />,
        portalRoot,
      ) : null}
      <figcaption>
        <strong>{unit.title}</strong>
        {byline ? <span>{byline}</span> : null}
      </figcaption>
    </figure>
  );
}
