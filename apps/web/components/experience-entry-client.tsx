"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { EXPERIENCE_RECIPE_VERSION } from "@artduo/ui";
import { Threshold } from "@artduo/ui";
import { beginExperienceTiming } from "../lib/experience-analytics";

export function ExperienceEntryClient({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const onSubmit = (query: string) => {
    if (busy) return;
    setBusy(true);
    beginExperienceTiming();
    const target = `/gallery/local/immersive?${new URLSearchParams({ query, view: "experience", recipeVersion: EXPERIENCE_RECIPE_VERSION, phase: "walk" }).toString()}`;
    void router.prefetch(target);
    router.push(target);
  };
  return <div className={busy ? "experience-entry is-leaving" : "experience-entry"}>
    <Threshold busy={busy} initialValue={initialQuery} onSubmit={onSubmit} />
  </div>;
}
