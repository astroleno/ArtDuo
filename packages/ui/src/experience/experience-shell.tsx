"use client";

import { appPath } from "@artduo/contracts";
import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { AudioButton, useAmbientAudio } from "./audio-controller";
import { Closing } from "./closing";
import { Preface } from "./preface";
import { Walk } from "./walk";
import { createExperienceState, experienceReducer, positionOfExperienceState, type ExperienceEvent } from "./state";
import type { DetailNavigation, ExperiencePosition, ExhibitionSnapshot } from "./types";
import { applyPendingPreference, createViewingSession, observedPace, queuePreference, snapshotForSession, type ViewingPreference } from "./viewing-session";
import { useViewingObservation, useViewingSession } from "./use-viewing-session";
import { useIdleChrome } from "./use-idle-chrome";
import { roomLightMood } from "./room-lighting";
import { useInteractionPreferences } from "./interaction-preferences";
import { ROOM_IMAGE_SIZES, roomImageSrcSet } from "./room-assets";
import { useKeepsakeController, type HandwritingProvider } from "./handwritten-keepsake";
import { useSculptureEncounter } from "./use-sculpture-encounter";
import type { SculptureNarrator, SculptureRoomScene, SculptureWork } from "./sculpture-types";

const EncounterRoom = lazy(() => import("./sculpture-room").then(module => ({ default: module.SculptureRoom })));
const NO_SCULPTURES: SculptureWork[] = [], NO_SCULPTURE_SCENES: SculptureRoomScene[] = [];

class SculptureBoundary extends Component<{ onUnavailable: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onUnavailable(); }
  render() { return this.state.failed ? null : this.props.children; }
}

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

export function ExperienceShell({ snapshot: baseSnapshot, initialPosition, onPositionChange, onDetail, detailNavigation, onRestart, restartHref, onMilestone, handwritingProvider, sculptureWorks = NO_SCULPTURES, sculptureScenes = NO_SCULPTURE_SCENES, sculptureNarrator }: {
  snapshot: ExhibitionSnapshot;
  initialPosition: ExperiencePosition;
  onPositionChange: (position: ExperiencePosition, snapshot: ExhibitionSnapshot) => void;
  onDetail: (artworkId: string, position: ExperiencePosition, snapshot: ExhibitionSnapshot) => void;
  detailNavigation?: DetailNavigation;
  onRestart: () => void;
  restartHref?: string;
  onMilestone?: (phase: "first-artwork-visible" | "first-artwork-actionable") => void;
  handwritingProvider?: HandwritingProvider;
  sculptureWorks?: SculptureWork[];
  sculptureScenes?: SculptureRoomScene[];
  sculptureNarrator?: SculptureNarrator;
}) {
  const reducedMotion = useReducedMotion();
  const interaction = useInteractionPreferences();
  const viewing = useViewingSession(baseSnapshot);
  const snapshot = useMemo(() => snapshotForSession(baseSnapshot, viewing.session), [baseSnapshot, viewing.session.order]);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const [state, setState] = useState(() => createExperienceState(snapshot, initialPosition));
  const encounter = useSculptureEncounter(snapshot, sculptureWorks, sculptureScenes, viewing.hydrated);
  const encounterActive = encounter.value?.status === "active" && state.act === "walk";
  const encounterWork = encounterActive ? sculptureWorks.find(work => work.id === encounter.value?.modelId) : undefined;
  const stageForLast = snapshot.units.find(unit => unit.exhibition.unitId === state.lastUnitId);
  const plannedLast = snapshot.units.find(unit => unit.artwork.id === viewing.session.order.at(-1)) ?? snapshot.units.at(-1);
  const keepsake = useKeepsakeController(snapshot, state.act === "closing" ? stageForLast ?? plannedLast : plannedLast, handwritingProvider);
  const [readingOpen, setReadingOpen] = useState(false);
  const chromeVisible = useIdleChrome(state.act === "walk", readingOpen || state.overlay !== "none" || state.transitioning || !state.online || state.failedMediaIds.length > 0 || state.audioState === "loading");
  const [readyUnitId, setReadyUnitId] = useState<string>();
  const activeUnit = snapshot.units.find((unit) => unit.exhibition.unitId === (state.unitId ?? state.lastUnitId)) ?? snapshot.units[0];
  const activeMood = roomLightMood(snapshot.stages.find((stage) => stage.id === activeUnit?.stageId));
  const audio = useAmbientAudio(readingOpen || state.overlay === "plaque", activeMood.audioGain, snapshot.audioTracks);
  const flushObservation = useViewingObservation({ controller: viewing, state, snapshot, readyUnitId, readingOpen,
    paused: encounterActive || sculptureWorks.length > 0 && !encounter.value });
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
    const isLightboxNavigation = event.type === "LIGHTBOX_NEXT" || event.type === "LIGHTBOX_PREVIOUS";
    const isNavigation = isLightboxNavigation || event.type === "NEXT" || event.type === "PREVIOUS" || event.type === "SELECT_UNIT";
    const current = stateRef.current;
    if (isNavigation && encounter.ref.current?.status === "active") return;
    if (event.type === "OPEN_LIGHTBOX") queuedNavigationRef.current = null;
    if (isNavigation && (isLightboxNavigation ? current.overlay !== "lightbox" : current.overlay !== "none" || (readingOpen && event.type !== "SELECT_UNIT"))) return;
    if (isNavigation && (navigationLockedRef.current || current.transitioning)) {
      queuedNavigationRef.current = event;
      return;
    }
    flushObservation();
    if ((event.type === "NEXT" || event.type === "LIGHTBOX_NEXT") && !current.transitioning) {
      const currentId = snapshotRef.current.units.find((unit) => unit.exhibition.unitId === current.unitId)?.artwork.id;
      if (currentId) {
        const updated = viewing.commit((session) => applyPendingPreference(session, baseSnapshot, currentId));
        snapshotRef.current = snapshotForSession(baseSnapshot, updated);
        const index = snapshotRef.current.units.findIndex(unit => unit.artwork.id === currentId);
        const following = snapshotRef.current.units[index + 1];
        if (event.type === "NEXT" && following && encounter.begin(currentId, following.artwork.id)) {
          queuedNavigationRef.current = null;
          return;
        }
      }
    }
    const next = experienceReducer(current, event, snapshotRef.current);
    stateRef.current = next;
    if (next.transitioning) navigationLockedRef.current = true;
    setState(next);
  }, [baseSnapshot, viewing.commit, flushObservation, readingOpen, encounter.begin]);

  const continueAfterEncounter = useCallback(() => {
    if (encounter.ref.current?.status !== "active") return;
    encounter.finish();
    queuedNavigationRef.current = null;
    setReadingOpen(false);
    setReadyUnitId(undefined);
    rawDispatch({ type: "NEXT" });
  }, [encounter.finish, rawDispatch]);

  useEffect(() => {
    const planned = encounter.value;
    if (planned?.status !== "pending" || state.act !== "walk") return;
    const index = snapshot.units.findIndex(unit => unit.exhibition.unitId === state.unitId);
    const anchor = snapshot.units.findIndex(unit => unit.artwork.id === planned.anchorArtworkId);
    if (index < anchor - 1 || index > anchor) return;
    const work = sculptureWorks.find(work => work.id === planned.modelId);
    if (!work) return;
    const abort = new AbortController();
    void import("./sculpture-room");
    void fetch(work.compactUrl, { signal: abort.signal, cache: "force-cache", referrerPolicy: "no-referrer" })
      .then(async response => { if (response.ok) await response.arrayBuffer(); else await response.body?.cancel(); }).catch(() => undefined);
    return () => abort.abort();
  }, [encounter.value?.modelId, encounter.value?.status, snapshot.units, state.act, state.unitId, sculptureWorks]);

  useEffect(() => {
    if (encounter.value?.status !== "active") return;
    const unit = snapshot.units.find(item => item.exhibition.unitId === state.unitId);
    if (state.act !== "walk" || unit?.artwork.id !== encounter.value.anchorArtworkId) encounter.finish();
  }, [encounter.value?.status, state.act, state.unitId, snapshot.units, encounter.finish]);

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
      if (event.key === "Escape" && state.overlay === "plaque") {
        // This global shortcut runs before the dialog's native cancel event.
        // Cancel navigation here too, and avoid closing the reader twice.
        event.preventDefault();
        detailNavigation?.onCancel();
        rawDispatch({ type: "CLOSE_OVERLAY" });
        return;
      }
      if (state.act !== "walk" || state.overlay !== "none" || readingOpen || keepsake.open || encounterActive) return;
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
  }, [dispatch, state.act, state.overlay, readingOpen, detailNavigation, keepsake.open, encounterActive]);

  const choosePreference = (preference: ViewingPreference) => {
    const currentId = snapshot.units.find((unit) => unit.exhibition.unitId === state.unitId)?.artwork.id;
    if (currentId) viewing.commit((session) => queuePreference(session, preference, currentId));
  };
  const restart = () => {
    viewing.commit(createViewingSession({ ...baseSnapshot, routeOrder: undefined }));
    onRestart();
  };

  useEffect(() => rawDispatch({ type: "AUDIO_STATE", state: audio.state }), [audio.state]);
  const toggleAudio = async () => {
    const nextState = await audio.toggle();
    if (nextState === "error") window.dispatchEvent(new CustomEvent("artduo:experience-degraded", { detail: { reason: "ambient-audio-unavailable" } }));
  };

  if (snapshot.units.length === 0) {
    return <main className="artduo-experience experience-empty" data-testid="experience-empty">
      <p className="experience-eyebrow">这次没有展出作品</p>
      <h1>暂未找到符合条件的作品</h1>
      <p>{snapshot.selectionNotice ?? "当前馆藏中，没有能同时确认符合这些条件的作品。"}</p>
      <p className="experience-empty-request">「{snapshot.query}」</p>
      <p>你的原句保留在这里，可以改写观看方向，或稍后再来。</p>
      {snapshot.omittedUnitCount ? <p>另有 {snapshot.omittedUnitCount} 件记录暂不可用。</p> : null}
      {restartHref ? <a className="experience-primary" href={appPath(restartHref)}>重新写一句</a>
        : <button className="experience-primary" onClick={restart} type="button">重新写一句</button>}
      <a className="experience-text-button" href={appPath("/gallery?view=route")}>查看经典路线</a>
    </main>;
  }

  return <main className={`artduo-experience experience-act-${state.act}`} data-testid="experience-shell" data-exhibition-id={snapshot.exhibitionId} data-viewing-pace={pace} data-chrome-visible={chromeVisible} data-encounter-status={encounter.value?.status}>
    {state.act === "preface" ? <link rel="preload" as="image" crossOrigin="anonymous" href={snapshot.units[0]!.media.previewUrl} fetchPriority="high" /> : null}
    {state.act === "preface" && snapshot.units[0]!.media.backgroundUrl ? <link rel="preload" as="image" crossOrigin="anonymous" href={snapshot.units[0]!.media.backgroundUrl} imageSrcSet={roomImageSrcSet(snapshot.units[0]!.media.backgroundUrl, snapshot.units[0]!.media.backgroundUrlSmall)} imageSizes={ROOM_IMAGE_SIZES} fetchPriority="high" /> : null}
    {state.act !== "walk" ? <div className="experience-global-controls"><AudioButton onToggle={() => void toggleAudio()} state={audio.state} /></div> : null}
    {!state.online ? <p className="experience-offline" role="status">离线浏览 · 作品讲解和未缓存媒体可能暂不可用</p> : null}
    <div aria-live="polite" className="sr-only">{statusMessage}</div>
    {state.act === "preface" ? <Preface block={snapshot.preface} count={snapshot.units.length} backdropUrl={snapshot.units[0]?.media.backgroundUrl} onContinue={() => dispatch({ type: "SKIP" })} reducedMotion={reducedMotion} ready={viewing.hydrated} pending={snapshot.narrativePending} selectionNotice={snapshot.selectionNotice} keepsake={keepsake.entry(true)} /> : null}
    {state.act === "walk" && encounterWork ? <SculptureBoundary onUnavailable={continueAfterEncounter}><Suspense fallback={<div className="experience-room experience-room-fallback" role="status">正在进入侧厅…</div>}>
      <EncounterRoom key={encounterWork.id} works={[encounterWork]} scenes={sculptureScenes} initialModel={encounterWork.id} initialScene={encounter.value!.roomId!}
        initialQuality="compact" query={snapshot.query} narrate={sculptureNarrator}
        encounter={{ onContinue: continueAfterEncounter, onUnavailable: continueAfterEncounter, onReadingChange: setReadingOpen,
          audioControl: <AudioButton onToggle={() => void toggleAudio()} state={audio.state} /> }} />
    </Suspense></SculptureBoundary> : null}
    {state.act === "walk" && !encounterWork ? <Walk
      dispatch={dispatch}
      onDetail={(artworkId) => { flushObservation(); onDetail(artworkId, positionOfExperienceState(state), snapshot); }}
      detailNavigation={detailNavigation}
      onMediaRetry={(artworkId) => { setReadyUnitId(undefined); rawDispatch({ type: "MEDIA_RETRIED", artworkId }); }}
      onArtworkReady={onArtworkReady}
      reducedMotion={reducedMotion}
      mouseMotion={interaction.mouseMotion}
      onMouseMotionChange={interaction.setMouseMotion}
      audioControl={<AudioButton onToggle={() => void toggleAudio()} state={audio.state} />}
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
      lastUnit={stageForLast ?? plannedLast}
      onRestart={restart}
      onRevisit={() => dispatch({ type: "REVISIT" })}
      reducedMotion={reducedMotion}
      snapshot={snapshot}
      keepsake={keepsake.entry(false)}
    /> : null}
    {keepsake.modal}
    {state.act !== "walk" ? <a className="experience-exit" href={appPath("/?view=experience")}>ArtDuo</a> : null}
  </main>;
}
