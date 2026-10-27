"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { appPath } from "@artduo/contracts";

import { ExperienceShell, validRouteOrder } from "@artduo/ui";
import type { ExperiencePosition, ExhibitionSnapshot, SculptureRoomScene, SculptureWork } from "@artduo/ui";

import { experienceHrefForPosition, resolveExperiencePosition } from "../lib/experience-navigation";
import { beginExperienceTimingIfMissing, recordExperienceDegradation, recordExperienceMilestone } from "../lib/experience-analytics";
import { useCurationNarrative } from "./use-curation-narrative";
import { useHandwrittenKeepsake } from "./use-handwritten-keepsake";
import { requestSculptureNarrative } from "../lib/sculpture-narrative-client";

export function ExperienceRouteClient({ snapshot, initialPosition, sculptures }: { snapshot: ExhibitionSnapshot; initialPosition: ExperiencePosition; sculptures: { works: SculptureWork[]; scenes: SculptureRoomScene[] } }) {
  const router = useRouter();
  const handwritingProvider = useHandwrittenKeepsake();
  const [routePosition, setRoutePosition] = useState(initialPosition);
  const [routeSnapshot, setRouteSnapshot] = useState(snapshot);
  const [detailNavigation, setDetailNavigation] = useState<{ returnTo: string; slow: boolean } | null>(null);
  useEffect(() => {
    if (!detailNavigation) return;
    const timer = setTimeout(() => setDetailNavigation(current => current ? { ...current, slow: true } : null), 8000);
    return () => clearTimeout(timer);
  }, [detailNavigation?.returnTo]);
  const cancelDetail = useCallback(() => {
    if (!detailNavigation) return;
    const returnTo = detailNavigation.returnTo;
    setDetailNavigation(null);
    // A newer navigation supersedes the pending RSC response. Clearing UI state
    // alone would let a late response unexpectedly take the visitor away.
    router.replace(returnTo, { scroll: false });
  }, [router, detailNavigation]);
  const { pieces, pending } = useCurationNarrative({ curationId: snapshot.curationId, releaseVersion: snapshot.releaseVersion,
    artworkIds: snapshot.units.map((unit) => unit.artwork.id), complete: snapshot.narrativeComplete });
  const narratedSnapshot = useMemo(() => ({ ...routeSnapshot,
    narrativePending: pending,
    preface: pieces.find((piece) => piece.kind === "preface") ?? routeSnapshot.preface,
    closing: pieces.find((piece) => piece.kind === "closing") ?? routeSnapshot.closing,
    units: routeSnapshot.units.map((unit) => ({ ...unit, curatorNote: pieces.find((piece) => piece.kind === "note" && piece.artworkId === unit.artwork.id) ?? unit.curatorNote })),
  }), [routeSnapshot, pieces, pending]);
  useEffect(() => {
    const restoreFromUrl = () => {
      const current = new URL(window.location.href);
      if (current.searchParams.get("view") !== "experience") return;
      setDetailNavigation(null);
      const params = Object.fromEntries(current.searchParams.entries());
      const order = params.route?.split(",");
      setRouteSnapshot({ ...snapshot, routeOrder: validRouteOrder(order, snapshot) ? order : snapshot.units.map((unit) => unit.artwork.id) });
      setRoutePosition(resolveExperiencePosition(params, snapshot).position);
    };
    window.addEventListener("popstate", restoreFromUrl);
    return () => window.removeEventListener("popstate", restoreFromUrl);
  }, [snapshot]);
  const onPositionChange = useCallback((position: ExperiencePosition, active: ExhibitionSnapshot) => {
    const href = appPath(experienceHrefForPosition(active, position));
    if (`${window.location.pathname}${window.location.search}` !== href) {
      window.history.replaceState(null, "", href);
    }
  }, [snapshot]);
  const onDetail = useCallback((artworkId: string, position: ExperiencePosition, active: ExhibitionSnapshot) => {
    if (detailNavigation) return;
    const unit = active.units.find((candidate) => candidate.artwork.id === artworkId);
    if (!unit) return;
    const returnTo = experienceHrefForPosition(active, position);
    const params = new URLSearchParams({
      releaseVersion: snapshot.releaseVersion,
      returnTo,
      query: snapshot.query,
      backgroundSceneId: unit.scene?.id ?? "",
      retrievalScore: String(unit.retrievalEvidence.score),
      matchedTokens: unit.retrievalEvidence.matchedTokens.join(","),
    });
    setDetailNavigation({ returnTo, slow: false });
    router.push(`/artwork/${encodeURIComponent(artworkId)}?${params.toString()}`);
  }, [router, snapshot, detailNavigation]);
  const restartHref = `/?view=experience&query=${encodeURIComponent(snapshot.query)}`;
  const onRestart = useCallback(() => {
    router.push(restartHref);
  }, [router, restartHref]);
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
    sculptureWorks={sculptures.works}
    sculptureScenes={sculptures.scenes}
    sculptureNarrator={requestSculptureNarrative}
    handwritingProvider={handwritingProvider}
    initialPosition={routePosition}
    onDetail={onDetail}
    detailNavigation={detailNavigation ? { slow: detailNavigation.slow, onCancel: cancelDetail } : undefined}
    onMilestone={onMilestone}
    onPositionChange={onPositionChange}
    onRestart={onRestart}
    restartHref={restartHref}
    snapshot={narratedSnapshot}
  />;
}
