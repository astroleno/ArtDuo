"use client";

import { useEffect } from "react";

export function GlassButtonEffects() {
  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;
    void import("../../../packages/ui/src/glass/glass-buttons").then(({ createGlassButtons }) => {
      if (!cancelled) dispose = createGlassButtons(document.body);
    }).catch(() => { /* Existing button faces remain usable if enhancement cannot load. */ });
    return () => { cancelled = true; dispose?.(); };
  }, []);
  return null;
}
