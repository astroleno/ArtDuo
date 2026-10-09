"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ExhibitionSnapshot } from "./types";
import type { ExperienceState } from "./state";
import { createViewingSession, enterArtwork, restoreViewingSession, sessionStorageKey, settleViewingClock, type ViewingClock, type ViewingSession } from "./viewing-session";

export function useViewingSession(base: ExhibitionSnapshot) {
  const [session, setSession] = useState(() => createViewingSession(base));
  const ref = useRef(session);
  const [hydrated, setHydrated] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const persist = useCallback((value: ViewingSession) => {
    try { sessionStorage.setItem(sessionStorageKey(base), JSON.stringify(value)); }
    catch { setStorageAvailable(false); }
  }, [base.exhibitionId]);
  const commit = useCallback((update: ViewingSession | ((value: ViewingSession) => ViewingSession)) => {
    const next = typeof update === "function" ? update(ref.current) : update;
    ref.current = next;
    setSession(next);
    persist(next);
    return next;
  }, [persist]);
  useEffect(() => {
    try {
      const restored = restoreViewingSession(sessionStorage.getItem(sessionStorageKey(base)), base) ?? createViewingSession(base);
      ref.current = restored; setSession(restored);
    } catch {
      const restored = createViewingSession(base);
      ref.current = restored; setSession(restored); setStorageAvailable(false);
    }
    setHydrated(true);
  }, [base.exhibitionId, base.routeOrder?.join(",")]);
  const clear = useCallback(() => {
    const next = { ...ref.current, observations: [], revisions: [], pending: undefined, message: "观看记录已清除，当前作品与路线保持不变。" };
    commit(next);
  }, [commit]);
  return { session, ref, commit, hydrated, storageAvailable, clear };
}

export function useViewingObservation({ controller, state, snapshot, readyUnitId, readingOpen }: {
  controller: ReturnType<typeof useViewingSession>; state: ExperienceState; snapshot: ExhibitionSnapshot;
  readyUnitId?: string; readingOpen: boolean;
}) {
  const clock = useRef<ViewingClock>({ mode: "paused", since: 0 });
  const [visible, setVisible] = useState(true);
  const currentId = state.act === "walk" ? snapshot.units.find((unit) => unit.exhibition.unitId === state.unitId)?.artwork.id : undefined;
  const flush = useCallback(() => {
    const now = performance.now();
    controller.commit((session) => settleViewingClock(session, clock.current, now));
    clock.current = { ...clock.current, since: now };
  }, [controller.commit]);
  useEffect(() => {
    const sync = () => {
      flush();
      if (document.visibilityState !== "visible") clock.current.mode = "paused";
      setVisible(document.visibilityState === "visible");
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    const interval = window.setInterval(() => { if (clock.current.mode !== "paused") flush(); }, 5_000);
    window.addEventListener("pagehide", flush);
    return () => { flush(); clearInterval(interval); document.removeEventListener("visibilitychange", sync); window.removeEventListener("pagehide", flush); };
  }, [flush]);
  useEffect(() => {
    if (!controller.hydrated) return;
    flush();
    if (clock.current.artworkId !== currentId) {
      const previousId = clock.current.artworkId;
      controller.commit((session) => {
        const finished = previousId ? { ...session, observations: session.observations.map((item) => item.artworkId === previousId ? { ...item, completedVisits: item.completedVisits + 1 } : item) } : session;
        return currentId ? enterArtwork(finished, currentId) : finished;
      });
    } else if (currentId && !controller.ref.current.observations.some((item) => item.artworkId === currentId)) {
      controller.commit((session) => enterArtwork(session, currentId));
    }
    const reading = readingOpen || state.overlay === "plaque";
    const mode = !visible || !currentId || state.transitioning || readyUnitId !== state.unitId || state.failedMediaIds.includes(currentId)
      ? "paused" : reading ? "reading" : state.overlay === "lightbox" ? "zoom" : "viewing";
    if (mode === "zoom" && clock.current.mode !== "zoom") controller.commit((session) => ({ ...session,
      observations: session.observations.map((item) => item.artworkId === currentId ? { ...item, zooms: item.zooms + 1 } : item) }));
    clock.current = { artworkId: currentId, mode, since: performance.now() };
  }, [controller.hydrated, controller.session.order, currentId, state.overlay, state.transitioning, state.failedMediaIds, state.unitId, readingOpen, readyUnitId, visible, flush]);
  return flush;
}
