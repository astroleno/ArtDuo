import assert from "node:assert/strict";
import { test } from "node:test";

import { parseArtworkRecords } from "./artwork";
import { parseBackgroundSceneRecords } from "./background-scene";
import { parseReleaseManifest } from "./corpus";
import { loadFixture } from "./test-helpers";

const CHECKSUM = `sha256:${"a".repeat(64)}`;
const OTHER_CHECKSUM = `sha256:${"b".repeat(64)}`;

function variantManifest(overrides: Record<string, unknown> = {}) {
  return {
    release: {
      corpusVersion: "2026-04-25-curation-b",
      backgroundCatalogVersion: "2026-04-25-curation-b",
      contractsVersion: "0.1.0",
      createdAt: "2026-04-25T00:00:00.000Z",
    },
    shards: {
      metadata: [{ id: "metadata-01", url: "./metadata-01.json", checksum: "sha256:test", sizeBytes: 100, recordCount: 3 }],
      search: [{ id: "search-01", url: "./search-01.json", checksum: "sha256:test", sizeBytes: 100, recordCount: 3 }],
      mediaIndex: [{ id: "media-01", url: "./media-01.json", checksum: "sha256:test", sizeBytes: 100, recordCount: 3 }],
      backgroundScenes: [{ id: "background-scenes-01", url: "./background-scenes-01.json", checksum: "sha256:test", sizeBytes: 100, recordCount: 2 }],
      imageEmbeddings: [{ id: "image-embeddings-01", url: "./image-embeddings-01.json", checksum: CHECKSUM, sizeBytes: 100, recordCount: 5 }],
    },
    imageEmbeddingSidecar: {
      schemaVersion: "image-embedding-v1",
      baseManifestChecksum: CHECKSUM,
      promotionReportChecksum: OTHER_CHECKSUM,
      promotionBindingChecksum: CHECKSUM,
      imageShardChecksum: CHECKSUM,
      model: "Xenova/clip-vit-base-patch32",
      modelRevision: "d15189d7028b43f1d3e65039190477f6af591c2a",
      modelVariant: "quantized",
      modelArtifactChecksum: OTHER_CHECKSUM,
      providerVersion: "2.17.2",
      preprocessingFingerprint: CHECKSUM,
      visualPolicy: {
        candidateCount: 2,
        weight: 0.25,
        lowerCosine: 0.1,
        upperCosine: 0.8,
      },
    },
    ...overrides,
  };
}

test("manifest fixture matches the bootstrap fixture counts", () => {
  const manifest = parseReleaseManifest(loadFixture("corpus-manifest.json"));
  const artworks = parseArtworkRecords(loadFixture("artworks.json"));
  const scenes = parseBackgroundSceneRecords(loadFixture("background-scenes.json"));

  assert.equal(manifest.release.contractsVersion, "0.1.0");
  assert.equal(manifest.shards.metadata[0]?.recordCount, artworks.length);
  assert.equal(manifest.shards.search[0]?.recordCount, artworks.length);
  assert.equal(manifest.shards.mediaIndex[0]?.recordCount, artworks.length);
  assert.equal(manifest.shards.backgroundScenes[0]?.recordCount, scenes.length);
  assert.equal(manifest.shards.embeddings, undefined);
});

test("manifest parser accepts optional embedding shards", () => {
  const manifest = parseReleaseManifest({
    release: {
      corpusVersion: "2026-04-25-curation-b",
      backgroundCatalogVersion: "2026-04-25-curation-b",
      contractsVersion: "0.1.0",
      createdAt: "2026-04-25T00:00:00.000Z",
    },
    shards: {
      metadata: [{ id: "metadata-01", url: "./metadata-01.json", checksum: "sha256:test", sizeBytes: 100, recordCount: 3 }],
      search: [{ id: "search-01", url: "./search-01.json", checksum: "sha256:test", sizeBytes: 100, recordCount: 3 }],
      mediaIndex: [{ id: "media-01", url: "./media-01.json", checksum: "sha256:test", sizeBytes: 100, recordCount: 3 }],
      backgroundScenes: [{ id: "background-scenes-01", url: "./background-scenes-01.json", checksum: "sha256:test", sizeBytes: 100, recordCount: 2 }],
      embeddings: [{ id: "embeddings-01", url: "./embeddings-01.json", checksum: "sha256:test", sizeBytes: 100, recordCount: 3 }],
    },
  });

  assert.equal(manifest.shards.embeddings?.[0]?.id, "embeddings-01");
  assert.equal(manifest.shards.embeddings?.[0]?.recordCount, 3);
});

test("manifest parser accepts optional relationship graph shards", () => {
  const manifest = parseReleaseManifest({
    release: {
      corpusVersion: "2026-04-25-curation-b",
      backgroundCatalogVersion: "2026-04-25-curation-b",
      contractsVersion: "0.1.0",
      createdAt: "2026-04-25T00:00:00.000Z",
    },
    shards: {
      metadata: [{ id: "metadata-01", url: "./metadata-01.json", checksum: "sha256:test", sizeBytes: 100, recordCount: 3 }],
      search: [{ id: "search-01", url: "./search-01.json", checksum: "sha256:test", sizeBytes: 100, recordCount: 3 }],
      mediaIndex: [{ id: "media-01", url: "./media-01.json", checksum: "sha256:test", sizeBytes: 100, recordCount: 3 }],
      backgroundScenes: [{ id: "background-scenes-01", url: "./background-scenes-01.json", checksum: "sha256:test", sizeBytes: 100, recordCount: 2 }],
      relationshipGraph: [{ id: "relationship-graph-01", url: "./relationship-graph-01.json", checksum: "sha256:test", sizeBytes: 100, recordCount: 7 }],
    },
  });

  assert.equal(manifest.shards.relationshipGraph?.[0]?.id, "relationship-graph-01");
  assert.equal(manifest.shards.relationshipGraph?.[0]?.recordCount, 7);
});

test("manifest parser accepts a complete image embedding manifest variant without mutating input", () => {
  const fixture = variantManifest();
  const before = JSON.stringify(fixture);
  const manifest = parseReleaseManifest(fixture);

  assert.equal(manifest.shards.imageEmbeddings?.[0]?.id, "image-embeddings-01");
  assert.equal(manifest.imageEmbeddingSidecar?.visualPolicy.weight, 0.25);
  assert.equal(JSON.stringify(fixture), before);
});

test("manifest parser requires image shards and their sidecar binding to appear together", () => {
  const withOnlyShards = variantManifest();
  delete (withOnlyShards as { imageEmbeddingSidecar?: unknown }).imageEmbeddingSidecar;
  assert.throws(() => parseReleaseManifest(withOnlyShards), /must appear together/);

  const withOnlyBinding = variantManifest({
    shards: {
      metadata: [{ id: "metadata-01", url: "./metadata-01.json", checksum: "sha256:test", sizeBytes: 100, recordCount: 3 }],
      search: [{ id: "search-01", url: "./search-01.json", checksum: "sha256:test", sizeBytes: 100, recordCount: 3 }],
      mediaIndex: [{ id: "media-01", url: "./media-01.json", checksum: "sha256:test", sizeBytes: 100, recordCount: 3 }],
      backgroundScenes: [{ id: "background-scenes-01", url: "./background-scenes-01.json", checksum: "sha256:test", sizeBytes: 100, recordCount: 2 }],
    },
  });
  assert.throws(() => parseReleaseManifest(withOnlyBinding), /must appear together/);
});

test("manifest parser rejects invalid image policy and checksum bindings", () => {
  const invalidWeight = variantManifest();
  ((invalidWeight as { imageEmbeddingSidecar: { visualPolicy: { weight: number } } }).imageEmbeddingSidecar.visualPolicy.weight) = 0.31;
  assert.throws(() => parseReleaseManifest(invalidWeight), /weight must be between 0 and 0.3/);

  const invalidCandidateCount = variantManifest();
  ((invalidCandidateCount as { imageEmbeddingSidecar: { visualPolicy: { candidateCount: number } } }).imageEmbeddingSidecar.visualPolicy.candidateCount) = 3;
  assert.throws(() => parseReleaseManifest(invalidCandidateCount), /candidateCount must be a positive integer no greater than 2/);

  const invalidCalibration = variantManifest();
  ((invalidCalibration as { imageEmbeddingSidecar: { visualPolicy: { upperCosine: number } } }).imageEmbeddingSidecar.visualPolicy.upperCosine) = 0.1;
  assert.throws(() => parseReleaseManifest(invalidCalibration), /upperCosine must be greater than lowerCosine/);

  const invalidChecksum = variantManifest();
  ((invalidChecksum as { imageEmbeddingSidecar: { imageShardChecksum: string } }).imageEmbeddingSidecar.imageShardChecksum) = "sha256:not-a-checksum";
  assert.throws(() => parseReleaseManifest(invalidChecksum), /expected sha256 checksum/);
});
