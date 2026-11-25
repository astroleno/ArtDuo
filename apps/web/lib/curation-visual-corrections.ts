import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { FileRevisionCache } from "./file-revision-cache";
import { readPublicMediaConfiguration } from "./public-media";
import { mediaSha256, parsePublicMediaManifest, publicMediaId } from "./public-media-manifest";
import type { WebReleaseCatalog } from "./release-catalog";

const RELEASE = "2026-11-19-open-gap-739";
const CORRECTION_VERSION = "forest-review-2026-11-25";
// Full published previews reviewed on 2026-11-25. The source column binds both
// the original observation ledger and the immutable imported image.
const REVIEWS = [
  // Dense trunks, plants, and a lighter path extending into the woodland.
  ["smk-KKS21313", "sha256:cae73b3b10f4b6fd5f6f7819083c41fbfeea0864a09784d046c7cb0decb85efd", "sha256:0c65afdabfd636df9f4f5d75fc6069df98fd549b00321579e8bed6b6ad8a6db3"],
  // Scattered trunks at the edge of a wood, opening onto a clearing.
  ["smk-KKS21148", "sha256:fc121d382d9b04d6d1ff153982e3adfe4e80520abe864d7be1703048cfea9138", "sha256:d39d965aa9687568ed0b4e4926de6ea058fa88a4763863f3de537abe75788dc7"],
  // Bare trees, a snowy path, and one small walker. People remain present.
  ["smk-KKS13637", "sha256:667ea44b797751cc40ab20d1ce560e8dc7653a7624a05260a9c8718edadee3bb", "sha256:9b6d6d42b458e1f526803cd529d7017fe1bc30062ab4f481c5eb359f0c1bd4fc"],
] as const;

const previewIds = new Set(REVIEWS.map(([id]) => publicMediaId("preview", id)));
const previewCache = new FileRevisionCache<Array<{ id: string; sha256: string; sourceFingerprint?: string }>>();

/** A versioned view for curation only. Missing or conflicting evidence leaves the source unchanged. */
export function withCurationVisualCorrections(catalog: WebReleaseCatalog): WebReleaseCatalog {
  if (catalog.releaseVersion !== RELEASE) return catalog;
  const pending = REVIEWS.filter(([id, source]) => {
    const artwork = catalog.artworkById.get(id);
    const media = catalog.artworkRecordById.get(id)?.media;
    const review = artwork?.visualEvidence;
    return review?.reviewer === "local-image-review" && review.artworkId === id && !artwork?.visualEvidenceUnavailable
      && review.imagePath === artwork?.imageUrl && review.imageSha256 === source && media?.sourceAssetFingerprint === source
      && media.verifiedRemoteImage?.sha256 === source && media.verifiedRemoteImage.url === review.imagePath
      && review.facts.war === "unknown" && review.facts.death === "unknown";
  });
  if (!pending.length) return catalog;

  let previews: Array<{ id: string; sha256: string; sourceFingerprint?: string }>;
  try {
    const configured = readPublicMediaConfiguration({ rootDir: path.resolve(catalog.releaseDir, "../../..") });
    if (configured?.manifest.releaseVersion === RELEASE) {
      previews = configured.manifest.assets.filter(asset => previewIds.has(asset.id));
    } else {
      const filename = path.join(catalog.releaseDir, "public-media-manifest.json");
      previews = previewCache.read(filename, () => [filename, catalog.manifestPath], () => {
        if (statSync(filename).size > 8_000_000) return [];
        const manifest = parsePublicMediaManifest(JSON.parse(readFileSync(filename, "utf8")));
        if (manifest.releaseVersion !== RELEASE || manifest.sourceManifestSha256 !== mediaSha256(readFileSync(catalog.manifestPath))) return [];
        return manifest.assets.filter(asset => previewIds.has(asset.id));
      });
    }
  } catch {
    return catalog;
  }
  const approved = new Set(pending.filter(([id, source, preview]) => previews.some(asset =>
    asset.id === publicMediaId("preview", id) && asset.sourceFingerprint === source && asset.sha256 === preview)).map(([id]) => id as string));
  if (!approved.size) return catalog;
  const artworks = catalog.artworks.map(artwork => {
    if (!approved.has(artwork.id) || !artwork.visualEvidence) return artwork;
    return { ...artwork, visualEvidence: { ...artwork.visualEvidence, facts: { ...artwork.visualEvidence.facts, war: "absent" as const, death: "absent" as const } } };
  });
  return { ...catalog, artworks, artworkById: new Map(artworks.map(artwork => [artwork.id, artwork])),
    visualEvidenceVersion: `${catalog.visualEvidenceVersion}+${CORRECTION_VERSION}:${[...approved].sort().join(",")}` };
}
