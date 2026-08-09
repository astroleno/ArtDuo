import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { readImageEmbeddingEvidenceSuiteManifest } from "./image-embedding-evidence-suite-manifest";
import { buildImageEmbeddingEvidenceSuiteDescriptor } from "./image-embedding-promotion-evidence";

const RELEASE_VERSION = "evidence-suite-manifest-test";
const textIds = Array.from({ length: 24 }, (_, index) => `text-${index + 1}`);
const passIds = Array.from({ length: 55 }, (_, index) => `pass-${index + 1}`);
const failIds = Array.from({ length: 40 }, (_, index) => `fail-${index + 1}`);
const blockedIds = Array.from({ length: 5 }, (_, index) => `blocked-${index + 1}`);
const replayIds = Array.from({ length: 50 }, (_, index) => `replay-${index + 1}`);
const e2eIds = Array.from({ length: 14 }, (_, index) => `e2e-${index + 1}`);
const fusionIds = Array.from({ length: 5 }, (_, index) => `fusion-${index + 1}`);

function checksum(value: string | Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function createFixture(): { rootDir: string; anchorPath: string; sourcePath: string } {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-evidence-suite-manifest-"));
  const reportDir = path.join(rootDir, "data", "curation", "reports", "image-embeddings", RELEASE_VERSION);
  mkdirSync(reportDir, { recursive: true });
  const sourcePath = path.join(rootDir, "apps", "web", "e2e", "thin-slice.spec.ts");
  mkdirSync(path.dirname(sourcePath), { recursive: true });
  writeFileSync(sourcePath, "test('real gallery flow', () => clickGalleryArtwork());\n");
  const sourceFiles = [{
    path: "apps/web/e2e/thin-slice.spec.ts",
    checksum: checksum(readFileSync(sourcePath)),
  }];
  const suites = {
    textBenchmark: buildImageEmbeddingEvidenceSuiteDescriptor({
      suiteType: "text-benchmark",
      suitePayload: { caseIds: textIds },
      sourceFiles,
    }),
    a2a: {
      caseSet: buildImageEmbeddingEvidenceSuiteDescriptor({
        suiteType: "a2a-case-set",
        suitePayload: { baseline: { passIds, failIds, blockedIds } },
        sourceFiles,
      }),
      replay: buildImageEmbeddingEvidenceSuiteDescriptor({
        suiteType: "a2a-replay",
        suitePayload: { caseIds: replayIds },
        sourceFiles,
      }),
    },
    e2e: buildImageEmbeddingEvidenceSuiteDescriptor({
      suiteType: "e2e",
      suitePayload: { baseline: { passIds: e2eIds, failIds: [], skippedIds: [] } },
      sourceFiles,
    }),
    fusionE2e: buildImageEmbeddingEvidenceSuiteDescriptor({
      suiteType: "fusion-e2e",
      suitePayload: { caseIds: fusionIds },
      sourceFiles,
    }),
  };
  const manifestPath = path.join(reportDir, "promotion-evidence-suite-manifest.v1.json");
  writeJson(manifestPath, {
    schemaVersion: "image-embedding-evidence-suite-manifest.v1",
    releaseVersion: RELEASE_VERSION,
    suites,
  });
  const anchorPath = path.join(reportDir, "promotion-anchor-set.json");
  writeJson(anchorPath, {
    schemaVersion: "image-embedding-promotion-anchor-set.v1",
    releaseVersion: RELEASE_VERSION,
    evidenceSuiteManifest: {
      schemaVersion: "image-embedding-evidence-suite-manifest.v1",
      path: "./promotion-evidence-suite-manifest.v1.json",
      checksum: checksum(readFileSync(manifestPath)),
    },
  });
  return { rootDir, anchorPath, sourcePath };
}

test("evidence suite manifest independently verifies canonical suite and source checksums", () => {
  const fixture = createFixture();
  const valid = readImageEmbeddingEvidenceSuiteManifest({
    rootDir: fixture.rootDir,
    anchorPath: fixture.anchorPath,
    releaseVersion: RELEASE_VERSION,
  });
  assert.ok(valid.bindings, valid.reasons.join(" "));
  assert.deepEqual(valid.reasons, []);

  writeFileSync(fixture.sourcePath, "test('weakened flow', () => directNavigate());\n");
  const changedSource = readImageEmbeddingEvidenceSuiteManifest({
    rootDir: fixture.rootDir,
    anchorPath: fixture.anchorPath,
    releaseVersion: RELEASE_VERSION,
  });
  assert.equal(changedSource.bindings, undefined);
  assert.ok(changedSource.reasons.some((reason) => /source checksum does not match/i.test(reason)));
});
