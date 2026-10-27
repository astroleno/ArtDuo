"use client";

import { useEffect, useRef, useState } from "react";
import type { NarrativeBlock } from "./types";

/** Once prose is readable, keep it still for this visit. Navigation remounts it. */
export function useStableNarrative(block: NarrativeBlock, pending = false): NarrativeBlock | null {
  const [visible, setVisible] = useState<NarrativeBlock | null>(() => !pending || block.source === "grounded" ? block : null);
  const deadline = useRef(Date.now() + 3000);
  useEffect(() => {
    if (visible) return;
    if (!pending || block.source === "grounded") { setVisible(block); return; }
    const timer = setTimeout(() => setVisible(block), Math.max(0, deadline.current - Date.now()));
    return () => clearTimeout(timer);
  }, [block, pending, visible]);
  return visible;
}
