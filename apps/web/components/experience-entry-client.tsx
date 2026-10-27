"use client";

import { useEffect, useState } from "react";
import { appPath } from "@artduo/contracts";

import { Threshold } from "@artduo/ui";
import { beginExperienceTiming } from "../lib/experience-analytics";

const ENTRY_ACTION = "/gallery/local/immersive";
const ENTRY_FIELDS = { view: "experience", recipeVersion: "experience-v2", phase: "preface" };

export function ExperienceEntryClient({ initialQuery = "" }: { initialQuery?: string }) {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => { if (event.persisted) setBusy(false); };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);
  const onSubmit = (query: string) => {
    if (busy) return;
    setBusy(true);
    beginExperienceTiming(query);
    // Back may reload this document instead of restoring its form state. Keep
    // the entry URL aligned with the submitted draft in either case.
    const entry = new URL(window.location.href);
    entry.searchParams.set("query", query);
    window.history.replaceState(window.history.state, "", `${entry.pathname}${entry.search}${entry.hash}`);
    const target = `${ENTRY_ACTION}?${new URLSearchParams({ query, ...ENTRY_FIELDS }).toString()}`;
    window.location.assign(appPath(target));
  };
  return <div className={busy ? "experience-entry is-leaving" : "experience-entry"}>
    <Threshold busy={busy} formAction={ENTRY_ACTION} formFields={ENTRY_FIELDS} initialValue={initialQuery} onSubmit={onSubmit} />
  </div>;
}
