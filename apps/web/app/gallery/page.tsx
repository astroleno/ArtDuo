import { appPath } from "@artduo/contracts";
import { ArrowRight } from "lucide-react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { enforcePublicRequest, RuntimeLimitError } from "../../lib/public-runtime";

import { ArtworkImage } from "../../components/artwork-image";
import { artworkImageUrl } from "../../lib/artwork-image-url";
import { buildExperienceEntryHref, buildExperienceHref } from "../../lib/experience-navigation";
import { curateExhibition } from "../../lib/semantic-curator";
import { getExhibitionNarrative } from "../../lib/exhibition-narrative-server";
import { readGalleryRouteOrder } from "../../lib/gallery-route";
import { loadWebReleaseCatalog } from "../../lib/release-catalog";

interface GalleryPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function readQuery(params: Record<string, string | string[] | undefined> | undefined): string {
  const value = params?.query;
  if (Array.isArray(value)) {
    return (value[0] ?? "").trim();
  }

  return (value ?? "").trim();
}

function readView(params: Record<string, string | string[] | undefined> | undefined): string | undefined {
  const value = params?.view;
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function GalleryPage({ searchParams }: GalleryPageProps) {
  const params = await searchParams;
  const query = readQuery(params);
  if (!query) redirect(buildExperienceEntryHref());
  const routePreview = readView(params) === "route";
  const single = (key: string) => { const value = params?.[key]; return Array.isArray(value) ? value[0] : value; };
  const catalog = loadWebReleaseCatalog({ releaseVersion: single("releaseVersion") });
  let curation;
  try {
    if (!single("curationId")) await enforcePublicRequest(await headers(), "curation");
    curation = await curateExhibition({ catalog, query, curationId: single("curationId") });
  } catch (error) {
    if (error instanceof RuntimeLimitError) return <main className="artduo-experience experience-unavailable"><h1>这次展览还没有准备好</h1>
      <p>现在请求较多，请稍后再试。</p><a href={appPath(buildExperienceEntryHref(query))}>返回入口</a></main>;
    return <main className="artduo-experience experience-unavailable"><h1>这次展览暂时无法打开</h1>
      <p>保存的展览未能恢复。</p><a href={appPath(buildExperienceEntryHref(query))}>重新写一句</a></main>;
  }
  if (curation.assignments.length && !single("curationId")) getExhibitionNarrative(catalog, curation);
  const byId = new Map(curation.search.results.map(result => [result.artwork.id, result]));
  const routeOrder = readGalleryRouteOrder(single("route"), [...byId.keys()]);
  const results = routeOrder ? routeOrder.map(id => byId.get(id)!) : curation.search.results;
  const hasCuratedResults = results.length > 0;
  const requestedArtwork = single("artworkId") ?? single("unit");
  const phase = single("phase");
  const base = { query, releaseVersion: catalog.releaseVersion, recipeVersion: "experience-v2", curationId: curation.curationId, routeOrder };
  const immersiveHref = buildExperienceHref({ ...base, phase: phase === "preface" || phase === "closing" ? phase : "walk",
    artworkId: requestedArtwork && byId.has(requestedArtwork) ? requestedArtwork : undefined });

  if (hasCuratedResults && !routePreview) {
    redirect(immersiveHref);
  }

  return (
    <main className="shell experience-artwork-page experience-route-page">
      <header className="topbar">
        <a className="brand" href={appPath("/")}>
          <span className="brand-mark">ArtDuo</span>
        </a>
        <nav className="nav" aria-label="观展导航">
          <a className="detail-return-link" href={appPath(buildExperienceEntryHref(query))}>重新选一组</a>
        </nav>
      </header>

      <section className="experience-route-heading">
        <p className="meta">{results.length} 件作品</p>
        <h1>{hasCuratedResults ? "这次的展览" : "暂未找到合适的作品"}</h1>
        <p className="experience-route-query">{query}</p>
        {hasCuratedResults ? (
          <a className="primary-button gallery-immersive-link" href={appPath(immersiveHref)}>进入展览 <ArrowRight aria-hidden="true" size={18} /></a>
        ) : (
          <a className="primary-button" href={appPath(buildExperienceEntryHref(query))}>重新写一句</a>
        )}
      </section>

      {hasCuratedResults ? <section className="section" aria-label="本次展览作品">
        <ol className="experience-route-works">{results.map(({ artwork }) => <li key={artwork.id}>
          <a className="experience-route-work" href={appPath(buildExperienceHref({ ...base, phase: "walk", artworkId: artwork.id }))}>
            <ArtworkImage alt="" className="experience-route-work-image" fallbackLabel={artwork.title} retryable={false}
              fallbackMeta={artwork.artistDisplayName} src={artworkImageUrl(artwork.id, "preview", catalog.releaseVersion)} />
            <strong>{artwork.title}</strong>
            <span>{[artwork.artistDisplayName, artwork.yearLabel].filter(Boolean).join(" · ")}</span>
          </a>
        </li>)}</ol>
      </section> : null}
    </main>
  );
}
