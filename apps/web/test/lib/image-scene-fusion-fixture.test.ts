import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { buildImageSceneFusionFixture } from "../../scripts/run-image-scene-fusion-e2e.mjs";

function checksum(value: string | Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  throw new TypeError("Unsupported canonical JSON value.");
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function fixtureInput(promotionReady = true) {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-fusion-fixture-test-"));
  const releaseDir = path.join(rootDir, "release");
  const baseManifestPath = path.join(releaseDir, "manifest.json");
  const candidateShardPath = path.join(rootDir, "candidate.json");
  const promotionReportPath = path.join(rootDir, "promotion.json");
  mkdirSync(releaseDir, { recursive: true });
  const baseManifest = {
    release: {
      corpusVersion: "fixture-release",
      backgroundCatalogVersion: "fixture-release",
      contractsVersion: "0.1.0",
      createdAt: "2026-08-09T00:00:00.000Z",
    },
    shards: {
      metadata: [],
      search: [],
      mediaIndex: [],
      backgroundScenes: [{ id: "background-scenes-01", url: "./background-scenes-01.json", checksum: checksum("scene"), sizeBytes: 3, recordCount: 2 }],
    },
  };
  const candidate = [
    { id: "background-scene:bg-001", entityType: "background-scene", entityId: "bg-001" },
    { id: "background-scene:bg-002", entityType: "background-scene", entityId: "bg-002" },
    { id: "artwork:art-001", entityType: "artwork", entityId: "art-001" },
  ];
  writeJson(baseManifestPath, baseManifest);
  writeJson(path.join(releaseDir, "background-scenes-01.json"), []);
  writeJson(candidateShardPath, candidate);
  const promotionBindingPayload = {
    releaseVersion: "fixture-release",
    evaluationVersion: "image-embedding-evaluation.v1",
    baseManifestChecksum: checksum(readFileSync(baseManifestPath)),
    candidateShardChecksum: checksum(JSON.stringify(candidate, null, 2)),
    model: "Xenova/clip-vit-base-patch32",
    modelRevision: "revision",
    modelVariant: "quantized",
    modelArtifactChecksum: checksum("model"),
    providerVersion: "2.17.2",
    preprocessingFingerprint: checksum("preprocessing"),
    visualCandidateCount: 2,
    recommendedVisualWeight: 0.05,
    visualCalibration: { lowerCosine: -1, upperCosine: 1 },
    gateEvidence: {
      bindingIntegrity: true,
      buildCoverageReady: true,
      artworkHoldout: {
        minimumSampleMet: true,
        count: 60,
        pointEstimate: 0.9,
        lowerConfidence: 0.8,
        allMajorStrataSufficient: true,
      },
      sceneHoldout: {
        minimumSampleMet: true,
        count: 60,
        pointEstimate: 0.8,
        lowerConfidence: 0.7,
        allMajorStrataSufficient: true,
      },
      reviewPackReady: promotionReady,
      humanReview: {
        valid: true,
        complete: true,
        completedCount: 30,
        uncertainRate: 0.05,
        candidateAcceptableRate: 0.9,
        candidateRegressionRate: 0.05,
      },
      baselineBindingsReady: true,
      visualPolicySelectionReady: true,
    },
  };
  const promotionBindingChecksum = checksum(canonicalJson(promotionBindingPayload));
  writeJson(promotionReportPath, {
    schemaVersion: "image-embedding-evaluation-report.v1",
    releaseVersion: "fixture-release",
    promotionBindingPayload,
    promotionBinding: {
      promotionReady,
      fusionVerificationReady: false,
      ...promotionBindingPayload,
      promotionBindingChecksum,
    },
  });
  return {
    rootDir,
    baseManifestPath,
    candidateShardPath,
    promotionReportPath,
    baseManifest,
    promotionBindingChecksum,
    expectedBinding: {
      releaseVersion: "fixture-release",
      baseManifestChecksum: promotionBindingPayload.baseManifestChecksum,
      candidateShardChecksum: promotionBindingPayload.candidateShardChecksum,
      promotionReportChecksum: checksum(readFileSync(promotionReportPath)),
      promotionBindingChecksum,
    },
  };
}

test("fusion fixture builder creates bound valid and fault variants without mutating the base release", () => {
  const input = fixtureInput();
  const fixtureRoot = path.join(input.rootDir, "generated");
  const result = buildImageSceneFusionFixture({ ...input, fixtureRoot });

  assert.deepEqual(JSON.parse(readFileSync(input.baseManifestPath, "utf8")), input.baseManifest);
  const valid = JSON.parse(readFileSync(result.validManifestPath, "utf8")) as {
    shards: { imageEmbeddings: Array<{ checksum: string }> };
    imageEmbeddingSidecar: { imageShardChecksum: string; promotionBindingChecksum: string };
  };
  assert.equal(valid.imageEmbeddingSidecar.imageShardChecksum, valid.shards.imageEmbeddings[0]?.checksum);
  assert.equal(valid.imageEmbeddingSidecar.promotionBindingChecksum, input.promotionBindingChecksum);

  const checksumFailure = JSON.parse(readFileSync(result.checksumManifestPath, "utf8")) as {
    shards: { imageEmbeddings: Array<{ checksum: string }> };
    imageEmbeddingSidecar: { imageShardChecksum: string };
  };
  assert.notEqual(checksumFailure.imageEmbeddingSidecar.imageShardChecksum, checksumFailure.shards.imageEmbeddings[0]?.checksum);
  const missingEntity = JSON.parse(readFileSync(path.join(path.dirname(result.missingEntityManifestPath), "image-embeddings-missing-entity.json"), "utf8")) as unknown[];
  assert.equal(missingEntity.some((record) => (record as { entityId?: string }).entityId === "bg-001"), false);
});

test("fusion fixture builder refuses a report that is not promotion-ready", () => {
  const input = fixtureInput(false);
  assert.throws(
    () => buildImageSceneFusionFixture({ ...input, fixtureRoot: path.join(input.rootDir, "generated") }),
    /promotionReady=true/u,
  );
});

test("fusion fixture builder rejects promotionReady=true when the canonical Task 5 gates are not ready", () => {
  const input = fixtureInput(false);
  const report = JSON.parse(readFileSync(input.promotionReportPath, "utf8")) as {
    promotionBinding: { promotionReady: boolean };
  };
  report.promotionBinding.promotionReady = true;
  writeJson(input.promotionReportPath, report);

  assert.throws(
    () => buildImageSceneFusionFixture({
      ...input,
      expectedBinding: {
        ...input.expectedBinding,
        promotionReportChecksum: checksum(readFileSync(input.promotionReportPath)),
      },
      fixtureRoot: path.join(input.rootDir, "generated"),
    }),
    /canonical Task 5 gates/u,
  );
});

test("fusion fixture builder recomputes and rejects a forged promotion binding checksum", () => {
  const input = fixtureInput();
  const report = JSON.parse(readFileSync(input.promotionReportPath, "utf8")) as {
    promotionBinding: { promotionBindingChecksum: string };
  };
  report.promotionBinding.promotionBindingChecksum = checksum("forged-promotion-binding");
  writeJson(input.promotionReportPath, report);

  assert.throws(
    () => buildImageSceneFusionFixture({ ...input, fixtureRoot: path.join(input.rootDir, "generated") }),
    /promotion binding checksum/u,
  );
});

test("fusion fixture builder rejects a self-consistent report detached from the producer-locked Task 5 artifact", () => {
  const input = fixtureInput();
  const detachedBinding = {
    ...input.expectedBinding,
    promotionReportChecksum: checksum("different-task-5-report"),
  };

  assert.throws(
    () => buildImageSceneFusionFixture({
      ...input,
      expectedBinding: detachedBinding,
      fixtureRoot: path.join(input.rootDir, "generated"),
    }),
    /producer-locked Task 5 inputs/u,
  );
});
