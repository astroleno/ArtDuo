import { ImmersiveGallery, type ImmersiveGalleryUnit, type TransitionFamily } from "@artduo/ui";

import { DEFAULT_CURATION_PROMPT } from "../../../../lib/prompts";
import { loadWebReleaseCatalog, searchReleaseCatalog } from "../../../../lib/release-catalog";

interface ImmersivePageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const TRANSITION_SEQUENCE: TransitionFamily[] = ["fade", "dissolve", "light-swell", "depth-push"];

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
    transitionFamily: TRANSITION_SEQUENCE[index % TRANSITION_SEQUENCE.length],
  }));

  return (
    <ImmersiveGallery
      galleryHref={galleryHref}
      getSceneHref={(unit) => `/gallery/${encodeURIComponent(id)}/immersive?${new URLSearchParams({
        query,
        unit: unit.id,
      }).toString()}`}
      selectedUnitId={selectedUnitId}
      units={units}
    />
  );
}
