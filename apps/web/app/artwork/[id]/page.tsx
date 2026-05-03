import { ArrowLeft, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";

import { ArtworkImage } from "../../../components/artwork-image";
import { getArtworkExplanationClient } from "../../../lib/explanation-client";
import { getArtworkDetail, loadWebReleaseCatalog } from "../../../lib/release-catalog";

interface ArtworkPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function readQuery(params: Record<string, string | string[] | undefined> | undefined): string | undefined {
  const value = params?.query;
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function generateStaticParams() {
  const catalog = loadWebReleaseCatalog();
  return catalog.artworks.map((artwork) => ({ id: artwork.id }));
}

export default async function ArtworkPage({ params, searchParams }: ArtworkPageProps) {
  const [{ id }, queryParams] = await Promise.all([params, searchParams]);
  const query = readQuery(queryParams);
  const catalog = loadWebReleaseCatalog();
  const detail = getArtworkDetail(catalog, id, query);

  if (!detail) {
    notFound();
  }

  const { artwork, scene } = detail;
  const explanation = await getArtworkExplanationClient({
    artworkId: artwork.id,
    releaseVersion: catalog.releaseVersion,
    contextText: query ?? artwork.searchText,
  });
  const galleryHref = query ? `/gallery?${new URLSearchParams({ query }).toString()}` : "/gallery";
  const stageImage = artwork.imageUrlFull ?? artwork.imageUrl;

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">ArtDuo</span>
          <span className="brand-meta">Release {catalog.releaseVersion}</span>
        </a>
        <nav className="nav" aria-label="Primary">
          <a href="/">Landing</a>
          <a href={galleryHref}>Gallery</a>
        </nav>
      </header>

      <section className="detail-stage" style={{ backgroundImage: `url(${stageImage})` }}>
        <div className="detail-stage-inner">
          <figure className="detail-image">
            <ArtworkImage
              alt={`${artwork.title} artwork`}
              className="detail-artwork-image"
              fallbackLabel={artwork.title}
              fallbackMeta={[artwork.artistDisplayName, artwork.yearLabel].filter(Boolean).join(", ") || "Collection image unavailable"}
              loading="eager"
              src={artwork.imageUrlFull ?? artwork.imageUrl}
            />
            <figcaption className="artwork-caption">
              <strong>{artwork.title}</strong>
              <span>{[artwork.artistDisplayName, artwork.yearLabel].filter(Boolean).join(", ")}</span>
            </figcaption>
          </figure>
          <div className="detail-copy">
            <p className="eyebrow">Release {catalog.releaseVersion}</p>
            <h1>{artwork.title}</h1>
            <p>{[artwork.artistDisplayName, artwork.yearLabel, artwork.medium].filter(Boolean).join(" · ")}</p>
            <p>{artwork.storySnippet ?? "Release-ready artwork selected by local retrieval."}</p>
            <div className="detail-actions">
              <a className="secondary-link" href={galleryHref}>
                <ArrowLeft aria-hidden="true" size={17} /> 返回 Gallery
              </a>
              {artwork.objectUrl ? (
                <a className="secondary-link" href={artwork.objectUrl} target="_blank" rel="noreferrer">
                  来源页面 <ExternalLink aria-hidden="true" size={17} />
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="detail-grid">
          <div>
            <div className="section-header">
              <div>
                <p className="meta">Selected scene: {scene?.label ?? "Default gallery scene"}</p>
                <h2>Detail</h2>
              </div>
            </div>
            <p>{artwork.description ?? artwork.searchText}</p>
            <p className="meta" data-testid="explanation-slot" style={{ marginTop: 16 }}>
              {explanation.status === "ready"
                ? explanation.content?.shortText
                : explanation.status === "pending"
                  ? "Explanation pending"
                  : "Explanation unavailable"}
            </p>
            <div className="tag-row" style={{ marginTop: 18 }}>
              {[...artwork.moodTags, ...artwork.subjectTags.slice(0, 4)].map((tag, index) => (
                <span className="tag" key={`${tag}-${index}`}>{tag}</span>
              ))}
            </div>
          </div>
          <dl className="facts">
            <div className="fact">
              <dt>Grade</dt>
              <dd>{artwork.grade} · {artwork.gradeLabel}</dd>
            </div>
            <div className="fact">
              <dt>Motion</dt>
              <dd>{artwork.motionProfile}</dd>
            </div>
            <div className="fact">
              <dt>Department</dt>
              <dd>{artwork.department ?? "Unknown"}</dd>
            </div>
            <div className="fact">
              <dt>Scene affinity</dt>
              <dd>{artwork.sceneAffinity.sceneTypes.concat(artwork.sceneAffinity.paletteModes).join(", ") || "Default"}</dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  );
}
