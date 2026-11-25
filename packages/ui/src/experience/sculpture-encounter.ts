import type { ExhibitionSnapshot, SculptureBridgeTheme } from "./types";
import type { SculptureRoomScene, SculptureWork } from "./sculpture-types";
import { hasExclusivePaintingRequest } from "@artduo/contracts";

export const SCULPTURE_ENCOUNTER_CHANCE = .5;
/** A visit planned below this arousal throughout is kept still: no side hall. */
const STILL_VISIT_AROUSAL = .25;
const CITY_VIEW_MIN_AROUSAL = .45;
export interface SculptureEncounter {
  version: 1 | 2;
  exhibitionId: string;
  status: "absent" | "pending" | "active" | "complete";
  modelId?: string;
  roomId?: string;
  anchorArtworkId?: string;
  nextArtworkId?: string;
}
const THEME_TAGS: Record<SculptureBridgeTheme, string[]> = { music: ["music", "音乐"], drapery: ["drapery", "衣纹", "衣褶"] };

export function permitsSculptureEncounter(query: string): boolean {
  // Figure subjects in paintings do not classify the separate sculpture interlude.
  let permitted = true;
  for (const clause of query.split(/[，。；,;.!?！？\n]/u)) {
    if (hasExclusivePaintingRequest(clause)) permitted = false;
    for (const match of clause.matchAll(/雕塑|雕像|\b(?:sculptures?|statues?)\b/giu)) {
      const before = clause.slice(0, match.index).split(/但是|而是|不过|\bbut\b|\binstead\b/iu).at(-1) ?? "";
      const denial = before.replace(/不介意|不排斥|\b(?:do not mind|don['’]t mind|not opposed to)\b/giu, "");
      const after = clause.slice(match.index! + match[0].length);
      if (/(?:不要|不看|不想|不愿|排除|不含|没有|无|不需要|别|避免|避开)[^，。；,;.!?]{0,32}$|\b(?:no|not|without|exclude|avoid|don['’]t|do not)\b[^,;.!?]{0,60}$/iu.test(denial)
        || /^\s*(?:(?:is|are)\s+)?(?:not\s+(?:welcome|wanted|allowed)|[- ]free\b)/iu.test(after)) return false;
      if (/想(?:看|要|遇见)|要看|欢迎|可以|接受|不介意|不排斥|只(?:看|要)|\b(?:want|like|welcome|include|allow|mind)\b/iu.test(before)
        || /^\s*(?:也(?:可以|行|好)|也?欢迎|也?能看|(?:(?:is|are)\s+)?(?:also\s+)?(?:welcome|fine|okay|allowed|acceptable))/iu.test(after)) permitted = true;
    }
  }
  return permitted;
}

function eligibleRoute(snapshot: ExhibitionSnapshot): boolean {
  const stages = snapshot.stages ?? [];
  return snapshot.units.length >= 4 && permitsSculptureEncounter(snapshot.query)
    && !(stages.length > 0 && stages.every(stage => stage.arousal < STILL_VISIT_AROUSAL));
}

function boundaryWorks(snapshot: ExhibitionSnapshot, anchor: number, works: SculptureWork[]): SculptureWork[] {
  const from = snapshot.units[anchor], to = snapshot.units[anchor + 1];
  if (anchor < 1 || anchor >= snapshot.units.length - 2 || from?.displayCategory !== "wall-painting" || to?.displayCategory !== "wall-painting") return [];
  const leftChapter = from.sceneMatch?.chapter?.index, rightChapter = to.sceneMatch?.chapter?.index;
  const crossesChapter = leftChapter !== undefined && rightChapter !== undefined && leftChapter !== rightChapter;
  const crossesStage = from.stageId && to.stageId && from.stageId !== to.stageId;
  if (!crossesStage && !crossesChapter) return [];
  const themes = (from.sculptureBridgeThemes ?? []).filter(theme => to.sculptureBridgeThemes?.includes(theme));
  return works.filter(work => work.tags?.some(tag => themes.some(theme => THEME_TAGS[theme].includes(tag.trim().toLowerCase()))));
}

/** Resolve the stored pair against the actual route, including older active encounters. */
export function sculptureEncounterSuccessor(snapshot: ExhibitionSnapshot, encounter: SculptureEncounter, anchorArtworkId: string | undefined) {
  if (!anchorArtworkId || anchorArtworkId !== encounter.anchorArtworkId) return undefined;
  const anchor = snapshot.units.findIndex(unit => unit.artwork.id === anchorArtworkId);
  const next = snapshot.units[anchor + 1];
  return anchor >= 0 && next?.artwork.id === encounter.nextArtworkId ? next : undefined;
}

export function canOfferSculptureEncounter(snapshot: ExhibitionSnapshot, encounter: SculptureEncounter | undefined,
  works: SculptureWork[], anchorArtworkId: string | undefined): boolean {
  if (encounter?.status !== "pending" || !sculptureEncounterSuccessor(snapshot, encounter, anchorArtworkId) || !eligibleRoute(snapshot)) return false;
  const anchor = snapshot.units.findIndex(unit => unit.artwork.id === anchorArtworkId);
  return boundaryWorks(snapshot, anchor, works).some(work => work.id === encounter.modelId);
}

export function passSculptureEncounter(encounter: SculptureEncounter | undefined, anchorArtworkId: string | undefined): SculptureEncounter | undefined {
  if (anchorArtworkId && encounter?.status === "pending" && encounter.anchorArtworkId === anchorArtworkId) {
    return { ...encounter, status: "complete" };
  }
}

/** Separate from routeOrder: an encounter never becomes a requested painting. */
export function planSculptureEncounter(snapshot: ExhibitionSnapshot, works: SculptureWork[], scenes: SculptureRoomScene[],
  options: { roll: number; selection: number; recent?: string[] }): SculptureEncounter {
  const absent: SculptureEncounter = { version: 2, exhibitionId: snapshot.exhibitionId, status: "absent" };
  const stages = snapshot.stages ?? [];
  if (!eligibleRoute(snapshot) || !works.length || !scenes.length
    || !Number.isFinite(options.roll) || options.roll < 0 || options.roll >= SCULPTURE_ENCOUNTER_CHANCE) return absent;
  const units = snapshot.units;
  const stageOf = (index: number) => stages.find((stage) => stage.id === units[index]?.stageId);
  const boundaries = units.flatMap((_, index) => {
    const matches = boundaryWorks(snapshot, index, works);
    return matches.length ? [{ index, matches }] : [];
  });
  // The side hall belongs where the route turns or releases, not at its quiet entrance.
  const turning = boundaries.find(({ index }) => ["turn", "release"].includes(stageOf(index + 1)?.role ?? "") && stageOf(index)?.id !== stageOf(index + 1)?.id);
  const boundary = turning ?? boundaries[0];
  if (!boundary) return absent;
  const { index: anchor, matches } = boundary;
  const recent = options.recent ?? [];
  const weights = matches.map(work => {
    const seen = recent.lastIndexOf(work.id);
    return seen < 0 ? 1 : seen === recent.length - 1 ? .03 : .15;
  });
  let cursor = Math.min(.999999999, Math.max(0, Number.isFinite(options.selection) ? options.selection : 0)) * weights.reduce((a, b) => a + b, 0);
  const model = matches.find((_, index) => (cursor -= weights[index]!) < 0) ?? matches[matches.length - 1]!;
  const quiet = (units[anchor]?.sceneMatch?.lightDirection ?? "top") === "top";
  const calmStage = [stageOf(anchor), stageOf(anchor + 1)].some((stage) => stage && stage.arousal < CITY_VIEW_MIN_AROUSAL);
  const suitable = scenes.filter((scene) => !(calmStage && scene.view === "city"));
  const room = suitable.find(scene => quiet || calmStage ? scene.tone === "neutral" : scene.light === "right") ?? suitable[0] ?? scenes[0]!;
  return { version: 2, exhibitionId: snapshot.exhibitionId, status: "pending", modelId: model.id, roomId: room.id,
    anchorArtworkId: units[anchor]!.artwork.id, nextArtworkId: units[anchor + 1]!.artwork.id };
}

export const sculptureEncounterKey = (exhibitionId: string) => `artduo.sculpture-encounter.v1.${exhibitionId}`;

export function restoreSculptureEncounter(raw: string | null, snapshot: ExhibitionSnapshot, works: SculptureWork[], scenes: SculptureRoomScene[]): SculptureEncounter | undefined {
  if (!raw || raw.length > 4096) return undefined;
  try {
    const value = JSON.parse(raw) as SculptureEncounter;
    if (![1, 2].includes(value.version) || value.exhibitionId !== snapshot.exhibitionId || !["absent", "pending", "active", "complete"].includes(value.status)) return undefined;
    const absent: SculptureEncounter = { version: value.version, exhibitionId: snapshot.exhibitionId, status: "absent" };
    if (value.status === "absent") return absent;
    if (!works.some(work => work.id === value.modelId) || !scenes.some(scene => scene.id === value.roomId)
      || !snapshot.units.some(unit => unit.artwork.id === value.anchorArtworkId) || !snapshot.units.some(unit => unit.artwork.id === value.nextArtworkId)
      || value.anchorArtworkId === value.nextArtworkId || !permitsSculptureEncounter(snapshot.query)) {
      // Retired catalog entries and changed eligibility do not create a reroll.
      return absent;
    }
    if (value.status === "pending" && !canOfferSculptureEncounter(snapshot, value, works, value.anchorArtworkId)) return absent;
    if (value.status === "active" && !sculptureEncounterSuccessor(snapshot, value, value.anchorArtworkId)) return absent;
    return { version: value.version, exhibitionId: snapshot.exhibitionId, status: value.status, modelId: value.modelId, roomId: value.roomId,
      anchorArtworkId: value.anchorArtworkId, nextArtworkId: value.nextArtworkId };
  } catch { return undefined; }
}
