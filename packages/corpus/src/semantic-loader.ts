import { readFileSync } from "node:fs";
import { parseSemanticIndex, type ReleaseManifest, type SemanticIndex, type ShardInfo } from "@artduo/contracts";
import { resolveShardPath } from "./release-loader";
import { LOCAL_SEMANTIC_MODEL, sameSemanticSpace, semanticFingerprint, semanticSourceFingerprint } from "./semantic-index";

export function readVerifiedSemanticArtifact(manifestPath: string, shard: ShardInfo): unknown {
  const bytes = readFileSync(resolveShardPath(manifestPath, shard));
  // Release JSON checksums follow the existing corpus convention: omit its final newline.
  if (bytes.length !== shard.sizeBytes || `sha256:${semanticFingerprint(bytes.toString("utf8").replace(/\n$/u, ""))}` !== shard.checksum) {
    throw new TypeError(`Release artifact failed integrity validation: ${shard.id}`);
  }
  return JSON.parse(bytes.toString("utf8"));
}

export function loadSemanticIndex(input: {
  manifestPath: string; manifest: ReleaseManifest;
  artworks: Array<{ id: string; text: string }>;
}): SemanticIndex | undefined {
  const shards = input.manifest.shards.semanticEmbeddings;
  if (!shards?.length) return undefined;
  if (shards.length !== 1) throw new TypeError("Expected one complete semantic index");
  for (const shard of [...input.manifest.shards.metadata, ...input.manifest.shards.search]) readVerifiedSemanticArtifact(input.manifestPath, shard);
  const index = parseSemanticIndex(readVerifiedSemanticArtifact(input.manifestPath, shards[0]));
  const expected = new Map(input.artworks.map((artwork) => [artwork.id, semanticFingerprint(artwork.text)]));
  if (!sameSemanticSpace(index.model, LOCAL_SEMANTIC_MODEL) || index.releaseVersion !== input.manifest.release.corpusVersion
    || index.sourceFingerprint !== semanticSourceFingerprint(input.manifest)
    || index.records.length !== expected.size || index.records.length !== shards[0].recordCount
    || index.records.some((record) => expected.get(record.artworkId) !== record.textFingerprint)) {
    throw new TypeError("Semantic index identity does not match this release and encoder");
  }
  return index;
}
