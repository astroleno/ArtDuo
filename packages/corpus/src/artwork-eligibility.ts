/** Use medium and catalog classifications, never depicted subjects or title words. */
export interface ArtworkTypeEvidence {
  id?: string;
  medium?: string;
  department?: string;
  subjectTags: readonly string[];
}

export type ArtworkEligibility = "flat-artwork" | "non-pictorial-object" | "unclassified";

export interface GalleryArtworkDecision {
  classification: ArtworkEligibility;
  status: "eligible" | "specialist-only" | "excluded" | "unclassified";
  reason: string;
  evidenceUrl?: string;
}

const OBJECT_MEDIUM = /\b(?:terracotta|porcelain|stoneware|earthenware|enamel|ceramic|leather binding)\b/i;
const SPECIALIST_WORKS: Record<string, string> = {
  "met-828433": "Jacquemart etching after Vermeer; a derivative print, not the Vermeer painting",
  "met-372886": "Illustration proof for Once a Week; retain for a publication/illustration exhibition",
  "met-366377": "Delivered image shows five prints mounted together; a single-work view has not been verified",
  "met-436203": "Delivered image includes the ceiling installation and surrounding decoration; not a frontal standalone painting image",
  "met-459024": "Delivered image shows the complete architectural altarpiece assembly; requires a dedicated multipart display",
};

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
    || OBJECT_MEDIUM.test(medium) || tags.some((tag) => OBJECT_CLASS.test(tag))) return "non-pictorial-object";
  if (tags.some((tag) => PICTURE_CLASS.test(tag)) || PRINT_MEDIUM.test(medium) || PAINT_MEDIUM.test(medium)
    || DRAWING_MEDIUM.test(medium) && FLAT_SUPPORT.test(medium)) return "flat-artwork";
  return "unclassified";
}

/** Separate the identity of a flat artwork from its eligibility for the default exhibition. */
export function galleryArtworkDecision(artwork: ArtworkTypeEvidence): GalleryArtworkDecision {
  const classification = classifyArtworkEligibility(artwork);
  if (classification !== "flat-artwork") return {
    classification, status: classification === "unclassified" ? "unclassified" : "excluded",
    reason: artwork.id && REVIEWED_EXCLUSIONS[artwork.id]?.reason
      || (classification === "unclassified" ? "Insufficient evidence of a flat artwork" : "Catalog classification or medium identifies an object, photograph or manuscript"),
    evidenceUrl: artwork.id ? REVIEWED_EXCLUSIONS[artwork.id]?.source : undefined,
  };
  const specialistReason = artwork.id && SPECIALIST_WORKS[artwork.id];
  if (specialistReason || /\bletterpress\b/i.test(artwork.medium ?? "")) return {
    classification, status: "specialist-only",
    reason: specialistReason || "Print combined with letterpress text; publication material requires a dedicated exhibition",
    evidenceUrl: artwork.id?.startsWith("met-") ? `https://www.metmuseum.org/art/collection/search/${artwork.id.slice(4)}` : undefined,
  };
  return { classification, status: "eligible", reason: "Painting, drawing or art print supported by catalog classification or medium" };
}

export function isGalleryArtwork(artwork: ArtworkTypeEvidence): boolean {
  return galleryArtworkDecision(artwork).status === "eligible";
}
