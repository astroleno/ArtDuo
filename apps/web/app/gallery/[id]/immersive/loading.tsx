"use client";

import { appPath } from "@artduo/contracts";
import { ExperienceWaitingFrame, type ExperienceWaitTier } from "@artduo/ui";
import { useEffect, useState, useSyncExternalStore } from "react";

import { experienceWaitElapsedMs, pendingExperienceQuery } from "../../../../lib/experience-analytics";
import { experienceLoadingTier } from "../../../../lib/experience-loading";

const unchanging = () => () => {};
const requestedQuery = () => new URLSearchParams(window.location.search).get("query") ?? pendingExperienceQuery() ?? "";

// Continues the frame the entry page faded into, on the same clock.
export default function ImmersiveLoading() {
  const query = useSyncExternalStore(unchanging, requestedQuery, () => "");
  const [tier, setTier] = useState<ExperienceWaitTier>("normal");
  useEffect(() => {
    const update = () => setTier(experienceLoadingTier(experienceWaitElapsedMs()));
    update();
    const timer = setInterval(update, 500);
    return () => clearInterval(timer);
  }, []);
  const returnHref = appPath(`/?${new URLSearchParams(query ? { view: "experience", query } : { view: "experience" })}`);
  return <main className="artduo-experience experience-loading-frame">
    <ExperienceWaitingFrame query={query} tier={tier} returnHref={returnHref} retryHref="" />
  </main>;
}
