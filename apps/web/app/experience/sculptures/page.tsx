import type { Metadata } from "next";
import { SculpturePreviewClient } from "../../../components/sculpture-preview-client";
import { getSculptureCollection } from "../../../lib/sculpture-catalog";

export const metadata: Metadata = {
  title: "雕塑试展 · ArtDuo",
  description: "在 ArtDuo 的光线与空间中，换个角度观看雕塑。",
  robots: { index: false, follow: false },
};

export default async function SculpturePreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const { works: SCULPTURE_PREVIEW_WORKS, scenes: SCULPTURE_PREVIEW_SCENES } = getSculptureCollection();
  const model = SCULPTURE_PREVIEW_WORKS.find(work => work.id === query.model)?.id ?? SCULPTURE_PREVIEW_WORKS[0].id;
  const scene = SCULPTURE_PREVIEW_SCENES.find(room => room.id === query.room)?.id ?? SCULPTURE_PREVIEW_SCENES[0].id;
  return <SculpturePreviewClient works={SCULPTURE_PREVIEW_WORKS} scenes={SCULPTURE_PREVIEW_SCENES} initialModel={model} initialScene={scene} initialQuality={query.quality === "reference" ? "reference" : "compact"} />;
}
