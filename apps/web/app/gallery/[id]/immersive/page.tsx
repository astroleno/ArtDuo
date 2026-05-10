import { ImmersiveGallery, type ImmersiveGalleryUnit, type TransitionFamily } from "@artduo/ui";

import { buildCurationNarrative } from "../../../../lib/curation-narrative";
import { DEFAULT_CURATION_PROMPT } from "../../../../lib/prompts";
import { loadWebReleaseCatalog, searchReleaseCatalog } from "../../../../lib/release-catalog";

interface ImmersivePageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const TRANSITION_SEQUENCE: TransitionFamily[] = ["fade", "dissolve", "light-swell", "depth-push"];
const STAGE_BY_INDEX = ["Opening", "Opening", "Opening", "Opening", "Drift", "Drift", "Drift", "Drift", "Return", "Return", "Return", "Return"] as const;

function readSingle(params: Record<string, string | string[] | undefined> | undefined, key: string): string | undefined {
  const value = params?.[key];
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function ImmersivePage({ params, searchParams }: ImmersivePageProps) {
  const [{ id }, queryParams] = await Promise.all([params, searchParams]);
  const query = readSingle(queryParams, "query") || DEFAULT_CURATION_PROMPT;
  const selectedUnitId = readSingle(queryParams, "unit");
  const catalog = loadWebReleaseCatalog();
  const search = searchReleaseCatalog(catalog, query, { limit: 12 });
  const narrative = buildCurationNarrative(search);
  const galleryHref = `/gallery?${new URLSearchParams({ query }).toString()}`;

  const units: ImmersiveGalleryUnit[] = search.results.map((result, index) => ({
    id: result.artwork.id,
    title: result.artwork.title,
    artistDisplayName: result.artwork.artistDisplayName,
    yearLabel: result.artwork.yearLabel,
    imageUrl: result.artwork.imageUrl,
    imageUrlFull: result.artwork.imageUrlFull,
    backgroundSceneUrl: result.scene?.imageUrl,
    sceneLabel: result.scene?.label ?? id,
    stageLabel: STAGE_BY_INDEX[index] ?? "Scene",
    stageTone: result.artwork.moodTags[0] ?? result.matchedTokens[0],
    emotionalIntensity: result.combinedScore,
    curatorNote: `This scene holds ${result.artwork.title} against ${result.scene?.label ?? "the gallery room"}, keeping the visit close to ${result.matchedTokens.slice(0, 3).join(", ") || "your original sentence"}.`,
    transitionFamily: TRANSITION_SEQUENCE[index % TRANSITION_SEQUENCE.length],
  }));

  return (
    <ImmersiveGallery
      galleryHref={galleryHref}
      preface={narrative.preface}
      closing={narrative.closing}
      getSceneHref={(unit) => `/gallery/${encodeURIComponent(id)}/immersive?${new URLSearchParams({
        query,
        unit: unit.id,
      }).toString()}`}
      selectedUnitId={selectedUnitId}
      units={units}
    />
  );
}
