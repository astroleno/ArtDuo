import { ArrowRight, Search } from "lucide-react";

import { ArtworkImage } from "../../components/artwork-image";
import { searchGalleryWithRuntime } from "../../lib/browser-curation";
import { DEFAULT_CURATION_PROMPT, STARTER_PROMPTS } from "../../lib/prompts";
import { loadWebReleaseCatalog, type WebReleaseCatalog, type WebSearchResult } from "../../lib/release-catalog";

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

function readRuntime(params: Record<string, string | string[] | undefined> | undefined): string | undefined {
  const value = params?.runtime;
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

function formatMatchScore(score: number): string {
  return `${Math.max(0, Math.min(100, score * 100)).toFixed(1)}%`;
}

function buildFallbackMeta(result: WebSearchResult["results"][number]): string {
  return [
    `馆藏编号 ${result.artwork.id}`,
    result.artwork.artistDisplayName,
    result.artwork.yearLabel,
  ].filter(Boolean).join(" · ");
}

function getPrimaryTag(result: WebSearchResult["results"][number]): string | undefined {
  return result.scene?.label
    ?? result.artwork.moodTags[0]
    ?? result.artwork.subjectTags[0]
    ?? result.artwork.colorTags[0];
}

function buildDetailHref(result: WebSearchResult["results"][number], query: string): string {
  const params = new URLSearchParams();
  if (query) {
    params.set("query", query);
  }
  if (result.scene?.id) {
    params.set("backgroundSceneId", result.scene.id);
  }
  params.set("retrievalScore", result.combinedScore.toFixed(6));
  for (const token of result.matchedTokens) {
    params.append("matchedTokens", token);
  }

  const suffix = params.toString();
  return `/artwork/${encodeURIComponent(result.artwork.id)}${suffix ? `?${suffix}` : ""}`;
}

export default async function GalleryPage({ searchParams }: GalleryPageProps) {
  const params = await searchParams;
  const query = readQuery(params);
  const hasQuery = query.length > 0;
  const runtimeMode = readRuntime(params);
  const catalog = loadWebReleaseCatalog();
  const immersiveHref = `/gallery/local/immersive?${new URLSearchParams({ query }).toString()}`;
  const { search, runtime } = hasQuery
    ? searchGalleryWithRuntime({
      catalog,
      query,
      limit: 12,
      runtimeMode,
    })
    : { search: buildIdleSearch(catalog, query), runtime: "idle" };
  const featured = search.results[0];
  const featuredSceneImage = featured?.scene?.imageUrl;
  const stages = [
    { label: "Opening", items: search.results.slice(1, 4) },
    { label: "Drift", items: search.results.slice(4, 8) },
    { label: "Return", items: search.results.slice(8, 12) },
  ].filter((stage) => stage.items.length > 0);
  const renderResultCard = (result: (typeof search.results)[number], variant: "featured" | "standard" = "standard") => {
    const detailHref = buildDetailHref(result, query);
    const primaryTag = getPrimaryTag(result);
    const cardImage = (
      <ArtworkImage
        alt={`${result.artwork.title} artwork`}
        className="result-image"
        fallbackLabel={result.artwork.title}
        fallbackMeta={buildFallbackMeta(result)}
        loading={variant === "featured" ? "eager" : "lazy"}
        src={result.artwork.imageUrl}
      />
    );

    if (variant === "standard") {
      return (
        <a
          aria-label={`打开详情：${result.artwork.title}`}
          className="result-card result-card-quiet"
          data-testid="result-card"
          href={detailHref}
          key={result.artwork.id}
        >
          {cardImage}
          <div className="result-body">
            <div>
              <h2 className="result-title">{result.artwork.title}</h2>
              <p className="meta">
                {[result.artwork.artistDisplayName, result.artwork.yearLabel].filter(Boolean).join(", ")}
              </p>
            </div>
            {primaryTag ? <span className="tag tag-single">{primaryTag}</span> : null}
          </div>
        </a>
      );
    }

    return (
      <article className="result-card result-card-featured" data-testid="result-card" key={result.artwork.id}>
        {cardImage}
        <div className="result-body">
          <p className="score-line">
            匹配度 {formatMatchScore(result.combinedScore)}
          </p>
          <div>
            <h2 className="result-title">{result.artwork.title}</h2>
            <p className="meta">
              {[result.artwork.artistDisplayName, result.artwork.yearLabel].filter(Boolean).join(", ")}
            </p>
          </div>
          <div className="tag-row">
            {result.artwork.moodTags.slice(0, 2).map((tag, index) => (
              <span className="tag" key={`${tag}-${index}`}>{tag}</span>
            ))}
            {result.scene ? <span className="tag">{result.scene.label}</span> : null}
          </div>
          <a className="secondary-link" href={detailHref} aria-label={`打开详情：${result.artwork.title}`}>
            打开详情 <ArrowRight aria-hidden="true" size={17} />
          </a>
        </div>
      </article>
    );
  };

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">ArtDuo</span>
          <span className="brand-meta">Release {catalog.releaseVersion}</span>
        </a>
        <nav className="nav" aria-label="Primary">
          <a href="/">Landing</a>
          <a href="/gallery">Gallery</a>
        </nav>
      </header>

      <section
        className={`gallery-header ${featuredSceneImage ? "has-scene-backdrop" : ""}`}
        style={featuredSceneImage ? { backgroundImage: `linear-gradient(90deg, rgba(24, 21, 18, 0.82), rgba(24, 21, 18, 0.36)), url(${featuredSceneImage})` } : undefined}
      >
        <p className="meta">
          {hasQuery
            ? `${search.results.length} ranked works from ${catalog.artworkCount} release-ready artworks`
            : `${catalog.artworkCount} release-ready artworks waiting for an intent`}
        </p>
        <p className="sr-only" data-testid="runtime-mode">Runtime: {runtime}</p>
        <h1 className="page-title">Gallery</h1>
        <form className="query-form" action="/gallery">
          <div className="field">
            <label htmlFor="query">
              <Search aria-hidden="true" size={16} /> 策展意图
            </label>
            <input id="query" name="query" defaultValue={query} required />
          </div>
          <button className="primary-button" type="submit">
            {hasQuery ? "重新检索" : "开始策展"} <ArrowRight aria-hidden="true" size={18} />
          </button>
        </form>
        {hasQuery && search.results.length > 0 ? (
          <a className="secondary-link gallery-immersive-link" href={immersiveHref}>
            沉浸观展 <ArrowRight aria-hidden="true" size={17} />
          </a>
        ) : null}
      </section>

      <section className="section" aria-label="Search results">
        {!hasQuery ? (
          <div className="empty-state gallery-intent-state">
            <p className="meta">Start with a mood, light, room, or viewing wish</p>
            <h2>先选择一个策展意图</h2>
            <p className="meta">Gallery 不再替你自动检索默认展览。选择一个示例，或输入自己的观看愿望。</p>
            <div className="empty-actions">
              {STARTER_PROMPTS.map((prompt) => (
                <a className="secondary-link" href={`/gallery?query=${encodeURIComponent(prompt)}`} key={prompt}>
                  {prompt}
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
              <a className="secondary-link" href={`/gallery?query=${encodeURIComponent(STARTER_PROMPTS[1] ?? DEFAULT_CURATION_PROMPT)}`}>
                使用示例
              </a>
              <a className="secondary-link" href={`/gallery?query=${encodeURIComponent(DEFAULT_CURATION_PROMPT)}`}>
                查看默认展览 <ArrowRight aria-hidden="true" size={17} />
              </a>
            </div>
          </div>
        ) : (
          <div className="curation-wall">
            {featured ? (
              <div className="featured-work">
                <p className="meta">Primary work</p>
                {renderResultCard(featured, "featured")}
              </div>
            ) : null}
            <div className="curation-arc" aria-hidden="true">
              {stages.map((stage) => (
                <span key={stage.label} />
              ))}
            </div>
            <div className="stage-wall">
              {stages.map((stage) => (
                <section className="stage-group" key={stage.label} aria-label={`${stage.label} works`}>
                  <h2>{stage.label}</h2>
                  <div className="stage-grid">
                    {stage.items.slice(0, 2).map((result) => renderResultCard(result))}
                  </div>
                  {stage.items.length > 2 ? (
                    <details className="stage-more">
                      <summary>查看更多候选（{stage.items.length - 2}）</summary>
                      <div className="stage-grid stage-grid-extra">
                        {stage.items.slice(2).map((result) => renderResultCard(result))}
                      </div>
                    </details>
                  ) : null}
                </section>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
