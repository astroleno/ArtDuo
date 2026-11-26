import type { ExhibitionSnapshot, ExperienceUnit } from "./types";
import type { ViewingSession } from "./viewing-session";

const MINIMUM_VIEWING_MS = 1000;
const SHARED_DETAILS = ["花朵", "花瓶", "帆船", "窗框", "拱门", "屋顶", "树干", "倒影"] as const;

function observation(unit: ExperienceUnit | undefined) {
  const text = unit?.closingObservation?.text.trim();
  if (!text || Array.from(text).length > 36 || !/^[^。！？]+。$/u.test(text)
    || /未见|没有|看不|可能|疑似|不确定|难以|无法|似乎/u.test(text)) return undefined;
  return text;
}

function pairText(earlier: ExperienceUnit | undefined, last: ExperienceUnit | undefined) {
  const before = observation(earlier), after = observation(last);
  if (!before || !after || before === after) return undefined;
  const shared = SHARED_DETAILS.find(detail => before.includes(detail) && after.includes(detail));
  const text = "先前那幅，" + before + "最后这幅，" + after;
  return Array.from(text).length <= 60 ? { text, shared } : undefined;
}

function viewed(session: ViewingSession, id: string) {
  return session.observations.some(item => item.artworkId === id && item.viewingMs >= MINIMUM_VIEWING_MS);
}

export function selectClosingLookback(snapshot: ExhibitionSnapshot, session: ViewingSession, lastId: string): ViewingSession["closingLookback"] {
  if (snapshot.exhibitionId !== session.exhibitionId || session.order.length < 2
    || session.order.at(-1) !== lastId || !viewed(session, lastId)) return undefined;
  const last = snapshot.units.find(unit => unit.artwork.id === lastId);
  const candidates = session.order.slice(0, -1).flatMap(id => {
    if (!viewed(session, id)) return [];
    const pair = pairText(snapshot.units.find(unit => unit.artwork.id === id), last);
    return pair ? [{ id, shared: pair.shared }] : [];
  });
  const earlier = candidates.find(candidate => candidate.shared) ?? candidates[0];
  return earlier ? { earlierId: earlier.id, lastId, order: [...session.order] } : undefined;
}

export function restoreClosingLookback(snapshot: ExhibitionSnapshot, session: ViewingSession, last: ExperienceUnit | undefined) {
  const saved = session.closingLookback;
  if (snapshot.exhibitionId !== session.exhibitionId || !saved || !last || saved.lastId !== last.artwork.id
    || session.order.at(-1) !== saved.lastId || !Array.isArray(saved.order)
    || saved.order.length !== session.order.length || saved.order.some((id, index) => id !== session.order[index])
    || !session.order.slice(0, -1).includes(saved.earlierId)
    || !viewed(session, saved.earlierId) || !viewed(session, saved.lastId)) return undefined;
  const pair = pairText(snapshot.units.find(unit => unit.artwork.id === saved.earlierId), last);
  return pair ? { earlierId: saved.earlierId, block: { text: pair.text, source: "grounded" as const } } : undefined;
}

export function closingLookbackForExit(snapshot: ExhibitionSnapshot, session: ViewingSession, lastId: string, ready: boolean) {
  const last = snapshot.units.find(unit => unit.artwork.id === lastId);
  if (restoreClosingLookback(snapshot, session, last)) return session.closingLookback;
  return ready ? selectClosingLookback(snapshot, session, lastId) : undefined;
}

export function resolveClosingNarrative(base: ExhibitionSnapshot, lastUnit: ExperienceUnit | undefined,
  lookback?: ReturnType<typeof restoreClosingLookback>): {
  block: ExhibitionSnapshot["closing"];
  pending: boolean;
} {
  if (lookback) return { block: lookback.block, pending: false };
  if (base.units.at(-1)?.artwork.id === lastUnit?.artwork.id) {
    return { block: base.closing, pending: Boolean(base.narrativePending) };
  }
  const observation = lastUnit?.closingObservation;
  if (observation?.text.trim()) return { block: observation, pending: false };
  const title = lastUnit?.artwork.metadata.title.trim();
  return { block: { text: title ? `这次看到《${title}》。` : "这次观展到这里。", source: "fallback" }, pending: false };
}
