import { ArrowLeft, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";

import { ArtworkImage } from "../../../components/artwork-image";
import { ArtworkExplanationPanel } from "../../../components/artwork-explanation-panel";
import { artworkImageUrl } from "../../../lib/artwork-image-url";
import { getArtworkDetail, loadWebReleaseCatalog } from "../../../lib/release-catalog";
import { sanitizeReturnTo } from "../../../lib/experience-navigation";

interface ArtworkPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export const dynamic = "force-dynamic";

function readParam(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string | undefined {
  const value = params?.[key];
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function readQuery(params: Record<string, string | string[] | undefined> | undefined): string | undefined {
  return readParam(params, "query");
}

function readNumberParam(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string,
): number | undefined {
  const value = readParam(params, key);
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readRepeatedParam(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string[] {
  const value = params?.[key];
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.flatMap((entry) => entry.split(",")).map((entry) => entry.trim()).filter(Boolean);
}

export default async function ArtworkPage({ params, searchParams }: ArtworkPageProps) {
  const [{ id }, queryParams] = await Promise.all([params, searchParams]);
  const query = readQuery(queryParams);
  const backgroundSceneId = readParam(queryParams, "backgroundSceneId");
  const retrievalScore = readNumberParam(queryParams, "retrievalScore");
  const matchedTokens = readRepeatedParam(queryParams, "matchedTokens");
  const requestedVersion = readParam(queryParams, "releaseVersion");
  let catalog;
  try {
    catalog = loadWebReleaseCatalog({ releaseVersion: requestedVersion });
  } catch {
    notFound();
  }
  const detail = getArtworkDetail(catalog, id, query);

  if (!detail) {
    notFound();
  }

  const { artwork } = detail;
  const requestedScene = backgroundSceneId
    ? catalog.backgroundScenes.find((candidate) => candidate.id === backgroundSceneId)
    : undefined;
  const scene = requestedScene ?? detail.scene;
  const defaultReturn = query
    ? `/gallery?${new URLSearchParams({ query, view: "route", releaseVersion: catalog.releaseVersion }).toString()}`
    : "/gallery?view=route";
  const returnTo = sanitizeReturnTo(readParam(queryParams, "returnTo"), defaultReturn);
  const returnView = new URL(returnTo, "https://artduo.invalid").searchParams.get("view");
  const immersiveParams = returnView === "experience"
    ? new URLSearchParams({ query: query ?? artwork.searchText, releaseVersion: catalog.releaseVersion, view: "experience", recipeVersion: "experience-v1", phase: "walk", artworkId: artwork.id })
    : new URLSearchParams({ query: query ?? artwork.searchText, releaseVersion: catalog.releaseVersion, view: "classic", unit: artwork.id });
  const immersiveHref = `/gallery/local/immersive?${immersiveParams.toString()}`;
  const stageImage = scene?.imageUrl ?? artworkImageUrl(artwork.id, "preview", catalog.releaseVersion);
  const fallbackMeta = [
    `馆藏编号 ${artwork.id}`,
    artwork.artistDisplayName,
    artwork.yearLabel,
  ].filter(Boolean).join(" · ");

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">ArtDuo</span>
          <span className="brand-meta">馆藏 {catalog.releaseVersion}</span>
        </a>
        <nav className="nav" aria-label="Primary">
          <a href="/">首页</a>
          <a href={returnTo}>画廊</a>
        </nav>
      </header>

      <section className="detail-stage" style={{ backgroundImage: `url(${stageImage})` }}>
        <div className="detail-stage-inner">
          <figure className="detail-image">
            <ArtworkImage
              alt={`${artwork.title} artwork`}
              className="detail-artwork-image"
              fallbackLabel={artwork.title}
              fallbackMeta={fallbackMeta}
              loading="eager"
              src={artworkImageUrl(artwork.id, "preview", catalog.releaseVersion)}
            />
            <figcaption className="artwork-caption">
              <strong>{artwork.title}</strong>
              <span>{[artwork.artistDisplayName, artwork.yearLabel].filter(Boolean).join(", ")}</span>
            </figcaption>
          </figure>
          <div className="detail-copy">
            <p className="eyebrow">馆藏 {catalog.releaseVersion}</p>
            <h1>{artwork.title}</h1>
            <p>{[artwork.artistDisplayName, artwork.yearLabel, artwork.medium].filter(Boolean).join(" · ")}</p>
            <p>{artwork.storySnippet ?? "这件作品适合作为本次观展路线中的一个停留点。"}</p>
            <div className="detail-actions">
              <a className="secondary-link" href={returnTo}>
                <ArrowLeft aria-hidden="true" size={17} /> 返回刚才的位置
              </a>
              <a className="secondary-link" href="/gallery?view=route">画廊路线</a>
              <a className="secondary-link" href={immersiveHref}>
                沉浸观展 <ExternalLink aria-hidden="true" size={17} />
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
            <ArtworkExplanationPanel
              artworkId={artwork.id}
              backgroundSceneId={scene?.id}
              matchedTokens={matchedTokens}
              query={query ?? artwork.searchText}
              releaseVersion={catalog.releaseVersion}
              retrievalScore={retrievalScore}
            />
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
