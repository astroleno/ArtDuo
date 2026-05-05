import { ArrowRight, Search } from "lucide-react";

import { STARTER_PROMPTS } from "../lib/prompts";
import { loadWebReleaseCatalog } from "../lib/release-catalog";

export default function HomePage() {
  const catalog = loadWebReleaseCatalog();
  const heroArtworks = catalog.artworks.slice(0, 3);
  const heroImage = heroArtworks[0]?.imageUrlFull ?? heroArtworks[0]?.imageUrl ?? "";

  return (
    <main className="shell">
      <section className="hero" style={{ backgroundImage: `url(${heroImage})` }}>
        <div className="hero-artwork-veil" aria-hidden="true">
          {heroArtworks.map((artwork) => (
            <img
              alt=""
              className="hero-artwork-slice"
              key={artwork.id}
              src={artwork.imageUrlFull ?? artwork.imageUrl}
            />
          ))}
        </div>
        <div className="hero-content">
          <p className="eyebrow">Release-backed curation thin slice</p>
          <h1>ArtDuo</h1>
          <p className="hero-copy">
            输入一句情绪、场景或观看愿望，ArtDuo 会从当前 release-ready 作品集中生成一个可打开详情的展览入口。
          </p>
          <form className="intent-form" action="/gallery">
            <div className="field">
              <label htmlFor="query">
                <Search aria-hidden="true" size={16} /> 策展意图
              </label>
              <input
                id="query"
                name="query"
                placeholder="例如：I need a calm painting about moonlight"
                required
              />
            </div>
            <button className="primary-button" type="submit">
              生成展览 <ArrowRight aria-hidden="true" size={18} />
            </button>
          </form>
          <div className="prompt-row" aria-label="示例提示">
            {STARTER_PROMPTS.map((prompt) => (
              <a className="prompt-chip" href={`/gallery?query=${encodeURIComponent(prompt)}`} key={prompt}>
                {prompt}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="section" aria-label="Release stats">
        <div className="section-header">
          <div>
            <p className="meta">Release {catalog.releaseVersion}</p>
            <h2>当前可检索作品集</h2>
          </div>
          <a className="secondary-link" href="/gallery">
            浏览 Gallery <ArrowRight aria-hidden="true" size={17} />
          </a>
        </div>
        <div className="stats">
          <div className="stat">
            <strong>{catalog.artworkCount}</strong>
            <span>release-ready artworks</span>
          </div>
          <div className="stat">
            <strong>{catalog.backgroundSceneCount}</strong>
            <span>background scenes</span>
          </div>
          <div className="stat">
            <strong>{catalog.embeddingRecords.length}</strong>
            <span>local embeddings</span>
          </div>
          <div className="stat">
            <strong>{catalog.manifest.shards.search[0]?.recordCount ?? catalog.artworkCount}</strong>
            <span>search records</span>
          </div>
        </div>
      </section>
    </main>
  );
}
