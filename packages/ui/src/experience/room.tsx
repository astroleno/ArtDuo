"use client";

import { appPath } from "@artduo/contracts";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { ImageLightbox } from "../immersive/image-lightbox";
import type { ImmersiveGalleryUnit } from "../immersive/scene-orchestrator";
import { calculateRoomLayout, sceneMountZone, type RoomPlaqueSize } from "./layout";
import { DepthParallaxCanvas } from "./depth-parallax-canvas";
import type { DetailNavigation, ExperienceStage, ExperienceUnit } from "./types";
import { AtmosphereLayer } from "./atmosphere-layer";
import { Plaque } from "./plaque";
import type { ViewingPace } from "./viewing-session";
import { artworkAspectRatio } from "./scene-matching";
import { roomFallbackShade, roomLightMood, roomLightProfile, roomMobileSurroundAlpha } from "./room-lighting";
import { RoomLightingLayer } from "./room-lighting-layer";
import type { useRoomMotion } from "./room-motion";
import { recordedArtistName, recordedArtworkCreditLines } from "./artwork-credits";
import { ROOM_IMAGE_SIZES, roomImageSrcSet } from "./room-assets";
import { experienceImageSource, experiencePrewarm } from "./media-prewarm";
import { RoomBackdrop } from "./room-backdrop";
import { roomParallaxInput } from "./room-parallax";
import { artworkPlaceholderRgb } from "./artwork-placeholder";
import { artworkRevealDuration, createStageMotionArrival, isLateNeutralReveal, LATE_NEUTRAL_REVEAL_MS, stageTransitionKeyframes, type StageTransitionProfile } from "./stage-transition";

function isCurrentPreviewNode(image: HTMLImageElement, source: string) {
  return image.isConnected && image.currentSrc === new URL(source, image.baseURI).href;
}

export function Room({ unit, index, count, stage, stageLabel, entryHref = "/?view=experience", reducedMotion, motion, mouseMotion, plaqueOpen, onTogglePlaque, onDetail, detailNavigation, onPrevious, onNext, onSculptureInvitation, onLightboxNext, onLightboxPrevious, onLightboxRestore, onRetryMedia, onMediaFailed, onLightboxChange, onArtworkReady, onRoomReady, mediaFailed, transitioning = false, transition, transitionSeq, pace = "steady" }: {
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
  onSculptureInvitation?: () => void;
  onLightboxNext: () => void;
  onLightboxPrevious: () => void;
  onLightboxRestore?: (artworkId: string) => void;
  onRetryMedia: () => void;
  onMediaFailed: () => void;
  onLightboxChange: (expanded: boolean) => void;
  onArtworkReady: (unitId: string, timing: { rafMs: number }) => void;
  onRoomReady: (unitId: string) => void;
  mediaFailed: boolean;
  transitioning?: boolean;
  transition: StageTransitionProfile;
  transitionSeq: number;
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
  const lightDepth = unit.media.roomLightMaps?.depthUrl;
  const lightNormal = unit.media.roomLightMaps?.normalUrl;
  const lightProfile = useMemo(() => roomLightProfile(unit.scene?.id,
    lightDepth !== undefined && lightNormal !== undefined ? { depthUrl: lightDepth, normalUrl: lightNormal } : undefined),
  [unit.scene?.id, lightDepth, lightNormal]);
  const lightingMood = useMemo(() => roomLightMood(stage), [stage]);
  const fallbackShade = useMemo(() => roomFallbackShade(lightingMood), [lightingMood]);
  const [lightingState, setLightingState] = useState<"loading" | "ready" | "fallback">("loading");
  const previewSource = experienceImageSource(unit.media.previewUrl);
  const [loadedArtwork, setLoadedArtwork] = useState<{ seq: number; source: string; image: HTMLImageElement; decodedAt: number; size: { width: number; height: number } } | null>(null);
  const [shownPreview, setShownPreview] = useState<typeof loadedArtwork>(null);
  const [settledPreview, setSettledPreview] = useState<typeof loadedArtwork>(null);
  const [visible, setVisible] = useState(true);
  const lastReady = useRef<typeof loadedArtwork>(null);
  const lastSettledSeq = useRef<number | undefined>(undefined);
  const [paintedSeq, setPaintedSeq] = useState<number>();
  const [enhancementSeq, setEnhancementSeq] = useState<number>();
  const [measuredPlaque, setMeasuredPlaque] = useState<{ id: string; size: RoomPlaqueSize } | null>(null);
  const decoded = loadedArtwork?.seq === transitionSeq && loadedArtwork.source === previewSource ? loadedArtwork : null;
  const previewShown = Boolean(decoded && shownPreview === decoded);
  const artworkSize = decoded?.size ?? null;
  const placeholderRgb = useMemo(() => artworkPlaceholderRgb(unit.artwork.metadata.colorTags, unit.appearance), [unit.artwork.metadata.colorTags, unit.appearance]);
  const plaqueMeasureWidth = Math.max(1, Math.min(156, viewport.width - 40));
  const plaqueSize = measuredPlaque?.id === unit.artwork.id && measuredPlaque.size.width === plaqueMeasureWidth
    ? measuredPlaque.size : { width: plaqueMeasureWidth, height: 90 };
  const essentialReady = Boolean(artworkSize) && (!unit.media.backgroundUrl || backgroundFailed || loadedScene?.url === unit.media.backgroundUrl);
  useEffect(() => {
    if (essentialReady && !mediaFailed) onRoomReady(unit.exhibition.unitId);
  }, [essentialReady, mediaFailed, unit.exhibition.unitId, onRoomReady]);
  useEffect(() => {
    if (paintedSeq !== transitionSeq || !essentialReady || transitioning) return;
    // Upload enhancement textures after the settled artwork has painted. Doing
    // that work during a room transition delays its final frames on slower GPUs.
    const timer = window.setTimeout(() => setEnhancementSeq(transitionSeq), 120);
    return () => window.clearTimeout(timer);
  }, [paintedSeq, essentialReady, transitioning, transitionSeq]);
  const enhancementsReady = essentialReady && !transitioning && enhancementSeq === transitionSeq;
  const sameWallAlreadyLit = lightingState === "ready" && loadedScene?.url === unit.media.backgroundUrl;
  const lightingActive = (enhancementsReady || sameWallAlreadyLit) && !reducedMotion && mouseMotion && !lightboxExpanded && !plaqueOpen && !backgroundFailed;
  const lightingImage = loadedScene && loadedScene.url === unit.media.backgroundUrl ? loadedScene.currentSrc : undefined;
  // A new wall or re-enabled canvas must paint before it can replace the fallback treatment.
  const lightingKey = useMemo(() => JSON.stringify([lightingActive, lightingImage, lightProfile?.sceneId, lightProfile?.depthUrl, lightProfile?.normalUrl]),
    [lightingActive, lightingImage, lightProfile]);
  const roomRef = useRef<HTMLElement>(null);
  const currentSeq = useRef(transitionSeq);
  currentSeq.current = transitionSeq;
  const arrival = useRef({ seq: transitionSeq, startedAt: performance.now() });
  if (arrival.current.seq !== transitionSeq) arrival.current = { seq: transitionSeq, startedAt: performance.now() };
  const { kind, direction, artworkMs, wallMs, wallOffsetPx } = transition;
  const motionAllowed = mouseMotion && !reducedMotion;
  const [consumeArrival] = useState(createStageMotionArrival);
  const [consumeArtworkArrival] = useState(createStageMotionArrival);
  useEffect(() => {
    const room = roomRef.current;
    const canAnimate = motionAllowed && kind !== "neutral" && room && typeof room.animate === "function";
    if (!canAnimate) { consumeArrival(transitionSeq, false); return; }
    let cancelled = false;
    const animations: Animation[] = [];
    // Deferring lets React discard a development-mode effect rehearsal
    // without consuming this arrival or briefly playing an animation twice.
    queueMicrotask(() => {
      if (cancelled || currentSeq.current !== transitionSeq || !consumeArrival(transitionSeq, true)) return;
      const frames = stageTransitionKeyframes({ kind, direction, artworkMs, wallMs, wallOffsetPx });
      const animate = (selector: string, keyframes: Keyframe[] | undefined, duration: number) => {
        if (!keyframes) return;
        for (const target of room.querySelectorAll(selector)) animations.push(target.animate(keyframes, { duration, easing: frames.easing }));
      };
      animate(".experience-room-shade", frames.shade, wallMs);
      // Keep the matching static wall under the photograph during its 4px move.
      animate(".experience-room-backdrop:not(.experience-room-fallback), .experience-room-lighting", frames.wall, wallMs);
    });
    return () => {
      cancelled = true;
      animations.forEach(animation => animation.cancel());
    };
  }, [transitionSeq, kind, direction, artworkMs, wallMs, wallOffsetPx, motionAllowed, consumeArrival]);
  useEffect(() => {
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    resize();
    window.addEventListener("resize", resize, { passive: true });
    return () => window.removeEventListener("resize", resize);
  }, []);
  const imageReady = useCallback((size: { width: number; height: number }, proof: { source: string; image: HTMLImageElement; decodedAt: number }) => {
    if (currentSeq.current !== transitionSeq || proof.source !== previewSource) return;
    setLoadedArtwork({ seq: transitionSeq, source: proof.source, image: proof.image, decodedAt: proof.decodedAt, size });
    window.dispatchEvent(new CustomEvent("artduo:artwork-decoded", { detail: { artworkId: unit.artwork.id, seq: transitionSeq, decodedAt: proof.decodedAt } }));
  }, [transitionSeq, previewSource, unit.artwork.id]);
  useEffect(() => {
    const updateVisibility = () => setVisible(document.visibilityState === "visible");
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);
  useLayoutEffect(() => {
    if (!motionAllowed) consumeArtworkArrival(transitionSeq, false);
    if (!decoded || !isCurrentPreviewNode(decoded.image, decoded.source) || !visible || document.visibilityState !== "visible" || lightboxExpanded) return;
    const frames = stageTransitionKeyframes({ kind, direction, artworkMs, wallMs, wallOffsetPx });
    const neutralLate = isLateNeutralReveal(kind, decoded.decodedAt - arrival.current.startedAt);
    const keyframes = frames.artwork ?? (neutralLate ? [{ opacity: .35 }, { opacity: 1 }] : undefined);
    const play = Boolean(motionAllowed && keyframes && typeof decoded.image.animate === "function");
    setShownPreview(decoded);
    if (!consumeArtworkArrival(transitionSeq, play) || !keyframes) {
      setSettledPreview(decoded);
      return;
    }
    const duration = neutralLate ? LATE_NEUTRAL_REVEAL_MS : artworkRevealDuration(artworkMs, performance.now() - arrival.current.startedAt);
    const animation = decoded.image.animate(keyframes, { duration, easing: frames.easing ?? "ease-out", fill: "backwards" });
    void animation.finished.then(() => {
      if (currentSeq.current === transitionSeq) setSettledPreview(decoded);
    }, () => undefined);
    return () => animation.cancel();
  }, [decoded, transitionSeq, motionAllowed, kind, direction, artworkMs, wallMs, wallOffsetPx, consumeArtworkArrival, visible, lightboxExpanded]);
  const plaqueMeasured = useCallback((size: RoomPlaqueSize) => setMeasuredPlaque((previous) =>
    previous?.id === unit.artwork.id && previous.size.width === size.width && previous.size.height === size.height
      ? previous : { id: unit.artwork.id, size }), [unit.artwork.id]);
  const lightboxChanged = useCallback((expanded: boolean) => {
    setLightboxExpanded(expanded);
    onLightboxChange(expanded);
  }, [onLightboxChange]);
  useEffect(() => {
    if (!decoded || lastReady.current?.seq === transitionSeq || mediaFailed
      || (lightboxExpanded ? detailReadyId !== unit.artwork.id : !previewShown)) return;
    let cancelled = false;
    let frame = 0;
    const reportAfterPaint = () => {
      if (document.visibilityState !== "visible") return;
      if (cancelled) return;
      const rafStartedAt = performance.now();
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (!cancelled && lastReady.current?.seq !== transitionSeq && currentSeq.current === transitionSeq && document.visibilityState === "visible"
            && isCurrentPreviewNode(decoded.image, decoded.source) && (lightboxExpanded || Number(getComputedStyle(decoded.image).opacity) > 0)) {
            lastReady.current = decoded;
            setPaintedSeq(transitionSeq);
            onArtworkReady(unit.exhibition.unitId, { rafMs: performance.now() - rafStartedAt });
          }
        });
      });
    };
    void reportAfterPaint();
    document.addEventListener("visibilitychange", reportAfterPaint);
    return () => { cancelled = true; cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", reportAfterPaint); };
  }, [decoded, previewShown, mediaFailed, lightboxExpanded, detailReadyId, onArtworkReady, transitionSeq, unit.exhibition.unitId, unit.artwork.id]);
  useEffect(() => {
    if (decoded && settledPreview === decoded && paintedSeq === transitionSeq && lastSettledSeq.current !== transitionSeq) {
      lastSettledSeq.current = transitionSeq;
      window.dispatchEvent(new CustomEvent("artduo:artwork-settled", { detail: { artworkId: unit.artwork.id, seq: transitionSeq } }));
    }
  }, [decoded, settledPreview, paintedSeq, transitionSeq, unit.artwork.id]);
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
    artistDisplayName: recordedArtistName(unit),
    creditDetails: recordedArtworkCreditLines(unit).details,
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
    data-stage-transition={kind}
    data-navigation-direction={direction}
    data-transition-seq={transitionSeq}
    data-artwork-placeholder={!mediaFailed && !previewShown ? "on" : "off"}
    data-artwork-reveal={!previewShown ? "waiting" : settledPreview === decoded ? "settled" : "revealing"}
    data-stage-motion={motionAllowed ? "on" : "off"}
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
      "--room-light-x": String(motion.input.x), "--room-light-y": String(motion.input.y),
      "--artwork-placeholder-rgb": previewShown ? undefined : placeholderRgb,
      "--room-mobile-surround-alpha": roomMobileSurroundAlpha(lightingMood.exposure),
      "--room-fallback-shade-alpha": fallbackShade.alpha, "--room-fallback-shade-stop": `${fallbackShade.stop}%` } as CSSProperties}
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
    {unit.media.backgroundUrl && !backgroundFailed ? <RoomBackdrop reducedMotion={!motionAllowed} url={unit.media.backgroundUrl} smallUrl={unit.media.backgroundUrlSmall} onError={sourceUrl => {
      if (sourceUrl !== unit.media.backgroundUrl) return;
      setFailedBackgroundUrl(sourceUrl);
      window.dispatchEvent(new CustomEvent("artduo:experience-degraded", { detail: { reason: "background-scene-unavailable", artworkId: unit.artwork.id } }));
    }} onReady={(size, sourceUrl) => {
      if (sourceUrl === unit.media.backgroundUrl) setLoadedScene({ ...size, url: sourceUrl });
    }} /> : null}
    <RoomLightingLayer key={lightingKey} imageUrl={lightingImage} profile={lightProfile} input={motion.input} mood={lightingMood}
      active={lightingActive} onState={setLightingState} />
    <div aria-hidden="true" className="experience-room-shade" />
    <AtmosphereLayer reducedMotion={!motionAllowed} tone={unit.scene?.visual_profile.lighting[0] ?? "warm"} />
    <header className="experience-room-header">
      <a aria-label="ArtDuo，返回入口" className="experience-mark" href={appPath(entryHref)}>ArtDuo</a>
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
        hasPrevious={index > 0} hasNext={index < count - 1} onPrevious={onLightboxPrevious} onNext={onLightboxNext}
        onRestoreArtwork={onLightboxRestore}
        onExpandedArtworkReady={setDetailReadyId} previewSource={previewSource} previewLifecycleKey={`${transitionSeq}:${retryToken}`} unit={viewUnit} />
      <DepthParallaxCanvas active={enhancementsReady && decoded !== null && settledPreview === decoded && mouseMotion && !lightboxExpanded && !plaqueOpen && !mediaFailed && Boolean(unit.media.depthMapUrl)} depthMapUrl={unit.media.depthMapUrl ? experienceImageSource(unit.media.depthMapUrl) : undefined} imageUrl={previewSource} pointer={pointer} reducedMotion={reducedMotion} />
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
      {onSculptureInvitation ? <button className="experience-sculpture-invitation" onClick={onSculptureInvitation} type="button">看一件雕塑</button> : null}
      <button aria-label={index === count - 1 ? "看完了，进入结语" : "下一件作品"} className="experience-next" onClick={onNext} type="button">{index === count - 1 ? "看完了" : "下一件"} <span aria-hidden="true">→</span></button>
    </nav>
    {motion.message ? <p className="experience-motion-status" role="status">{motion.message}</p> : null}
  </section>;
}
