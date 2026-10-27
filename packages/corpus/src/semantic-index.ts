import { createHash } from "node:crypto";
import type { ReleaseManifest, SemanticModelIdentity } from "@artduo/contracts";

export const LOCAL_SEMANTIC_MODEL: SemanticModelIdentity = {
  id: "Xenova/multilingual-e5-small",
  revision: "761b726dd34fb83930e26aab4e9ac3899aa1fa78",
  dimensions: 384,
  quantized: true,
  pooling: "mean",
  normalization: "l2",
  queryPrefix: "query: ",
  documentPrefix: "passage: ",
  textVersion: "museum-facts-and-editorial-tags-v1",
};
export function semanticFingerprint(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}
export function semanticSourceFingerprint(manifest: ReleaseManifest): string {
  return semanticFingerprint(JSON.stringify({ release: manifest.release.corpusVersion,
    metadata: manifest.shards.metadata.map((shard) => shard.checksum),
    search: manifest.shards.search.map((shard) => shard.checksum) }));
}
export function sameSemanticSpace(left: SemanticModelIdentity, right: SemanticModelIdentity): boolean {
  return (Object.keys(LOCAL_SEMANTIC_MODEL) as Array<keyof SemanticModelIdentity>).every((key) => left[key] === right[key]);
}
export function normalizeSemanticVector(vector: number[], dimensions: number): number[] {
  if (vector.length !== dimensions || vector.some((number) => !Number.isFinite(number))) throw new TypeError("Invalid semantic vector dimension or value");
  const norm = Math.hypot(...vector);
  if (!norm || !Number.isFinite(norm)) throw new TypeError("Semantic vector must have a finite nonzero norm");
  return vector.map((number) => number / norm);
}
export interface SemanticArtworkTextInput {
  title: string;
  artistDisplayName?: string;
  yearLabel?: string;
  medium?: string;
  description?: string;
  subjectTags: string[];
  moodTags: string[];
  colorTags: string[];
  compositionTags: string[];
}
/** Museum text and editorial tags retain separate labels; no hash aliases. */
export function semanticArtworkText(artwork: SemanticArtworkTextInput): string {
  const description = artwork.description && !/Strong\s+.+\s+fit with usable image and title signal/i.test(artwork.description)
    ? artwork.description.trim().slice(0, 1400) : undefined;
  return [
    `Artwork: ${artwork.title}.`,
    artwork.artistDisplayName && `Artist: ${artwork.artistDisplayName}.`,
    artwork.yearLabel && `Date label: ${artwork.yearLabel}.`,
    artwork.medium && `Medium: ${artwork.medium}.`,
    artwork.subjectTags.length && `Recorded subjects: ${artwork.subjectTags.join(", ")}.`,
    artwork.moodTags.length && `Editorial viewing moods: ${artwork.moodTags.join(", ")}.`,
    artwork.colorTags.length && `Editorial palette: ${artwork.colorTags.join(", ")}.`,
    artwork.compositionTags.length && `Editorial composition: ${artwork.compositionTags.join(", ")}.`,
    description && `Recorded description: ${description}`,
  ].filter(Boolean).join(" ").normalize("NFKC");
}
