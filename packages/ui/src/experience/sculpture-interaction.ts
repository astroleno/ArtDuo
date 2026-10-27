import { boundedRoomLightInput, type RoomLightInput } from "./room-lighting";

/** View-height units: the photo shader and the sculpture use this same soft light. */
export const SCULPTURE_INTERACTION = {
  lightHeight: .62,
  lightPower: .48,
  backgroundLightRatio: .16,
  lightRadius: .56,
  lightColor: [1, .97, .91] as [number, number, number],
  depthScale: .24,
  depthPivot: .46,
  cameraX: .045,
  cameraY: .028,
} as const;

/** Project a stationary photograph's floor line through its bottom-aligned cover crop. */
export function sculptureFloorLine(photoY: number, viewAspect: number, imageAspect: number) {
  return (photoY - 1) / Math.min(1, imageAspect / viewAspect) + 1;
}

export function sculpturePointerLight(input: RoomLightInput, aspect: number) {
  const value = boundedRoomLightInput(input);
  return { x: value.x * aspect * .5, y: value.y ? -value.y * .5 : 0, z: SCULPTURE_INTERACTION.lightHeight };
}

export const sculptureInputBlend = (seconds: number) => 1 - Math.exp(-Math.max(0, Math.min(.05, seconds)) * 8);
