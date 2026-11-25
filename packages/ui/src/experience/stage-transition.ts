import type { ExperienceStage } from "./types";

export type StageTransitionKind = "neutral" | "continue" | "turn" | "settle";
export type NavigationDirection = "none" | "forward" | "backward";

export interface StageTransitionProfile {
  kind: StageTransitionKind;
  direction: NavigationDirection;
  artworkMs: number;
  wallMs: number;
  wallOffsetPx: number;
}

const NEUTRAL: StageTransitionProfile = { kind: "neutral", direction: "none", artworkMs: 0, wallMs: 0, wallOffsetPx: 0 };
const AFFECT_AXES = ["valence", "arousal", "tension", "wonder", "intimacy"] as const;

export function stageTransitionProfile(input: {
  from?: ExperienceStage;
  to?: ExperienceStage;
  fromIndex: number;
  toIndex: number;
  count: number;
}): StageTransitionProfile {
  const { from, to, fromIndex, toIndex, count } = input;
  if (!from || !to || count < 3 || fromIndex < 0 || toIndex < 0 || toIndex >= count || Math.abs(fromIndex - toIndex) !== 1) return NEUTRAL;
  const direction = toIndex > fromIndex ? "forward" : "backward";
  if (direction === "forward" && count >= 4 && toIndex === count - 1 && to.role === "afterglow") {
    return { kind: "settle", direction, artworkMs: 208, wallMs: 420, wallOffsetPx: 0 };
  }
  if (from.id !== to.id) {
    const forwardArrival = direction === "forward" ? to : from;
    const shift = Math.max(...AFFECT_AXES.map(axis => Math.abs(to[axis] - from[axis])));
    if (from.role === "turn" || to.role === "turn" || forwardArrival.transitionIntent === "push"
      || forwardArrival.transitionIntent === "drift" && shift >= .20 - Number.EPSILON) {
      return { kind: "turn", direction, artworkMs: 176, wallMs: 260, wallOffsetPx: direction === "forward" ? 4 : -4 };
    }
  }
  return { kind: "continue", direction, artworkMs: 128, wallMs: 0, wallOffsetPx: 0 };
}

export function stageTransitionKeyframes(profile: StageTransitionProfile) {
  switch (profile.kind) {
    case "neutral": return {};
    case "continue": return { artwork: [{ opacity: .84 }, { opacity: 1 }], easing: "ease-out" };
    case "turn": return {
      artwork: [{ opacity: .72 }, { opacity: .94, offset: .64 }, { opacity: 1 }],
      shade: [{ opacity: .85 }, { opacity: .96, offset: .68 }, { opacity: 1 }],
      wall: [{ transform: `translateX(${profile.wallOffsetPx}px)` }, { transform: "translateX(0px)" }],
      easing: "cubic-bezier(.2,.7,.3,1)",
    };
    case "settle": return {
      artwork: [{ opacity: .76 }, { opacity: .96, offset: .72 }, { opacity: 1 }],
      shade: [{ opacity: .90 }, { opacity: .93, offset: .42 }, { opacity: 1 }],
      easing: "cubic-bezier(.2,.55,.28,1)",
    };
  }
}

export function createStageMotionArrival() {
  let consumed = -1;
  return (seq: number, motionEnabled: boolean) => {
    if (seq <= consumed) return false;
    consumed = seq;
    return motionEnabled;
  };
}
