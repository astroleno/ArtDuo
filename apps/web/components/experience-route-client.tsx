"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { appPath } from "@artduo/contracts";

import { ExperienceShell, replaceExperienceHistory } from "@artduo/ui";
import type { ExperiencePosition, ExhibitionSnapshot, SculptureRoomScene, SculptureWork } from "@artduo/ui";

import { buildExperienceEntryHref, experienceHrefForPosition, restoreExperienceRoute } from "../lib/experience-navigation";
import { beginExperienceTimingIfMissing, recordExperienceDegradation, recordExperienceMilestone } from "../lib/experience-analytics";
import { useCurationNarrative } from "./use-curation-narrative";
import { useHandwrittenKeepsake } from "./use-handwritten-keepsake";
import { requestSculptureNarrative } from "../lib/sculpture-narrative-client";

export function ExperienceRouteClient({ snapshot, initialPosition, sculptures, canonicalHref }: { snapshot: ExhibitionSnapshot; initialPosition: ExperiencePosition; sculptures: { works: SculptureWork[]; scenes: SculptureRoomScene[] }; canonicalHref?: string }) {
  const router = useRouter();
  const handwritingProvider = useHandwrittenKeepsake();
  const [restoredRoute] = useState(() => restoreExperienceRoute(snapshot, initialPosition, typeof window === "undefined" ? undefined : window.location.href));
  const [routePosition, setRoutePosition] = useState(restoredRoute.position);
  const [routeSnapshot, setRouteSnapshot] = useState(restoredRoute.snapshot);
  const [detailNavigation, setDetailNavigation] = useState<{ returnTo: string; slow: boolean } | null>(null);
  useEffect(() => {
    // The first response already contains the saved selection. Publish its
    // identity without fetching and rebuilding the same exhibition a second time.
    // A cached first response may mount again on Forward. Its address already
    // contains a newer work/phase; don't replace it with the original preface.
    if (canonicalHref && !restoredRoute.restored) replaceExperienceHistory(appPath(canonicalHref));
  }, [canonicalHref, restoredRoute]);
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
      const restored = restoreExperienceRoute(snapshot, initialPosition, window.location.href);
      if (!restored.restored) return;
      setDetailNavigation(null);
      setRouteSnapshot(restored.snapshot);
      setRoutePosition(restored.position);
    };
    window.addEventListener("popstate", restoreFromUrl);
    return () => window.removeEventListener("popstate", restoreFromUrl);
  }, [snapshot, initialPosition]);
  const onPositionChange = useCallback((position: ExperiencePosition, active: ExhibitionSnapshot) => {
    const href = appPath(experienceHrefForPosition(active, position));
    if (`${window.location.pathname}${window.location.search}` !== href) {
      replaceExperienceHistory(href);
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
  const restartHref = buildExperienceEntryHref(snapshot.query);
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
