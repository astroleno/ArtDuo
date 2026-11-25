// Release projection shared by offline builders and the optional local runtime index.
import { lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import type { SemanticIndex } from "@artduo/contracts";
import { semanticArtworkText, semanticFingerprint } from "@artduo/corpus/src/semantic-index";
import { validateSemanticObservationIndex } from "@artduo/corpus/src/semantic-observation-index";
import { loadSemanticIndex } from "@artduo/corpus/src/semantic-loader";
import { resolveShardPath } from "@artduo/corpus/src/release-loader";
import type { WebReleaseCatalog } from "./release-catalog";
import { fileRevision } from "./file-revision-cache";

export const OBSERVATION_SIDECAR_NAME = "semantic-observation-index-v1.json";

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

type RuntimeObservation = ReturnType<typeof loadObservationSidecar> & { museumIndex: SemanticIndex };
const runtimeIndexes = new Map<string, { revision: string; value?: RuntimeObservation }>();

export function runtimeObservationIndex(catalog: WebReleaseCatalog): RuntimeObservation | undefined {
  const filename = path.join(catalog.releaseDir, OBSERVATION_SIDECAR_NAME);
  try {
    const stat = lstatSync(filename);
    if (!stat.isFile() || stat.size > 32 * 1024 * 1024) return undefined;
    const shards = catalog.manifest.shards;
    const dependencies = [filename, catalog.manifestPath, path.join(catalog.releaseDir, "visual-reviews.json"),
      ...[...shards.metadata, ...shards.search, ...(shards.semanticEmbeddings ?? [])].map(shard => resolveShardPath(catalog.manifestPath, shard))];
    const revision = fileRevision(dependencies);
    const cached = runtimeIndexes.get(filename);
    if (cached?.revision === revision) return cached.value;
    let value: RuntimeObservation | undefined;
    try {
      const museumIndex = loadSemanticIndex({ manifestPath: catalog.manifestPath, manifest: catalog.manifest, artworks: museumSemanticDocuments(catalog) });
      if (museumIndex) {
        const observation = loadObservationSidecar(filename, catalog, museumIndex);
        if (observation.vectors.size) value = { ...observation, museumIndex };
      }
    } catch { /* A damaged optional index leaves the museum-only path available. */ }
    if (fileRevision(dependencies) !== revision) return undefined;
    runtimeIndexes.delete(filename);
    runtimeIndexes.set(filename, { revision, value });
    while (runtimeIndexes.size > 2) runtimeIndexes.delete(runtimeIndexes.keys().next().value!);
    return value;
  } catch { return undefined; }
}
