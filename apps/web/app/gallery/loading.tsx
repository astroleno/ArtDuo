import { Search } from "lucide-react";

const CURATION_STEPS = [
  "分析情绪",
  "生成曲线",
  "选择作品",
  "写序言",
];

export default function GalleryLoading() {
  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">ArtDuo</span>
          <span className="brand-meta">Preparing gallery</span>
        </a>
        <nav className="nav" aria-label="Primary">
          <a href="/">Landing</a>
          <a href="/gallery">Gallery</a>
        </nav>
      </header>

      <section className="gallery-header" aria-busy="true">
        <p className="meta">Curating from the release corpus</p>
        <h1 className="page-title">Gallery</h1>
        <div className="query-form" role="status" aria-label="Gallery loading">
          <div className="field">
            <label>
              <Search aria-hidden="true" size={16} /> 策展意图
            </label>
            <div className="loading-input" />
          </div>
          <div className="loading-button" />
        </div>
      </section>

      <section className="section" aria-label="Curation progress">
        <div className="curation-loading">
          <ol className="curation-timeline">
            {CURATION_STEPS.map((step, index) => (
              <li key={step} style={{ animationDelay: `${index * 160}ms` }}>
                <span />
                {step}
              </li>
            ))}
          </ol>
          <div className="loading-wall" aria-hidden="true">
            <div className="loading-featured" />
            <div className="loading-minis">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
