/** Pixel observations are separate from museum metadata and never imply unseen detail. */
export const VISUAL_SUBJECTS = ["sea", "forest", "mountain", "water", "waterfall", "moon", "flowers", "stillLife", "architecture", "portrait", "people", "interior", "war", "death", "boats", "religion", "outdoors"] as const;
export type VisualSubject = typeof VISUAL_SUBJECTS[number];
export type VisualState = "present" | "absent" | "unknown";
export type VisualFacts = Partial<Record<VisualSubject, VisualState>>;
export const SPATIAL_FRAMINGS = ["open", "framed", "enclosed", "not-applicable", "unknown"] as const;
export type SpatialFraming = typeof SPATIAL_FRAMINGS[number];

export type ArtworkMedium = "oil" | "watercolor" | "print" | "drawing" | "pastel" | "ink" | "tempera" | "fresco" | "gouache";
export const ARTWORK_MEDIUM_LABELS: Record<ArtworkMedium, string> = {
  oil: "油画", watercolor: "水彩", print: "版画", drawing: "素描", pastel: "粉彩", ink: "水墨", tempera: "蛋彩", fresco: "壁画", gouache: "水粉",
};
/** Classifies only the supplied medium field; a watercolor is not a waterscape. */
export function artworkMediumKinds(medium: string | undefined): ArtworkMedium[] {
  if (!medium?.trim()) return [];
  const kinds: ArtworkMedium[] = [];
  if (/\boil\b|油画|油彩/iu.test(medium)) kinds.push("oil");
  if (/watercolou?r|aquarelle|水彩/iu.test(medium)) kinds.push("watercolor");
  if (/etching|engrav(?:ing|ed)|mezzotint|woodblock|woodcut|lithograph|drypoint|aquatint|版画|蚀刻|木版|铜版|石版/iu.test(medium)) kinds.push("print");
  if (/pastel|粉彩|色粉/iu.test(medium)) kinds.push("pastel");
  if (/gouache|水粉/iu.test(medium)) kinds.push("gouache");
  if (/tempera|蛋彩/iu.test(medium)) kinds.push("tempera");
  if (/fresco|湿壁画|壁画/iu.test(medium)) kinds.push("fresco");
  if (!kinds.includes("print") && /\bink\b|水墨|墨笔/iu.test(medium)) kinds.push("ink");
  if (!kinds.includes("print") && /chalk|charcoal|pencil|graphite|pen and|brush and|drawing|素描|炭笔|铅笔/iu.test(medium)) kinds.push("drawing");
  return kinds;
}
