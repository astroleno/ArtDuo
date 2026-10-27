"use client";

import { ImmersiveGallery, type ImmersiveGalleryUnit } from "@artduo/ui";
import { useCurationNarrative } from "./use-curation-narrative";

export function CuratedClassicGallery(props: {
  units: ImmersiveGalleryUnit[]; selectedUnitId?: string; galleryHref: string; preface: string; closing: string;
  curationId: string; releaseVersion: string; query: string; narrativeComplete: boolean;
}) {
  const { pieces } = useCurationNarrative({ curationId: props.curationId, releaseVersion: props.releaseVersion,
    artworkIds: props.units.map((unit) => unit.id), complete: props.narrativeComplete });
  const units = props.units.map((unit) => ({ ...unit, curatorNote: pieces.find((piece) => piece.kind === "note" && piece.artworkId === unit.id)?.text ?? unit.curatorNote }));
  return <ImmersiveGallery units={units} selectedUnitId={props.selectedUnitId} galleryHref={props.galleryHref}
    preface={pieces.find((piece) => piece.kind === "preface")?.text ?? props.preface}
    closing={pieces.find((piece) => piece.kind === "closing")?.text ?? props.closing}
    getSceneHref={(unit) => `/gallery/local/immersive?${new URLSearchParams({ query: props.query, releaseVersion: props.releaseVersion,
      curationId: props.curationId, recipeVersion: "experience-v2", view: "classic", unit: unit.id })}`} />;
}
