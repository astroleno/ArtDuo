"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import type { ExperienceEvent, ExperienceState } from "./state";
import type { DetailNavigation, ExhibitionSnapshot } from "./types";
import { Room } from "./room";
import { ViewingControls } from "./viewing-controls";
import type { ViewingSession, ViewingPreference, ViewingPace } from "./viewing-session";
import { adjacentWarmUrls, artworkWarmUrls, experiencePrewarm, type ConnectionHint } from "./media-prewarm";
import { useRoomMotion } from "./room-motion";
import { roomImageCandidate } from "./room-assets";

export function Walk({ snapshot, state, dispatch, onDetail, detailNavigation, onMediaRetry, onArtworkReady, reducedMotion, mouseMotion = true, onMouseMotionChange, audioControl, viewingSession, onPreference, onCancelPreference, onReadingChange, onTogglePace, onClearObservations, storageAvailable, pace }: {
  snapshot: ExhibitionSnapshot;
  state: ExperienceState;
  dispatch: (event: ExperienceEvent) => void;
  onDetail: (artworkId: string) => void;
  detailNavigation?: DetailNavigation;
  onMediaRetry: (artworkId: string) => void;
  onArtworkReady: (unitId: string) => void;
  reducedMotion: boolean;
  mouseMotion?: boolean;
  onMouseMotionChange?: (enabled: boolean) => void;
  audioControl?: ReactNode;
  viewingSession: ViewingSession;
  onPreference: (preference: ViewingPreference) => void;
  onCancelPreference: () => void;
  onReadingChange: (open: boolean) => void;
  onTogglePace: () => void;
  onClearObservations: () => void;
  storageAvailable: boolean;
  pace: ViewingPace;
}) {
  const index = snapshot.units.findIndex((unit) => unit.exhibition.unitId === state.unitId);
  const unit = snapshot.units[index >= 0 ? index : 0];
  const previousUnit = snapshot.units[index - 1];
  const nextUnit = snapshot.units[index + 1];
  useEffect(() => {
    experiencePrewarm.retain([previousUnit, unit, nextUnit].flatMap(candidate => candidate
      ? [candidate.media.previewUrl, candidate.media.depthMapUrl, candidate.media.backgroundUrl].filter((url): url is string => Boolean(url)) : []));
  }, [previousUnit?.artwork.id, unit?.artwork.id, nextUnit?.artwork.id]);
  const [readyId, setReadyId] = useState<string>();
  const [roomReadyId, setRoomReadyId] = useState<string>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDialogElement>(null);
  const settingsTrigger = useRef<HTMLButtonElement>(null);
  const motion = useRoomMotion(reducedMotion, settingsOpen || state.overlay !== "none" || state.transitioning, mouseMotion);
  const closeSettings = () => { setSettingsOpen(false); onReadingChange(false); };
  useEffect(() => {
    const dialog = settingsRef.current;
    if (!dialog) return;
    if (settingsOpen && !dialog.open) dialog.showModal();
    else if (!settingsOpen && dialog.open) { dialog.close(); settingsTrigger.current?.focus({ preventScroll: true }); }
  }, [settingsOpen]);
  const arrival = useRef({ id: unit?.artwork.id, started: typeof performance === "undefined" ? 0 : performance.now() });
  if (arrival.current.id !== unit?.artwork.id) arrival.current = { id: unit?.artwork.id, started: performance.now() };
  const artworkReady = useCallback((id: string) => {
    setReadyId(id);
    onArtworkReady(id);
    if (unit && id === unit.exhibition.unitId) window.dispatchEvent(new CustomEvent("artduo:artwork-ready", { detail: {
      artworkId: unit.artwork.id, durationMs: performance.now() - arrival.current.started, prewarmed: experiencePrewarm.ready(unit.media.previewUrl),
    } }));
  }, [unit?.artwork.id, unit?.exhibition.unitId, unit?.media.previewUrl, onArtworkReady]);
  const walkRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!state.transitioning) return;
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      const animations = walkRef.current?.getAnimations({ subtree: true }).filter((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        return animation.effect?.getTiming().iterations !== Infinity && target instanceof Element
          && Boolean(target.closest(".experience-frame-shadow, .experience-room-backdrop"));
      }) ?? [];
      void Promise.all(animations.map((animation) => animation.finished.catch(() => {}))).then(() => {
        if (!cancelled) dispatch({ type: "RESTORE_TRANSITION" });
      });
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [state.transitioning, state.unitId, reducedMotion, dispatch]);
  const lightboxChanged = useCallback((expanded: boolean) => {
    dispatch({ type: expanded ? "OPEN_LIGHTBOX" : "CLOSE_OVERLAY" });
  }, [dispatch]);
  useEffect(() => {
    if (!unit || readyId !== unit.exhibition.unitId || roomReadyId !== unit.exhibition.unitId || !navigator.onLine) return;
    const assets = (candidate: typeof nextUnit) => artworkWarmUrls(candidate?.media, unit.media.backgroundUrl);
    const urls = adjacentWarmUrls(assets(nextUnit), assets(previousUnit), (navigator as Navigator & { connection?: ConnectionHint }).connection);
    const controller = new AbortController(), started = performance.now();
    const backgrounds = new Map([nextUnit, previousUnit].flatMap(candidate => candidate?.media.backgroundUrl
      ? [[candidate.media.backgroundUrl, roomImageCandidate(candidate.media.backgroundUrl, window.innerWidth, window.devicePixelRatio, candidate.media.backgroundUrlSmall)]] : []));
    void Promise.all(urls.map(url => experiencePrewarm.warm(url, controller.signal, backgrounds.get(url) ?? url))).then(results => {
      if (!controller.signal.aborted && urls.length) window.dispatchEvent(new CustomEvent("artduo:media-prewarmed", { detail: {
        artworkId: unit.artwork.id, nextArtworkId: nextUnit?.artwork.id, durationMs: performance.now() - started, prepared: results.filter(Boolean).length, requested: urls.length,
      } }));
    });
    return () => controller.abort();
  }, [readyId, roomReadyId, unit?.exhibition.unitId, unit?.media.backgroundUrl, previousUnit?.media.previewUrl, previousUnit?.media.depthMapUrl, previousUnit?.media.backgroundUrl, nextUnit?.media.previewUrl, nextUnit?.media.depthMapUrl, nextUnit?.media.backgroundUrl]);
  const markMediaFailed = useCallback(() => {
    window.dispatchEvent(new CustomEvent("artduo:experience-degraded", { detail: { reason: "artwork-media-unavailable", artworkId: unit.artwork.id } }));
    if (unit) dispatch({ type: "MEDIA_FAILED", artworkId: unit.artwork.id });
  }, [dispatch, unit?.artwork.id]);
  if (!unit) return null;
  const stage = snapshot.stages.find((candidate) => candidate.id === unit.stageId);
  return <div className={`experience-walk ${state.transitioning ? "is-transitioning" : ""}`} ref={walkRef}>
    <button ref={settingsTrigger} className="experience-settings-trigger" aria-label="观展设置" aria-haspopup="dialog" aria-expanded={settingsOpen}
      onClick={() => { setSettingsOpen(true); onReadingChange(true); }} type="button"><span aria-hidden="true">•••</span></button>
    <dialog ref={settingsRef} className="experience-settings-panel" aria-label="观展设置" onCancel={event => { event.preventDefault(); closeSettings(); }}
      onKeyDown={event => event.stopPropagation()} onClick={event => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) closeSettings();
      }}>
      <header><h2>观展设置</h2><button autoFocus aria-label="关闭观展设置" onClick={closeSettings} type="button">×</button></header>
      <label className="experience-motion-choice"><span>画面轻动<small>{reducedMotion ? "已遵循系统的减少动态效果设置" : "轻移画面，感受前后层次"}</small></span>
        <input type="checkbox" checked={mouseMotion && !reducedMotion} disabled={reducedMotion} onChange={event => onMouseMotionChange?.(event.target.checked)} /></label>
      <div className="experience-settings-audio">{audioControl}</div>
      {motion.available ? <button aria-label={!mouseMotion ? "先开启画面轻动，再开启手机感应" : motion.enabled ? "关闭手机感应" : "开启手机感应"}
        aria-pressed={motion.enabled} className="experience-settings-motion" disabled={!mouseMotion || motion.state === "requesting"}
        onClick={() => void motion.toggle()} type="button">{!mouseMotion ? "先开启画面轻动" : motion.state === "requesting" ? "正在开启感应" : motion.enabled ? "关闭手机感应" : "开启手机感应"}</button> : null}
      {motion.message ? <p role="status">{motion.message}</p> : null}
      <details className="experience-settings-exhibition"><summary>本次展览</summary>
        <p className="experience-eyebrow">{snapshot.units.length} 件作品</p>
        <p>{snapshot.preface.text}</p>
        <ViewingControls session={viewingSession} onPreference={onPreference} onCancel={onCancelPreference} onTogglePace={onTogglePace} onClear={onClearObservations} storageAvailable={storageAvailable} />
      </details>
    </dialog>
    <Room
      count={snapshot.units.length}
      entryHref={`/?${new URLSearchParams({ view: "experience", query: snapshot.query }).toString()}`}
      index={index}
      mediaFailed={state.failedMediaIds.includes(unit.artwork.id)}
      onDetail={() => onDetail(unit.artwork.id)}
      detailNavigation={detailNavigation}
      onNext={() => dispatch({ type: "NEXT" })}
      onLightboxNext={() => dispatch({ type: "LIGHTBOX_NEXT" })}
      onLightboxPrevious={() => dispatch({ type: "LIGHTBOX_PREVIOUS" })}
      onMediaFailed={markMediaFailed}
      onLightboxChange={lightboxChanged}
      onArtworkReady={artworkReady}
      onRoomReady={setRoomReadyId}
      onPrevious={() => dispatch({ type: "PREVIOUS" })}
      onRetryMedia={() => onMediaRetry(unit.artwork.id)}
      onTogglePlaque={() => dispatch({ type: state.overlay === "plaque" ? "CLOSE_OVERLAY" : "OPEN_PLAQUE" })}
      plaqueOpen={state.overlay === "plaque"}
      reducedMotion={reducedMotion}
      motion={motion}
      mouseMotion={mouseMotion}
      stageLabel={stage?.label}
      stage={stage}
      transitioning={state.transitioning}
      unit={unit}
      pace={pace}
    />
    <div aria-live="polite" className="sr-only">正在观看第 {index + 1} 件，共 {snapshot.units.length} 件作品：{unit.artwork.metadata.title}</div>
  </div>;
}
