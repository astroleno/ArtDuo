"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import type { ExperienceEvent, ExperienceState } from "./state";
import type { DetailNavigation, ExhibitionSnapshot, NarrativeBlock } from "./types";
import { Room } from "./room";
import { ViewingControls } from "./viewing-controls";
import type { ViewingSession, ViewingPreference, ViewingPace } from "./viewing-session";
import { adjacentWarmUrls, experiencePrewarm, type ConnectionHint } from "./media-prewarm";
import { useRoomMotion } from "./room-motion";
import { roomImageCandidate } from "./room-assets";
import { useOverlayHistory } from "./use-overlay-history";
import { stageTransitionProfile } from "./stage-transition";

export function Walk({ snapshot, preface, onPrefaceVisibilityChange, state, dispatch, onDetail, detailNavigation, onMediaRetry, onArtworkReady, reducedMotion, mouseMotion = true, onMouseMotionChange, audioControl, viewingSession, onPreference, onCancelPreference, onReadingChange, onTogglePace, onClearObservations, storageAvailable, pace, onSculptureInvitation }: {
  snapshot: ExhibitionSnapshot;
  preface: NarrativeBlock | null;
  onPrefaceVisibilityChange: (visible: boolean) => void;
  state: ExperienceState;
  dispatch: (event: ExperienceEvent) => void;
  onDetail: (artworkId: string) => void;
  detailNavigation?: DetailNavigation;
  onMediaRetry: (artworkId: string) => void;
  onArtworkReady: (unitId: string, preview: { image: HTMLImageElement; source: string }) => void;
  onSculptureInvitation?: () => void;
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
  const fromIndex = state.transitionFromUnitId ? snapshot.units.findIndex(candidate => candidate.exhibition.unitId === state.transitionFromUnitId) : -1;
  const origin = snapshot.units[fromIndex];
  const stage = snapshot.stages.find(candidate => candidate.id === unit?.stageId);
  const transition = stageTransitionProfile({ from: snapshot.stages.find(candidate => candidate.id === origin?.stageId),
    to: stage, fromIndex, toIndex: index, count: snapshot.units.length });
  const motionEnabled = !reducedMotion && mouseMotion;
  useEffect(() => {
    experiencePrewarm.retain([previousUnit, unit, nextUnit].flatMap(candidate => candidate
      ? [candidate.media.previewUrl, candidate.media.depthMapUrl, candidate.media.backgroundUrl].filter((url): url is string => Boolean(url)) : []));
  }, [previousUnit?.artwork.id, unit?.artwork.id, nextUnit?.artwork.id]);
  const [readySeq, setReadySeq] = useState<number>();
  const [roomReadySeq, setRoomReadySeq] = useState<number>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exhibitionOpen, setExhibitionOpen] = useState(false);
  useEffect(() => { onPrefaceVisibilityChange(settingsOpen && exhibitionOpen); }, [settingsOpen, exhibitionOpen, onPrefaceVisibilityChange]);
  useEffect(() => () => onPrefaceVisibilityChange(false), [onPrefaceVisibilityChange]);
  const settingsRef = useRef<HTMLDialogElement>(null);
  const settingsTrigger = useRef<HTMLButtonElement>(null);
  const restoreSettingsFocus = useRef(true);
  const motion = useRoomMotion(reducedMotion, settingsOpen || state.overlay !== "none" || state.transitioning, mouseMotion);
  const closeSettings = useOverlayHistory(settingsOpen, sameView => {
    restoreSettingsFocus.current = sameView;
    setSettingsOpen(false); onReadingChange(false);
  });
  useEffect(() => {
    const dialog = settingsRef.current;
    if (!dialog) return;
    if (settingsOpen && !dialog.open) { restoreSettingsFocus.current = true; dialog.showModal(); }
    else if (!settingsOpen && dialog.open) { dialog.close(); if (restoreSettingsFocus.current) settingsTrigger.current?.focus({ preventScroll: true }); }
  }, [settingsOpen]);
  const arrival = useRef({ seq: state.transitionSeq, started: typeof performance === "undefined" ? 0 : performance.now() });
  if (arrival.current.seq !== state.transitionSeq) arrival.current = { seq: state.transitionSeq, started: performance.now() };
  const artworkReady = useCallback((id: string, timing: { rafMs: number; image: HTMLImageElement; source: string }) => {
    if (arrival.current.seq !== state.transitionSeq) return;
    setReadySeq(state.transitionSeq);
    onArtworkReady(id, timing);
    if (unit && id === unit.exhibition.unitId) window.dispatchEvent(new CustomEvent("artduo:artwork-ready", { detail: {
      artworkId: unit.artwork.id, durationMs: performance.now() - arrival.current.started, prewarmed: experiencePrewarm.ready(unit.media.previewUrl),
      seq: state.transitionSeq, rafMs: timing.rafMs,
    } }));
  }, [unit?.artwork.id, unit?.exhibition.unitId, unit?.media.previewUrl, onArtworkReady, state.transitionSeq]);
  const roomReady = useCallback((id: string) => {
    if (arrival.current.seq === state.transitionSeq && unit?.exhibition.unitId === id) setRoomReadySeq(state.transitionSeq);
  }, [state.transitionSeq, unit?.exhibition.unitId]);
  useEffect(() => {
    if (!state.transitioning) return;
    const complete = () => dispatch({ type: "RESTORE_TRANSITION", seq: state.transitionSeq });
    const frame = requestAnimationFrame(complete);
    return () => cancelAnimationFrame(frame);
  }, [state.transitioning, state.transitionSeq, dispatch]);
  const lightboxChanged = useCallback((expanded: boolean) => {
    dispatch({ type: expanded ? "OPEN_LIGHTBOX" : "CLOSE_OVERLAY" });
  }, [dispatch]);
  useEffect(() => {
    if (!unit || readySeq !== state.transitionSeq || roomReadySeq !== state.transitionSeq || !navigator.onLine) return;
    const urls = adjacentWarmUrls(nextUnit?.media, previousUnit?.media, {
      currentBackground: unit.media.backgroundUrl,
      connection: (navigator as Navigator & { connection?: ConnectionHint }).connection,
      reducedMotion,
      mouseMotion,
    });
    const controller = new AbortController(), started = performance.now();
    const backgrounds = new Map([nextUnit, previousUnit].flatMap(candidate => candidate?.media.backgroundUrl
      ? [[candidate.media.backgroundUrl, roomImageCandidate(candidate.media.backgroundUrl, window.innerWidth, window.devicePixelRatio, candidate.media.backgroundUrlSmall)]] : []));
    void Promise.all(urls.map(url => experiencePrewarm.warm(url, controller.signal, backgrounds.get(url) ?? url))).then(results => {
      if (!controller.signal.aborted && urls.length) window.dispatchEvent(new CustomEvent("artduo:media-prewarmed", { detail: {
        artworkId: unit.artwork.id, nextArtworkId: nextUnit?.artwork.id, durationMs: performance.now() - started, prepared: results.filter(Boolean).length, requested: urls.length,
      } }));
    });
    return () => controller.abort();
  }, [readySeq, roomReadySeq, state.transitionSeq, unit?.exhibition.unitId, unit?.media.backgroundUrl, previousUnit?.media.previewUrl, previousUnit?.media.depthMapUrl, previousUnit?.media.backgroundUrl, previousUnit?.media.backgroundUrlSmall, nextUnit?.media.previewUrl, nextUnit?.media.depthMapUrl, nextUnit?.media.backgroundUrl, nextUnit?.media.backgroundUrlSmall, reducedMotion, mouseMotion]);
  const markMediaFailed = useCallback(() => {
    window.dispatchEvent(new CustomEvent("artduo:experience-degraded", { detail: { reason: "artwork-media-unavailable", artworkId: unit.artwork.id } }));
    if (unit) dispatch({ type: "MEDIA_FAILED", artworkId: unit.artwork.id });
  }, [dispatch, unit?.artwork.id]);
  if (!unit) return null;
  return <div className={`experience-walk ${state.transitioning ? "is-transitioning" : ""}`} data-stage-motion={motionEnabled ? "on" : "off"}>
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
      {motion.available ? <button aria-pressed={motion.enabled} className="experience-settings-motion" disabled={!mouseMotion || motion.state === "requesting"}
        onClick={() => void motion.toggle()} type="button">{!mouseMotion ? "先开启画面轻动" : motion.state === "requesting" ? "正在开启感应" : motion.enabled ? "关闭手机感应" : "开启手机感应"}</button> : null}
      {motion.message ? <p role="status">{motion.message}</p> : null}
      <details className="experience-settings-exhibition" onToggle={event => setExhibitionOpen(event.currentTarget.open)}><summary>本次展览</summary>
        <p className="experience-eyebrow">{snapshot.units.length} 件作品</p>
        {preface ? <p className="experience-presented-preface">{preface.text}</p> : <p className="experience-narrative-pending" role="status">这次展览正在展开。</p>}
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
      onSculptureInvitation={onSculptureInvitation}
      onLightboxNext={() => dispatch({ type: "LIGHTBOX_NEXT" })}
      onLightboxPrevious={() => dispatch({ type: "LIGHTBOX_PREVIOUS" })}
      onLightboxRestore={artworkId => dispatch({ type: "LIGHTBOX_RESTORE", artworkId })}
      onMediaFailed={markMediaFailed}
      onLightboxChange={lightboxChanged}
      onArtworkReady={artworkReady}
      onRoomReady={roomReady}
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
      transition={transition}
      transitionSeq={state.transitionSeq}
      unit={unit}
      pace={pace}
    />
    <div aria-live="polite" className="sr-only">正在观看第 {index + 1} 件，共 {snapshot.units.length} 件作品：{unit.artwork.metadata.title}</div>
  </div>;
}
