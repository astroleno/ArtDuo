import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import type { ImageEmbeddingShardRecord } from "@artduo/contracts";

import {
  parseImageEmbeddingReproducibilityEvidence,
  verifyImageEmbeddingReproducibility,
} from "./image-embedding-reproducibility";

const RELEASE = "fixture-release";
const SHA = /^sha256:[a-f0-9]{64}$/u;

function sha256(value: Uint8Array | string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function write(rootDir: string, relativePath: string, value: string | Uint8Array): string {
  const target = path.join(rootDir, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, value);
  return target;
}

function writeJson(rootDir: string, relativePath: string, value: unknown): string {
  return write(rootDir, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function git(rootDir: string, args: string[]): string {
  return execFileSync("git", args, { cwd: rootDir, encoding: "utf8" }).trim();
}

function aggregateCache(rootDir: string): `sha256:${string}` {
  const names = ["entry.bin", "entry.json"].sort();
  const index = names.map((name) => `${sha256(readFileSync(path.join(rootDir, name))).slice(7)}  ${name}\n`).join("");
  return sha256(index);
}

interface Fixture {
  rootDir: string;
  evidencePath: string;
  offlineManifestPath: string;
  bundlePath: string;
  candidatePath: string;
  modelArtifactPath: string;
  sourceCacheRoot: string;
  evidence: Record<string, unknown>;
}

function createFixture(): Fixture {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), "artduo-reproducibility-"));
  git(rootDir, ["init", "-q"]);
  git(rootDir, ["config", "user.email", "fixture@example.invalid"]);
  git(rootDir, ["config", "user.name", "Fixture"]);

  const releaseManifestPath = `data/releases/${RELEASE}/manifest.json`;
  const reportDir = `data/curation/reports/image-embeddings/${RELEASE}`;
  const anchorPath = `${reportDir}/promotion-anchor-set.json`;
  const buildReportPath = `${reportDir}/image-embedding-report.json`;
  const candidateRelativePath = `${reportDir}/candidates/image-embeddings-01.json`;
  const evidenceRelativePath = `${reportDir}/reproducibility/evidence.v1.json`;
  const offlineManifestRelativePath = `${reportDir}/reproducibility/offline-build-manifest.v1.json`;
  const bundleRelativePath = `${reportDir}/reproducibility/bundle.v1.json`;

  writeJson(rootDir, "package.json", { name: "fixture", private: true, scripts: { existing: "fixture" } });
  writeJson(rootDir, "apps/pipeline/package.json", { name: "@fixture/pipeline", private: true, scripts: { existing: "fixture" } });
  write(rootDir, "pnpm-lock.yaml", "lockfileVersion: '6.0'\n");
  writeJson(rootDir, releaseManifestPath, { schemaVersion: "fixture-release.v1", releaseVersion: RELEASE });
  writeJson(rootDir, anchorPath, { schemaVersion: "fixture-anchor.v1", releaseVersion: RELEASE });
  write(rootDir, "apps/pipeline/src/image-embedding-provider.real.test.ts", [
    "const ONE_PIXEL_PNG = Buffer.from('png');",
    "const ONE_PIXEL_JPEG = Buffer.from('jpeg');",
    "assert.equal(provenance.checksum, IMAGE_MODEL_ARTIFACT_SHA256);",
    "assert.equal(embedded.every((entry) => entry.dimensions === IMAGE_EMBEDDING_DIMENSIONS), true);",
    "assert.equal(embedded.every((entry) => Math.abs(Math.hypot(...entry.vector) - 1) < 1e-4), true);",
    "",
  ].join("\n"));

  const candidate: ImageEmbeddingShardRecord[] = [{
    id: "artwork:art-1",
    entityType: "artwork",
    entityId: "art-1",
    releaseVersion: RELEASE,
    source: {
      shardId: "media-01",
      recordId: "art-1",
      fieldPath: "media.imageUrlPreview",
      fingerprint: sha256("fixture-image"),
    },
    model: "fixture/model",
    modelRevision: "revision-1",
    modelVariant: "quantized",
    modelArtifactChecksum: sha256("pinned-model"),
    provider: "@xenova/transformers",
    providerVersion: "1.2.3",
    dimensions: 512,
    preprocessingVersion: "fixture-preprocess.v1",
    preprocessingFingerprint: sha256("fixture-preprocess"),
    vectorPrecision: 8,
    vector: Array.from({ length: 512 }, (_, index) => index === 0 ? 1 : 0),
  }];
  const candidateBytes = `${JSON.stringify(candidate, null, 2)}\n`;
  const candidateDeclaredChecksum = sha256(JSON.stringify(candidate, null, 2));
  const candidateBytesChecksum = sha256(candidateBytes);
  const modelBytes = new TextEncoder().encode("pinned-model");
  const modelChecksum = sha256(modelBytes);

  const baseManifestChecksum = sha256(readFileSync(path.join(rootDir, releaseManifestPath)));
  const anchorChecksum = sha256(readFileSync(path.join(rootDir, anchorPath)));
  writeJson(rootDir, buildReportPath, {
    releaseVersion: RELEASE,
    baseManifestChecksum,
    promotionAnchorSetChecksum: anchorChecksum,
    model: "fixture/model",
    modelRevision: "revision-1",
    modelVariant: "quantized",
    modelArtifactChecksum: modelChecksum,
    providerVersion: "1.2.3",
    gates: { coverageReady: true },
    candidateShard: {
      id: "image-embeddings-01",
      url: "./image-embeddings-01.json",
      checksum: candidateDeclaredChecksum,
      sizeBytes: Buffer.byteLength(candidateBytes),
      recordCount: candidate.length,
    },
  });

  git(rootDir, ["add", "package.json", "apps/pipeline/package.json", "apps/pipeline/src", "pnpm-lock.yaml", "data"]);
  git(rootDir, ["commit", "-qm", "fixture inputs"]);
  const commitSha = git(rootDir, ["rev-parse", "HEAD"]);
  const treeSha = git(rootDir, ["rev-parse", "HEAD^{tree}"]);

  const candidatePath = write(rootDir, candidateRelativePath, candidateBytes);
  const modelArtifactPath = write(rootDir, ".cache/model/vision_model_quantized.onnx", modelBytes);
  const sourceCacheRoot = path.join(rootDir, ".cache/artduo/image-sources");
  write(rootDir, ".cache/artduo/image-sources/entry.bin", "cached-image");
  writeJson(rootDir, ".cache/artduo/image-sources/entry.json", { mediaType: "image/png", sizeBytes: 12 });
  const sourceCacheChecksum = aggregateCache(sourceCacheRoot);

  const inputPaths = [
    "package.json",
    "apps/pipeline/package.json",
    "pnpm-lock.yaml",
    releaseManifestPath,
    anchorPath,
    buildReportPath,
  ];
  const inputs = inputPaths.map((inputPath) => ({
    path: inputPath,
    checksum: sha256(execFileSync("git", ["show", `${commitSha}:${inputPath}`], { cwd: rootDir })),
  }));

  const runDefinitions = [
    {
      id: "normal-frozen-install",
      command: "pnpm install --frozen-lockfile --registry=https://registry.npmjs.org",
      extra: { isolation: "detached sparse checkout at execution.commitSha", nativeScriptsEnabled: true },
      body: [
        "Lockfile is up to date, resolution step is skipped",
        "Packages: +4",
        ".../node_modules/hnswlib-node install$ node-gyp rebuild",
        ".../node_modules/hnswlib-node install: gyp info ok",
        ".../node_modules/hnswlib-node install: Done",
        ".../sharp@0.1.0/node_modules/sharp install$ node install/libvips",
        ".../sharp@0.1.0/node_modules/sharp install: sharp: Integrity check passed for darwin-arm64v8",
        ".../sharp@0.1.0/node_modules/sharp install: Done",
        "resolved @xenova/transformers 1.2.3",
        "resolved sharp 0.1.0",
        "resolved commander 1.0.0",
        "resolved ipaddr.js 2.0.0",
      ].join("\n") + "\n",
    },
    {
      id: "offline-frozen-install",
      command: "pnpm install --frozen-lockfile --offline",
      extra: { isolation: "detached sparse checkout at execution.commitSha", nativeScriptsEnabled: true },
      body: [
        "Lockfile is up to date, resolution step is skipped",
        "Progress: resolved 4, reused 4, downloaded 0, added 4, done",
        "resolved @xenova/transformers 1.2.3",
        "resolved sharp 0.1.0",
        "resolved commander 1.0.0",
        "resolved ipaddr.js 2.0.0",
      ].join("\n") + "\n",
    },
    {
      id: "real-provider-smoke",
      command: "ARTDUO_RUN_REAL_IMAGE_EMBEDDING_SMOKE=true pnpm --filter @artduo/pipeline exec tsx --test src/image-embedding-provider.real.test.ts",
      extra: {},
      body: `expectedArtifactChecksum: ${modelChecksum}\n✔ real image provider smoke embeds one PNG and one JPEG\nℹ tests 1\nℹ pass 1\nℹ fail 0\nℹ skipped 0\n`,
    },
    {
      id: "offline-shadow-rebuild",
      command: `pnpm image-embeddings:build -- --release-version ${RELEASE} --image-embedding-model fixture/model --image-embedding-model-revision revision-1 --image-embedding-model-variant quantized --image-embedding-batch-size 8 --offline true --report-root <TEMP_REPORT_ROOT> --promotion-anchor-set ${anchorPath}`,
      extra: {},
      body: `records: 1\ncoverage ready: true\ncandidateDeclaredChecksum: ${candidateDeclaredChecksum}\ncandidateBytesChecksum: ${candidateBytesChecksum}\ncandidateRecordCount: 1\nreportBytesChecksum: ${sha256("offline-report")}\ncoverageReady: true\nfailures: [{"entityType":"artwork","entityId":"art-missing","code":"offline-cache-miss","message":"fixture"}]\n`,
    },
  ] as const;
  const runs = runDefinitions.map((run) => {
    const logRelativePath = `${reportDir}/reproducibility/${run.id}.log`;
    const log = `command: ${run.command}\nexecutionCommitSha: ${commitSha}\n${run.body}trackedGitStatus: clean\nexitCode: 0\n`;
    write(rootDir, logRelativePath, log);
    return {
      id: run.id,
      command: run.command,
      ...run.extra,
      exitCode: 0,
      trackedGitStatusAfterRun: "clean",
      log: { path: logRelativePath, checksum: sha256(log) },
    };
  });

  const offlineReportChecksum = sha256("offline-report");
  const offlineManifest = {
    schemaVersion: "artduo-image-embedding-offline-build-manifest.v1",
    releaseVersion: RELEASE,
    executionCommitSha: commitSha,
    inputs: {
      baseManifestChecksum,
      promotionAnchorSetChecksum: anchorChecksum,
      modelArtifactChecksum: modelChecksum,
      sourceCacheAggregateChecksum: sourceCacheChecksum,
    },
    candidate: {
      recordCount: 1,
      sizeBytes: Buffer.byteLength(candidateBytes),
      declaredChecksum: candidateDeclaredChecksum,
      bytesChecksum: candidateBytesChecksum,
    },
    report: {
      sizeBytes: Buffer.byteLength("offline-report"),
      bytesChecksum: offlineReportChecksum,
      coverageReady: true,
      controlledFailures: [{ entityType: "artwork", entityId: "art-missing", code: "offline-cache-miss" }],
    },
  };
  const offlineManifestPath = writeJson(rootDir, offlineManifestRelativePath, offlineManifest);

  const evidence = {
    schemaVersion: "artduo-image-embedding-reproducibility-evidence.v1",
    releaseVersion: RELEASE,
    generatedAt: "2026-08-12T00:00:00Z",
    execution: {
      commitSha,
      treeSha,
      trackedGitStatusBeforeRuns: "clean",
      untrackedPromotionArtifactsExcluded: true,
    },
    environment: { operatingSystem: "Darwin", architecture: "arm64", nodeVersion: "v26.7.0", pnpmVersion: "8.15.1" },
    inputs,
    runtimeArtifacts: {
      model: {
        id: "fixture/model",
        revision: "revision-1",
        variant: "quantized",
        artifact: "onnx/vision_model_quantized.onnx",
        sizeBytes: modelBytes.byteLength,
        checksum: modelChecksum,
      },
      sourceCache: {
        schema: "artduo-image-source-cache.v1",
        fileCount: 2,
        aggregateAlgorithm: "sha256(concat(sortByRelativePath(fileSha256 + twoSpaces + relativePath + newline)))",
        aggregateChecksum: sourceCacheChecksum,
        committed: false,
      },
    },
    resolvedDependencies: { "@xenova/transformers": "1.2.3", sharp: "0.1.0", commander: "1.0.0", "ipaddr.js": "2.0.0" },
    runs,
    outputs: {
      candidate: { committed: false, recordCount: 1, declaredChecksum: candidateDeclaredChecksum, bytesChecksum: candidateBytesChecksum },
      offlineReport: {
        sizeBytes: Buffer.byteLength("offline-report"),
        bytesChecksum: offlineReportChecksum,
        coverageReady: true,
        controlledFailures: [{ entityType: "artwork", entityId: "art-missing", code: "offline-cache-miss" }],
      },
    },
    promotionState: {
      promotionReady: false,
      task6Authorized: false,
      artworkHoldoutAccuracy: 0.61,
      artworkHoldoutLowerConfidence: 0.59,
      sceneTop3HitRate: 0.18,
      sceneTop3LowerConfidence: 0.11,
      humanReviewCompleted: 0,
      humanReviewRequired: 30,
    },
  };
  const evidencePath = writeJson(rootDir, evidenceRelativePath, evidence);
  const bundlePath = writeJson(rootDir, bundleRelativePath, {
    schemaVersion: "artduo-image-embedding-reproducibility-bundle.v1",
    releaseVersion: RELEASE,
    evidence: { path: "./evidence.v1.json", checksum: sha256(readFileSync(evidencePath)) },
    offlineBuildManifest: { path: "./offline-build-manifest.v1.json", checksum: sha256(readFileSync(offlineManifestPath)) },
    artifactRetention: {
      status: "local-only",
      task7Ready: false,
      immutableArtifacts: [],
    },
  });

  return { rootDir, evidencePath, offlineManifestPath, bundlePath, candidatePath, modelArtifactPath, sourceCacheRoot, evidence };
}

function rewriteEvidence(fixture: Fixture, mutate: (evidence: Record<string, unknown>) => void): void {
  const evidence = JSON.parse(readFileSync(fixture.evidencePath, "utf8")) as Record<string, unknown>;
  mutate(evidence);
  writeJson(fixture.rootDir, path.relative(fixture.rootDir, fixture.evidencePath), evidence);
  const bundle = JSON.parse(readFileSync(fixture.bundlePath, "utf8")) as Record<string, unknown>;
  (bundle.evidence as Record<string, unknown>).checksum = sha256(readFileSync(fixture.evidencePath));
  writeJson(fixture.rootDir, path.relative(fixture.rootDir, fixture.bundlePath), bundle);
}

function rewriteRunLog(fixture: Fixture, runId: string, mutate: (text: string) => string): void {
  rewriteEvidence(fixture, (evidence) => {
    const runs = evidence.runs as Array<Record<string, unknown>>;
    const run = runs.find((entry) => entry.id === runId);
    assert.ok(run);
    const log = run.log as Record<string, unknown>;
    const logPath = path.join(fixture.rootDir, log.path as string);
    const bytes = mutate(readFileSync(logPath, "utf8"));
    writeFileSync(logPath, bytes);
    log.checksum = sha256(bytes);
  });
}

function rewriteBundle(fixture: Fixture, mutate: (bundle: Record<string, unknown>) => void): void {
  const bundle = JSON.parse(readFileSync(fixture.bundlePath, "utf8")) as Record<string, unknown>;
  mutate(bundle);
  writeJson(fixture.rootDir, path.relative(fixture.rootDir, fixture.bundlePath), bundle);
}

test("reproducibility verifier binds Git inputs, logs, runtime artifacts, candidate, report, and offline manifest", async () => {
  const fixture = createFixture();
  writeJson(fixture.rootDir, "package.json", {
    name: "fixture",
    private: true,
    scripts: {
      existing: "fixture",
      "image-embeddings:verify-reproducibility": "pnpm --filter @artduo/pipeline verify:image-embedding-reproducibility",
    },
  });
  writeJson(fixture.rootDir, "apps/pipeline/package.json", {
    name: "@fixture/pipeline",
    private: true,
    scripts: {
      existing: "fixture",
      "verify:image-embedding-reproducibility": "pnpm run workspace:prepare && tsx src/verify-image-embedding-reproducibility.ts",
    },
  });
  git(fixture.rootDir, ["add", "package.json", "apps/pipeline/package.json"]);
  git(fixture.rootDir, ["commit", "-qm", "add verifier after evidence run"]);
  const result = await verifyImageEmbeddingReproducibility({
    rootDir: fixture.rootDir,
    bundlePath: fixture.bundlePath,
    modelArtifactPath: fixture.modelArtifactPath,
    sourceCacheRoot: fixture.sourceCacheRoot,
    verifyResolvedDependencies: false,
  });
  assert.equal(result.valid, true, result.reasons.join("\n"));
  assert.deepEqual(result.reasons, []);
});

test("reproducibility evidence parser rejects unknown schema fields", () => {
  const fixture = createFixture();
  const parsed = parseImageEmbeddingReproducibilityEvidence({ ...fixture.evidence, unexpected: true });
  assert.equal(parsed.evidence, undefined);
  assert.ok(parsed.reasons.some((reason) => /exact schema|unexpected/i.test(reason)));
});

test("reproducibility verifier fails closed when runtime artifacts or candidate bytes drift", async () => {
  const fixture = createFixture();
  writeFileSync(fixture.candidatePath, "[]\n");
  rmSync(fixture.modelArtifactPath);
  writeFileSync(path.join(fixture.sourceCacheRoot, "entry.bin"), "tampered-cache");

  const result = await verifyImageEmbeddingReproducibility({
    rootDir: fixture.rootDir,
    bundlePath: fixture.bundlePath,
    modelArtifactPath: fixture.modelArtifactPath,
    sourceCacheRoot: fixture.sourceCacheRoot,
    verifyResolvedDependencies: false,
  });
  assert.equal(result.valid, false);
  assert.ok(result.reasons.some((reason) => /model artifact.*missing/i.test(reason)));
  assert.ok(result.reasons.some((reason) => /source cache.*checksum/i.test(reason)));
  assert.ok(result.reasons.some((reason) => /candidate.*checksum/i.test(reason)));
});

test("reproducibility verifier rejects changed Git inputs, logs, and offline manifest binding", async () => {
  const fixture = createFixture();
  const evidence = JSON.parse(readFileSync(fixture.evidencePath, "utf8")) as Record<string, unknown>;
  const execution = evidence.execution as Record<string, unknown>;
  execution.treeSha = "0".repeat(40);
  writeJson(fixture.rootDir, path.relative(fixture.rootDir, fixture.evidencePath), evidence);
  const bundle = JSON.parse(readFileSync(fixture.bundlePath, "utf8")) as Record<string, unknown>;
  (bundle.evidence as Record<string, unknown>).checksum = sha256(readFileSync(fixture.evidencePath));
  writeJson(fixture.rootDir, path.relative(fixture.rootDir, fixture.bundlePath), bundle);
  writeFileSync(path.join(fixture.rootDir, "package.json"), "{\"tampered\":true}\n");

  const result = await verifyImageEmbeddingReproducibility({
    rootDir: fixture.rootDir,
    bundlePath: fixture.bundlePath,
    modelArtifactPath: fixture.modelArtifactPath,
    sourceCacheRoot: fixture.sourceCacheRoot,
    verifyResolvedDependencies: false,
  });
  assert.equal(result.valid, false);
  assert.ok(result.reasons.some((reason) => /tree/i.test(reason)));
  assert.ok(result.reasons.some((reason) => /tracked worktree/i.test(reason)));
});

test("reproducibility checksums use full sha256 values", () => {
  const fixture = createFixture();
  const parsed = parseImageEmbeddingReproducibilityEvidence(fixture.evidence);
  assert.ok(parsed.evidence, parsed.reasons.join("\n"));
  assert.match(parsed.evidence.runtimeArtifacts.model.checksum, SHA);
});

test("reproducibility evidence accepts only the exact six release inputs", () => {
  const fixture = createFixture();
  const evidence = structuredClone(fixture.evidence);
  const inputs = evidence.inputs as Array<Record<string, unknown>>;
  inputs.unshift({
    path: `x/data/releases/${RELEASE}/manifest.json`,
    checksum: inputs[3]?.checksum,
  });

  const parsed = parseImageEmbeddingReproducibilityEvidence(evidence);
  assert.equal(parsed.evidence, undefined);
  assert.ok(parsed.reasons.some((reason) => /exact|required input/i.test(reason)));
});

test("reproducibility verifier executes each run-specific log contract", async () => {
  const mutations = [
    {
      id: "normal-frozen-install",
      mutate: (text: string) => text.replace(".../sharp@0.1.0/node_modules/sharp install: sharp: Integrity check passed for darwin-arm64v8\n", ""),
    },
    {
      id: "offline-frozen-install",
      mutate: (text: string) => text.replace("downloaded 0, added 4, done", "downloaded 1, added 4, done"),
    },
    {
      id: "real-provider-smoke",
      mutate: (text: string) => text.replace("ℹ skipped 0\n", ""),
    },
    {
      id: "offline-shadow-rebuild",
      mutate: (text: string) => text.replace(/^failures:.*\n/mu, ""),
    },
  ];

  for (const mutation of mutations) {
    const fixture = createFixture();
    rewriteRunLog(fixture, mutation.id, mutation.mutate);
    const result = await verifyImageEmbeddingReproducibility({
      rootDir: fixture.rootDir,
      bundlePath: fixture.bundlePath,
      modelArtifactPath: fixture.modelArtifactPath,
      sourceCacheRoot: fixture.sourceCacheRoot,
      verifyResolvedDependencies: false,
    });
    assert.equal(result.valid, false, `${mutation.id} unexpectedly passed`);
    assert.ok(result.reasons.some((reason) => reason.includes(mutation.id)), result.reasons.join("\n"));
  }
});

function configureImmutableRetention(fixture: Fixture): {
  observations: Map<string, { sizeBytes: number; checksum: `sha256:${string}` }>;
} {
  const evidence = JSON.parse(readFileSync(fixture.evidencePath, "utf8")) as Record<string, unknown>;
  const runtimeArtifacts = evidence.runtimeArtifacts as Record<string, Record<string, unknown>>;
  const outputs = evidence.outputs as Record<string, Record<string, unknown>>;
  const candidateBytes = readFileSync(fixture.candidatePath);
  const cacheArchive = "deterministic-source-cache-archive";
  const artifacts = [
    {
      kind: "model",
      uri: "https://artifacts.example.invalid/model/vision_model_quantized.onnx",
      sizeBytes: runtimeArtifacts.model?.sizeBytes,
      checksum: runtimeArtifacts.model?.checksum,
    },
    {
      kind: "source-cache",
      uri: "https://artifacts.example.invalid/source-cache/source-cache.tar",
      sizeBytes: Buffer.byteLength(cacheArchive),
      checksum: sha256(cacheArchive),
      archiveFormat: "artduo-source-cache-tar-ustar.v1",
      contentFileCount: runtimeArtifacts.sourceCache?.fileCount,
      contentAggregateChecksum: runtimeArtifacts.sourceCache?.aggregateChecksum,
    },
    {
      kind: "candidate",
      uri: "https://artifacts.example.invalid/candidate/image-embeddings-01.json",
      sizeBytes: candidateBytes.byteLength,
      checksum: outputs.candidate?.bytesChecksum,
    },
    {
      kind: "offline-report",
      uri: "https://artifacts.example.invalid/report/image-embedding-report.json",
      sizeBytes: outputs.offlineReport?.sizeBytes,
      checksum: outputs.offlineReport?.bytesChecksum,
    },
  ];
  rewriteBundle(fixture, (bundle) => {
    bundle.artifactRetention = {
      status: "immutable-storage",
      task7Ready: true,
      immutableArtifacts: artifacts,
    };
  });
  return {
    observations: new Map(artifacts.map((artifact) => [
      artifact.uri,
      { sizeBytes: artifact.sizeBytes as number, checksum: artifact.checksum as `sha256:${string}` },
    ])),
  };
}

test("Task 7 artifact readiness binds and verifies all four immutable objects", async () => {
  const fixture = createFixture();
  const { observations } = configureImmutableRetention(fixture);
  const result = await verifyImageEmbeddingReproducibility({
    rootDir: fixture.rootDir,
    bundlePath: fixture.bundlePath,
    modelArtifactPath: fixture.modelArtifactPath,
    sourceCacheRoot: fixture.sourceCacheRoot,
    verifyResolvedDependencies: false,
    verifyRemoteArtifact: async (artifact: { uri: string }) => observations.get(artifact.uri),
  });
  assert.equal(result.valid, true, result.reasons.join("\n"));
  assert.equal(result.task7ArtifactReady, true);
});

test("Task 7 artifact readiness fails closed on remote mismatch and unrelated validation failures", async () => {
  const fixture = createFixture();
  const { observations } = configureImmutableRetention(fixture);
  const candidateUri = "https://artifacts.example.invalid/candidate/image-embeddings-01.json";
  observations.set(candidateUri, { sizeBytes: 1, checksum: sha256("wrong") });

  const result = await verifyImageEmbeddingReproducibility({
    rootDir: fixture.rootDir,
    bundlePath: fixture.bundlePath,
    modelArtifactPath: fixture.modelArtifactPath,
    sourceCacheRoot: fixture.sourceCacheRoot,
    verifyResolvedDependencies: false,
    verifyRemoteArtifact: async (artifact: { uri: string }) => observations.get(artifact.uri),
  });
  assert.equal(result.valid, false);
  assert.equal(result.task7ArtifactReady, false);
  assert.ok(result.reasons.some((reason) => /remote immutable artifact/i.test(reason)));
});

test("Task 7 readiness cannot copy a true bundle flag when another verification fails", async () => {
  const fixture = createFixture();
  const { observations } = configureImmutableRetention(fixture);
  writeFileSync(fixture.candidatePath, "[]\n");

  const result = await verifyImageEmbeddingReproducibility({
    rootDir: fixture.rootDir,
    bundlePath: fixture.bundlePath,
    modelArtifactPath: fixture.modelArtifactPath,
    sourceCacheRoot: fixture.sourceCacheRoot,
    verifyResolvedDependencies: false,
    verifyRemoteArtifact: async (artifact: { uri: string }) => observations.get(artifact.uri),
  });
  assert.equal(result.valid, false);
  assert.equal(result.task7ArtifactReady, false);
  assert.ok(result.reasons.some((reason) => /candidate/i.test(reason)));
});

test("Task 7 rejects self-consistent remote metadata that is not bound to local artifacts", async () => {
  const fixture = createFixture();
  const { observations } = configureImmutableRetention(fixture);
  rewriteBundle(fixture, (bundle) => {
    const retention = bundle.artifactRetention as Record<string, unknown>;
    const artifacts = retention.immutableArtifacts as Array<Record<string, unknown>>;
    const model = artifacts[0] as Record<string, unknown>;
    model.sizeBytes = 4;
    model.checksum = sha256("fake");
    observations.set(model.uri as string, { sizeBytes: 4, checksum: sha256("fake") });
  });

  const result = await verifyImageEmbeddingReproducibility({
    rootDir: fixture.rootDir,
    bundlePath: fixture.bundlePath,
    modelArtifactPath: fixture.modelArtifactPath,
    sourceCacheRoot: fixture.sourceCacheRoot,
    verifyResolvedDependencies: false,
    verifyRemoteArtifact: async (artifact: { uri: string }) => observations.get(artifact.uri),
  });
  assert.equal(result.valid, false);
  assert.equal(result.task7ArtifactReady, false);
  assert.ok(result.reasons.some((reason) => /metadata.*local artifacts/i.test(reason)));
});

test("Task 7 artifact retention rejects duplicate kinds", async () => {
  const fixture = createFixture();
  configureImmutableRetention(fixture);
  rewriteBundle(fixture, (bundle) => {
    const retention = bundle.artifactRetention as Record<string, unknown>;
    const artifacts = retention.immutableArtifacts as Array<Record<string, unknown>>;
    artifacts.push({ ...artifacts[0], uri: "https://artifacts.example.invalid/model/duplicate.onnx" });
  });

  const result = await verifyImageEmbeddingReproducibility({
    rootDir: fixture.rootDir,
    bundlePath: fixture.bundlePath,
    modelArtifactPath: fixture.modelArtifactPath,
    sourceCacheRoot: fixture.sourceCacheRoot,
    verifyResolvedDependencies: false,
    verifyRemoteArtifact: async () => undefined,
  });
  assert.equal(result.valid, false);
  assert.equal(result.task7ArtifactReady, false);
  assert.ok(result.reasons.some((reason) => /retention|artifact/i.test(reason)));
});

test("committed schemas encode the same strict run, retention, and safe-path discriminants", () => {
  const sourceDir = path.dirname(fileURLToPath(import.meta.url));
  const evidenceSchema = JSON.parse(readFileSync(path.join(sourceDir, "image-embedding-reproducibility-evidence.schema.json"), "utf8")) as Record<string, any>;
  const bundleSchema = JSON.parse(readFileSync(path.join(sourceDir, "image-embedding-reproducibility-bundle.schema.json"), "utf8")) as Record<string, any>;
  const offlineSchema = JSON.parse(readFileSync(path.join(sourceDir, "image-embedding-offline-build-manifest.schema.json"), "utf8")) as Record<string, any>;

  assert.equal(evidenceSchema.properties.inputs.minItems, 6);
  assert.equal(evidenceSchema.properties.inputs.maxItems, 6);
  assert.equal(evidenceSchema.properties.runs.prefixItems.length, 4);
  assert.equal(evidenceSchema.$defs.normalInstallRun.properties.id.const, "normal-frozen-install");
  assert.equal(evidenceSchema.$defs.offlineBuildRun.properties.id.const, "offline-shadow-rebuild");
  assert.ok(Array.isArray(evidenceSchema.properties.promotionState.allOf));
  assert.match(evidenceSchema.$defs.fileBinding.properties.path.pattern, /\\\.\\\./u);
  assert.equal(bundleSchema.properties.artifactRetention.oneOf.length, 2);
  assert.equal(bundleSchema.properties.artifactRetention.oneOf[1].properties.immutableArtifacts.minItems, 4);
  assert.equal(bundleSchema.properties.artifactRetention.oneOf[1].properties.immutableArtifacts.maxItems, 4);
  assert.match(bundleSchema.$defs.fileBinding.properties.path.pattern, /\\\.\\\./u);
  assert.equal(offlineSchema.properties.report.required.includes("sizeBytes"), true);
});
