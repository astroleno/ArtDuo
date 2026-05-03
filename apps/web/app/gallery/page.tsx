import { ArrowRight, Search } from "lucide-react";

import { ArtworkImage } from "../../components/artwork-image";
import { searchGalleryWithRuntime } from "../../lib/browser-curation";
import { loadWebReleaseCatalog } from "../../lib/release-catalog";

interface GalleryPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function readQuery(params: Record<string, string | string[] | undefined> | undefined): string {
  const value = params?.query;
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function readRuntime(params: Record<string, string | string[] | undefined> | undefined): string | undefined {
  const value = params?.runtime;
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function GalleryPage({ searchParams }: GalleryPageProps) {
  const params = await searchParams;
  const query = readQuery(params) || "I want a quiet moonlit room";
  const runtimeMode = readRuntime(params);
  const catalog = loadWebReleaseCatalog();
  const { search, runtime } = searchGalleryWithRuntime({
    catalog,
    query,
    limit: 12,
    runtimeMode,
  });
  const featured = search.results[0];
  const stages = [
    { label: "Opening", items: search.results.slice(1, 4) },
    { label: "Drift", items: search.results.slice(4, 8) },
    { label: "Return", items: search.results.slice(8, 12) },
  ].filter((stage) => stage.items.length > 0);
  const renderResultCard = (result: (typeof search.results)[number], variant: "featured" | "standard" = "standard") => (
    <article className={`result-card ${variant === "featured" ? "result-card-featured" : ""}`} data-testid="result-card" key={result.artwork.id}>
      <ArtworkImage
        alt={`${result.artwork.title} artwork`}
        className="result-image"
        fallbackLabel={result.artwork.title}
        fallbackMeta={[result.artwork.artistDisplayName, result.artwork.yearLabel].filter(Boolean).join(", ") || "Collection image unavailable"}
        loading="eager"
        src={result.artwork.imageUrl}
      />
      <div className="result-body">
        <p className="score-line">
          #{result.rank} combined {result.combinedScore.toFixed(3)}
        </p>
        <div>
          <h2 className="result-title">{result.artwork.title}</h2>
          <p className="meta">
            {[result.artwork.artistDisplayName, result.artwork.yearLabel].filter(Boolean).join(", ")}
          </p>
        </div>
        <div className="tag-row">
          {result.artwork.moodTags.slice(0, 3).map((tag, index) => (
            <span className="tag" key={`${tag}-${index}`}>{tag}</span>
          ))}
          {result.scene ? <span className="tag">{result.scene.label}</span> : null}
        </div>
        <a className="secondary-link" href={result.artwork.detailHref} aria-label={`打开详情：${result.artwork.title}`}>
          打开详情 <ArrowRight aria-hidden="true" size={17} />
        </a>
      </div>
    </article>
  );

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

      <section className="gallery-header">
        <p className="meta">{search.results.length} ranked works from {catalog.artworkCount} release-ready artworks</p>
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
            重新检索 <ArrowRight aria-hidden="true" size={18} />
          </button>
        </form>
      </section>

      <section className="section" aria-label="Search results">
        {search.results.length === 0 ? (
          <div className="empty-state">
            <h2>没有找到可展示作品</h2>
            <p className="meta">尝试更具体的情绪、光线、主题或空间描述。</p>
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
                    {stage.items.map((result) => renderResultCard(result))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
