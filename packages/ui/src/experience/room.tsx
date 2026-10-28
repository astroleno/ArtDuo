"use client";

import { appPath } from "@artduo/contracts";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { ImageLightbox } from "../immersive/image-lightbox";
import type { ImmersiveGalleryUnit } from "../immersive/scene-orchestrator";
import { calculateRoomLayout, sceneMountZone, type RoomPlaqueSize } from "./layout";
import { DepthParallaxCanvas } from "./depth-parallax-canvas";
import type { DetailNavigation, ExperienceStage, ExperienceUnit } from "./types";
import { AtmosphereLayer } from "./atmosphere-layer";
import { Plaque } from "./plaque";
import type { ViewingPace } from "./viewing-session";
import { artworkAspectRatio } from "./scene-matching";
import { roomLightMood, roomLightProfile } from "./room-lighting";
import { RoomLightingLayer } from "./room-lighting-layer";
import type { useRoomMotion } from "./room-motion";
import { experienceArtistName } from "./artwork-credits";
import { ROOM_IMAGE_SIZES, roomImageSrcSet } from "./room-assets";
import { experienceImageSource, experiencePrewarm } from "./media-prewarm";
import { RoomBackdrop } from "./room-backdrop";
import { roomParallaxInput } from "./room-parallax";

export function Room({ unit, index, count, stage, stageLabel, entryHref = "/?view=experience", reducedMotion, motion, mouseMotion, plaqueOpen, onTogglePlaque, onDetail, detailNavigation, onPrevious, onNext, onLightboxNext, onLightboxPrevious, onLightboxRestore, onRetryMedia, onMediaFailed, onLightboxChange, onArtworkReady, onRoomReady, mediaFailed, transitioning = false, pace = "steady" }: {
  unit: ExperienceUnit;
  index: number;
  count: number;
  stageLabel?: string;
  stage?: ExperienceStage;
  entryHref?: string;
  reducedMotion: boolean;
  motion: ReturnType<typeof useRoomMotion>;
  mouseMotion: boolean;
  plaqueOpen: boolean;
  onTogglePlaque: () => void;
  onDetail: () => void;
  detailNavigation?: DetailNavigation;
  onPrevious: () => void;
  onNext: () => void;
  onLightboxNext: () => void;
  onLightboxPrevious: () => void;
  onLightboxRestore?: (artworkId: string) => void;
  onRetryMedia: () => void;
  onMediaFailed: () => void;
  onLightboxChange: (expanded: boolean) => void;
  onArtworkReady: (unitId: string) => void;
  onRoomReady: (unitId: string) => void;
  mediaFailed: boolean;
  transitioning?: boolean;
  pace?: ViewingPace;
}) {
  const [viewport, setViewport] = useState({ width: 1440, height: 900 });
  const [loadedScene, setLoadedScene] = useState<{ url: string; currentSrc: string; width: number; height: number }>();
  const sceneSize = loadedScene && loadedScene.url === unit.media.backgroundUrl ? loadedScene
    : { width: unit.scene?.image_info.width ?? 1600, height: unit.scene?.image_info.height ?? 900 };
  const [failedBackgroundUrl, setFailedBackgroundUrl] = useState<string>();
  const backgroundFailed = Boolean(unit.media.backgroundUrl && failedBackgroundUrl === unit.media.backgroundUrl);
  const [retryToken, setRetryToken] = useState(0);
  const [lightboxExpanded, setLightboxExpanded] = useState(false);
  const [detailReadyId, setDetailReadyId] = useState<string>();
  const pointer = useMemo(() => roomParallaxInput(motion.input), [motion.input]);
  const lightProfile = useMemo(() => roomLightProfile(unit.scene?.id, unit.media.roomLightMaps), [unit.scene?.id, unit.media.roomLightMaps]);
  const lightingMood = useMemo(() => roomLightMood(stage), [stage]);
  const [lightingState, setLightingState] = useState<"loading" | "ready" | "fallback">("loading");
  const [loadedArtwork, setLoadedArtwork] = useState<{ id: string; size: { width: number; height: number } } | null>(null);
  const [paintedId, setPaintedId] = useState<string>();
  const [enhancementId, setEnhancementId] = useState<string>();
  const [measuredPlaque, setMeasuredPlaque] = useState<{ id: string; size: RoomPlaqueSize } | null>(null);
  const artworkSize = loadedArtwork?.id === unit.artwork.id ? loadedArtwork.size : null;
  const plaqueMeasureWidth = Math.max(1, Math.min(156, viewport.width - 40));
  const plaqueSize = measuredPlaque?.id === unit.artwork.id && measuredPlaque.size.width === plaqueMeasureWidth
    ? measuredPlaque.size : { width: plaqueMeasureWidth, height: 90 };
  const essentialReady = Boolean(artworkSize) && (!unit.media.backgroundUrl || backgroundFailed || loadedScene?.url === unit.media.backgroundUrl);
  useEffect(() => {
    if (essentialReady && !mediaFailed) onRoomReady(unit.exhibition.unitId);
  }, [essentialReady, mediaFailed, unit.exhibition.unitId, onRoomReady]);
  useEffect(() => {
    if (paintedId !== unit.exhibition.unitId || !essentialReady || transitioning) return;
    // Upload enhancement textures after the settled artwork has painted. Doing
    // that work during a room transition delays its final frames on slower GPUs.
    const timer = window.setTimeout(() => setEnhancementId(unit.exhibition.unitId), 120);
    return () => window.clearTimeout(timer);
  }, [paintedId, essentialReady, transitioning, unit.exhibition.unitId]);
  const enhancementsReady = essentialReady && !transitioning && enhancementId === unit.exhibition.unitId;
  const roomRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    resize();
    window.addEventListener("resize", resize, { passive: true });
    return () => window.removeEventListener("resize", resize);
  }, []);
  const imageReady = useCallback((size: { width: number; height: number }) => setLoadedArtwork({ id: unit.artwork.id, size }), [unit.artwork.id]);
  const plaqueMeasured = useCallback((size: RoomPlaqueSize) => setMeasuredPlaque((previous) =>
    previous?.id === unit.artwork.id && previous.size.width === size.width && previous.size.height === size.height
      ? previous : { id: unit.artwork.id, size }), [unit.artwork.id]);
  const lightboxChanged = useCallback((expanded: boolean) => {
    setLightboxExpanded(expanded);
    onLightboxChange(expanded);
  }, [onLightboxChange]);
  useEffect(() => {
    if (!artworkSize || mediaFailed || transitioning || (lightboxExpanded && detailReadyId !== unit.artwork.id)) return;
    let cancelled = false;
    let frame = 0;
    const reportAfterPaint = async () => {
      if (document.visibilityState !== "visible") return;
      const walk = roomRef.current?.closest(".experience-walk");
      const animations = walk?.getAnimations({ subtree: true }).filter((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        return animation.effect?.getTiming().iterations !== Infinity && target instanceof Element
          && Boolean(target.closest(".experience-frame-shadow, .experience-room-backdrop"));
      }) ?? [];
      await Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
      if (cancelled) return;
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (!cancelled && document.visibilityState === "visible") {
            setPaintedId(unit.exhibition.unitId);
            onArtworkReady(unit.exhibition.unitId);
          }
        });
      });
    };
    void reportAfterPaint();
    document.addEventListener("visibilitychange", reportAfterPaint);
    return () => { cancelled = true; cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", reportAfterPaint); };
  }, [artworkSize, mediaFailed, transitioning, lightboxExpanded, detailReadyId, onArtworkReady, unit.exhibition.unitId, unit.artwork.id]);
  const retryMedia = useCallback(() => {
    setRetryToken((value) => value + 1);
    setLoadedArtwork(null);
    setFailedBackgroundUrl(undefined);
    onRetryMedia();
  }, [onRetryMedia]);
  const paper = /paper|woodblock|etching|engraving|lithograph|watercolou?r|ink|drawing|print/i.test(unit.artwork.metadata.medium ?? "");
  const frameBorder = paper ? 4 : 1;
  const frameInset = unit.displayCategory === "architecture-flat" ? 5
    : paper ? Math.min(28, Math.max(12, viewport.width * 0.024)) + frameBorder
    : unit.scene?.id === "bg-004" ? 9 : 6;
  const layout = useMemo(() => calculateRoomLayout({
    viewport, sceneSize, mountZone: backgroundFailed ? undefined : sceneMountZone(unit.scene), artworkAspectRatio: artworkSize ? artworkSize.width / artworkSize.height : artworkAspectRatio(unit),
    frameInset,
    navigationHeight: viewport.width < 768 ? 80 : 76,
    plaqueSize,
  }), [viewport, sceneSize.width, sceneSize.height, unit, artworkSize, backgroundFailed, frameInset, plaqueSize.width, plaqueSize.height]);
  const viewUnit: ImmersiveGalleryUnit = {
    id: unit.artwork.id,
    title: unit.artwork.metadata.title,
    artistDisplayName: experienceArtistName(unit),
    yearLabel: unit.artwork.metadata.yearLabel,
    imageUrl: unit.media.previewUrl,
    imageUrlFull: unit.media.fullUrl,
    depthMapUrl: unit.media.depthMapUrl,
    requireDepthMap: true,
    aspectRatioHint: unit.artwork.media.aspectRatioHint,
      backgroundSceneUrl: loadedScene && loadedScene.url === unit.media.backgroundUrl ? loadedScene.currentSrc : unit.media.backgroundUrl,
    backgroundSceneId: unit.scene?.id,
    lightingMood,
    sceneLabel: unit.scene?.asset.label_cn,
    stageLabel,
    emotionalIntensity: stage?.intensity ?? .5,
    affectState: stage,
    growthStageRole: stage?.role,
    transitionIntent: stage?.transitionIntent,
    growthStageId: unit.stageId ?? undefined,
    transitionFamily: unit.transitionFamily,
    displayMode: unit.displayCategory,
    visualPresentation: {
      contentAspectRatio: artworkSize ? artworkSize.width / artworkSize.height : artworkAspectRatio(unit),
      cropStrategy: "preserve-paper",
    },
  };
  const imageRatio = `${Math.max(1, layout.frame.width)} / ${Math.max(1, layout.frame.height)}`;
  const plaqueTop = layout.plaque.y;

  return <section
    className={`experience-room ${layout.staticFallback ? "is-static-fallback" : ""} ${reducedMotion ? "is-reduced-motion" : ""} ${transitioning ? "is-transitioning" : ""}`}
    data-display-mode={unit.displayCategory}
    data-transition-family={unit.transitionFamily}
    data-viewing-pace={pace}
    data-frame-material={paper ? "paper" : "canvas"}
    data-scene-id={unit.scene?.id ?? "neutral"}
    data-scene-state={backgroundFailed || !unit.media.backgroundUrl ? "fallback" : loadedScene?.url === unit.media.backgroundUrl ? "ready" : "loading"}
    data-wall-tone={unit.scene?.id === "bg-004" ? "warm" : unit.scene?.id === "bg-027" ? "cool" : "neutral"}
    data-wall-light={unit.sceneMatch?.lightDirection ?? (unit.scene?.id === "bg-004" ? "left" : "top")}
    data-light-profile={lightProfile?.shape ?? "ambient"}
    data-relighting-state={lightingState}
    data-room-motion-state={motion.state}
    data-mouse-motion={mouseMotion && !reducedMotion ? "on" : "off"}
    data-light-exposure={lightingMood.exposure.toFixed(4)}
    data-light-warmth={lightingMood.warmth.toFixed(4)}
    data-testid="experience-room"
    data-scene-chapter={unit.sceneMatch?.chapter?.index}
    style={{ "--art-center-x": `${layout.frame.x + layout.frame.width / 2}px`, "--art-center-y": `${layout.frame.y + layout.frame.height / 2}px`,
      "--art-width": `${layout.frame.width}px`, "--art-height": `${layout.frame.height}px`, "--art-top": `${layout.frame.y}px`,
      "--room-light-x": String(motion.input.x), "--room-light-y": String(motion.input.y) } as CSSProperties}
    ref={roomRef}
    onPointerMove={(event) => {
      if (reducedMotion || !mouseMotion || event.pointerType !== "mouse" || lightboxExpanded) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      motion.setPointer({ x: ((event.clientX - bounds.left) / bounds.width - 0.5) * 2, y: ((event.clientY - bounds.top) / bounds.height - 0.5) * 2 });
    }}
    onPointerLeave={() => motion.setPointer({ x: 0, y: 0 }, true)}
  >
    {unit.media.backgroundUrl && !experiencePrewarm.ready(unit.media.backgroundUrl) ? <link rel="preload" as="image" crossOrigin="anonymous" href={unit.media.backgroundUrl} imageSrcSet={roomImageSrcSet(unit.media.backgroundUrl, unit.media.backgroundUrlSmall)} imageSizes={ROOM_IMAGE_SIZES} fetchPriority="high" /> : null}
    <div aria-hidden="true" className="experience-room-backdrop experience-room-fallback" />
    {unit.media.backgroundUrl && !backgroundFailed ? <RoomBackdrop reducedMotion={reducedMotion} url={unit.media.backgroundUrl} smallUrl={unit.media.backgroundUrlSmall} onError={() => {
      setFailedBackgroundUrl(unit.media.backgroundUrl);
      window.dispatchEvent(new CustomEvent("artduo:experience-degraded", { detail: { reason: "background-scene-unavailable", artworkId: unit.artwork.id } }));
    }} onReady={(size) => setLoadedScene({ ...size, url: unit.media.backgroundUrl! })} /> : null}
    <RoomLightingLayer imageUrl={loadedScene && loadedScene.url === unit.media.backgroundUrl ? loadedScene.currentSrc : undefined} profile={lightProfile} input={motion.input} mood={lightingMood}
      active={enhancementsReady && !reducedMotion && mouseMotion && !lightboxExpanded && !plaqueOpen && !backgroundFailed} onState={setLightingState} />
    <div aria-hidden="true" className="experience-room-shade" />
    <AtmosphereLayer reducedMotion={reducedMotion} tone={unit.scene?.visual_profile.lighting[0] ?? "warm"} />
    <header className="experience-room-header">
      <a aria-label="ArtDuo，重新选一组作品" className="experience-mark" href={appPath(entryHref)}>ArtDuo</a>
      <div className="experience-room-meta"><span>{unit.scene?.asset.label_cn ?? "静光展厅"}</span><span>{String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}</span></div>
    </header>
    {mediaFailed && !lightboxExpanded ? <div className="experience-media-fallback" role="status">
      <p>这件作品暂时无法载入，展签和路线仍可继续。</p><button onClick={retryMedia} type="button">重试载入</button>
    </div> : <div key={retryToken} className="experience-frame-shadow" style={{
      left: `${layout.frame.x}px`, top: `${layout.frame.y}px`, width: `${layout.frame.width}px`, height: `${layout.frame.height}px`, aspectRatio: imageRatio,
      "--frame-inset": `${Math.max(0, layout.frameInset - frameBorder)}px`,
    } as CSSProperties}>
      <ImageLightbox key={retryToken} className="experience-art-lightbox" onExpandedChange={lightboxChanged} onImageReady={imageReady} onImageError={onMediaFailed}
        motionEnabled={mouseMotion && !reducedMotion}
        hasPrevious={index > 0 && !transitioning} hasNext={index < count - 1 && !transitioning} onPrevious={onLightboxPrevious} onNext={onLightboxNext}
        onRestoreArtwork={onLightboxRestore}
        onExpandedArtworkReady={setDetailReadyId} previewSource={experienceImageSource(unit.media.previewUrl)} unit={viewUnit} />
      <DepthParallaxCanvas active={enhancementsReady && mouseMotion && !lightboxExpanded && !plaqueOpen && !mediaFailed && Boolean(unit.media.depthMapUrl)} depthMapUrl={unit.media.depthMapUrl ? experienceImageSource(unit.media.depthMapUrl) : undefined} imageUrl={experienceImageSource(unit.media.previewUrl)} pointer={pointer} reducedMotion={reducedMotion} />
    </div>}
    <div className={`experience-plaque-position ${layout.mobilePlaque ? "is-mobile" : ""}`} data-placement={layout.plaquePlacement} style={{
      left: `${layout.plaque.x}px`, top: `${plaqueTop}px`, width: `${layout.plaque.width}px`,
      height: `${layout.plaque.height}px`,
      "--plaque-max-height": `${layout.plaque.height}px`,
    } as CSSProperties}>
      <Plaque unit={unit} previewSource={experienceImageSource(unit.media.previewUrl)} backgroundSource={unit.media.backgroundUrl ? experienceImageSource(unit.media.backgroundUrl) : undefined} expanded={plaqueOpen} onToggle={onTogglePlaque} onDetail={onDetail} detailNavigation={detailNavigation} onSizeChange={plaqueMeasured} measureWidth={plaqueMeasureWidth} />
    </div>
    <nav className="experience-walk-controls" aria-label="作品导航">
      <button aria-label="上一件作品" disabled={index === 0} onClick={onPrevious} type="button">← <span>上一件</span></button>
      <button aria-label={index === count - 1 ? "进入结语" : "下一件作品"} className="experience-next" onClick={onNext} type="button">{index === count - 1 ? "看完了" : "下一件"} <span aria-hidden="true">→</span></button>
    </nav>
    {motion.message ? <p className="experience-motion-status" role="status">{motion.message}</p> : null}
  </section>;
}
