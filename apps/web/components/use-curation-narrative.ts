"use client";

import { useEffect, useState } from "react";
import { appPath } from "@artduo/contracts";
import { readCurationNarrativeStream, type NarrativeDelivery } from "../lib/curation-stream";
import { recordExperienceMilestone } from "../lib/experience-analytics";

export function useCurationNarrative(input: { curationId?: string; releaseVersion: string; artworkIds: string[]; complete?: boolean }) {
  const [received, setReceived] = useState<{ id?: string; pieces: NarrativeDelivery[]; settled: boolean }>({ id: input.curationId, pieces: [], settled: Boolean(input.complete || !input.curationId) });
  const artworkKey = input.artworkIds.join(",");
  useEffect(() => {
    const id = input.curationId;
    if (id && input.complete) {
      recordExperienceMilestone("first-narrative", input.releaseVersion);
      recordExperienceMilestone("narrative-complete", input.releaseVersion);
    }
    if (!id || input.complete) return;
    const controller = new AbortController();
    let active = true;
    setReceived({ id, pieces: [], settled: false });
    void (async () => {
      try {
        const params = new URLSearchParams({ curationId: id, releaseVersion: input.releaseVersion });
        const response = await fetch(appPath(`/api/curation/narrative?${params}`), { signal: controller.signal });
        for await (const piece of readCurationNarrativeStream(response, id, artworkKey.split(","))) {
          if (!active) return;
          if (piece.kind === "preface") recordExperienceMilestone("first-narrative", input.releaseVersion);
          setReceived((current) => current.id === id ? { ...current, pieces: [...current.pieces, piece] } : current);
        }
        if (active) recordExperienceMilestone("narrative-complete", input.releaseVersion);
      } catch {
        if (active && !controller.signal.aborted) window.dispatchEvent(new CustomEvent("artduo:experience-degraded", { detail: { reason: "narrative-interrupted" } }));
      } finally {
        if (active) setReceived((current) => current.id === id ? { ...current, settled: true } : current);
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [input.curationId, input.releaseVersion, input.complete, artworkKey]);
  return { pieces: received.id === input.curationId ? received.pieces : [], pending: Boolean(input.curationId && !input.complete && (received.id !== input.curationId || !received.settled)) };
}
