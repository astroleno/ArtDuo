"use client";

import type { SculptureQuality, SculptureRoomScene, SculptureWork } from "@artduo/ui";
import { SculptureRoom } from "@artduo/ui/src/experience/sculpture-room";
import { requestSculptureNarrative } from "../lib/sculpture-narrative-client";

export function SculpturePreviewClient(props: { works: SculptureWork[]; scenes: SculptureRoomScene[]; initialModel: string; initialScene: string; initialQuality: SculptureQuality }) {
  return <SculptureRoom {...props} narrate={requestSculptureNarrative} />;
}
