import type { ExhibitionSnapshot, ExperienceUnit } from "./types";

export function resolveClosingNarrative(base: ExhibitionSnapshot, lastUnit: ExperienceUnit | undefined): {
  block: ExhibitionSnapshot["closing"];
  pending: boolean;
} {
  if (base.units.at(-1)?.artwork.id === lastUnit?.artwork.id) {
    return { block: base.closing, pending: Boolean(base.narrativePending) };
  }
  const observation = lastUnit?.closingObservation;
  if (observation?.text.trim()) return { block: observation, pending: false };
  const title = lastUnit?.artwork.metadata.title.trim();
  return { block: { text: title ? `这次看到《${title}》。` : "这次观展到这里。", source: "fallback" }, pending: false };
}
