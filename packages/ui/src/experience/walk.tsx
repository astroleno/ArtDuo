"use client";

import { useCallback, useEffect, useRef } from "react";

import type { ExperienceEvent, ExperienceState } from "./state";
import type { ExhibitionSnapshot } from "./types";
import { EmotionRail } from "./emotion-rail";
import { Room } from "./room";
import { ViewingControls } from "./viewing-controls";
import type { ViewingSession, ViewingPreference, ViewingPace } from "./viewing-session";

export function Walk({ snapshot, state, dispatch, onDetail, onMediaRetry, onArtworkReady, reducedMotion, viewingSession, onPreference, onCancelPreference, onReadingChange, onTogglePace, onClearObservations, storageAvailable, pace }: {
  snapshot: ExhibitionSnapshot;
  state: ExperienceState;
  dispatch: (event: ExperienceEvent) => void;
  onDetail: (artworkId: string) => void;
  onMediaRetry: (artworkId: string) => void;
  onArtworkReady: (unitId: string) => void;
  reducedMotion: boolean;
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
  const walkRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!state.transitioning) return;
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      const animations = walkRef.current?.getAnimations({ subtree: true }).filter((animation) => animation.effect?.getTiming().iterations !== Infinity) ?? [];
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
    const images = [previousUnit, nextUnit].filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate)).map((candidate) => {
      const image = new Image();
      image.decoding = "async";
      image.src = candidate.media.previewUrl;
      return image;
    });
    return () => {
      for (const image of images) {
        image.onload = null;
        image.onerror = null;
      }
    };
  }, [previousUnit?.artwork.id, previousUnit?.media.previewUrl, nextUnit?.artwork.id, nextUnit?.media.previewUrl]);
  const markMediaFailed = useCallback(() => {
    window.dispatchEvent(new CustomEvent("artduo:experience-degraded", { detail: { reason: "artwork-media-unavailable", artworkId: unit.artwork.id } }));
    if (unit) dispatch({ type: "MEDIA_FAILED", artworkId: unit.artwork.id });
  }, [dispatch, unit?.artwork.id]);
  if (!unit) return null;
  const stage = snapshot.stages.find((candidate) => candidate.id === unit.stageId);
  const selectStage = (stageId: string) => {
    const stageUnit = snapshot.units.find((candidate) => candidate.stageId === stageId);
    if (stageUnit) {
      const notes = walkRef.current?.querySelector("details");
      if (notes) notes.open = false;
      onReadingChange(false);
      dispatch({ type: "SELECT_UNIT", unitId: stageUnit.exhibition.unitId });
    }
  };
  return <div className={`experience-walk ${state.transitioning ? "is-transitioning" : ""}`} ref={walkRef}>
    <details className="experience-route-notes" onToggle={(event) => onReadingChange(event.currentTarget.open)} onKeyDown={(event) => {
      if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); }
      event.stopPropagation();
    }}>
      <summary>本次展览</summary>
      <div className="experience-route-panel">
        <p className="experience-eyebrow">{snapshot.units.length} 件作品</p>
        <p>{snapshot.preface.text}</p>
        <EmotionRail
          activeStageId={unit.stageId ?? undefined}
          availableStageIds={[...new Set(snapshot.units.map((candidate) => candidate.stageId).filter((stageId): stageId is string => Boolean(stageId)))]}
          onSelect={selectStage}
          stages={snapshot.stages}
        />
        <ViewingControls session={viewingSession} onPreference={onPreference} onCancel={onCancelPreference} onTogglePace={onTogglePace} onClear={onClearObservations} storageAvailable={storageAvailable} />
      </div>
    </details>
    <Room
      count={snapshot.units.length}
      index={index}
      mediaFailed={state.failedMediaIds.includes(unit.artwork.id)}
      onDetail={() => onDetail(unit.artwork.id)}
      onNext={() => dispatch({ type: "NEXT" })}
      onMediaFailed={markMediaFailed}
      onLightboxChange={lightboxChanged}
      onArtworkReady={onArtworkReady}
      onPrevious={() => dispatch({ type: "PREVIOUS" })}
      onRetryMedia={() => onMediaRetry(unit.artwork.id)}
      onTogglePlaque={() => dispatch({ type: state.overlay === "plaque" ? "CLOSE_OVERLAY" : "OPEN_PLAQUE" })}
      plaqueOpen={state.overlay === "plaque"}
      reducedMotion={reducedMotion}
      stageLabel={stage?.label}
      transitioning={state.transitioning}
      unit={unit}
      pace={pace}
    />
    <div aria-live="polite" className="sr-only">正在观看第 {index + 1} 件，共 {snapshot.units.length} 件作品：{unit.artwork.metadata.title}</div>
  </div>;
}
