import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">ArtDuo</span>
          <span className="brand-meta">Phase 1</span>
        </a>
        <nav className="nav" aria-label="Primary">
          <a href="/">Landing</a>
          <a href="/gallery">Gallery</a>
        </nav>
      </header>
      <section className="section">
        <div className="empty-state">
          <p className="meta">404</p>
          <h1 className="page-title">作品未找到</h1>
          <p className="meta">该作品不在当前 release-ready manifest 中。</p>
          <div className="detail-actions">
            <a className="secondary-link" href="/gallery">
              <ArrowLeft aria-hidden="true" size={17} /> 返回 Gallery
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
