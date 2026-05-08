import { ArrowLeft, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";

import { ArtworkImage } from "../../../components/artwork-image";
import { getArtworkExplanationClient } from "../../../lib/explanation-client";
import { getArtworkDetail, loadWebReleaseCatalog } from "../../../lib/release-catalog";

interface ArtworkPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

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

function formatEvidenceScore(score: number): string {
  return `${Math.max(0, Math.min(100, score * 100)).toFixed(1)}%`;
}

function formatEvidenceTokens(tokens: string[]): string {
  return tokens.length > 0 ? tokens.slice(0, 6).join(", ") : "No lexical token match";
}

function buildRecommendationReason(explanation: Awaited<ReturnType<typeof getArtworkExplanationClient>>): string {
  if (explanation.status !== "ready" || !explanation.content?.evidence) {
    return "解释会在不阻塞作品阅读的前提下补全。";
  }

  const grounding = explanation.content.evidence.grounding;
  const sceneLabel = grounding.scene?.label ?? "当前展厅";
  const tokens = grounding.matchedTokens.slice(0, 3);
  const tokenText = tokens.length > 0 ? `，尤其靠近「${tokens.join(" / ")}」这些线索` : "";

  return `这件作品被选中，是因为它和你的观看意图在情绪、主题与画面气质上相互靠近${tokenText}，并适合放入「${sceneLabel}」的观展氛围。`;
}

function renderExplanationStatus(explanation: Awaited<ReturnType<typeof getArtworkExplanationClient>>): string {
  if (explanation.status === "ready") {
    return explanation.content?.shortText ?? "Explanation ready";
  }
  if (explanation.status === "pending") {
    return "Explanation pending";
  }

  return "Explanation unavailable";
}

export function generateStaticParams() {
  const catalog = loadWebReleaseCatalog();
  return catalog.artworks.map((artwork) => ({ id: artwork.id }));
}

export default async function ArtworkPage({ params, searchParams }: ArtworkPageProps) {
  const [{ id }, queryParams] = await Promise.all([params, searchParams]);
  const query = readQuery(queryParams);
  const backgroundSceneId = readParam(queryParams, "backgroundSceneId");
  const retrievalScore = readNumberParam(queryParams, "retrievalScore");
  const matchedTokens = readRepeatedParam(queryParams, "matchedTokens");
  const catalog = loadWebReleaseCatalog();
  const detail = getArtworkDetail(catalog, id, query);

  if (!detail) {
    notFound();
  }

  const { artwork } = detail;
  const requestedScene = backgroundSceneId
    ? catalog.backgroundScenes.find((candidate) => candidate.id === backgroundSceneId)
    : undefined;
  const scene = requestedScene ?? detail.scene;
  const explanation = await getArtworkExplanationClient({
    artworkId: artwork.id,
    releaseVersion: catalog.releaseVersion,
    contextText: query ?? artwork.searchText,
    backgroundSceneId: scene?.id,
    retrievalScore,
    matchedTokens,
  });
  const galleryHref = query ? `/gallery?${new URLSearchParams({ query }).toString()}` : "/gallery";
  const immersiveHref = `/gallery/local/immersive?${new URLSearchParams({
    query: query ?? artwork.searchText,
    unit: artwork.id,
  }).toString()}`;
  const stageImage = scene?.imageUrl ?? artwork.imageUrlFull ?? artwork.imageUrl;
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
              fallbackMeta={fallbackMeta}
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
            <div className="explanation-card" data-testid="explanation-slot" style={{ marginTop: 16 }}>
              <p className="meta">{renderExplanationStatus(explanation)}</p>
              {explanation.status === "ready" && explanation.content?.evidence ? (
                <>
                  <div className="recommendation-reason">
                    <p className="evidence-label">为什么推荐这件作品</p>
                    <p>{buildRecommendationReason(explanation)}</p>
                  </div>
                  <details className="explanation-evidence" data-testid="explanation-evidence">
                    <summary>检索依据</summary>
                    <div className="evidence-summary">
                      <span>展厅：{explanation.content.evidence.grounding.scene?.label ?? "作品自身"}</span>
                      <span>匹配度：{formatEvidenceScore(explanation.content.evidence.grounding.retrievalScore)}</span>
                      <span>线索：{formatEvidenceTokens(explanation.content.evidence.grounding.matchedTokens)}</span>
                    </div>
                    <ul className="citation-list" aria-label="Explanation citations">
                      {explanation.content.evidence.citations.map((citation) => (
                        <li key={`${citation.kind}-${citation.sourceId}`}>
                          <span>{citation.kind}</span>
                          {citation.url ? (
                            <a href={citation.url} target="_blank" rel="noreferrer">{citation.label}</a>
                          ) : (
                            <strong>{citation.label}</strong>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                </>
              ) : null}
            </div>
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
