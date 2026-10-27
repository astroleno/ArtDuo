import { appPath } from "@artduo/contracts";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";

import { ArtworkImage } from "../../../components/artwork-image";
import { ArtworkExplanationPanel } from "../../../components/artwork-explanation-panel";
import { artworkImageUrl } from "../../../lib/artwork-image-url";
import { getArtworkDetail, loadWebReleaseCatalog } from "../../../lib/release-catalog";
import { sanitizeReturnTo } from "../../../lib/experience-navigation";
import { readSavedCuration } from "../../../lib/semantic-curator";
import { readNarrativePieces } from "../../../lib/exhibition-narrative-server";
import { buildArtworkReadingCopy } from "../../../lib/artwork-page-copy";

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
  const experienceView = returnView === "experience";
  const curationId = new URL(returnTo, "https://artduo.invalid").searchParams.get("curationId");
  let curatorNote: string | undefined;
  if (returnView === "experience" && curationId) {
    try {
      const curation = readSavedCuration(catalog, curationId, query?.normalize("NFKC").trim());
      curatorNote = readNarrativePieces(catalog, curation)?.find((piece) => piece.kind === "note" && piece.artworkId === artwork.id)?.text;
    } catch { /* Existing artwork facts remain readable when a saved exhibition is unavailable. */ }
  }
  const immersiveParams = returnView === "experience"
    ? new URLSearchParams({ query: query ?? artwork.title, releaseVersion: catalog.releaseVersion, view: "experience", recipeVersion: "experience-v1", phase: "walk", artworkId: artwork.id })
    : new URLSearchParams({ query: query ?? artwork.title, releaseVersion: catalog.releaseVersion, view: "classic", unit: artwork.id });
  const immersiveHref = returnView === "experience" ? returnTo : `/gallery/local/immersive?${immersiveParams.toString()}`;
  const stageImage = scene?.imageUrl ?? artworkImageUrl(artwork.id, "preview", catalog.releaseVersion);
  const artistName = artwork.displayCredits ? artwork.displayCredits.artistDisplayName ?? "作者尚待核实" : artwork.artistDisplayName;
  const fallbackMeta = [
    artistName,
    artwork.yearLabel,
  ].filter(Boolean).join(" · ");
  const readingCopy = buildArtworkReadingCopy({ curatorNote, storySnippet: artwork.storySnippet, description: artwork.description });

  return (
    <main className={`shell${experienceView ? " experience-artwork-page" : ""}`}>
      <header className="topbar">
        <a className="brand" href={appPath(experienceView ? "/?view=experience" : "/")}>
          <span className="brand-mark">ArtDuo</span>
          <span className="brand-meta">作品资料</span>
        </a>
        <nav className="nav" aria-label={experienceView ? "观展导航" : "Primary"}>
          {experienceView ? <a className="detail-return-link" href={appPath(returnTo)}>
            <ArrowLeft aria-hidden="true" size={17} /> 返回刚才的位置
          </a> : <><a href={appPath("/")}>首页</a><a href={appPath(returnTo)}>画廊</a></>}
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
              fetchPriority="high"
              src={artworkImageUrl(artwork.id, "preview", catalog.releaseVersion)}
            />
            <figcaption className="artwork-caption">
              <strong>{artwork.title}</strong>
              <span>{[artistName, artwork.yearLabel].filter(Boolean).join(", ")}</span>
            </figcaption>
          </figure>
          <div className="detail-copy">
            {!experienceView ? <p className="eyebrow">作品</p> : null}
            <h1>{artwork.title}</h1>
            <p className="detail-byline">{[artistName, artwork.yearLabel, artwork.medium].filter(Boolean).join(" · ")}</p>
            {readingCopy.primary ? <p className="detail-primary-note">{readingCopy.primary}</p> : null}
            <div className="detail-actions">
              <a className={`secondary-link${experienceView ? " detail-return-action" : ""}`} href={appPath(returnTo)}>
                <ArrowLeft aria-hidden="true" size={17} /> 返回刚才的位置
              </a>
              {!experienceView ? <>
              <a className="secondary-link" href={appPath("/gallery?view=route")}>画廊路线</a>
              <a className="secondary-link" href={appPath(immersiveHref)}>
                沉浸观展 <ExternalLink aria-hidden="true" size={17} />
              </a>
              {artwork.objectUrl ? (
                <a className="secondary-link" href={artwork.objectUrl} target="_blank" rel="noreferrer">
                  来源页面 <ExternalLink aria-hidden="true" size={17} />
                </a>
              ) : null}
              </> : null}
            </div>
            {experienceView ? <div className="detail-context-links">
              <a href={appPath("/gallery?view=route")}>其他画廊路线</a>
              {artwork.objectUrl ? <a href={artwork.objectUrl} target="_blank" rel="noreferrer">
                馆藏来源 <ExternalLink aria-hidden="true" size={15} />
              </a> : null}
            </div> : null}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="detail-grid">
          <div>
            <div className="section-header">
              <div>
                <h2>作品资料</h2>
              </div>
            </div>
            {readingCopy.description ? <details className="detail-source-description"><summary>馆藏说明</summary><p>{readingCopy.description}</p></details> : null}
            <ArtworkExplanationPanel
              artworkId={artwork.id}
              backgroundSceneId={scene?.id}
              matchedTokens={matchedTokens}
              query={query ?? artwork.title}
              releaseVersion={catalog.releaseVersion}
              retrievalScore={retrievalScore}
              curatorNote={curatorNote}
            />
          </div>
          <dl className="facts">
            <div className="fact">
              <dt>馆方尺寸</dt>
              <dd style={{ whiteSpace: "pre-line" }}>{artwork.dimensionsLabel ?? "尺寸尚待核实"}</dd>
            </div>
            <div className="fact">
              <dt>展示方式</dt>
              <dd>按屏幕适配，完整显示图像；展厅中的大小不代表原作实际尺寸。</dd>
            </div>
            <div className="fact">
              <dt>作者</dt>
              <dd>{artistName ?? "作者资料尚待核实"}</dd>
            </div>
            {artwork.displayCredits?.publishers.length ? <div className="fact"><dt>出版</dt><dd>{artwork.displayCredits.publishers.join("; ")}</dd></div> : null}
            <div className="fact">
              <dt>时期</dt>
              <dd>{artwork.yearLabel ?? "年代尚待核实"}</dd>
            </div>
            <div className="fact">
              <dt>馆藏部门</dt>
              <dd>{artwork.department ?? "部门资料尚待核实"}</dd>
            </div>
            <div className="fact">
              <dt>媒材</dt>
              <dd>{artwork.medium ?? "媒材尚待核实"}</dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  );
}
