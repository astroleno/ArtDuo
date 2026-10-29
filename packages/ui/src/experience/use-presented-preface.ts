"use client";

import { useEffect, useRef, useState } from "react";
import { createPresentedPrefaceStore, prefaceIdentity, readyPreface } from "./presented-preface";
import type { ExhibitionSnapshot, NarrativeBlock } from "./types";

const runtime = globalThis as typeof globalThis & { __artduoPresentedPrefaces?: ReturnType<typeof createPresentedPrefaceStore> };
const store = () => runtime.__artduoPresentedPrefaces ??= createPresentedPrefaceStore();
function tabStorage(): Storage | undefined {
  try { return window.sessionStorage; } catch { return; }
}

export function usePresentedPreface(snapshot: ExhibitionSnapshot, active: boolean): NarrativeBlock | null {
  const identity = prefaceIdentity(snapshot);
  const [presented, setPresented] = useState<{ identity: string; block: NarrativeBlock | null }>();
  const [visible, setVisible] = useState(false);
  const deadline = useRef<{ identity: string; at?: number }>({ identity });
  useEffect(() => {
    const sync = () => setVisible(document.visibilityState === "visible");
    sync(); document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  useEffect(() => {
    deadline.current = { identity };
    setPresented({ identity, block: store().restore(identity, tabStorage()) ?? null });
  }, [identity]);
  useEffect(() => {
    if (presented?.identity !== identity || presented.block) return;
    if (!active || !visible) { deadline.current = { identity }; return; }
    const until = deadline.current.identity === identity && deadline.current.at !== undefined
      ? deadline.current.at : Date.now() + 3000;
    deadline.current = { identity, at: until };
    const show = () => setPresented({ identity, block: store().present(identity, snapshot.preface, tabStorage()) });
    if (readyPreface(snapshot.preface, Boolean(snapshot.narrativePending), until, Date.now())) { show(); return; }
    const timer = setTimeout(show, Math.max(0, until - Date.now()));
    return () => clearTimeout(timer);
  }, [identity, active, visible, presented, snapshot.preface, snapshot.narrativePending]);
  return presented?.identity === identity ? presented.block : null;
}
