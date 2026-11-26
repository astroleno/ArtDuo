"use client";

import { appPath } from "@artduo/contracts";
import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { AudioButton, useAmbientAudio } from "./audio-controller";
import { ambientTrack } from "./ambient-track";
import { Closing } from "./closing";
import { closingLookbackForExit, resolveClosingNarrative, restoreClosingLookback, viewedForLookback } from "./closing-narrative";
import { captureClosingPreview, readClosingPreview, saveClosingPreview, type ClosingPreview } from "./closing-preview";
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
import { canOfferSculptureEncounter, sculptureEncounterSuccessor } from "./sculpture-encounter";
import type { SculptureNarrator, SculptureRoomScene, SculptureWork } from "./sculpture-types";
import { usePresentedPreface } from "./use-presented-preface";
import { useStableNarrative } from "./use-stable-narrative";
import { stageTransitionProfile } from "./stage-transition";

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
  onMilestone?: (phase: "preface-actionable" | "empty-actionable" | "enter-activated" | "first-artwork-visible" | "first-artwork-actionable") => void;
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
  const currentArtworkId = snapshot.units.find(unit => unit.exhibition.unitId === state.unitId)?.artwork.id;
  const encounterWork = encounter.value?.status === "active" && state.act === "walk"
    && sculptureEncounterSuccessor(snapshot, encounter.value, currentArtworkId)
    ? sculptureWorks.find(work => work.id === encounter.value?.modelId) : undefined;
  const encounterActive = Boolean(encounterWork);
  const [showSettingsPreface, setShowSettingsPreface] = useState(false);
  const stageForLast = snapshot.units.find(unit => unit.exhibition.unitId === state.lastUnitId);
  const plannedLast = snapshot.units.find(unit => unit.artwork.id === viewing.session.order.at(-1)) ?? snapshot.units.at(-1);
  const isClosing = state.act === "closing";
  const lastUnit = isClosing ? stageForLast ?? plannedLast : plannedLast;
  const [closingMedia, setClosingMedia] = useState<{ exhibitionId: string; preview?: ClosingPreview }>();
  useEffect(() => {
    if (!isClosing || closingMedia?.exhibitionId === snapshot.exhibitionId) return;
    let current = true;
    void readClosingPreview(snapshot.exhibitionId).then(preview => {
      if (current) setClosingMedia({ exhibitionId: snapshot.exhibitionId, preview });
    });
    return () => { current = false; };
  }, [closingMedia?.exhibitionId, isClosing, snapshot.exhibitionId]);
  const association = isClosing && viewing.hydrated ? restoreClosingLookback(snapshot, viewing.session, lastUnit) : undefined;
  const earlier = snapshot.units.find(unit => unit.artwork.id === association?.earlierId);
  const preview = closingMedia?.preview;
  const lookback = earlier && preview?.exhibitionId === snapshot.exhibitionId && preview.artworkId === earlier.artwork.id
    && preview.previewUrl === earlier.media.previewUrl ? association : undefined;
  const ending = resolveClosingNarrative(baseSnapshot, lastUnit, lookback);
  const closingIdentity = JSON.stringify([snapshot.exhibitionId, lastUnit?.artwork.id, lookback?.earlierId]);
  const presentedClosing = useStableNarrative(ending.block, ending.pending, closingIdentity,
    isClosing && viewing.hydrated && closingMedia?.exhibitionId === snapshot.exhibitionId);
  const keepsake = useKeepsakeController(snapshot, lastUnit, handwritingProvider, {
    block: presentedClosing ?? ending.block,
    pending: isClosing ? !presentedClosing : ending.pending,
  });
  const presentedPreface = usePresentedPreface(snapshot, !keepsake.open && (state.act === "preface" || state.act === "walk" && !encounterActive && showSettingsPreface));
  const [readingOpen, setReadingOpen] = useState(false);
  const sculptureInvitation = state.act === "walk" && state.overlay === "none" && !state.transitioning && !readingOpen && !viewing.session.pending
    && canOfferSculptureEncounter(snapshot, encounter.value, sculptureWorks, currentArtworkId);
  const chromeVisible = useIdleChrome(state.act === "walk", readingOpen || state.overlay !== "none" || state.transitioning || !state.online || state.failedMediaIds.length > 0 || state.audioState === "loading");
  const [arrival, setArrival] = useState<{ unitId: string; seq: number }>();
  const readyUnitId = arrival?.seq === state.transitionSeq ? arrival.unitId : undefined;
  const readyImage = useRef<{ unitId: string; seq: number; image: HTMLImageElement; source: string } | undefined>(undefined);
  const captured = useRef(new Map<string, ClosingPreview>());
  const activeUnit = snapshot.units.find((unit) => unit.exhibition.unitId === (state.unitId ?? state.lastUnitId)) ?? snapshot.units[0];
  const activeMood = roomLightMood(snapshot.stages.find((stage) => stage.id === activeUnit?.stageId));
  const trackUrl = ambientTrack(baseSnapshot.exhibitionId, baseSnapshot.stages, baseSnapshot.audioTracks);
  const audio = useAmbientAudio(readingOpen || state.overlay === "plaque", activeMood.audioGain, trackUrl, isClosing);
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
    const current = stateRef.current;
    const next = experienceReducer(current, event, snapshotRef.current);
    if (event.type === "RESTORE_POSITION") audio.navigate(false);
    stateRef.current = next;
    setState(next);
  }, [audio.navigate]);
  const dispatch = useCallback((event: ExperienceEvent) => {
    const isLightboxNavigation = event.type === "LIGHTBOX_NEXT" || event.type === "LIGHTBOX_PREVIOUS";
    const isNavigation = isLightboxNavigation || event.type === "NEXT" || event.type === "PREVIOUS" || event.type === "SELECT_UNIT";
    const current = stateRef.current;
    if (event.type === "RESTORE_TRANSITION") { rawDispatch(event); return; }
    if (isNavigation && encounter.ref.current?.status === "active") return;
    if (isNavigation && (isLightboxNavigation ? current.overlay !== "lightbox" : current.overlay !== "none" || (readingOpen && event.type !== "SELECT_UNIT"))) return;
    flushObservation();
    const isForward = event.type === "NEXT" || event.type === "LIGHTBOX_NEXT";
    const anchorId = isForward ? snapshotRef.current.units.find(unit => unit.exhibition.unitId === current.unitId)?.artwork.id : undefined;
    if (anchorId) {
      const updated = viewing.commit((session) => applyPendingPreference(session, baseSnapshot, anchorId));
      snapshotRef.current = snapshotForSession(baseSnapshot, updated);
    }
    const next = experienceReducer(current, event, snapshotRef.current);
    const proof = readyImage.current;
    if (current.act === "walk" && next.act === "walk" && next.unitId !== current.unitId
      && proof && proof.unitId === current.unitId && proof.seq === current.transitionSeq) {
      const route = snapshotRef.current;
      const unit = route.units.find(item => item.exhibition.unitId === proof.unitId);
      if (unit?.closingObservation && !captured.current.has(unit.artwork.id) && !current.failedMediaIds.includes(unit.artwork.id)
        && viewedForLookback(viewing.ref.current, unit.artwork.id)
        && proof.image.currentSrc === new URL(proof.source, location.href).href) {
        const data = captureClosingPreview(proof.image);
        if (data) {
          captured.current.set(unit.artwork.id, { exhibitionId: route.exhibitionId, artworkId: unit.artwork.id, previewUrl: unit.media.previewUrl, data });
          if (captured.current.size > 12) captured.current.delete(captured.current.keys().next().value!);
        }
      }
    }
    if (next.unitId !== current.unitId && current.act === "walk" && next.act === "walk") {
      const route = snapshotRef.current;
      const fromIndex = route.units.findIndex(unit => unit.exhibition.unitId === current.unitId);
      const toIndex = route.units.findIndex(unit => unit.exhibition.unitId === next.unitId);
      const profile = stageTransitionProfile({ fromIndex, toIndex, count: route.units.length,
        from: route.stages.find(stage => stage.id === route.units[fromIndex]?.stageId),
        to: route.stages.find(stage => stage.id === route.units[toIndex]?.stageId),
      });
      audio.navigate(event.type === "NEXT" && !reducedMotion && profile.kind === "turn");
    }
    if (event.type === "NEXT" && current.act === "walk" && next.act === "closing" && anchorId && viewing.hydrated) {
      const route = snapshotRef.current;
      const available = (id: string) => {
        const image = captured.current.get(id) ?? closingMedia?.preview;
        return image?.artworkId === id && image.exhibitionId === route.exhibitionId
          && image.previewUrl === route.units.find(unit => unit.artwork.id === id)?.media.previewUrl ? image : undefined;
      };
      const closingLookback = closingLookbackForExit(route, viewing.ref.current, anchorId,
        readyUnitId === current.unitId && !current.failedMediaIds.includes(anchorId), id => Boolean(available(id)));
      const selected = closingLookback && available(closingLookback.earlierId);
      viewing.commit(session => ({ ...session, closingLookback }));
      setClosingMedia({ exhibitionId: route.exhibitionId, preview: selected });
      saveClosingPreview(selected);
    }
    if (isForward && next !== current) encounter.pass(anchorId);
    stateRef.current = next;
    // Browser Back also restores route props in this event. Publish a cancelled
    // close-view target synchronously so those props cannot restore the failed
    // work over the visible one after the overlay has closed.
    if (event.type === "LIGHTBOX_RESTORE" && next !== current) onPositionChange(positionOfExperienceState(next), snapshotRef.current);
    setState(next);
  }, [audio.navigate, baseSnapshot, closingMedia?.preview, viewing.commit, viewing.hydrated, viewing.ref, flushObservation, readyUnitId, readingOpen, reducedMotion, encounter.pass, onPositionChange, rawDispatch]);

  const openSculptureEncounter = useCallback(() => {
    const current = stateRef.current;
    if (current.act !== "walk" || current.overlay !== "none" || current.transitioning
      || readingOpen || viewing.ref.current.pending) return;
    const anchorId = snapshotRef.current.units.find(unit => unit.exhibition.unitId === current.unitId)?.artwork.id;
    if (!anchorId) return;
    flushObservation();
    audio.navigate(false);
    encounter.begin(anchorId);
  }, [audio.navigate, encounter.begin, flushObservation, readingOpen, viewing.ref]);

  const shell = useRef<HTMLElement>(null);
  const focusAfterEncounter = useRef<string | undefined>(undefined);
  const continueAfterEncounter = useCallback(() => {
    const active = encounter.ref.current, current = stateRef.current;
    if (active?.status !== "active") return;
    const anchorId = snapshotRef.current.units.find(unit => unit.exhibition.unitId === current.unitId)?.artwork.id;
    const next = current.act === "walk" ? sculptureEncounterSuccessor(snapshotRef.current, active, anchorId) : undefined;
    encounter.finish();
    setReadingOpen(false);
    if (next) {
      focusAfterEncounter.current = next.exhibition.unitId;
      rawDispatch({ type: "SELECT_UNIT", unitId: next.exhibition.unitId });
    }
  }, [encounter.finish, rawDispatch]);

  useEffect(() => {
    if (!focusAfterEncounter.current || focusAfterEncounter.current !== state.unitId || encounterActive || state.transitioning) return;
    focusAfterEncounter.current = undefined;
    shell.current?.querySelector<HTMLButtonElement>(".experience-walk-controls .experience-next")?.focus({ preventScroll: true });
  }, [state.unitId, state.transitioning, encounterActive]);

  useEffect(() => {
    if (encounter.value?.status === "active" && !encounterActive) encounter.finish();
  }, [encounter.value?.status, encounterActive, encounter.finish]);

  const onArtworkReady = useCallback((unitId: string, preview: { image: HTMLImageElement; source: string }) => {
    const current = stateRef.current;
    if (current.act === "walk" && current.unitId === unitId) {
      const proof = { unitId, seq: current.transitionSeq };
      readyImage.current = { ...proof, ...preview };
      setArrival(proof);
    }
    if (current.act !== "walk" || current.unitId !== unitId || current.overlay === "lightbox" || firstWalkMarkedRef.current || !onMilestone) return;
    firstWalkMarkedRef.current = true;
    onMilestone("first-artwork-visible");
    onMilestone("first-artwork-actionable");
  }, [onMilestone]);
  const onPrefaceActionable = useCallback(() => onMilestone?.("preface-actionable"), [onMilestone]);
  useEffect(() => {
    if (!snapshot.units.length && viewing.hydrated) onMilestone?.("empty-actionable");
  }, [onMilestone, snapshot.units.length, viewing.hydrated]);

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
      previousUnitRef.current = state.unitId;
      if (state.unitId) {
        const unit = snapshot.units.find((candidate) => candidate.exhibition.unitId === state.unitId);
        if (unit) setStatusMessage(`已准备作品：${unit.artwork.metadata.title}`);
      }
    }
  }, [snapshot.units, state.unitId]);

  useEffect(() => { if (reducedMotion) audio.navigate(false); }, [audio.navigate, reducedMotion]);

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
        if (event.repeat) return;
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
    const alternative = snapshot.emptyAlternative;
    const etching = alternative?.kind === "unrecorded-plate-etching";
    const available = alternative ? Math.min(alternative.eligible, alternative.requested) : 0;
    const moreInCollection = alternative ? alternative.eligible > available : false;
    return <main className="artduo-experience experience-empty" data-testid="experience-empty">
      <p className="experience-eyebrow">这次没有展出作品</p>
      <h1>暂未找到符合条件的作品</h1>
      <p>{snapshot.selectionNotice ?? "当前馆藏中，没有能同时确认符合这些条件的作品。"}</p>
      <p className="experience-empty-request">「{snapshot.presentationQuery ?? snapshot.query}」</p>
      <p>你的原句保留在这里，可以改写观看方向，或稍后再来。</p>
      {alternative ? <div>
        <p>{etching
          ? <>{moreInCollection ? `这 ${alternative.eligible} 幅都是蚀刻版画。` : `目前可以看 ${available} 幅蚀刻版画。`}馆方没有注明用了哪种印版。</>
          : <>{moreInCollection ? `馆里有 ${alternative.eligible} 幅没有人物的静物画` : `目前能看 ${available} 幅没有人物的静物画`}，画的地方可能在室内，也可能在别处。</>}
        {moreInCollection ? `这次可以从中看 ${available} 幅。` : null}</p>
        <a className="experience-primary" href={appPath(`/gallery/local/immersive?${new URLSearchParams({
          query: alternative.query, view: "experience", recipeVersion: "experience-v2", phase: "preface",
          releaseVersion: snapshot.releaseVersion,
        })}`)}>{etching ? "看看这些蚀刻" : "看看这些静物"}</a>
      </div> : null}
      {snapshot.omittedUnitCount ? <p>另有 {snapshot.omittedUnitCount} 件记录暂不可用。</p> : null}
      {restartHref ? <a className="experience-primary" href={appPath(restartHref)}>重新写一句</a>
        : <button className="experience-primary" onClick={restart} type="button">重新写一句</button>}
    </main>;
  }

  return <main ref={shell} className={`artduo-experience experience-act-${state.act}`} data-testid="experience-shell" data-exhibition-id={snapshot.exhibitionId} data-viewing-pace={pace} data-chrome-visible={chromeVisible} data-encounter-status={encounter.value?.status}>
    {state.act === "preface" ? <link rel="preload" as="image" crossOrigin="anonymous" href={snapshot.units[0]!.media.previewUrl} fetchPriority="high" /> : null}
    {state.act === "preface" && snapshot.units[0]!.media.backgroundUrl ? <link rel="preload" as="image" crossOrigin="anonymous" href={snapshot.units[0]!.media.backgroundUrl} imageSrcSet={roomImageSrcSet(snapshot.units[0]!.media.backgroundUrl, snapshot.units[0]!.media.backgroundUrlSmall)} imageSizes={ROOM_IMAGE_SIZES} fetchPriority="high" /> : null}
    {state.act !== "walk" ? <div className="experience-global-controls"><AudioButton onToggle={() => void toggleAudio()} state={audio.state} /></div> : null}
    {!state.online ? <p className="experience-offline" role="status">离线浏览 · 作品讲解和未缓存媒体可能暂不可用</p> : null}
    <div aria-live="polite" className="sr-only">{statusMessage}</div>
    {state.act === "preface" ? <Preface block={presentedPreface} query={snapshot.presentationQuery ?? snapshot.query} pending={Boolean(snapshot.narrativePending)} count={snapshot.units.length} backdropUrl={snapshot.units[0]?.media.backgroundUrl} backdropSmallUrl={snapshot.units[0]?.media.backgroundUrlSmall}
      onActionable={onPrefaceActionable} onContinue={() => { onMilestone?.("enter-activated"); dispatch({ type: "SKIP" }); }}
      reducedMotion={reducedMotion} ready={viewing.hydrated} selectionNotice={snapshot.selectionNotice} keepsake={keepsake.entry(true)} /> : null}
    {state.act === "walk" && encounterWork ? <SculptureBoundary onUnavailable={continueAfterEncounter}><Suspense fallback={<div className="experience-room experience-room-fallback" role="status">正在进入侧厅…</div>}>
      <EncounterRoom key={encounterWork.id} works={[encounterWork]} scenes={sculptureScenes} initialModel={encounterWork.id} initialScene={encounter.value!.roomId!}
        initialQuality="compact" query={snapshot.query} narrate={sculptureNarrator}
        encounter={{ onContinue: continueAfterEncounter, onReadingChange: setReadingOpen,
          audioControl: <AudioButton onToggle={() => void toggleAudio()} state={audio.state} /> }} />
    </Suspense></SculptureBoundary> : null}
    {state.act === "walk" && !encounterWork ? <Walk
      onSculptureInvitation={sculptureInvitation ? openSculptureEncounter : undefined}
      preface={presentedPreface}
      onPrefaceVisibilityChange={setShowSettingsPreface}
      dispatch={dispatch}
      onDetail={(artworkId) => { flushObservation(); onDetail(artworkId, positionOfExperienceState(state), snapshot); }}
      detailNavigation={detailNavigation}
      onMediaRetry={(artworkId) => { setArrival(undefined); readyImage.current = undefined; rawDispatch({ type: "MEDIA_RETRIED", artworkId }); }}
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
      onClearObservations={() => { flushObservation(); viewing.clear(); captured.current.clear(); saveClosingPreview(undefined);
        setClosingMedia({ exhibitionId: snapshot.exhibitionId }); }}
      storageAvailable={viewing.storageAvailable}
      pace={pace}
    /> : null}
    {isClosing ? <Closing
      key={closingIdentity}
      lastUnit={lastUnit}
      closing={presentedClosing}
      noScriptText={viewing.hydrated ? undefined : ending.block.text}
      lookback={lookback && earlier && preview ? { title: earlier.artwork.metadata.title, src: preview.data } : undefined}
      onRestart={restart}
      onRevisit={() => dispatch({ type: "REVISIT" })}
      reducedMotion={reducedMotion}
      omittedUnitCount={snapshot.omittedUnitCount}
      keepsake={keepsake.entry(false)}
    /> : null}
    {keepsake.modal}
    {state.act !== "walk" ? <a className="experience-exit" aria-label="ArtDuo，返回入口" href={appPath(restartHref ?? `/?${new URLSearchParams({ view: "experience", query: snapshot.query })}`)}>ArtDuo</a> : null}
  </main>;
}
