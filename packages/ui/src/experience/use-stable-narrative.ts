"use client";

import { useEffect, useRef, useState } from "react";
import type { NarrativeBlock } from "./types";

/** Once prose is readable, keep it still for this visit and ending identity. */
export function useStableNarrative(block: NarrativeBlock, pending: boolean, identity: string, active: boolean): NarrativeBlock | null {
  const ready = !pending || block.source === "grounded";
  const [presented, setPresented] = useState<{ identity: string; block: NarrativeBlock }>();
  const visible = presented?.identity === identity ? presented.block : undefined;
  const deadline = useRef<{ identity: string; at: number } | undefined>(undefined);
  useEffect(() => {
    if (!active) {
      deadline.current = undefined;
      if (presented) setPresented(undefined);
      return;
    }
    if (visible) return;
    const present = () => setPresented({ identity, block });
    if (ready) { present(); return; }
    if (presented) setPresented(undefined);
    if (deadline.current?.identity !== identity) deadline.current = { identity, at: Date.now() + 3000 };
    const timer = setTimeout(present, Math.max(0, deadline.current.at - Date.now()));
    return () => clearTimeout(timer);
  }, [active, block, identity, presented, ready, visible]);
  return active ? visible ?? (ready ? block : null) : null;
}
