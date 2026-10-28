import { appPath } from "@artduo/contracts";
import { validRouteOrder } from "@artduo/ui";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { ExperienceRouteClient } from "../../../../components/experience-route-client";
import { enforcePublicRequest, RuntimeLimitError } from "../../../../lib/public-runtime";
import { curateExhibition } from "../../../../lib/semantic-curator";
import { curationNarrativeView, getExhibitionNarrative } from "../../../../lib/exhibition-narrative-server";
import { buildCurationNarrative } from "../../../../lib/curation-narrative";
import { orderSearchForGrowth } from "../../../../lib/affective-negotiation";
import { buildGallerySceneRoute } from "../../../../lib/gallery-route";
import { DEFAULT_CURATION_PROMPT } from "../../../../lib/prompts";
import { buildExperienceSnapshot } from "../../../../lib/experience-adapter";
import { getExhibitionSculptures } from "../../../../lib/sculpture-catalog";
import { buildExperienceEntryHref, buildExperienceHref, resolveExperiencePosition } from "../../../../lib/experience-navigation";
import { recordExperienceDegradation, recordExperienceTiming } from "../../../../lib/experience-analytics";
import { loadWebReleaseCatalog, searchBackgroundScenes, searchReleaseCatalog } from "../../../../lib/release-catalog";

interface ImmersivePageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function readSingle(params: Record<string, string | string[] | undefined> | undefined, key: string): string | undefined {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function ImmersivePage({ searchParams }: ImmersivePageProps) {
  const queryParams = await searchParams;
  const query = readSingle(queryParams, "query") || DEFAULT_CURATION_PROMPT;
  const requestedVersion = readSingle(queryParams, "releaseVersion");
  const releaseLoadStartedAt = performance.now();
  let catalog;
  try {
    catalog = loadWebReleaseCatalog({ releaseVersion: requestedVersion });
    recordExperienceTiming("release-load", performance.now() - releaseLoadStartedAt, catalog.releaseVersion);
  } catch {
    recordExperienceDegradation("release-unavailable", requestedVersion ?? "current");
    return <main className="artduo-experience experience-unavailable">
      <h1>这次展览暂时无法打开</h1>
      <p>原句已保留，可以重新选一组。</p>
      <a className="experience-primary" href={appPath(buildExperienceEntryHref(query))}>返回入口</a>
    </main>;
  }

  const recipeVersion = readSingle(queryParams, "recipeVersion");
  if (recipeVersion && !["experience-v1", "experience-v2"].includes(recipeVersion)) {
    recordExperienceDegradation("recipe-unavailable", catalog.releaseVersion);
    return <main className="artduo-experience experience-unavailable">
      <h1>这次展览暂时无法打开</h1>
      <a className="experience-primary" href={appPath(buildExperienceEntryHref(query))}>带原句返回入口</a>
    </main>;
  }
  const requestedCuration = readSingle(queryParams, "curationId");
  const searchStartedAt = performance.now();
  let curation;
  try {
    if (!requestedCuration && recipeVersion !== "experience-v1") await enforcePublicRequest(await headers(), "curation");
    curation = recipeVersion === "experience-v1" ? undefined : await curateExhibition({ catalog, query, curationId: requestedCuration });
  } catch (error) {
    if (error instanceof RuntimeLimitError) return <main className="artduo-experience experience-unavailable"><h1>这次展览还没有准备好</h1>
      <p>现在请求较多，请稍后再试。</p><a className="experience-primary" href={appPath(buildExperienceEntryHref(query))}>返回入口</a></main>;
    return <main className="artduo-experience experience-unavailable"><h1>保存的展览暂时无法恢复</h1>
      <p>原句已保留，可以重新选一组。</p>
      <a className="experience-primary" href={appPath(buildExperienceEntryHref(query))}>返回入口</a></main>;
  }
  recordExperienceTiming("retrieval", performance.now() - searchStartedAt, catalog.releaseVersion);
  if (curation?.assignments.length && !requestedCuration) getExhibitionNarrative(catalog, curation);
  const preparedNarrative = curation ? curationNarrativeView(catalog, curation) : undefined;
  let search = curation?.search ?? searchReleaseCatalog(catalog, query, { limit: 12 });
  const narrative = preparedNarrative?.narrative ?? buildCurationNarrative(search);
  if (!curation) search = orderSearchForGrowth(search, narrative.growthForm);
  const sceneMatchStartedAt = performance.now();
  const sceneSearch = searchBackgroundScenes(catalog, query, { limit: 12 });
  const exhibitionRooms = catalog.backgroundScenes.filter(scene => ["bg-004", "bg-027", "bg-034"].includes(scene.id));
  const route = buildGallerySceneRoute(search, exhibitionRooms.length ? exhibitionRooms : catalog.backgroundScenes, {
    sceneResults: sceneSearch.results,
    growthForm: narrative.growthForm,
  });
  recordExperienceTiming("scene-match", performance.now() - sceneMatchStartedAt, catalog.releaseVersion);
  const adapterStartedAt = performance.now();
  const snapshot = buildExperienceSnapshot({ query, catalog, search, narrative, route,
    curationId: curation?.curationId, narrativePieces: preparedNarrative?.pieces, narrativeComplete: preparedNarrative?.complete });
  const requestedRoute = readSingle(queryParams, "route");
  const routeOrder = requestedRoute && requestedRoute.length < 4096 ? requestedRoute.split(",") : undefined;
  if (validRouteOrder(routeOrder, snapshot)) snapshot.routeOrder = routeOrder;
  recordExperienceTiming("snapshot-adapter", performance.now() - adapterStartedAt, catalog.releaseVersion);
  if (snapshot.omittedUnitCount > 0) recordExperienceDegradation("release-records-omitted", catalog.releaseVersion);
  const { position, corrected } = resolveExperiencePosition(queryParams, snapshot);
  const needsCanonical = !requestedVersion || corrected || readSingle(queryParams, "view") !== "experience"
    || !readSingle(queryParams, "phase") || Boolean(curation && (!requestedCuration || recipeVersion !== "experience-v2"));
  const canonicalHref = needsCanonical ? buildExperienceHref({
      query,
      releaseVersion: catalog.releaseVersion,
      phase: position.phase,
      artworkId: position.phase === "walk" ? snapshot.units.find(unit => unit.exhibition.unitId === position.unitId)?.artwork.id
        : position.phase === "closing" && position.lastUnitId ? snapshot.units.find(unit => unit.exhibition.unitId === position.lastUnitId)?.artwork.id : undefined,
      routeOrder: snapshot.routeOrder,
      recipeVersion: snapshot.recipeVersion,
      curationId: snapshot.curationId,
    }) : undefined;
  // Fresh curation can render immediately: its durable identity is already
  // known. Retain server redirects for saved-link corrections and legacy recipes.
  if (canonicalHref && (requestedCuration || !curation)) redirect(canonicalHref);
  return <>
    {canonicalHref ? <noscript><meta httpEquiv="refresh" content={`0;url=${appPath(canonicalHref)}`} /></noscript> : null}
    <ExperienceRouteClient key={snapshot.exhibitionId} initialPosition={position} snapshot={snapshot} sculptures={getExhibitionSculptures()} canonicalHref={canonicalHref} />
  </>;
}
