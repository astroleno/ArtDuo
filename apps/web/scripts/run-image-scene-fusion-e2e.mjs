import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isImageEmbeddingPromotionGateReady } from "@artduo/contracts";

function checksum(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalJson(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Fusion E2E promotion binding contains a non-finite number.");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  throw new TypeError("Fusion E2E promotion binding is not canonical JSON.");
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
  const payload = report?.promotionBindingPayload;
  if (!binding || !payload || typeof payload !== "object" || Array.isArray(payload)
    || binding.promotionReady !== true) {
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
  const computedChecksum = checksum(canonicalJson(payload));
  if (binding.promotionBindingChecksum !== computedChecksum) {
    throw new TypeError("Fusion E2E promotion binding checksum does not match its canonical Task 5 payload.");
  }
  if (!isImageEmbeddingPromotionGateReady(payload.gateEvidence)) {
    throw new TypeError("Fusion E2E promotionReady=true does not match the canonical Task 5 gates.");
  }
  if (report.schemaVersion !== "image-embedding-evaluation-report.v1"
    || report.releaseVersion !== payload.releaseVersion
    || binding.fusionVerificationReady !== false) {
    throw new TypeError("Fusion E2E promotion report is not a Task 5 decision artifact.");
  }
  for (const field of [
    "releaseVersion",
    "baseManifestChecksum",
    "candidateShardChecksum",
    "model",
    "modelRevision",
    "modelVariant",
    "modelArtifactChecksum",
    "providerVersion",
    "preprocessingFingerprint",
    "visualCandidateCount",
    "recommendedVisualWeight",
  ]) {
    if (binding[field] !== payload[field]) {
      throw new TypeError(`Fusion E2E promotion binding field ${field} does not match its canonical payload.`);
    }
  }
  if (binding.visualCalibration?.lowerCosine !== payload.visualCalibration?.lowerCosine
    || binding.visualCalibration?.upperCosine !== payload.visualCalibration?.upperCosine) {
    throw new TypeError("Fusion E2E promotion binding calibration does not match its canonical payload.");
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
  const reportChecksum = checksum(promotionReportBytes);
  const observedBinding = {
    releaseVersion: report.releaseVersion,
    baseManifestChecksum: checksum(baseManifestBytes),
    candidateShardChecksum: checksum(JSON.stringify(candidate, null, 2)),
    promotionReportChecksum: reportChecksum,
    promotionBindingChecksum: binding.promotionBindingChecksum,
  };
  if (!input.expectedBinding
    || Object.keys(observedBinding).some((field) => input.expectedBinding[field] !== observedBinding[field])) {
    throw new TypeError("Fusion E2E inputs do not match the producer-locked Task 5 inputs.");
  }
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

function requiredEnvironment(name, absolutePath = false) {
  const value = process.env[name]?.trim();
  if (!value || (absolutePath && !path.isAbsolute(value))) {
    throw new TypeError(`${name} is required${absolutePath ? " as an absolute path" : ""} from the promotion evidence producer.`);
  }
  return value;
}

function run() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const expectedBinding = {
    releaseVersion: requiredEnvironment("ARTDUO_FUSION_E2E_LOCKED_RELEASE_VERSION"),
    baseManifestChecksum: requiredEnvironment("ARTDUO_FUSION_E2E_LOCKED_BASE_MANIFEST_CHECKSUM"),
    candidateShardChecksum: requiredEnvironment("ARTDUO_FUSION_E2E_LOCKED_CANDIDATE_SHARD_CHECKSUM"),
    promotionReportChecksum: requiredEnvironment("ARTDUO_FUSION_E2E_LOCKED_PROMOTION_REPORT_CHECKSUM"),
    promotionBindingChecksum: requiredEnvironment("ARTDUO_FUSION_E2E_LOCKED_PROMOTION_BINDING_CHECKSUM"),
  };
  const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), "artduo-image-scene-fusion-e2e-"));
  try {
    const fixture = buildImageSceneFusionFixture({
      baseManifestPath: requiredEnvironment("ARTDUO_FUSION_E2E_LOCKED_BASE_MANIFEST", true),
      candidateShardPath: requiredEnvironment("ARTDUO_FUSION_E2E_LOCKED_CANDIDATE_SHARD", true),
      promotionReportPath: requiredEnvironment("ARTDUO_FUSION_E2E_LOCKED_PROMOTION_REPORT", true),
      expectedBinding,
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
