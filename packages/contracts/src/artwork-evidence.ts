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

export const PRINT_DETAILS = ["woodblock", "etching", "engraving", "lithograph", "copperplate"] as const;
export type PrintDetail = typeof PRINT_DETAILS[number];

/** Museum medium wording is the only source of specific print-process evidence. */
export function artworkPrintDetails(medium: string | undefined): Record<PrintDetail, VisualState> {
  const states: Record<PrintDetail, VisualState> = { woodblock: "unknown", etching: "unknown", engraving: "unknown", lithograph: "unknown", copperplate: "unknown" };
  if (!medium || /可能|疑似|或为|仿照|仿自|\b(?:probably|possibly|perhaps|reproduction|or)\b|\b(?:photograph|photo|digital image)\s+of\b|\bafter an? (?:woodcut|etching|engraving|lithograph)|\?/iu.test(medium)) return states;
  const woodblock = /木[版刻](?![上油])|木板(?:印刷|版画|刻)|\b(?:wood[ -]?(?:cut|block)|wood engraving)/iu.test(medium);
  const etching = /蚀刻|\betch(?:ing|ed)\b/iu.test(medium);
  const engraving = /铜[版板]雕刻|\bengrav(?:ing|ed)\b/iu.test(medium);
  const lithograph = /石[版板]|\blithograph(?:y|ic|s)?\b/iu.test(medium);
  const copperplate = /铜[版板]|\bcopper[ -]?plate\b|\bcopper\s+(?:etching|engraving)|\b(?:etching|etch(?:ed)|engrav(?:ing|ed))\b[^.;]{0,40}\b(?:on|from) copper\b/iu.test(medium);
  const otherTechnique = /\b(?:aquatint|mezzotint|drypoint|linocut|screenprint|screen print|monotype)\b/iu.test(medium);
  const identified = woodblock || etching || engraving || lithograph || otherTechnique;
  const knownNonPrint = !identified && !copperplate && !/\bprints?\b|版画/iu.test(medium)
    && artworkMediumKinds(medium).some(kind => kind !== "print");
  for (const [detail, present] of Object.entries({ woodblock, etching, engraving, lithograph }) as Array<[Exclude<PrintDetail, "copperplate">, boolean]>) {
    if (present) states[detail] = "present";
    else if (knownNonPrint || identified && (detail !== "woodblock" || etching || lithograph || otherTechnique || copperplate)) states[detail] = "absent";
  }
  if (copperplate) states.copperplate = "present";
  else if (knownNonPrint || /\b(?:zinc|steel|aluminium|aluminum)\b|锌版|钢版|铝版/iu.test(medium)
    || (woodblock || lithograph) && !etching && !otherTechnique && (!engraving || /\bwood engraving\b/iu.test(medium))) states.copperplate = "absent";
  return states;
}
