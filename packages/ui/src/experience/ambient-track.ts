import { appPath } from "@artduo/contracts";
import type { ExperienceStage } from "./types";

// The manifest publishes these URLs in asset order. The bands run from quiet to active.
const TRACKS = [
  { name: "Felt Letter.mp3", assetIndex: 1 },
  { name: "Awakening.mp3", assetIndex: 0 },
  { name: "First Words.mp3", assetIndex: 2 },
] as const;

export function ambientTrack(exhibitionId: string, stages: readonly Pick<ExperienceStage, "arousal">[], trackUrls?: readonly string[]) {
  const readings = stages.map(stage => stage.arousal).filter(value => Number.isFinite(value) && value >= 0 && value <= 1);
  const average = readings.length ? readings.reduce((total, value) => total + value, 0) / readings.length : undefined;
  let band: number;
  if (average === undefined) {
    // Older exhibits may lack an emotional plan. Keep their sound stable as well.
    let hash = 2166136261;
    for (let index = 0; index < exhibitionId.length; index++) hash = Math.imul(hash ^ exhibitionId.charCodeAt(index), 16777619);
    band = (hash >>> 0) % TRACKS.length;
  } else {
    band = average < .42 ? 0 : average < .63 ? 1 : 2;
  }
  const track = TRACKS[band]!;
  return trackUrls?.[track.assetIndex] ?? appPath(`/ambient-audio/${encodeURIComponent(track.name)}`);
}
