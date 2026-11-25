// Offline release projection shared by the observation builder and evaluators.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { SemanticIndex } from "@artduo/contracts";
import { semanticArtworkText, semanticFingerprint } from "@artduo/corpus/src/semantic-index";
import { validateSemanticObservationIndex } from "@artduo/corpus/src/semantic-observation-index";
import type { WebReleaseCatalog } from "../lib/release-catalog";

export function observationReleaseInput(catalog: WebReleaseCatalog, museumIndex: SemanticIndex) {
  const checksum = catalog.manifest.shards.semanticEmbeddings?.[0]?.checksum;
  if (!checksum || !catalog.visualEvidenceVersion) throw new Error("Museum index and visual evidence must be installed");
  const sources = catalog.artworks.flatMap(artwork => {
    const review = artwork.visualEvidence;
    if (artwork.visualEvidenceUnavailable || review?.reviewer !== "local-image-review" || review.artworkId !== artwork.id
      || review.imagePath !== artwork.imageUrl || !review.observation.trim()) return [];
    return [{ artworkId: artwork.id, imageSha256: review.imageSha256, observation: review.observation }];
  });
  return { sources, museumIndex, provenance: {
    releaseVersion: catalog.releaseVersion,
    releaseManifestSha256: semanticFingerprint(readFileSync(catalog.manifestPath)),
    museumIndexChecksum: checksum,
    visualLedgerSha256: semanticFingerprint(readFileSync(path.join(catalog.releaseDir, "visual-reviews.json"))),
    visualEvidenceVersion: catalog.visualEvidenceVersion,
  } };
}

export function museumSemanticDocuments(catalog: WebReleaseCatalog) {
  return catalog.artworkRecords.map(({ id, metadata }) => ({ id,
    text: semanticArtworkText({ ...metadata, description: metadata.descriptionClean ?? metadata.storySnippet }) }));
}

export function loadObservationSidecar(file: string, catalog: WebReleaseCatalog, museumIndex: SemanticIndex) {
  return validateSemanticObservationIndex(JSON.parse(readFileSync(file, "utf8")), observationReleaseInput(catalog, museumIndex));
}
