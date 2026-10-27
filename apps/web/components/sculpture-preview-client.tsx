"use client";

import { SculptureRoom, type SculptureQuality, type SculptureRoomScene, type SculptureWork } from "@artduo/ui";
import { requestSculptureNarrative } from "../lib/sculpture-narrative-client";

export function SculpturePreviewClient(props: { works: SculptureWork[]; scenes: SculptureRoomScene[]; initialModel: string; initialScene: string; initialQuality: SculptureQuality }) {
  return <SculptureRoom {...props} narrate={requestSculptureNarrative} />;
}
