import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

function checksum(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function readJson(filePath, label) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    throw new TypeError(`${label} could not be read as JSON: ${filePath}`);
  }
}

function writeJsonArtifact(filePath, value) {
  const serialized = JSON.stringify(value, null, 2);
  const content = `${serialized}\n`;
  writeFileSync(filePath, content);
  return {
    checksum: checksum(serialized),
    sizeBytes: Buffer.byteLength(content),
    recordCount: Array.isArray(value) ? value.length : 1,
  };
}

function requirePromotionBinding(report) {
  const binding = report?.promotionBinding;
  if (!binding || binding.promotionReady !== true) {
    throw new TypeError("Fusion E2E fixture generation requires a Task 5 report with promotionReady=true.");
  }
  const requiredStrings = [
    "baseManifestChecksum",
    "candidateShardChecksum",
    "promotionBindingChecksum",
    "model",
    "modelRevision",
    "modelVariant",
    "modelArtifactChecksum",
    "providerVersion",
    "preprocessingFingerprint",
  ];
  if (requiredStrings.some((field) => typeof binding[field] !== "string" || !binding[field].trim())
    || !Number.isInteger(binding.visualCandidateCount)
    || binding.visualCandidateCount <= 0
    || typeof binding.recommendedVisualWeight !== "number"
    || !Number.isFinite(binding.recommendedVisualWeight)
    || typeof binding.visualCalibration?.lowerCosine !== "number"
    || typeof binding.visualCalibration?.upperCosine !== "number") {
    throw new TypeError("Fusion E2E promotion binding is incomplete.");
  }
  return binding;
}

function variantManifest(baseManifest, binding, reportChecksum, shard, shardFileName, imageShardChecksum = shard.checksum) {
  return {
    ...structuredClone(baseManifest),
    shards: {
      ...structuredClone(baseManifest.shards),
      imageEmbeddings: [{
        id: path.basename(shardFileName, ".json"),
        url: `./${shardFileName}`,
        checksum: shard.checksum,
        sizeBytes: shard.sizeBytes,
        recordCount: shard.recordCount,
      }],
    },
    imageEmbeddingSidecar: {
      schemaVersion: "image-embedding-v1",
      baseManifestChecksum: binding.baseManifestChecksum,
      promotionReportChecksum: reportChecksum,
      promotionBindingChecksum: binding.promotionBindingChecksum,
      imageShardChecksum,
      model: binding.model,
      modelRevision: binding.modelRevision,
      modelVariant: binding.modelVariant,
      modelArtifactChecksum: binding.modelArtifactChecksum,
      providerVersion: binding.providerVersion,
      preprocessingFingerprint: binding.preprocessingFingerprint,
      visualPolicy: {
        candidateCount: binding.visualCandidateCount,
        weight: binding.recommendedVisualWeight,
        lowerCosine: binding.visualCalibration.lowerCosine,
        upperCosine: binding.visualCalibration.upperCosine,
      },
    },
  };
}

export function buildImageSceneFusionFixture(input) {
  const baseManifestPath = path.resolve(input.baseManifestPath);
  const candidateShardPath = path.resolve(input.candidateShardPath);
  const promotionReportPath = path.resolve(input.promotionReportPath);
  const fixtureRoot = path.resolve(input.fixtureRoot);
  const baseManifestBytes = readFileSync(baseManifestPath);
  const promotionReportBytes = readFileSync(promotionReportPath);
  const baseManifest = readJson(baseManifestPath, "Base manifest");
  const candidate = readJson(candidateShardPath, "Image embedding candidate shard");
  const report = readJson(promotionReportPath, "Image embedding promotion report");
  const binding = requirePromotionBinding(report);
  if (!Array.isArray(candidate) || candidate.length === 0) {
    throw new TypeError("Fusion E2E candidate shard must contain records.");
  }
  if (checksum(baseManifestBytes) !== binding.baseManifestChecksum) {
    throw new TypeError("Fusion E2E base manifest checksum does not match the promotion report.");
  }
  if (checksum(JSON.stringify(candidate, null, 2)) !== binding.candidateShardChecksum) {
    throw new TypeError("Fusion E2E candidate checksum does not match the promotion report.");
  }

  cpSync(path.dirname(baseManifestPath), fixtureRoot, { recursive: true });
  mkdirSync(fixtureRoot, { recursive: true });
  const reportChecksum = checksum(promotionReportBytes);

  const validShardName = "image-embeddings-valid.json";
  const validShard = writeJsonArtifact(path.join(fixtureRoot, validShardName), candidate);
  const validManifestPath = path.join(fixtureRoot, "manifest.image-embedding-valid.json");
  writeJsonArtifact(validManifestPath, variantManifest(baseManifest, binding, reportChecksum, validShard, validShardName));

  const checksumManifestPath = path.join(fixtureRoot, "manifest.image-embedding-checksum.json");
  writeJsonArtifact(checksumManifestPath, variantManifest(
    baseManifest,
    binding,
    reportChecksum,
    validShard,
    validShardName,
    checksum("intentional-fusion-e2e-checksum-mismatch"),
  ));

  const missingEntityCandidate = candidate.filter((record, index) =>
    !(index === candidate.findIndex((entry) => entry?.entityType === "background-scene")));
  if (missingEntityCandidate.length === candidate.length) {
    throw new TypeError("Fusion E2E candidate shard does not contain a background-scene record for the missing-entity case.");
  }
  const missingEntityShardName = "image-embeddings-missing-entity.json";
  const missingEntityShard = writeJsonArtifact(path.join(fixtureRoot, missingEntityShardName), missingEntityCandidate);
  const missingEntityManifestPath = path.join(fixtureRoot, "manifest.image-embedding-missing-entity.json");
  writeJsonArtifact(missingEntityManifestPath, variantManifest(
    baseManifest,
    binding,
    reportChecksum,
    missingEntityShard,
    missingEntityShardName,
  ));

  const timeoutShardName = "image-embeddings-timeout.json";
  const timeoutShard = writeJsonArtifact(path.join(fixtureRoot, timeoutShardName), candidate);
  const timeoutManifestPath = path.join(fixtureRoot, "manifest.image-embedding-timeout.json");
  writeJsonArtifact(timeoutManifestPath, variantManifest(baseManifest, binding, reportChecksum, timeoutShard, timeoutShardName));

  return { validManifestPath, checksumManifestPath, missingEntityManifestPath, timeoutManifestPath };
}

function run() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const releaseVersion = process.env.ARTDUO_FUSION_E2E_RELEASE_VERSION ?? "2026-04-25-curation-b";
  const reportDir = path.join(repositoryRoot, "data", "curation", "reports", "image-embeddings", releaseVersion);
  const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), "artduo-image-scene-fusion-e2e-"));
  try {
    const fixture = buildImageSceneFusionFixture({
      baseManifestPath: process.env.ARTDUO_FUSION_E2E_BASE_MANIFEST
        ?? path.join(repositoryRoot, "data", "releases", releaseVersion, "manifest.json"),
      candidateShardPath: process.env.ARTDUO_FUSION_E2E_CANDIDATE_SHARD
        ?? path.join(reportDir, "candidates", "image-embeddings-01.json"),
      promotionReportPath: process.env.ARTDUO_FUSION_E2E_PROMOTION_REPORT
        ?? path.join(reportDir, "image-embedding-evaluation.json"),
      fixtureRoot,
    });
    const result = spawnSync("pnpm", ["exec", "playwright", "test", "--config=playwright.image-scene-fusion.config.ts"], {
      cwd: path.join(repositoryRoot, "apps", "web"),
      env: {
        ...process.env,
        ARTDUO_FUSION_E2E_VALID_MANIFEST: fixture.validManifestPath,
        ARTDUO_FUSION_E2E_CHECKSUM_MANIFEST: fixture.checksumManifestPath,
        ARTDUO_FUSION_E2E_MISSING_ENTITY_MANIFEST: fixture.missingEntityManifestPath,
        ARTDUO_FUSION_E2E_TIMEOUT_MANIFEST: fixture.timeoutManifestPath,
      },
      stdio: "inherit",
    });
    return typeof result.status === "number" ? result.status : 1;
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
