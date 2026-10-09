"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AudioButton, useAmbientAudio } from "./audio-controller";
import { Closing } from "./closing";
import { Preface } from "./preface";
import { Walk } from "./walk";
import { createExperienceState, experienceReducer, positionOfExperienceState, type ExperienceEvent } from "./state";
import type { ExperiencePosition, ExhibitionSnapshot } from "./types";
import { applyPendingPreference, createViewingSession, observedPace, queuePreference, snapshotForSession, type ViewingPreference } from "./viewing-session";
import { useViewingObservation, useViewingSession } from "./use-viewing-session";

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);
  return reduced;
}

export function ExperienceShell({ snapshot: baseSnapshot, initialPosition, onPositionChange, onDetail, onRestart, onMilestone }: {
  snapshot: ExhibitionSnapshot;
  initialPosition: ExperiencePosition;
  onPositionChange: (position: ExperiencePosition, snapshot: ExhibitionSnapshot) => void;
  onDetail: (artworkId: string, position: ExperiencePosition, snapshot: ExhibitionSnapshot) => void;
  onRestart: () => void;
  onMilestone?: (phase: "first-artwork-visible" | "first-artwork-actionable") => void;
}) {
  const reducedMotion = useReducedMotion();
  const viewing = useViewingSession(baseSnapshot);
  const snapshot = useMemo(() => snapshotForSession(baseSnapshot, viewing.session), [baseSnapshot, viewing.session.order]);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const [state, setState] = useState(() => createExperienceState(snapshot, initialPosition));
  const [readingOpen, setReadingOpen] = useState(false);
  const [readyUnitId, setReadyUnitId] = useState<string>();
  const audio = useAmbientAudio(readingOpen || state.overlay === "plaque");
  const flushObservation = useViewingObservation({ controller: viewing, state, snapshot, readyUnitId, readingOpen });
  const pace = observedPace(viewing.session);
  const previousUnitRef = useRef(state.unitId);
  const firstWalkMarkedRef = useRef(false);
  const positionKey = `${state.act}:${state.unitId ?? ""}:${state.lastUnitId ?? ""}:${viewing.session.order.join(",")}`;
  const publishedPositionRef = useRef(positionKey);
  const [statusMessage, setStatusMessage] = useState("");
  const stateRef = useRef(state);
  const rawDispatch = useCallback((event: ExperienceEvent) => {
    const next = experienceReducer(stateRef.current, event, snapshotRef.current);
    stateRef.current = next;
    setState(next);
  }, []);
  const navigationLockedRef = useRef(false);
  const queuedNavigationRef = useRef<ExperienceEvent | null>(null);
  const dispatch = useCallback((event: ExperienceEvent) => {
    const isNavigation = event.type === "NEXT" || event.type === "PREVIOUS" || event.type === "SELECT_UNIT";
    const current = stateRef.current;
    if (event.type === "OPEN_LIGHTBOX") queuedNavigationRef.current = null;
    if (isNavigation && (current.overlay !== "none" || (readingOpen && event.type !== "SELECT_UNIT"))) return;
    if (isNavigation && (navigationLockedRef.current || current.transitioning)) {
      queuedNavigationRef.current = event;
      return;
    }
    flushObservation();
    if (event.type === "NEXT" && !current.transitioning) {
      const currentId = snapshotRef.current.units.find((unit) => unit.exhibition.unitId === current.unitId)?.artwork.id;
      if (currentId) {
        const updated = viewing.commit((session) => applyPendingPreference(session, baseSnapshot, currentId));
        snapshotRef.current = snapshotForSession(baseSnapshot, updated);
      }
    }
    const next = experienceReducer(current, event, snapshotRef.current);
    stateRef.current = next;
    if (next.transitioning) navigationLockedRef.current = true;
    setState(next);
  }, [baseSnapshot, viewing.commit, flushObservation, readingOpen]);

  useEffect(() => {
    stateRef.current = state;
    navigationLockedRef.current = state.transitioning;
    if (state.transitioning || !queuedNavigationRef.current) return;
    const queued = queuedNavigationRef.current;
    queuedNavigationRef.current = null;
    dispatch(queued);
  }, [dispatch, state]);

  useEffect(() => () => {
    queuedNavigationRef.current = null;
    navigationLockedRef.current = false;
  }, []);

  const onArtworkReady = useCallback((unitId: string) => {
    const current = stateRef.current;
    if (current.act === "walk" && current.unitId === unitId && !current.transitioning) setReadyUnitId(unitId);
    if (current.act !== "walk" || current.unitId !== unitId || current.transitioning || current.overlay === "lightbox" || firstWalkMarkedRef.current || !onMilestone) return;
    firstWalkMarkedRef.current = true;
    onMilestone("first-artwork-visible");
    onMilestone("first-artwork-actionable");
  }, [onMilestone]);

  const incomingPositionKey = `${initialPosition.phase}:${initialPosition.phase === "walk" ? initialPosition.unitId : initialPosition.phase === "closing" ? initialPosition.lastUnitId ?? "" : ""}`;
  const lastIncomingPosition = useRef(initialPosition);
  const restoringPositionKey = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (lastIncomingPosition.current === initialPosition) return;
    lastIncomingPosition.current = initialPosition;
    const currentPosition = positionOfExperienceState(state);
    const currentPositionKey = `${currentPosition.phase}:${currentPosition.phase === "walk" ? currentPosition.unitId : currentPosition.phase === "closing" ? currentPosition.lastUnitId ?? "" : ""}`;
    if (currentPositionKey !== incomingPositionKey) {
      restoringPositionKey.current = incomingPositionKey;
      queuedNavigationRef.current = null;
      navigationLockedRef.current = false;
      const restored = createExperienceState(snapshot, initialPosition);
      stateRef.current = restored;
      rawDispatch({ type: "RESTORE_POSITION", position: initialPosition });
    }
  }, [incomingPositionKey, initialPosition, rawDispatch, state]);

  useEffect(() => {
    const syncOnline = () => {
      const online = navigator.onLine;
      rawDispatch({ type: "CONNECTIVITY_CHANGED", online });
      setStatusMessage(online ? "网络已恢复。" : "当前离线，已准备的展览仍可继续浏览。" );
    };
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    rawDispatch({ type: "CONNECTIVITY_CHANGED", online: navigator.onLine });
    return () => {
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
    };
  }, []);

  useEffect(() => {
    const position = positionOfExperienceState(state);
    const currentKey = `${position.phase}:${position.phase === "walk" ? position.unitId : position.phase === "closing" ? position.lastUnitId ?? "" : ""}`;
    // A popstate restoration updates local state in an effect. Never publish
    // the previous render's position over the URL while that update is pending.
    if (restoringPositionKey.current && restoringPositionKey.current !== currentKey) return;
    restoringPositionKey.current = undefined;
    if (!viewing.hydrated || publishedPositionRef.current === positionKey) return;
    publishedPositionRef.current = positionKey;
    onPositionChange(position, snapshot);
  }, [onPositionChange, positionKey, state, snapshot, viewing.hydrated]);

  useEffect(() => {
    if (previousUnitRef.current !== state.unitId) {
      if (previousUnitRef.current && state.unitId) audio.dip(600);
      previousUnitRef.current = state.unitId;
      if (state.unitId) {
        const unit = snapshot.units.find((candidate) => candidate.exhibition.unitId === state.unitId);
        if (unit) setStatusMessage(`已准备作品：${unit.artwork.metadata.title}`);
      }
    }
  }, [audio.dip, snapshot.units, state.unitId]);

  useEffect(() => {
    if (state.act === "closing") audio.dip(1200);
  }, [audio.dip, state.act]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && state.overlay === "plaque") rawDispatch({ type: "CLOSE_OVERLAY" });
      if (state.act !== "walk" || state.overlay !== "none" || readingOpen) return;
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        dispatch({ type: event.key === "ArrowRight" ? "NEXT" : "PREVIOUS" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, state.act, state.overlay, readingOpen]);

  const choosePreference = (preference: ViewingPreference) => {
    const currentId = snapshot.units.find((unit) => unit.exhibition.unitId === state.unitId)?.artwork.id;
    if (currentId) viewing.commit((session) => queuePreference(session, preference, currentId));
  };
  const restart = () => {
    viewing.commit(createViewingSession({ ...baseSnapshot, routeOrder: undefined }));
    onRestart();
  };

  const stageForLast = snapshot.units.find((unit) => unit.exhibition.unitId === state.lastUnitId);
  useEffect(() => rawDispatch({ type: "AUDIO_STATE", state: audio.state }), [audio.state]);
  const toggleAudio = async () => {
    const nextState = await audio.toggle();
    if (nextState === "error") window.dispatchEvent(new CustomEvent("artduo:experience-degraded", { detail: { reason: "ambient-audio-unavailable" } }));
  };

  if (snapshot.units.length === 0) {
    return <main className="artduo-experience experience-empty" data-testid="experience-empty">
      <p className="experience-eyebrow">展厅准备完成</p>
      <h1>这次暂时没有可展示的作品</h1>
      <p>试试换一种情绪、光线或主题，再从当前馆藏里策展。</p>
      {snapshot.omittedUnitCount ? <p>另有 {snapshot.omittedUnitCount} 件记录暂不可用。</p> : null}
      <button className="experience-primary" onClick={restart} type="button">重新写一句</button>
      <a className="experience-text-button" href="/gallery?view=route">查看经典路线</a>
    </main>;
  }

  return <main className={`artduo-experience experience-act-${state.act}`} data-testid="experience-shell" data-viewing-pace={pace}>
    {state.act === "preface" ? <link rel="preload" as="image" href={snapshot.units[0]!.media.previewUrl} fetchPriority="high" /> : null}
    <div className="experience-global-controls"><AudioButton onToggle={() => void toggleAudio()} state={audio.state} /></div>
    {!state.online ? <p className="experience-offline" role="status">离线浏览 · 作品讲解和未缓存媒体可能暂不可用</p> : null}
    <div aria-live="polite" className="sr-only">{statusMessage}</div>
    {state.act === "preface" ? <Preface block={snapshot.preface} onContinue={() => dispatch({ type: "SKIP" })} reducedMotion={reducedMotion} /> : null}
    {state.act === "walk" ? <Walk
      dispatch={dispatch}
      onDetail={(artworkId) => { flushObservation(); onDetail(artworkId, positionOfExperienceState(state), snapshot); }}
      onMediaRetry={(artworkId) => { setReadyUnitId(undefined); rawDispatch({ type: "MEDIA_RETRIED", artworkId }); }}
      onArtworkReady={onArtworkReady}
      reducedMotion={reducedMotion}
      snapshot={snapshot}
      state={state}
      viewingSession={viewing.session}
      onPreference={choosePreference}
      onCancelPreference={() => viewing.commit((session) => ({ ...session, pending: undefined, message: "待应用的调整已取消。" }))}
      onReadingChange={setReadingOpen}
      onTogglePace={() => viewing.commit((session) => ({ ...session, paceEnabled: !session.paceEnabled }))}
      onClearObservations={() => { flushObservation(); viewing.clear(); }}
      storageAvailable={viewing.storageAvailable}
      pace={pace}
    /> : null}
    {state.act === "closing" ? <Closing
      lastUnit={stageForLast}
      onRestart={restart}
      onRevisit={() => dispatch({ type: "REVISIT" })}
      reducedMotion={reducedMotion}
      snapshot={snapshot}
    /> : null}
    {state.act !== "walk" ? <a className="experience-exit" href="/?view=experience">ArtDuo</a> : null}
  </main>;
}
