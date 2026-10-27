import type { PlaqueArtwork } from "./plaque";
import type { SculptureProportions } from "./sculpture-layout";

export interface SculptureWork extends SculptureProportions {
  id: string;
  title: string;
  compactUrl: string;
  referenceUrl: string;
  posterUrl: string;
  initialRotation: number;
  tags?: string[];
  reading: Omit<PlaqueArtwork, "media">;
}

export type SculptureNarrator = (id: string, query: string, signal: AbortSignal) => Promise<{ text: string; source: "grounded" | "fallback" }>;

export interface SculptureRoomScene {
  id: string;
  label: string;
  imageUrl: string;
  smallImageUrl: string;
  depthUrl: string;
  normalUrl: string;
  light: "left" | "right" | "top";
  tone: "warm" | "neutral";
}

export type SculptureQuality = "compact" | "reference";
