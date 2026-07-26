import { ArrowRight, Search } from "lucide-react";

import { artworkImageUrl } from "../lib/artwork-image-url";
import { STARTER_PROMPTS } from "../lib/prompts";
import { loadWebReleaseCatalog } from "../lib/release-catalog";

export default function HomePage() {
  const catalog = loadWebReleaseCatalog();
  const heroArtworks = catalog.artworks.slice(0, 3);
  const heroImage = heroArtworks[0] ? artworkImageUrl(heroArtworks[0].id) : "";

  return (
    <main className="shell">
      <section className="hero" style={{ backgroundImage: `url(${heroImage})` }}>
        <div className="hero-artwork-veil" aria-hidden="true">
          {heroArtworks.map((artwork) => (
            <img
              alt=""
              className="hero-artwork-slice"
              key={artwork.id}
              src={artworkImageUrl(artwork.id)}
            />
          ))}
        </div>
        <div className="hero-content">
          <p className="eyebrow">情绪策展入口</p>
          <h1>ArtDuo</h1>
          <p className="hero-copy">
            输入一句情绪、场景或观看愿望，ArtDuo 会从当前馆藏中展开一场安静的观展。
          </p>
          <form className="intent-form" action="/gallery/local/immersive">
            <div className="field">
              <label htmlFor="query">
                <Search aria-hidden="true" size={16} /> 策展意图
              </label>
              <input
                id="query"
                name="query"
                placeholder="例如：我想看一幅安静的月光"
                required
                suppressHydrationWarning
              />
            </div>
            <button className="primary-button" type="submit">
              生成观展路线 <ArrowRight aria-hidden="true" size={18} />
            </button>
          </form>
          <div className="prompt-row" aria-label="示例提示">
            {STARTER_PROMPTS.map((prompt) => (
              <a className="prompt-chip" href={`/gallery/local/immersive?query=${encodeURIComponent(prompt.query)}`} key={prompt.query}>
                {prompt.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="section home-afterword" aria-label="Viewing note">
        <div className="section-header">
          <div>
            <p className="meta">观展从一句话开始</p>
            <h2>写下你想停留的光、情绪或房间。</h2>
          </div>
          <a className="secondary-link" href="/gallery">
            换一句愿望 <ArrowRight aria-hidden="true" size={17} />
          </a>
        </div>
      </section>
    </main>
  );
}
