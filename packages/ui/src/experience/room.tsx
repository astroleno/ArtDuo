"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ImageLightbox } from "../immersive/image-lightbox";
import type { ImmersiveGalleryUnit } from "../immersive/scene-orchestrator";
import { calculateRoomLayout, sceneMountZone } from "./layout";
import { DepthParallaxCanvas } from "./depth-parallax-canvas";
import type { ExperienceUnit } from "./types";
import { AtmosphereLayer } from "./atmosphere-layer";
import { Plaque } from "./plaque";
import type { ViewingPace } from "./viewing-session";

function aspectOf(value: string | undefined): number {
  if (value === "portrait" || value === "9:16") return 0.72;
  if (value === "square" || value === "1:1") return 1;
  if (value === "landscape" || value === "16:9") return 1.52;
  return 1.2;
}

export function Room({ unit, index, count, stageLabel, reducedMotion, plaqueOpen, onTogglePlaque, onDetail, onPrevious, onNext, onRetryMedia, onMediaFailed, onLightboxChange, onArtworkReady, mediaFailed, transitioning = false, pace = "steady" }: {
  unit: ExperienceUnit;
  index: number;
  count: number;
  stageLabel?: string;
  reducedMotion: boolean;
  plaqueOpen: boolean;
  onTogglePlaque: () => void;
  onDetail: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onRetryMedia: () => void;
  onMediaFailed: () => void;
  onLightboxChange: (expanded: boolean) => void;
  onArtworkReady: (unitId: string) => void;
  mediaFailed: boolean;
  transitioning?: boolean;
  pace?: ViewingPace;
}) {
  const [viewport, setViewport] = useState({ width: 1440, height: 900 });
  const [sceneSize, setSceneSize] = useState({ width: unit.scene?.image_info.width ?? 1600, height: unit.scene?.image_info.height ?? 900 });
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [failedBackgroundUrl, setFailedBackgroundUrl] = useState<string>();
  const backgroundFailed = Boolean(unit.media.backgroundUrl && failedBackgroundUrl === unit.media.backgroundUrl);
  const [retryToken, setRetryToken] = useState(0);
  const [lightboxExpanded, setLightboxExpanded] = useState(false);
  const [loadedArtwork, setLoadedArtwork] = useState<{ id: string; size: { width: number; height: number } } | null>(null);
  const artworkSize = loadedArtwork?.id === unit.artwork.id ? loadedArtwork.size : null;
  const roomRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    resize();
    window.addEventListener("resize", resize, { passive: true });
    return () => window.removeEventListener("resize", resize);
  }, []);
  const imageReady = useCallback((size: { width: number; height: number }) => setLoadedArtwork({ id: unit.artwork.id, size }), [unit.artwork.id]);
  const lightboxChanged = useCallback((expanded: boolean) => {
    setLightboxExpanded(expanded);
    onLightboxChange(expanded);
  }, [onLightboxChange]);
  useEffect(() => {
    if (!artworkSize || mediaFailed || transitioning || lightboxExpanded) return;
    let cancelled = false;
    let frame = 0;
    const reportAfterPaint = async () => {
      if (document.visibilityState !== "visible") return;
      const walk = roomRef.current?.closest(".experience-walk");
      const animations = walk?.getAnimations({ subtree: true }).filter((animation) => animation.effect?.getTiming().iterations !== Infinity) ?? [];
      await Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
      if (cancelled) return;
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (!cancelled && document.visibilityState === "visible") onArtworkReady(unit.exhibition.unitId);
        });
      });
    };
    void reportAfterPaint();
    document.addEventListener("visibilitychange", reportAfterPaint);
    return () => { cancelled = true; cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", reportAfterPaint); };
  }, [artworkSize, mediaFailed, transitioning, lightboxExpanded, onArtworkReady, unit.exhibition.unitId]);
  const retryMedia = useCallback(() => {
    setRetryToken((value) => value + 1);
    setLoadedArtwork(null);
    setFailedBackgroundUrl(undefined);
    onRetryMedia();
  }, [onRetryMedia]);
  const layout = useMemo(() => calculateRoomLayout({
    viewport, sceneSize, mountZone: backgroundFailed ? undefined : sceneMountZone(unit.scene), artworkAspectRatio: artworkSize ? artworkSize.width / artworkSize.height : aspectOf(unit.artwork.media.aspectRatioHint),
    navigationHeight: 76, plaqueHeight: 92,
  }), [viewport, sceneSize, unit, artworkSize, backgroundFailed]);
  const viewUnit: ImmersiveGalleryUnit = {
    id: unit.artwork.id,
    title: unit.artwork.metadata.title,
    artistDisplayName: unit.artwork.metadata.artistDisplayName,
    yearLabel: unit.artwork.metadata.yearLabel,
    imageUrl: unit.media.previewUrl,
    imageUrlFull: unit.media.fullUrl,
    depthMapUrl: unit.media.depthMapUrl,
    requireDepthMap: true,
    aspectRatioHint: unit.artwork.media.aspectRatioHint,
    backgroundSceneUrl: unit.media.backgroundUrl,
    sceneLabel: unit.scene?.asset.label_cn,
    stageLabel,
    emotionalIntensity: unit.artwork.presentation.grade === "A" ? 0.76 : 0.58,
    growthStageId: unit.stageId ?? undefined,
    transitionFamily: unit.transitionFamily,
    displayMode: unit.displayCategory,
    visualPresentation: undefined,
  };
  const imageRatio = `${Math.max(1, layout.frame.width)} / ${Math.max(1, layout.frame.height)}`;
  const plaqueTop = layout.plaque.y;
  const paper = /paper|woodblock|etching|engraving|lithograph|watercolou?r|ink|drawing|print/i.test(unit.artwork.metadata.medium ?? "");

  return <section
    className={`experience-room ${layout.staticFallback ? "is-static-fallback" : ""} ${reducedMotion ? "is-reduced-motion" : ""} ${transitioning ? "is-transitioning" : ""}`}
    data-display-mode={unit.displayCategory}
    data-transition-family={unit.transitionFamily}
    data-viewing-pace={pace}
    data-frame-material={paper ? "paper" : "canvas"}
    data-wall-light={unit.scene?.id === "bg-004" ? "left" : "top"}
    data-testid="experience-room"
    ref={roomRef}
    onPointerMove={(event) => {
      if (reducedMotion || event.pointerType !== "mouse" || !unit.media.depthMapUrl || lightboxExpanded) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      setPointer({ x: ((event.clientX - bounds.left) / bounds.width - 0.5) * 2, y: ((event.clientY - bounds.top) / bounds.height - 0.5) * 2 });
    }}
    onPointerLeave={() => { if (unit.media.depthMapUrl) setPointer({ x: 0, y: 0 }); }}
  >
    <div className="experience-room-backdrop experience-room-fallback" />
    {unit.media.backgroundUrl && !backgroundFailed ? <RoomBackdrop reducedMotion={reducedMotion} url={unit.media.backgroundUrl} onError={() => {
      setFailedBackgroundUrl(unit.media.backgroundUrl);
      window.dispatchEvent(new CustomEvent("artduo:experience-degraded", { detail: { reason: "background-scene-unavailable", artworkId: unit.artwork.id } }));
    }} onReady={setSceneSize} /> : null}
    <div aria-hidden="true" className="experience-room-shade" />
    <AtmosphereLayer reducedMotion={reducedMotion} tone={unit.scene?.visual_profile.lighting[0] ?? "warm"} />
    <header className="experience-room-header">
      <a aria-label="ArtDuo，重新选一组作品" className="experience-mark" href="/?view=experience">ArtDuo</a>
      <div className="experience-room-meta"><span>{unit.scene?.asset.label_cn ?? "静光展厅"}</span><span>{String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}</span></div>
    </header>
    {mediaFailed ? <div className="experience-media-fallback" role="status">
      <p>这件作品暂时无法载入，展签和路线仍可继续。</p><button onClick={retryMedia} type="button">重试载入</button>
    </div> : <div key={`${unit.artwork.id}:${retryToken}`} className="experience-frame-shadow" style={{
      left: `${layout.frame.x}px`, top: `${layout.frame.y}px`, width: `${layout.frame.width}px`, height: `${layout.frame.height}px`, aspectRatio: imageRatio,
    }}>
      <ImageLightbox key={retryToken} className="experience-art-lightbox" onExpandedChange={lightboxChanged} onImageReady={imageReady} onImageError={onMediaFailed} unit={viewUnit} />
      <DepthParallaxCanvas active={!lightboxExpanded && !mediaFailed && Boolean(unit.media.depthMapUrl)} depthMapUrl={unit.media.depthMapUrl} imageUrl={unit.media.previewUrl} pointer={pointer} reducedMotion={reducedMotion} />
    </div>}
    <div className={`experience-plaque-position ${layout.mobilePlaque ? "is-mobile" : ""}`} style={{
      left: `${layout.mobilePlaque ? 20 : layout.plaque.x}px`, top: `${plaqueTop}px`, width: `${layout.plaque.width}px`,
      maxHeight: `${Math.max(80, viewport.height - plaqueTop - (layout.mobilePlaque ? 88 : 72))}px`,
    }}>
      <Plaque unit={unit} expanded={plaqueOpen} onToggle={onTogglePlaque} onDetail={onDetail} />
    </div>
    <nav className="experience-walk-controls" aria-label="作品导航">
      <button aria-label="上一件作品" disabled={index === 0} onClick={onPrevious} type="button">← <span>上一件</span></button>
      <button aria-label={index === count - 1 ? "进入结语" : "下一件作品"} className="experience-next" onClick={onNext} type="button">{index === count - 1 ? "看完了" : "下一件"} <span aria-hidden="true">→</span></button>
    </nav>
  </section>;
}

/** Keep the previous wall visible until its replacement has decoded. */
function RoomBackdrop({ url, onReady, onError, reducedMotion }: { url: string; onReady: (size: { width: number; height: number }) => void; onError: () => void; reducedMotion: boolean }) {
  const [loaded, setLoaded] = useState<string>();
  const [previous, setPrevious] = useState<string>();
  return <>
    {previous && !reducedMotion ? <img alt="" className="experience-room-backdrop" src={previous} /> : null}
    {loaded ? <img key={loaded} alt="" className={`experience-room-backdrop ${reducedMotion ? "" : "is-revealed-wall"}`} src={loaded} onAnimationEnd={() => setPrevious(undefined)} /> : null}
    {loaded !== url ? <img key={url} alt="" className="experience-room-backdrop is-loading-wall" src={url} onError={onError} onLoad={async (event) => {
      const image = event.currentTarget;
      await image.decode().catch(() => {});
      if (!image.isConnected) return;
      onReady({ width: image.naturalWidth, height: image.naturalHeight });
      setPrevious(loaded);
      setLoaded(url);
    }} /> : null}
  </>;
}
