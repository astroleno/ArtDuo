import type { ExhibitionSnapshot, ExperienceUnit } from "./types";

export type ViewingPreference = "quieter" | "similar" | "different" | "original";
export type ViewingPace = "steady" | "unhurried" | "quick";
export interface ViewerObservation {
  artworkId: string;
  viewingMs: number;
  zoomMs: number;
  readingMs: number;
  visits: number;
  returns: number;
  zooms: number;
  completedVisits: number;
}
export interface RouteRevision {
  id: number;
  preference: ViewingPreference;
  anchorId: string;
  frozenThrough: number;
  before: string[];
  after: string[];
  reason: string;
}
export interface ViewingSession {
  schemaVersion: 1;
  exhibitionId: string;
  order: string[];
  frontier: number;
  observations: ViewerObservation[];
  revisions: RouteRevision[];
  pending?: { preference: ViewingPreference; anchorId: string };
  paceEnabled: boolean;
  message: string;
}

export const PREFERENCE_LABELS: Record<ViewingPreference, string> = {
  quieter: "接下来更安静一些", similar: "多看这类作品", different: "换一种题材", original: "保持原来的路线",
};

const SUBJECT_GROUPS: Array<[string, RegExp]> = [
  ["海景", /\b(?:sea|coast|beach|waves?|ocean)\b/i],
  ["水面", /\b(?:water|pond|river|lake)\b/i],
  ["花卉", /\b(?:flowers?|lilies|garden)\b/i],
  ["树木", /\b(?:trees?|forest|woods|cypresses?)\b/i],
  ["山景", /\b(?:mountains?|hills?)\b/i],
  ["静物", /\bstill[ -]life\b/i],
  ["人物", /\b(?:portrait|figures?|men|women|woman|children)\b/i],
  ["建筑", /\b(?:architecture|street|interior|bedroom|buildings?|church|monastery)\b/i],
  ["月光", /\bmoon(?:light|lit)?\b/i],
];

export function depictedSubjects(unit: ExperienceUnit): string[] {
  const text = [unit.artwork.metadata.title, ...(unit.artwork.metadata.subjectTags ?? [])].join(" ");
  return SUBJECT_GROUPS.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
}

function overlap(a: string[], b: string[]): number {
  const values = new Set(b.map((item) => item.toLowerCase()));
  return a.filter((item) => values.has(item.toLowerCase())).length;
}

export function affinity(a: ExperienceUnit, b: ExperienceUnit): number {
  return overlap(depictedSubjects(a), depictedSubjects(b)) * 3
    + overlap(a.artwork.metadata.colorTags ?? [], b.artwork.metadata.colorTags ?? []) * 0.5
    + overlap(a.artwork.metadata.compositionTags ?? [], b.artwork.metadata.compositionTags ?? []) * 0.2;
}

export function connectionNote(previous: ExperienceUnit | undefined, unit: ExperienceUnit): string {
  if (!previous) return "从这一件开始，先让目光停在画面上。";
  const shared = depictedSubjects(unit).filter((subject) => depictedSubjects(previous).includes(subject));
  if (shared.length) return `两件作品都包含${shared.slice(0, 2).join("与")}。可以比较它们怎样安排空间与细节。`;
  if (previous.artwork.metadata.artistDisplayName && previous.artwork.metadata.artistDisplayName === unit.artwork.metadata.artistDisplayName) return "继续看同一位艺术家的另一件作品，比较笔触与构图的变化。";
  return "转向另一件作品，看看目光会先落在哪里，再比较前后的构图与色彩。";
}

/** Preserve the opening work and stage membership; improve adjacency within each stage. */
export function sequenceExhibition(units: ExperienceUnit[]): ExperienceUnit[] {
  const result: ExperienceUnit[] = [];
  let index = 0;
  while (index < units.length) {
    const stage = units[index]!.stageId;
    const group: ExperienceUnit[] = [];
    do { group.push(units[index++]!); } while (index < units.length && units[index]!.stageId === stage);
    if (!result.length) result.push(group.shift()!);
    while (group.length) {
      const previous = result.at(-1)!;
      let best = 0;
      for (let i = 1; i < group.length; i++) if (affinity(previous, group[i]!) > affinity(previous, group[best]!)) best = i;
      result.push(group.splice(best, 1)[0]!);
    }
  }
  return result.map((unit, order) => ({ ...unit, exhibition: { ...unit.exhibition, order }, rationale: { text: connectionNote(result[order - 1], unit), source: "grounded" } }));
}

export function validRouteOrder(value: unknown, snapshot: ExhibitionSnapshot): value is string[] {
  const ids = new Set(snapshot.units.map((unit) => unit.artwork.id));
  return Array.isArray(value) && value.length === ids.size && new Set(value).size === ids.size
    && value.every((id) => typeof id === "string" && ids.has(id));
}

export function createViewingSession(snapshot: ExhibitionSnapshot): ViewingSession {
  return { schemaVersion: 1, exhibitionId: snapshot.exhibitionId,
    order: validRouteOrder(snapshot.routeOrder, snapshot) ? [...snapshot.routeOrder] : snapshot.units.map((unit) => unit.artwork.id),
    frontier: -1, observations: [], revisions: [], paceEnabled: true, message: "" };
}

export function enterArtwork(session: ViewingSession, artworkId: string): ViewingSession {
  const index = session.order.indexOf(artworkId);
  if (index < 0) return session;
  const observation = session.observations.find((item) => item.artworkId === artworkId);
  const next = observation ? { ...observation, visits: observation.visits + 1, returns: observation.returns + 1 }
    : { artworkId, viewingMs: 0, zoomMs: 0, readingMs: 0, visits: 1, returns: 0, zooms: 0, completedVisits: 0 };
  return { ...session, frontier: Math.max(session.frontier, index), observations: [...session.observations.filter((item) => item.artworkId !== artworkId), next] };
}

export function queuePreference(session: ViewingSession, preference: ViewingPreference, anchorId: string): ViewingSession {
  if (!session.order.includes(anchorId)) return session;
  if (session.frontier >= session.order.length - 1) return { ...session, pending: undefined, message: "已经走过整条路线，可以重新策展。" };
  return { ...session, pending: { preference, anchorId }, message: "回到未看部分时应用；当前作品和已走过的顺序保持不变。" };
}

function quietScore(unit: ExperienceUnit): number {
  const moods = unit.artwork.metadata.moodTags ?? [];
  return moods.filter((value) => /^(quiet|calm|serenity|restful|serene)$/i.test(value)).length
    - moods.filter((value) => /^(drama|tension|awe|anxiety)$/i.test(value)).length;
}

/** Only an explicit preference changes content; observation-derived pace never calls this. */
export function applyPendingPreference(session: ViewingSession, snapshot: ExhibitionSnapshot, currentId: string): ViewingSession {
  if (!session.pending || session.order.indexOf(currentId) !== session.frontier) return session;
  const { preference, anchorId } = session.pending;
  const byId = new Map(snapshot.units.map((unit) => [unit.artwork.id, unit]));
  const anchor = byId.get(anchorId);
  if (!anchor) return { ...session, pending: undefined, message: "这次调整暂不可用，继续原来的路线。" };
  const prefix = session.order.slice(0, session.frontier + 1);
  let tail = session.order.slice(prefix.length);
  if (preference === "original") tail = snapshot.units.map((unit) => unit.artwork.id).filter((id) => !prefix.includes(id));
  else tail = tail.map((id, index) => ({ id, index, score: preference === "quieter" ? quietScore(byId.get(id)!)
    : (preference === "similar" ? 1 : -1) * affinity(anchor, byId.get(id)!) }))
    .sort((a, b) => b.score - a.score || a.index - b.index).map(({ id }) => id);
  const order = [...prefix, ...tail];
  if (order.every((id, index) => id === session.order[index])) return { ...session, pending: undefined, message: "剩余作品已经符合这个方向，保留当前顺序。" };
  const revision: RouteRevision = { id: (session.revisions.at(-1)?.id ?? 0) + 1, preference, anchorId,
    frozenThrough: session.frontier, before: session.order, after: order, reason: PREFERENCE_LABELS[preference] };
  return { ...session, order, pending: undefined, revisions: [...session.revisions, revision].slice(-20), message: `已按“${PREFERENCE_LABELS[preference]}”调整后续作品。` };
}

export function snapshotForSession(base: ExhibitionSnapshot, session: Pick<ViewingSession, "order">): ExhibitionSnapshot {
  if (!validRouteOrder(session.order, base)) return base;
  const byId = new Map(base.units.map((unit) => [unit.artwork.id, unit]));
  const units = session.order.map((id, index) => {
    const unit = byId.get(id)!;
    const slot = base.units[index]!;
    // Scenes belong to the route's positions. A frozen prefix therefore retains
    // its original room even when the remaining artworks move to other stages.
    return { ...unit, stageId: slot.stageId, scene: slot.scene, transitionFamily: slot.transitionFamily,
      media: { ...unit.media, backgroundUrl: slot.media.backgroundUrl },
      exhibition: { ...unit.exhibition, order: index, backgroundSceneId: slot.exhibition.backgroundSceneId, transitionIn: slot.exhibition.transitionIn } };
  });
  return { ...base, routeOrder: [...session.order], units: units.map((unit, index) => ({ ...unit, rationale: { text: connectionNote(units[index - 1], unit), source: "grounded" } })) };
}

export function observedPace(session: ViewingSession): ViewingPace {
  if (!session.paceEnabled) return "steady";
  const visits = session.observations.filter((item) => item.completedVisits > 0 && item.viewingMs + item.zoomMs > 0);
  if (visits.length < 3) return "steady";
  const durations = visits.map((item) => (item.viewingMs + item.zoomMs) / item.visits).sort((a, b) => a - b);
  const median = durations[Math.floor(durations.length / 2)]!;
  return median >= 12_000 ? "unhurried" : median < 4_000 ? "quick" : "steady";
}

export function sessionStorageKey(snapshot: ExhibitionSnapshot): string {
  return `artduo.viewing.v1.${snapshot.exhibitionId}`;
}

/** Storage is untrusted and optional. Invalid state cannot introduce artworks. */
export function restoreViewingSession(raw: string | null, snapshot: ExhibitionSnapshot): ViewingSession | undefined {
  if (!raw || raw.length > 100_000) return undefined;
  try {
    const value = JSON.parse(raw) as ViewingSession;
    if (value.schemaVersion !== 1 || value.exhibitionId !== snapshot.exhibitionId || !validRouteOrder(value.order, snapshot)
      || !Number.isInteger(value.frontier) || value.frontier < -1 || value.frontier >= value.order.length
      || !Array.isArray(value.observations) || value.observations.length > value.order.length
      || new Set(value.observations.map((item) => item.artworkId)).size !== value.observations.length
      || value.observations.some((item) => !value.order.includes(item.artworkId) || [item.viewingMs, item.zoomMs, item.readingMs, item.visits, item.returns, item.zooms, item.completedVisits].some((n) => !Number.isFinite(n) || n < 0 || n > 86_400_000))
      || !Array.isArray(value.revisions) || value.revisions.length > 20
      || value.revisions.some((revision) => !validRouteOrder(revision.before, snapshot) || !validRouteOrder(revision.after, snapshot)
        || !Object.hasOwn(PREFERENCE_LABELS, revision.preference) || !value.order.includes(revision.anchorId)
        || !Number.isInteger(revision.id) || !Number.isInteger(revision.frozenThrough)
        || revision.frozenThrough < -1 || revision.frozenThrough >= value.order.length)
      || typeof value.paceEnabled !== "boolean") return undefined;
    // URL order wins over stale storage (e.g. a different shared route).
    if (snapshot.routeOrder && snapshot.routeOrder.join(",") !== value.order.join(",")) return undefined;
    return { ...value, pending: undefined, message: "", revisions: value.revisions.map((revision) => ({ ...revision, reason: PREFERENCE_LABELS[revision.preference] })) };
  } catch { return undefined; }
}

export type ViewingMode = "viewing" | "zoom" | "reading" | "paused";
export interface ViewingClock { artworkId?: string; mode: ViewingMode; since: number }

/** Monotonic elapsed time; the caller changes modes on visibility/readiness events. */
export function settleViewingClock(session: ViewingSession, clock: ViewingClock, now: number): ViewingSession {
  if (!clock.artworkId || clock.mode === "paused") return session;
  const duration = Math.max(0, Math.min(3_600_000, now - clock.since));
  const field = clock.mode === "viewing" ? "viewingMs" : clock.mode === "zoom" ? "zoomMs" : "readingMs";
  return { ...session, observations: session.observations.map((item) => item.artworkId === clock.artworkId ? { ...item, [field]: Math.min(86_400_000, item[field] + duration) } : item) };
}
