// Release projection shared by offline builders and the optional local runtime index.
import { lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import type { SemanticIndex } from "@artduo/contracts";
import { semanticArtworkText, semanticFingerprint } from "@artduo/corpus/src/semantic-index";
import { ObservationIndexIdentityError, validateSemanticObservationIndex } from "@artduo/corpus/src/semantic-observation-index";
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
  const bytes = readFileSync(file);
  return { ...validateSemanticObservationIndex(JSON.parse(bytes.toString("utf8")), observationReleaseInput(catalog, museumIndex)),
    fileSha256: semanticFingerprint(bytes) };
}

type RuntimeObservation = ReturnType<typeof loadObservationSidecar> & { museumIndex: SemanticIndex };
type ObservationStatus = { status: "loaded"; value: RuntimeObservation }
  | { status: "unavailable"; reason: "missing" | "unreadable" | "damaged" | "identity-mismatch" };
const runtimeIndexes = new Map<string, { revision: string; result: ObservationStatus }>();
const lastReportedStatus = new Map<string, "loaded" | Extract<ObservationStatus, { status: "unavailable" }>["reason"]>();

export function runtimeObservationIndex(catalog: WebReleaseCatalog): RuntimeObservation | undefined {
  const result = runtimeObservationStatus(catalog);
  const releaseVersion = catalog.releaseVersion;
  const state = result.status === "loaded" ? "loaded" : result.reason;
  const previous = lastReportedStatus.get(releaseVersion);
  lastReportedStatus.delete(releaseVersion);
  lastReportedStatus.set(releaseVersion, state);
  if (lastReportedStatus.size > 8) lastReportedStatus.delete(lastReportedStatus.keys().next().value!);
  if (previous !== state) {
    try {
      console.warn(JSON.stringify({ event: "semantic-observation-index", releaseVersion, status: result.status,
        ...(result.status === "unavailable" ? { reason: result.reason } : {}) }));
    } catch { /* Diagnostics must never affect selection. */ }
  }
  return result.status === "loaded" ? result.value : undefined;
}

export function runtimeObservationStatus(catalog: WebReleaseCatalog): ObservationStatus {
  const filename = path.join(catalog.releaseDir, OBSERVATION_SIDECAR_NAME);
  try {
    const stat = lstatSync(filename);
    if (!stat.isFile() || stat.size > 32 * 1024 * 1024) return { status: "unavailable", reason: "damaged" };
    const shards = catalog.manifest.shards;
    const dependencies = [filename, catalog.manifestPath, path.join(catalog.releaseDir, "visual-reviews.json"),
      ...[...shards.metadata, ...shards.search, ...(shards.semanticEmbeddings ?? [])].map(shard => resolveShardPath(catalog.manifestPath, shard))];
    const revision = fileRevision(dependencies);
    const cached = runtimeIndexes.get(filename);
    if (cached?.revision === revision) return cached.result;
    let result: ObservationStatus = { status: "unavailable", reason: "damaged" };
    try {
      const museumIndex = loadSemanticIndex({ manifestPath: catalog.manifestPath, manifest: catalog.manifest, artworks: museumSemanticDocuments(catalog) });
      if (museumIndex) {
        const observation = loadObservationSidecar(filename, catalog, museumIndex);
        if (observation.vectors.size) result = { status: "loaded", value: { ...observation, museumIndex } };
      }
    } catch (error) {
      result = { status: "unavailable", reason: error instanceof ObservationIndexIdentityError ? "identity-mismatch"
        : (error as NodeJS.ErrnoException).code ? "unreadable" : "damaged" };
    }
    if (fileRevision(dependencies) !== revision) return { status: "unavailable", reason: "unreadable" };
    runtimeIndexes.delete(filename);
    runtimeIndexes.set(filename, { revision, result });
    while (runtimeIndexes.size > 2) runtimeIndexes.delete(runtimeIndexes.keys().next().value!);
    return result;
  } catch (error) {
    return { status: "unavailable", reason: (error as NodeJS.ErrnoException).code === "ENOENT" ? "missing" : "unreadable" };
  }
}
