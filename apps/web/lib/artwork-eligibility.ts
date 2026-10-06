/** Use medium and catalog classifications, never depicted subjects or title words. */
export interface ArtworkTypeEvidence {
  id?: string;
  medium?: string;
  department?: string;
  subjectTags: readonly string[];
}

export type ArtworkEligibility = "flat-artwork" | "non-pictorial-object" | "unclassified";

const OBJECT_CLASS = /^(?:photographs?|sculpture(?:[- ].*)?|(?:stone|wood)[- ]sculpture|ceramics(?:[- ].*)?|terracottas?|bronzes?|metalwork(?:[- ].*)?|glass(?:[- ].*)?|leaded glass|stained glass|textiles(?:[- ].*)?|ivories(?:[- ].*)?|ivory|enamels?|lacquer|lapidary work(?:-.*)?|natural substances(?:-.*)?|codices|manuscripts and illuminations)$/i;
const PICTURE_CLASS = /^(?:(?:miscellaneous-)?paintings?(?:-canvas)?|drawings?|prints?|calligraphy|watercolors?|pastels?)$/i;
const PHOTO_MEDIUM = /\b(?:photograph|albumen|gelatin(?:[- ]coated)?|silver print|silver gelatin|salted paper print|daguerreotype|cyanotype|chromogenic|platinum print|photogravure)\b/i;
const PRINT_MEDIUM = /\b(?:etching|engraving|lithograph(?:y)?|woodcut|woodblock print|screenprint|aquatint|mezzotint|drypoint)\b/i;
const PAINT_MEDIUM = /\b(?:oil|tempera|watercolou?r|gouache|acrylic|pastel)\b|\bfresco\b/i;
const DRAWING_MEDIUM = /\b(?:ink|pencil|graphite|chalk|charcoal|crayon)\b/i;
const FLAT_SUPPORT = /\b(?:paper|silk|canvas|vellum|parchment)\b/i;

// The source's broad "Paintings" category includes these non-picture objects.
// Reviewed against the official object pages, 2026-10-03. Keep the original
// corpus intact; these are exhibition eligibility decisions, not metadata edits.
const REVIEWED_EXCLUSIONS: Record<string, { reason: string; source: string }> = {
  "met-37789": { reason: "Ritual crown worn in ceremonies, assembled from five painted panels", source: "https://www.metmuseum.org/art/collection/search/37789" },
  "met-902212": { reason: "Sutra text fragment remounted as a scroll; primarily manuscript calligraphy", source: "https://www.metmuseum.org/art/collection/search/902212" },
};

export function classifyArtworkEligibility(artwork: ArtworkTypeEvidence): ArtworkEligibility {
  if (artwork.id && Object.hasOwn(REVIEWED_EXCLUSIONS, artwork.id)) return "non-pictorial-object";
  const tags = artwork.subjectTags.map((tag) => tag.trim());
  const medium = artwork.medium ?? "";
  if (artwork.department?.trim() === "Photographs" || PHOTO_MEDIUM.test(medium)
    || tags.some((tag) => OBJECT_CLASS.test(tag))) return "non-pictorial-object";
  if (tags.some((tag) => PICTURE_CLASS.test(tag)) || PRINT_MEDIUM.test(medium) || PAINT_MEDIUM.test(medium)
    || DRAWING_MEDIUM.test(medium) && FLAT_SUPPORT.test(medium)) return "flat-artwork";
  return "unclassified";
}

export function isGalleryArtwork(artwork: ArtworkTypeEvidence): boolean {
  return classifyArtworkEligibility(artwork) === "flat-artwork";
}
