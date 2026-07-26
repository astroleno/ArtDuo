import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">ArtDuo</span>
          <span className="brand-meta">馆藏入口</span>
        </a>
        <nav className="nav" aria-label="Primary">
          <a href="/">首页</a>
          <a href="/gallery">画廊</a>
        </nav>
      </header>
      <section className="section">
        <div className="empty-state">
          <p className="meta">404</p>
          <h1 className="page-title">作品未找到</h1>
          <p className="meta">当前馆藏入口里还没有这件作品。</p>
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
