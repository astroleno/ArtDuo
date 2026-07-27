import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { parseImageEmbeddingShardRecords } from "@artduo/contracts";

import type { ImageEmbeddingProvider } from "./image-embedding-provider";
import { buildImageEmbeddingShards } from "./image-embedding-shards";
import type { ImageEmbeddingSourceInput } from "./image-embedding-sources";

const RELEASE_VERSION = "image-builder-test";

function checksum(value: string | Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function writeJson(rootDir: string, fileName: string, value: unknown): {
  id: string;
  url: string;
  checksum: string;
  sizeBytes: number;
  recordCount: number;
} {
  const serialized = JSON.stringify(value, null, 2);
  const content = `${serialized}\n`;
  writeFileSync(path.join(rootDir, fileName), content);
  return {
    id: path.basename(fileName, ".json"),
    url: `./${fileName}`,
    checksum: checksum(serialized),
    sizeBytes: Buffer.byteLength(content),
    recordCount: Array.isArray(value) ? value.length : 1,
  };
}

function createFixtureRelease(): {
  rootDir: string;
  manifestPath: string;
  promotionAnchorPath: string;
} {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-image-builder-"));
  const releaseDir = path.join(rootDir, "data", "releases", RELEASE_VERSION);
  const reportDir = path.join(rootDir, "data", "curation", "reports", "image-embeddings", RELEASE_VERSION);
  mkdirSync(releaseDir, { recursive: true });
  mkdirSync(reportDir, { recursive: true });

  const metadata = [
    { id: "artwork-b", presentation: { grade: "A" } },
    { id: "artwork-a", presentation: { grade: "B" } },
  ];
  const media = [
    { id: "artwork-b", media: { imageUrlPreview: "https://images.metmuseum.org/artwork-b.png" } },
    { id: "artwork-a", media: { imageUrlPreview: "https://images.metmuseum.org/artwork-a.png" } },
  ];
  const scenes = [
    { id: "scene-b", asset: { local_public_path: "/artduo-gallery/scene-b.png" } },
    { id: "scene-a", asset: { local_public_path: "/artduo-gallery/scene-a.png" } },
  ];
  const manifest = {
    release: {
      corpusVersion: RELEASE_VERSION,
      backgroundCatalogVersion: RELEASE_VERSION,
      contractsVersion: "0.1.0",
      createdAt: "2026-07-27T00:00:00.000Z",
    },
    shards: {
      metadata: [writeJson(releaseDir, "metadata-01.json", metadata)],
      search: [writeJson(releaseDir, "search-01.json", [])],
      mediaIndex: [writeJson(releaseDir, "media-01.json", media)],
      backgroundScenes: [writeJson(releaseDir, "background-scenes-01.json", scenes)],
    },
  };
  const manifestPath = path.join(releaseDir, "manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const promotionAnchorPath = path.join(reportDir, "promotion-anchor-set.json");
  writeFileSync(promotionAnchorPath, `${JSON.stringify({
    schemaVersion: "image-embedding-promotion-anchor-set.v1",
    releaseVersion: RELEASE_VERSION,
    anchors: [{ artworkId: "artwork-a" }],
  }, null, 2)}\n`);

  return { rootDir, manifestPath, promotionAnchorPath };
}

function createFakeProvider(): ImageEmbeddingProvider {
  return {
    mode: "local-transformers",
    model: "test-image-model",
    modelRevision: "test-revision",
    modelVariant: "quantized",
    expectedModelArtifactChecksum: checksum("test-model"),
    async getModelArtifactProvenance() {
      return {
        artifact: "onnx/vision_model_quantized.onnx",
        checksum: checksum("test-model"),
        providerVersion: "2.17.2",
      };
    },
    async embedImages(inputs) {
      return inputs.map((input, index) => ({
        model: "test-image-model",
        modelRevision: "test-revision",
        modelVariant: "quantized",
        modelArtifactChecksum: checksum("test-model"),
        providerVersion: "2.17.2",
        dimensions: 2,
        preprocessingVersion: "test-preprocessing.v1",
        preprocessingFingerprint: checksum("test-preprocessing"),
        vector: index % 2 === 0 ? [1, 0] : [0, 1],
      }));
    },
  };
}

async function resolveFixtureSource(input: ImageEmbeddingSourceInput) {
  return {
    status: "ready" as const,
    source: {
      entityType: input.entityType,
      entityId: input.entityId,
      fieldPath: input.entityType === "artwork" ? "media.imageUrlPreview" : "asset.local_public_path",
      bytes: new Uint8Array([1]),
      mediaType: "image/png" as const,
      width: 1,
      height: 1,
      fingerprint: checksum(`source:${input.entityType}:${input.entityId}`),
      sourceLocatorFingerprint: checksum(`locator:${input.entityType}:${input.entityId}`),
    },
  };
}

test("image embedding builder writes a sorted internal candidate without changing the base manifest", async () => {
  const fixture = createFixtureRelease();
  const baseManifest = readFileSync(fixture.manifestPath, "utf8");

  const result = await buildImageEmbeddingShards({
    rootDir: fixture.rootDir,
    releaseVersion: RELEASE_VERSION,
    manifestPath: fixture.manifestPath,
    promotionAnchorPath: fixture.promotionAnchorPath,
    candidateRoot: path.join(fixture.rootDir, "candidates"),
    reportRoot: path.join(fixture.rootDir, "reports"),
    provider: createFakeProvider(),
    sourceResolver: resolveFixtureSource,
  });

  const candidate = parseImageEmbeddingShardRecords(JSON.parse(readFileSync(result.candidatePath, "utf8")));

  assert.deepEqual(candidate.map((record) => record.id), [
    "artwork:artwork-a",
    "artwork:artwork-b",
    "background-scene:scene-a",
    "background-scene:scene-b",
  ]);
  assert.equal(candidate[0]?.source.shardId, "media-01");
  assert.equal(candidate[2]?.source.shardId, "background-scenes-01");
  assert.deepEqual(result.report.artwork, {
    eligible: 2,
    embedded: 2,
    gradeAEligible: 1,
    gradeAEmbedded: 1,
    criticalEligible: 2,
    criticalEmbedded: 2,
  });
  assert.deepEqual(result.report.backgroundScene, { eligible: 2, embedded: 2 });
  assert.equal(result.report.gates.coverageReady, true);
  assert.deepEqual(result.report.failures, []);
  assert.equal(readFileSync(fixture.manifestPath, "utf8"), baseManifest);
  assert.equal(existsSync(path.join(path.dirname(fixture.manifestPath), "image-embeddings-01.json")), false);
  assert.equal(existsSync(path.join(path.dirname(fixture.manifestPath), "manifest.image-embedding-v1.json")), false);
});

test("image embedding builder rejects model flags that disagree with provider provenance", async () => {
  const fixture = createFixtureRelease();

  await assert.rejects(
    buildImageEmbeddingShards({
      rootDir: fixture.rootDir,
      releaseVersion: RELEASE_VERSION,
      manifestPath: fixture.manifestPath,
      promotionAnchorPath: fixture.promotionAnchorPath,
      candidateRoot: path.join(fixture.rootDir, "candidates"),
      reportRoot: path.join(fixture.rootDir, "reports"),
      model: "untrusted-image-model",
      provider: createFakeProvider(),
      sourceResolver: resolveFixtureSource,
    }),
    /must match the configured provider provenance/,
  );
});

test("image embedding builder records controlled source failures and keeps coverage below the shadow gate", async () => {
  const fixture = createFixtureRelease();
  const result = await buildImageEmbeddingShards({
    rootDir: fixture.rootDir,
    releaseVersion: RELEASE_VERSION,
    manifestPath: fixture.manifestPath,
    promotionAnchorPath: fixture.promotionAnchorPath,
    candidateRoot: path.join(fixture.rootDir, "candidates"),
    reportRoot: path.join(fixture.rootDir, "reports"),
    provider: createFakeProvider(),
    sourceResolver: async (input) => {
      if (input.entityId === "artwork-b") {
        return {
          status: "failed" as const,
          failure: {
            reason: "decode-failed" as const,
            message: "file:///Users/private/decoder-error.png",
          },
        };
      }
      if (input.entityId === "scene-b") {
        throw new Error("https://images.metmuseum.org/scene-b.png?token=private-token");
      }
      return resolveFixtureSource(input);
    },
  });

  assert.deepEqual(result.records.map((record) => record.id), [
    "artwork:artwork-a",
    "background-scene:scene-a",
  ]);
  assert.deepEqual(result.report.artwork, {
    eligible: 2,
    embedded: 1,
    gradeAEligible: 1,
    gradeAEmbedded: 0,
    criticalEligible: 2,
    criticalEmbedded: 1,
  });
  assert.deepEqual(result.report.backgroundScene, { eligible: 2, embedded: 1 });
  assert.deepEqual(result.report.failures.map((failure) => ({
    id: `${failure.entityType}:${failure.entityId}`,
    code: failure.code,
  })), [
    { id: "artwork:artwork-b", code: "decode-failed" },
    { id: "background-scene:scene-b", code: "fetch-failed" },
  ]);
  assert.equal(result.report.gates.coverageReady, false);
  assert.equal(JSON.stringify(result.report).includes("private-token"), false);
  assert.equal(JSON.stringify(result.report).includes("/Users/private"), false);
});

test("image embedding builder rejects a release version that could escape its report root", async () => {
  const fixture = createFixtureRelease();
  const unsafeReleaseVersion = "../escaped-report";
  const manifest = JSON.parse(readFileSync(fixture.manifestPath, "utf8")) as {
    release: { corpusVersion: string };
  };
  manifest.release.corpusVersion = unsafeReleaseVersion;
  writeFileSync(fixture.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const anchorSet = JSON.parse(readFileSync(fixture.promotionAnchorPath, "utf8")) as { releaseVersion: string };
  anchorSet.releaseVersion = unsafeReleaseVersion;
  writeFileSync(fixture.promotionAnchorPath, `${JSON.stringify(anchorSet, null, 2)}\n`);

  await assert.rejects(
    buildImageEmbeddingShards({
      rootDir: fixture.rootDir,
      releaseVersion: unsafeReleaseVersion,
      manifestPath: fixture.manifestPath,
      promotionAnchorPath: fixture.promotionAnchorPath,
      candidateRoot: path.join(fixture.rootDir, "candidates"),
      reportRoot: path.join(fixture.rootDir, "reports"),
      provider: createFakeProvider(),
      sourceResolver: resolveFixtureSource,
    }),
    /safe release version/,
  );
});

test("image embedding builder rejects a custom fetch adapter that cannot preserve DNS binding", async () => {
  const fixture = createFixtureRelease();

  await assert.rejects(
    buildImageEmbeddingShards({
      rootDir: fixture.rootDir,
      releaseVersion: RELEASE_VERSION,
      manifestPath: fixture.manifestPath,
      promotionAnchorPath: fixture.promotionAnchorPath,
      candidateRoot: path.join(fixture.rootDir, "candidates"),
      reportRoot: path.join(fixture.rootDir, "reports"),
      fetchImpl: (async () => new Response()) as typeof fetch,
      provider: createFakeProvider(),
      sourceResolver: resolveFixtureSource,
    }),
    /does not accept a custom fetch adapter/,
  );
});
