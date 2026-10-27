import type { ExhibitionSnapshot } from "./types";
import type { SculptureRoomScene, SculptureWork } from "./sculpture-types";

export const SCULPTURE_ENCOUNTER_CHANCE = .5;
export interface SculptureEncounter {
  version: 1;
  exhibitionId: string;
  status: "absent" | "pending" | "active" | "complete";
  modelId?: string;
  roomId?: string;
  anchorArtworkId?: string;
  nextArtworkId?: string;
}

export function permitsSculptureEncounter(query: string): boolean {
  // Figure subjects in paintings do not classify the separate sculpture interlude.
  return !/(?:不要|不看|排除|不含|没有|无|不需要)[^，。；]{0,8}(?:雕塑|雕像)|(?:只(?:要|看|想看|想要)|仅(?:限|看|要)|全部|全是)[^，。；]{0,8}(?:绘画|画作|油画|水彩|风景|静物)|(?:no|without|exclude)\s+(?:sculptures?|statues?)|(?:only\s+(?:paintings?|landscapes?|still lifes?)|(?:paintings?|landscapes?)\s+only)/iu.test(query);
}

/** Separate from routeOrder: an encounter never becomes a requested painting. */
export function planSculptureEncounter(snapshot: ExhibitionSnapshot, works: SculptureWork[], scenes: SculptureRoomScene[],
  options: { roll: number; selection: number; recent?: string[] }): SculptureEncounter {
  const absent: SculptureEncounter = { version: 1, exhibitionId: snapshot.exhibitionId, status: "absent" };
  if (snapshot.units.length < 4 || !works.length || !scenes.length || !permitsSculptureEncounter(snapshot.query)
    || !Number.isFinite(options.roll) || options.roll < 0 || options.roll >= SCULPTURE_ENCOUNTER_CHANCE) return absent;
  const units = snapshot.units;
  const boundaries = units.flatMap((unit, index) => index >= 1 && index < units.length - 2
    && (unit.sceneMatch?.chapter?.index !== units[index + 1]?.sceneMatch?.chapter?.index
      || unit.stageId !== units[index + 1]?.stageId) ? [index] : []);
  const anchor = boundaries[0] ?? Math.max(1, Math.min(units.length - 3, Math.floor(units.length / 2) - 1));
  const context = [snapshot.query, units[anchor]!.artwork.metadata.title, ...(units[anchor]!.artwork.metadata.moodTags ?? []),
    units[anchor + 1]!.artwork.metadata.title, ...(units[anchor + 1]!.artwork.metadata.moodTags ?? [])].join(" ").toLowerCase();
  const recent = options.recent ?? [];
  const weights = works.map(work => {
    const affinity = (work.tags ?? []).filter(tag => context.includes(tag.toLowerCase())).length;
    const seen = recent.lastIndexOf(work.id);
    return (1 + Math.min(5, affinity) * 3) * (seen < 0 ? 1 : seen === recent.length - 1 ? .03 : .15);
  });
  let cursor = Math.min(.999999999, Math.max(0, Number.isFinite(options.selection) ? options.selection : 0)) * weights.reduce((a, b) => a + b, 0);
  const model = works.find((_, index) => (cursor -= weights[index]!) < 0) ?? works[works.length - 1]!;
  const quiet = (units[anchor]?.sceneMatch?.lightDirection ?? "top") === "top";
  const room = scenes.find(scene => quiet ? scene.tone === "neutral" : scene.light === "right") ?? scenes[0]!;
  return { version: 1, exhibitionId: snapshot.exhibitionId, status: "pending", modelId: model.id, roomId: room.id,
    anchorArtworkId: units[anchor]!.artwork.id, nextArtworkId: units[anchor + 1]!.artwork.id };
}

export const sculptureEncounterKey = (exhibitionId: string) => `artduo.sculpture-encounter.v1.${exhibitionId}`;

export function restoreSculptureEncounter(raw: string | null, snapshot: ExhibitionSnapshot, works: SculptureWork[], scenes: SculptureRoomScene[]): SculptureEncounter | undefined {
  if (!raw || raw.length > 4096) return undefined;
  try {
    const value = JSON.parse(raw) as SculptureEncounter;
    if (value.version !== 1 || value.exhibitionId !== snapshot.exhibitionId || !["absent", "pending", "active", "complete"].includes(value.status)) return undefined;
    if (value.status === "absent") return { version: 1, exhibitionId: snapshot.exhibitionId, status: "absent" };
    if (!works.some(work => work.id === value.modelId) || !scenes.some(scene => scene.id === value.roomId)
      || !snapshot.units.some(unit => unit.artwork.id === value.anchorArtworkId) || !snapshot.units.some(unit => unit.artwork.id === value.nextArtworkId)
      || value.anchorArtworkId === value.nextArtworkId || !permitsSculptureEncounter(snapshot.query)) {
      // Retired catalog entries and changed eligibility do not create a reroll.
      return { version: 1, exhibitionId: snapshot.exhibitionId, status: "absent" };
    }
    return { version: 1, exhibitionId: snapshot.exhibitionId, status: value.status, modelId: value.modelId, roomId: value.roomId,
      anchorArtworkId: value.anchorArtworkId, nextArtworkId: value.nextArtworkId };
  } catch { return undefined; }
}
