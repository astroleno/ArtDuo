import type { ExperienceStage } from "./types";
import { appPath } from "@artduo/contracts";

export interface RoomLightInput { x: number; y: number }
export interface RoomLightMood { exposure: number; warmth: number; softness: number; motionScale: number; audioGain: number }
export const NEUTRAL_ROOM_MOOD: RoomLightMood = { exposure: 1, warmth: 0, softness: 1, motionScale: 1, audioGain: 1 };
const finite = (value: number, min: number, max: number, fallback: number) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
export function boundedRoomLightMood(value: RoomLightMood): RoomLightMood {
  return { exposure: finite(value.exposure, .88, 1.08, 1), warmth: finite(value.warmth, -1, 1, 0), softness: finite(value.softness, .8, 1.5, 1),
    motionScale: finite(value.motionScale, .35, 1.05, 1), audioGain: finite(value.audioGain, .5, 1, 1) };
}
/** Curatorial stage targets shape the room, never the original artwork pixels. */
export function roomLightMood(stage?: Pick<ExperienceStage, "valence" | "arousal" | "tension" | "wonder" | "intimacy">): RoomLightMood {
  if (!stage) return NEUTRAL_ROOM_MOOD;
  const unit = (v: number) => finite(v, 0, 1, .5);
  const v = unit(stage.valence), a = unit(stage.arousal), t = unit(stage.tension), w = unit(stage.wonder), i = unit(stage.intimacy);
  return boundedRoomLightMood({ exposure: .93 + v * .1 + w * .025 - t * .025, warmth: (i - .5) * .55 + (v - .5) * .3,
    softness: 1.15 + (1 - a) * .35 - t * .35, motionScale: .45 + a * .45 + w * .15, audioGain: .62 + a * .25 + t * .05 });
}
export interface RoomLightProfile {
  sceneId: string;
  shape: "window-wash" | "linear-wash" | "oval-spots";
  depthUrl: string;
  normalUrl: string;
  color: readonly [number, number, number];
  strength: number;
  /** Source-photo coordinates, top-left origin: center x/y and soft radii. */
  lights: ReadonlyArray<readonly [number, number, number, number]>;
}

const profile = (sceneId: string, values: Omit<RoomLightProfile, "sceneId" | "depthUrl" | "normalUrl">): RoomLightProfile => ({
  sceneId, depthUrl: appPath(`/artduo-gallery/lighting/v2/${sceneId}-depth.png`),
  normalUrl: appPath(`/artduo-gallery/lighting/v2/${sceneId}-normal.png`), ...values,
});

// Editorial photometric distributions fitted to the photographed fixtures;
// these are not measurements from an IES luminaire file.
const PROFILES: Record<string, RoomLightProfile> = {
  "bg-004": profile("bg-004", { shape: "window-wash", color: [1, .94, .82], strength: .25,
    lights: [[.19, .43, .36, .39]] }),
  "bg-012": profile("bg-012", { shape: "oval-spots", color: [1, .98, .93], strength: .20,
    lights: [[.28, .28, .22, .40], [.50, .28, .22, .40], [.72, .28, .22, .40]] }),
  "bg-015": profile("bg-015", { shape: "linear-wash", color: [1, .98, .94], strength: .16,
    lights: [[.50, .24, .48, .28], [.50, .67, .45, .16]] }),
  "bg-022": profile("bg-022", { shape: "window-wash", color: [1, .97, .91], strength: .22,
    lights: [[.83, .43, .43, .48]] }),
  "bg-027": profile("bg-027", { shape: "linear-wash", color: [.91, .95, 1], strength: .24,
    lights: [[.5, .24, .53, .28], [.5, .76, .37, .13]] }),
  "bg-034": profile("bg-034", { shape: "oval-spots", color: [1, .97, .90], strength: .23,
    lights: [[.34, .36, .16, .32], [.51, .36, .17, .33], [.68, .36, .16, .32]] }),
};

export function roomLightProfile(sceneId: string | undefined, maps?: { depthUrl: string; normalUrl: string }): RoomLightProfile | undefined {
  const value = sceneId ? PROFILES[sceneId] : undefined;
  return value && maps ? { ...value, ...maps } : value;
}

export function boundedRoomLightInput(value: RoomLightInput): RoomLightInput {
  const bound = (v: number) => Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
  return { x: bound(value.x), y: bound(value.y) };
}
