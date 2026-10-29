"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ImmersiveDetailStage, type ImmersiveDetailOrigin } from "./immersive-detail-stage";
import type { ImmersiveGalleryUnit } from "./scene-orchestrator";
import { prepareReadingImage } from "../experience/reading-image";
import { useOverlayHistory } from "../experience/use-overlay-history";

export interface ImageLightboxProps {
  unit: ImmersiveGalleryUnit;
  previewSource?: string;
  className?: string;
  motionEnabled?: boolean;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  onRestoreArtwork?: (artworkId: string) => void;
  onExpandedChange?: (isExpanded: boolean) => void;
  onExpandedArtworkReady?: (artworkId: string) => void;
  onImageReady?: (size: { width: number; height: number }) => void;
  onImageError?: () => void;
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
  previewSource,
  className = "",
  motionEnabled = true,
  hasPrevious = false,
  hasNext = false,
  onPrevious,
  onNext,
  onRestoreArtwork,
  onExpandedChange,
  onExpandedArtworkReady,
  onImageReady,
  onImageError,
}: ImageLightboxProps) {
  const byline = [unit.artistDisplayName, unit.yearLabel].filter(Boolean).join(", ");
  const previewSrc = previewSource ?? unit.imageUrl;
  const fullSrc = unit.imageUrlFull && unit.imageUrlFull !== previewSrc ? unit.imageUrlFull : undefined;
  const aspectHint = normalizeAspectHint(unit.aspectRatioHint);
  const cropStyle = cropFrameStyle(unit);
  const isBorderTrimmed = Boolean(cropStyle);
  const exactAspect = unit.visualPresentation?.cropStrategy === "preserve-paper"
    ? unit.visualPresentation.contentAspectRatio : undefined;
  const hasExactAspect = Number.isFinite(exactAspect) && (exactAspect ?? 0) > 0;
  const [imageState, setImageState] = useState<"loading" | "ready" | "error">("loading");
  const [detail, setDetail] = useState(() => ({ unit, imageSrc: previewSrc }));
  const [isExpanded, setIsExpanded] = useState(false);
  const [prepareAttempt, setPrepareAttempt] = useState(0);
  const [preparation, setPreparation] = useState<{ artworkId: string; failed: boolean }>();
  const [entryOrigin, setEntryOrigin] = useState<ImmersiveDetailOrigin | undefined>();
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const decodedSourceRef = useRef<string | null>(null);
  const artworkFrameRef = useRef<HTMLSpanElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const restoreTriggerFocusRef = useRef(false);
  const expandedRef = useRef(isExpanded);
  const callbacksRef = useRef({ onExpandedChange, onExpandedArtworkReady });
  const unitRef = useRef(unit);
  expandedRef.current = isExpanded;
  callbacksRef.current = { onExpandedChange, onExpandedArtworkReady };
  unitRef.current = unit;
  const pendingArtwork = detail.unit.id !== unit.id;
  const preparationFailed = pendingArtwork && preparation?.artworkId === unit.id && preparation.failed;
  const closeDetail = useOverlayHistory(isExpanded, sameView => {
    if (pendingArtwork && sameView) onRestoreArtwork?.(detail.unit.id);
    onExpandedChange?.(false);
    setIsExpanded(false);
  });

  useEffect(() => {
    setImageState("loading");
    decodedSourceRef.current = null;
  }, [previewSrc, unit.id]);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    if (!isExpanded && restoreTriggerFocusRef.current) {
      restoreTriggerFocusRef.current = false;
      triggerRef.current?.focus();
    }

  }, [isExpanded]);

  useEffect(() => () => {
    if (expandedRef.current) callbacksRef.current.onExpandedChange?.(false);
  }, []);

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
    if (!isExpanded) return;
    const controller = new AbortController();
    const nextUnit = unitRef.current;
    setPreparation({ artworkId: nextUnit.id, failed: false });
    async function prepare() {
      const preview = new Image();
      preview.crossOrigin = "anonymous";
      preview.decoding = "async";
      preview.src = previewSrc;
      const state = await prepareReadingImage(preview, controller.signal, 8000);
      if (controller.signal.aborted) return;
      if (state !== "ready") { setPreparation({ artworkId: nextUnit.id, failed: true }); return; }
      // Change the work and its credit together, only once real pixels exist.
      setDetail({ unit: nextUnit, imageSrc: previewSrc });
      if (!fullSrc) return;
      const full = new Image();
      full.crossOrigin = "anonymous";
      full.decoding = "async";
      full.src = fullSrc;
      try {
        await full.decode();
        if (!controller.signal.aborted && full.naturalWidth) setDetail({ unit: nextUnit, imageSrc: fullSrc });
      } catch { /* Keep the decoded preview if the full image fails. */ }
    }
    void prepare();
    return () => controller.abort();
  }, [previewSrc, fullSrc, unit.id, isExpanded, prepareAttempt]);

  useEffect(() => {
    if (!isExpanded || pendingArtwork) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => callbacksRef.current.onExpandedArtworkReady?.(detail.unit.id));
    });
    return () => cancelAnimationFrame(frame);
  }, [isExpanded, pendingArtwork, detail.unit.id]);

  useEffect(() => {
    let cancelled = false;
    async function syncImageState() {
      const image = imageRef.current;
      if (!image?.complete || cancelled) {
        return;
      }
      try {
        await image.decode();
        if (!cancelled) {
          decodedSourceRef.current = previewSrc;
          setImageState(image.naturalWidth > 0 ? "ready" : "error");
        }
      } catch {
        if (!cancelled) setImageState("error");
      }
    }
    const image = imageRef.current;
    image?.addEventListener("load", syncImageState);
    image?.addEventListener("error", syncImageState);
    void syncImageState();

    return () => {
      cancelled = true;
      image?.removeEventListener("load", syncImageState);
      image?.removeEventListener("error", syncImageState);
    };
  }, [previewSrc]);

  useEffect(() => {
    const image = imageRef.current;
    if (imageState === "ready" && decodedSourceRef.current === previewSrc && image?.naturalWidth) onImageReady?.({ width: image.naturalWidth, height: image.naturalHeight });
    if (imageState === "error") onImageError?.();
  }, [imageState, previewSrc, onImageReady, onImageError]);

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
    restoreTriggerFocusRef.current = true;
    setDetail({ unit, imageSrc: previewSrc });
    // Notify the room in this same update, before the detail renderer mounts.
    onExpandedChange?.(true);
    setIsExpanded(true);
  }

  return (
    <figure
      className={`immersive-lightbox ${className}`}
      data-aspect-ratio={aspectHint}
      data-exact-aspect={hasExactAspect ? "true" : undefined}
      data-detail-state={isExpanded ? "immersive" : "idle"}
      data-display-mode={unit.displayMode ?? "wall-painting"}
      data-image-state={imageState}
      data-lightbox-open={isExpanded ? "true" : "false"}
      data-visual-crop={isBorderTrimmed ? "trim-border" : "none"}
      style={hasExactAspect ? { "--immersive-source-aspect-ratio": String(exactAspect) } as CSSProperties : undefined}
    >
      <button
        aria-label={`放大，进入画中：《${unit.title}》`}
        className="immersive-lightbox-trigger"
        onClick={openImmersiveDetail}
        ref={triggerRef}
        type="button"
      >
        <span className="immersive-artwork-frame" ref={artworkFrameRef}>
          {isBorderTrimmed ? (
            <span className="immersive-image-crop" style={cropStyle}>
              <img
                crossOrigin="anonymous"
                alt={`《${unit.title}》`}
                className="immersive-preview-image"
                decoding="async"
                fetchPriority="high"
                ref={imageRef}
                src={previewSrc}
              />
            </span>
          ) : (
            <img
              crossOrigin="anonymous"
              alt={`《${unit.title}》`}
              className="immersive-preview-image"
              decoding="async"
              fetchPriority="high"
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
          motionEnabled={motionEnabled}
          entryOrigin={entryOrigin}
          hasNext={hasNext && !pendingArtwork}
          hasPrevious={hasPrevious && !pendingArtwork}
          pendingArtwork={pendingArtwork}
          preparationFailed={preparationFailed}
          onRetryArtwork={() => { setPreparation({ artworkId: unit.id, failed: false }); setPrepareAttempt(attempt => attempt + 1); }}
          onCancelArtwork={onRestoreArtwork ? () => onRestoreArtwork(detail.unit.id) : closeDetail}
          imageSrc={detail.imageSrc}
          onClose={closeDetail}
          onNext={onNext}
          onPrevious={onPrevious}
          requireDepthMap={detail.unit.requireDepthMap}
          unit={detail.unit}
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
