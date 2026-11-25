import type { ExperiencePosition, ExhibitionSnapshot } from "./types";

export type ExperienceAct = "preface" | "walk" | "closing";
export type ExperienceOverlay = "none" | "plaque" | "lightbox";

export interface ExperienceState {
  act: ExperienceAct;
  unitId?: string;
  lastUnitId?: string;
  overlay: ExperienceOverlay;
  transitioning: boolean;
  transitionSeq: number;
  transitionFromUnitId?: string;
  online: boolean;
  failedMediaIds: string[];
  shareState: "idle" | "generating" | "ready" | "failed";
  audioState: "off" | "loading" | "on" | "error";
}

export type ExperienceEvent =
  | { type: "CONTINUE" | "SKIP" }
  | { type: "NEXT" | "PREVIOUS" }
  | { type: "LIGHTBOX_NEXT" | "LIGHTBOX_PREVIOUS" }
  | { type: "LIGHTBOX_RESTORE"; artworkId: string }
  | { type: "SELECT_UNIT"; unitId: string }
  | { type: "RESTORE_TRANSITION"; seq: number }
  | { type: "RESTORE_POSITION"; position: ExperiencePosition }
  | { type: "OPEN_PLAQUE" | "OPEN_LIGHTBOX" | "CLOSE_OVERLAY" }
  | { type: "MEDIA_FAILED"; artworkId: string }
  | { type: "MEDIA_RETRIED"; artworkId: string }
  | { type: "CONNECTIVITY_CHANGED"; online: boolean }
  | { type: "SHARE_STATE"; state: ExperienceState["shareState"] }
  | { type: "AUDIO_STATE"; state: ExperienceState["audioState"] }
  | { type: "REVISIT" };

function indexOfUnit(snapshot: ExhibitionSnapshot, unitId: string | undefined): number {
  return unitId ? snapshot.units.findIndex((unit) => unit.exhibition.unitId === unitId) : -1;
}

export function createExperienceState(snapshot: ExhibitionSnapshot, position: ExperiencePosition): ExperienceState {
  const unitId = position.phase === "walk"
    ? (snapshot.units.find((unit) => unit.exhibition.unitId === position.unitId) ?? snapshot.units[0])?.exhibition.unitId
    : undefined;
  const lastUnitId = position.phase === "closing"
    ? (snapshot.units.find((unit) => unit.exhibition.unitId === position.lastUnitId) ?? snapshot.units.at(-1))?.exhibition.unitId
    : undefined;
  return {
    act: position.phase,
    unitId,
    lastUnitId,
    overlay: "none",
    transitioning: false,
    transitionSeq: 0,
    online: true,
    failedMediaIds: [],
    shareState: "idle",
    audioState: "off",
  };
}

export function positionOfExperienceState(state: ExperienceState): ExperiencePosition {
  if (state.act === "walk" && state.unitId) return { phase: "walk", unitId: state.unitId };
  if (state.act === "closing") return { phase: "closing", lastUnitId: state.lastUnitId };
  return { phase: "preface" };
}

function navigateTo(state: ExperienceState, unitId: string, overlay: ExperienceOverlay): ExperienceState {
  if (unitId === state.unitId) return state;
  return { ...state, unitId, overlay, transitioning: true, transitionSeq: state.transitionSeq + 1,
    transitionFromUnitId: overlay === "lightbox" ? undefined : state.unitId };
}

export function experienceReducer(state: ExperienceState, event: ExperienceEvent, snapshot: ExhibitionSnapshot): ExperienceState {
  if (state.overlay === "lightbox" && (event.type === "NEXT" || event.type === "PREVIOUS" || event.type === "SELECT_UNIT")) return state;
  const currentIndex = indexOfUnit(snapshot, state.unitId);
  switch (event.type) {
    case "LIGHTBOX_RESTORE": {
      const unit = snapshot.units.find(candidate => candidate.artwork.id === event.artworkId);
      return state.act === "walk" && state.overlay === "lightbox" && unit
        ? { ...state, unitId: unit.exhibition.unitId, transitioning: false, transitionFromUnitId: undefined, transitionSeq: state.transitionSeq + 1 } : state;
    }
    case "LIGHTBOX_NEXT":
    case "LIGHTBOX_PREVIOUS": {
      if (state.act !== "walk" || state.overlay !== "lightbox") return state;
      const nextUnit = snapshot.units[currentIndex + (event.type === "LIGHTBOX_NEXT" ? 1 : -1)];
      return currentIndex >= 0 && nextUnit
        ? navigateTo(state, nextUnit.exhibition.unitId, "lightbox")
        : state;
    }
    case "CONTINUE":
    case "SKIP":
      return state.act === "preface" && snapshot.units[0]
        ? { ...state, act: "walk", unitId: snapshot.units[0].exhibition.unitId, transitioning: false, transitionFromUnitId: undefined, transitionSeq: state.transitionSeq + 1 }
        : state;
    case "NEXT":
      if (state.act !== "walk" || currentIndex < 0) return state;
      if (currentIndex >= snapshot.units.length - 1) return { ...state, act: "closing", lastUnitId: state.unitId, transitioning: false, transitionFromUnitId: undefined, transitionSeq: state.transitionSeq + 1 };
      return snapshot.units[currentIndex + 1]
        ? navigateTo(state, snapshot.units[currentIndex + 1]!.exhibition.unitId, "none")
        : state;
    case "PREVIOUS":
      if (state.act !== "walk" || currentIndex <= 0) return state;
      return snapshot.units[currentIndex - 1]
        ? navigateTo(state, snapshot.units[currentIndex - 1]!.exhibition.unitId, "none")
        : state;
    case "SELECT_UNIT":
      return state.act === "walk" && snapshot.units.some((unit) => unit.exhibition.unitId === event.unitId)
        ? navigateTo(state, event.unitId, "none")
        : state;
    case "RESTORE_TRANSITION":
      return state.transitioning && event.seq === state.transitionSeq ? { ...state, transitioning: false } : state;
    case "RESTORE_POSITION":
      return { ...createExperienceState(snapshot, event.position), transitionSeq: state.transitionSeq + 1, online: state.online, failedMediaIds: state.failedMediaIds };
    case "OPEN_PLAQUE":
      return { ...state, overlay: "plaque" };
    case "OPEN_LIGHTBOX":
      return { ...state, overlay: "lightbox" };
    case "CLOSE_OVERLAY":
      return { ...state, overlay: "none" };
    case "MEDIA_FAILED":
      return { ...state, failedMediaIds: state.failedMediaIds.includes(event.artworkId) ? state.failedMediaIds : [...state.failedMediaIds, event.artworkId] };
    case "MEDIA_RETRIED":
      return { ...state, failedMediaIds: state.failedMediaIds.filter((id) => id !== event.artworkId) };
    case "CONNECTIVITY_CHANGED":
      return { ...state, online: event.online };
    case "SHARE_STATE":
      return { ...state, shareState: event.state };
    case "AUDIO_STATE":
      return { ...state, audioState: event.state };
    case "REVISIT":
      return snapshot.units.length > 0
        ? { ...state, act: "walk", unitId: state.lastUnitId ?? snapshot.units.at(-1)?.exhibition.unitId, transitioning: false, transitionFromUnitId: undefined, transitionSeq: state.transitionSeq + 1 }
        : state;
  }
}
