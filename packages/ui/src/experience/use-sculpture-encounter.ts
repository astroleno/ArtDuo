"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { canOfferSculptureEncounter, passSculptureEncounter, planSculptureEncounter, restoreSculptureEncounter, sculptureEncounterKey, type SculptureEncounter } from "./sculpture-encounter";
import type { ExhibitionSnapshot } from "./types";
import type { SculptureRoomScene, SculptureWork } from "./sculpture-types";

const RECENT_KEY = "artduo.sculpture-recent.v1";
function recentWorks(): string[] {
  try { const value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && /^[a-z-]{1,64}$/u.test(id)).slice(-8) : [];
  } catch { return []; }
}
const random = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 0x100000000;

export function useSculptureEncounter(snapshot: ExhibitionSnapshot, works: SculptureWork[], scenes: SculptureRoomScene[], hydrated: boolean) {
  const [value, setValue] = useState<SculptureEncounter>();
  const ref = useRef<SculptureEncounter | undefined>(undefined);
  const inputs = useRef({ snapshot, works, scenes }); inputs.current = { snapshot, works, scenes };
  const commit = useCallback((next: SculptureEncounter) => {
    ref.current = next; setValue(next);
    try { sessionStorage.setItem(sculptureEncounterKey(next.exhibitionId), JSON.stringify(next)); } catch { /* Optional storage. */ }
    return next;
  }, []);
  useEffect(() => {
    if (!hydrated || ref.current?.exhibitionId === snapshot.exhibitionId) return;
    const current = inputs.current;
    let saved: SculptureEncounter | undefined;
    try { saved = restoreSculptureEncounter(sessionStorage.getItem(sculptureEncounterKey(snapshot.exhibitionId)), current.snapshot, current.works, current.scenes); } catch { /* Optional storage. */ }
    commit(saved ?? planSculptureEncounter(current.snapshot, current.works, current.scenes, { roll: random(), selection: random(), recent: recentWorks() }));
  }, [snapshot.exhibitionId, hydrated, commit]);
  const begin = useCallback((anchorId: string) => {
    const current = ref.current;
    if (!current || !canOfferSculptureEncounter(inputs.current.snapshot, current, inputs.current.works, anchorId)) return false;
    commit({ ...current, status: "active" });
    try { localStorage.setItem(RECENT_KEY, JSON.stringify([...recentWorks(), current.modelId!].slice(-8))); } catch { /* Optional history. */ }
    return true;
  }, [commit]);
  const finish = useCallback(() => {
    const current = ref.current;
    if (current && current.status !== "absent") commit({ ...current, status: "complete" });
  }, [commit]);
  const pass = useCallback((anchorId: string | undefined) => {
    const passed = passSculptureEncounter(ref.current, anchorId);
    if (passed) commit(passed);
  }, [commit]);
  return { value, ref, begin, finish, pass };
}
