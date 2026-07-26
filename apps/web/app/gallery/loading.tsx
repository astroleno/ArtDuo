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
          <span className="brand-meta">正在策展</span>
        </a>
        <nav className="nav" aria-label="Primary">
          <a href="/">首页</a>
          <a href="/gallery">画廊</a>
        </nav>
      </header>

      <section className="gallery-header" aria-busy="true">
        <p className="meta">正在从馆藏中组织观展路线</p>
        <h1 className="page-title">导览画廊</h1>
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
