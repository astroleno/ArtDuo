import { ArrowRight, Search } from "lucide-react";
import { redirect } from "next/navigation";

import { ArtworkImage } from "../../components/artwork-image";
import { artworkImageUrl } from "../../lib/artwork-image-url";
import { searchGalleryWithRuntime } from "../../lib/browser-curation";
import { buildCurationNarrative } from "../../lib/curation-narrative";
import { buildHardFilteredExhibition } from "../../lib/exhibition-results";
import { buildGallerySceneRoute, type GallerySceneRouteStop } from "../../lib/gallery-route";
import { DEFAULT_CURATION_PROMPT, STARTER_PROMPTS } from "../../lib/prompts";
import { loadWebReleaseCatalog, searchBackgroundScenes, type WebReleaseCatalog, type WebSearchResult } from "../../lib/release-catalog";

interface GalleryPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const EXHIBITION_RESULT_LIMIT = 12;

function readQuery(params: Record<string, string | string[] | undefined> | undefined): string {
  const value = params?.query;
  if (Array.isArray(value)) {
    return (value[0] ?? "").trim();
  }

  return (value ?? "").trim();
}

function readRuntime(params: Record<string, string | string[] | undefined> | undefined): string | undefined {
  const value = params?.runtime;
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function readView(params: Record<string, string | string[] | undefined> | undefined): string | undefined {
  const value = params?.view;
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function buildIdleSearch(catalog: WebReleaseCatalog, query: string): WebSearchResult {
  return {
    query,
    normalizedQuery: "",
    model: "idle",
    dimensions: catalog.embeddingRecords[0]?.dimensions ?? 0,
    results: [],
  };
}

function buildFallbackMeta(result: WebSearchResult["results"][number]): string {
  return [
    `馆藏编号 ${result.artwork.id}`,
    result.artwork.artistDisplayName,
    result.artwork.yearLabel,
  ].filter(Boolean).join(" · ");
}

function buildRoomHref(
  query: string,
  stop: GallerySceneRouteStop,
  results: WebSearchResult["results"],
): string {
  const params = new URLSearchParams({ query });
  const unit = results[stop.startIndex]?.artwork.id;

  if (unit && stop.startIndex > 0) {
    params.set("unit", unit);
  }

  return `/gallery/local/immersive?${params.toString()}`;
}

function displayStageLabel(stageLabel: string): string {
  if (stageLabel === "Opening") {
    return "第一站";
  }
  if (stageLabel === "Drift") {
    return "行进中";
  }
  if (stageLabel === "Return") {
    return "回望处";
  }

  return "展厅";
}

function GallerySceneRoute({
  featured,
  query,
  results,
  route,
}: {
  featured?: WebSearchResult["results"][number];
  query: string;
  results: WebSearchResult["results"];
  route: GallerySceneRouteStop[];
}) {
  if (route.length === 0) {
    return null;
  }

  return (
    <section className="gallery-route-panel" aria-label="今日路线" data-testid="gallery-route">
      <div className="gallery-route-heading">
        <p className="meta">路线大厅</p>
        <h2>先走进第一间展厅</h2>
      </div>
      <ol className="gallery-route-track">
        {route.map((stop) => {
          const isOpening = stop.stageLabel === "Opening";
          const featuredMeta = featured ? [featured.artwork.artistDisplayName, featured.artwork.yearLabel].filter(Boolean).join(", ") : "";

          return (
            <li className={isOpening ? "is-opening-stop" : ""} key={`${stop.stageLabel}-${stop.scene.id}`}>
              <a
                aria-label={`从${stop.scene.label}开始观展`}
                className="gallery-route-stop"
                data-testid="gallery-route-stop"
                href={buildRoomHref(query, stop, results)}
              >
                <span aria-hidden="true" className="gallery-route-thumb">
                  {stop.scene.imageUrl ? <img alt="" loading="eager" src={stop.scene.imageUrl} /> : null}
                </span>
                <span className="gallery-route-copy">
                  <span className="gallery-route-stage">{displayStageLabel(stop.stageLabel)}</span>
                  <strong>{stop.scene.label}</strong>
                  <span>{stop.whisper}</span>
                  {stop.stageLabel === "Opening" ? (
                    <span className="gallery-route-enter">从这里开始</span>
                  ) : null}
                </span>
                {isOpening && featured ? (
                  <span className="route-opening-work" data-testid="result-card">
                    <ArtworkImage
                      alt={`${featured.artwork.title} artwork`}
                      className="route-opening-work-image"
                      fallbackLabel={featured.artwork.title}
                      fallbackMeta={buildFallbackMeta(featured)}
                      fetchPriority="high"
                      loading="eager"
                      src={artworkImageUrl(featured.artwork.id)}
                    />
                    <span className="route-opening-work-copy">
                      <span>当前第一幅</span>
                      <strong>{featured.artwork.title}</strong>
                      {featuredMeta ? <span>{featuredMeta}</span> : null}
                    </span>
                  </span>
                ) : null}
              </a>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default async function GalleryPage({ searchParams }: GalleryPageProps) {
  const params = await searchParams;
  const query = readQuery(params);
  const hasQuery = query.length > 0;
  const runtimeMode = readRuntime(params);
  const routePreview = readView(params) === "route";
  const catalog = loadWebReleaseCatalog();
  const immersiveHref = `/gallery/local/immersive?${new URLSearchParams({ query }).toString()}`;
  const { search: candidateSearch, runtime } = hasQuery
    ? searchGalleryWithRuntime({
      catalog,
      query,
      limit: catalog.artworkCount,
      runtimeMode,
    })
    : { search: buildIdleSearch(catalog, query), runtime: "idle" };
  const exhibition = buildHardFilteredExhibition(candidateSearch, { limit: EXHIBITION_RESULT_LIMIT });
  const search = exhibition.search;
  const hasCuratedResults = hasQuery && search.results.length > 0;
  const featured = search.results[0];
  const narrative = hasQuery && search.results.length > 0
    ? buildCurationNarrative(search, {
      hardFilterEvidence: exhibition.evidence,
      candidateSearch,
      hardFilterVisibleLimit: EXHIBITION_RESULT_LIMIT,
    })
    : undefined;
  const sceneSearch = hasQuery ? searchBackgroundScenes(catalog, query, { limit: 12 }) : undefined;
  const sceneRoute = hasCuratedResults ? buildGallerySceneRoute(search, catalog.backgroundScenes, {
    sceneResults: sceneSearch?.results,
    growthForm: narrative?.growthForm,
  }) : [];
  const featuredSceneImage = sceneRoute[0]?.scene.imageUrl ?? featured?.scene?.imageUrl;

  if (hasCuratedResults && !routePreview) {
    redirect(immersiveHref);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">ArtDuo</span>
          <span className="brand-meta">馆藏 {catalog.releaseVersion}</span>
        </a>
        <nav className="nav" aria-label="Primary">
          <a href="/">首页</a>
          <a href="/gallery">画廊</a>
        </nav>
      </header>

      <section
        className={`gallery-header ${featuredSceneImage ? "has-scene-backdrop" : ""} ${hasCuratedResults ? "is-curated" : ""}`}
        style={featuredSceneImage ? { backgroundImage: `linear-gradient(90deg, rgba(24, 21, 18, 0.82), rgba(24, 21, 18, 0.36)), url(${featuredSceneImage})` } : undefined}
      >
        <p className="meta">
          {hasCuratedResults
            ? `为这句观看愿望挑出 ${search.results.length} 件作品`
            : hasQuery
              ? "这句观看愿望还需要换一个角度"
            : `${catalog.artworkCount} 件作品正在等待你的策展意图`}
        </p>
        <p className="sr-only" data-testid="runtime-mode">Runtime: {runtime}</p>
        <h1 className="page-title">导览画廊</h1>
        {hasCuratedResults ? (
          <div className="gallery-header-actions">
            <a className="primary-button gallery-immersive-link" href={immersiveHref}>
              进入这场观展
              <ArrowRight aria-hidden="true" size={18} />
            </a>
            <details className="gallery-query-edit">
              <summary>调整策展意图</summary>
              <form className="query-form query-form-compact" action="/gallery">
                <div className="field">
                  <label htmlFor="query">
                    <Search aria-hidden="true" size={16} /> 策展意图
                  </label>
                  <input id="query" name="query" defaultValue={query} required suppressHydrationWarning />
                </div>
                <button className="secondary-link" type="submit">
                  生成路线 <ArrowRight aria-hidden="true" size={17} />
                </button>
              </form>
            </details>
          </div>
        ) : (
          <form className="query-form" action="/gallery">
            <div className="field">
              <label htmlFor="query">
                <Search aria-hidden="true" size={16} /> 策展意图
              </label>
              <input id="query" name="query" defaultValue={query} required suppressHydrationWarning />
            </div>
            <button className="primary-button" type="submit">
              生成观展路线 <ArrowRight aria-hidden="true" size={18} />
            </button>
          </form>
        )}
      </section>

      <section className="section" aria-label="Search results">
        {!hasQuery ? (
          <div className="empty-state gallery-intent-state">
            <p className="meta">从情绪、光线、房间或观看愿望开始</p>
            <h2>先选择一个策展意图</h2>
            <p className="meta">这里用于修改或重新输入观看愿望。选择一个示例，或输入自己的观看愿望。</p>
            <div className="empty-actions">
              {STARTER_PROMPTS.map((prompt) => (
                <a className="secondary-link" href={`/gallery?query=${encodeURIComponent(prompt.query)}`} key={prompt.query}>
                  {prompt.label}
                </a>
              ))}
            </div>
          </div>
        ) : search.results.length === 0 ? (
          <div className="empty-state">
            <h2>没有找到可展示作品</h2>
            <p className="meta">尝试更具体的情绪、光线、主题或空间描述。</p>
            <div className="empty-actions">
              <a className="secondary-link" href="/gallery">清空输入</a>
              <a className="secondary-link" href={`/gallery?query=${encodeURIComponent(STARTER_PROMPTS[1]?.query ?? DEFAULT_CURATION_PROMPT)}`}>
                使用示例
              </a>
              <a className="secondary-link" href={`/gallery?query=${encodeURIComponent(DEFAULT_CURATION_PROMPT)}`}>
                查看默认展览 <ArrowRight aria-hidden="true" size={17} />
              </a>
            </div>
          </div>
        ) : (
          <div className="curation-experience">
            <section className="gallery-exhibition-hero" aria-label="Curated exhibition opening">
              <div className="gallery-hero-copy">
                <GallerySceneRoute featured={featured} query={query} results={search.results} route={sceneRoute} />
              </div>
            </section>
            {narrative ? (
              <details className="curation-preface curation-note-disclosure" data-testid="curation-preface">
                <summary>读一段序言</summary>
                <p>{narrative.preface}</p>
              </details>
            ) : null}
            {narrative ? (
              <details className="curation-closing curation-note-disclosure" data-testid="curation-closing">
                <summary>停留片刻</summary>
                <p>{narrative.closing}</p>
              </details>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
