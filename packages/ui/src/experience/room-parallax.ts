import { boundedRoomLightInput, type RoomLightInput } from "./room-lighting";

/** Both image depth and sculpture views follow the current input, never drag distance. */
export function roomParallaxInput(input: RoomLightInput): RoomLightInput {
  const bounded = boundedRoomLightInput(input);
  return { x: bounded.x * .65, y: bounded.y * .65 };
}
