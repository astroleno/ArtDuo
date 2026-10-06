"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ExperienceShell } from "@artduo/ui";
import type { ExperiencePosition, ExhibitionSnapshot } from "@artduo/ui";

import { experienceHrefForPosition, resolveExperiencePosition } from "../lib/experience-navigation";
import { beginExperienceTimingIfMissing, recordExperienceDegradation, recordExperienceMilestone } from "../lib/experience-analytics";

export function ExperienceRouteClient({ snapshot, initialPosition }: { snapshot: ExhibitionSnapshot; initialPosition: ExperiencePosition }) {
  const router = useRouter();
  const [routePosition, setRoutePosition] = useState(initialPosition);
  useEffect(() => {
    const restoreFromUrl = () => {
      const current = new URL(window.location.href);
      if (current.searchParams.get("view") !== "experience") return;
      const params = Object.fromEntries(current.searchParams.entries());
      setRoutePosition(resolveExperiencePosition(params, snapshot).position);
    };
    window.addEventListener("popstate", restoreFromUrl);
    return () => window.removeEventListener("popstate", restoreFromUrl);
  }, [snapshot]);
  const onPositionChange = useCallback((position: ExperiencePosition) => {
    const href = experienceHrefForPosition(snapshot, position);
    if (`${window.location.pathname}${window.location.search}` !== href) {
      window.history.replaceState(null, "", href);
    }
  }, [snapshot]);
  const onDetail = useCallback((artworkId: string, position: ExperiencePosition) => {
    const unit = snapshot.units.find((candidate) => candidate.artwork.id === artworkId);
    if (!unit) return;
    const returnTo = experienceHrefForPosition(snapshot, position);
    const params = new URLSearchParams({
      releaseVersion: snapshot.releaseVersion,
      returnTo,
      query: snapshot.query,
      backgroundSceneId: unit.scene?.id ?? "",
      retrievalScore: String(unit.retrievalEvidence.score),
      matchedTokens: unit.retrievalEvidence.matchedTokens.join(","),
    });
    router.push(`/artwork/${encodeURIComponent(artworkId)}?${params.toString()}`);
  }, [router, snapshot]);
  const onRestart = useCallback(() => {
    router.push(`/?view=experience&query=${encodeURIComponent(snapshot.query)}`);
  }, [router, snapshot.query]);
  useEffect(() => {
    beginExperienceTimingIfMissing();
    recordExperienceMilestone("snapshot-ready", snapshot.releaseVersion);
    const onDegraded = (event: Event) => {
      const detail = (event as CustomEvent<{ reason?: string; artworkId?: string }>).detail;
      if (detail?.reason) recordExperienceDegradation(detail.reason, snapshot.releaseVersion, detail.artworkId);
    };
    window.addEventListener("artduo:experience-degraded", onDegraded);
    return () => window.removeEventListener("artduo:experience-degraded", onDegraded);
  }, [snapshot.releaseVersion]);
  const onMilestone = useCallback((phase: "first-artwork-visible" | "first-artwork-actionable") => {
    recordExperienceMilestone(phase, snapshot.releaseVersion);
  }, [snapshot.releaseVersion]);
  return <ExperienceShell
    initialPosition={routePosition}
    onDetail={onDetail}
    onMilestone={onMilestone}
    onPositionChange={onPositionChange}
    onRestart={onRestart}
    snapshot={snapshot}
  />;
}
