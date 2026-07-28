import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

import { cosineSimilarity, loadReleaseManifest } from "@artduo/corpus";
import {
  assertImageSceneScoreCardinality,
  IMAGE_SCENE_SCORE_CARDINALITY_LIMITS,
  IMAGE_SCENE_SCORE_UPPER_BOUND,
  parseImageEmbeddingShardRecords,
  type ImageEmbeddingShardRecord,
  type ShardInfo,
} from "@artduo/contracts";

import {
  buildImageEmbeddingReviewPack,
  evaluateImageEmbeddingHumanReview,
  evaluateImageEmbeddingWeakLabels,
  renderImageEmbeddingReviewerView,
  scoreFrozenBackgroundSceneWeakLabel,
  validateImageEmbeddingMachineReviewPack,
  type ImageEmbeddingEvaluationArtwork,
  type ImageEmbeddingEvaluationScene,
  type ImageEmbeddingHumanReviewEvaluation,
  type ImageEmbeddingMachineReviewPack,
  type ImageEmbeddingWeakLabelEvaluation,
} from "./image-embedding-evaluation";
import {
  validateImageEmbeddingA2aEvidence,
  validateImageEmbeddingE2eEvidence,
  validateImageEmbeddingFusionE2eEvidence,
  validateImageEmbeddingTextBenchmarkEvidence,
  type ImageEmbeddingEvidenceContext,
  type ImageEmbeddingEvidenceValidation,
} from "./image-embedding-promotion-evidence";
import { readImageEmbeddingEvaluationOptions } from "./cli";

const EVALUATION_VERSION = "image-embedding-evaluation.v1";
const VISUAL_CANDIDATE_COUNT = 12;
const VISUAL_WEIGHT_CANDIDATES = [0.05, 0.1, 0.15, 0.2, 0.3] as const;
export const FROZEN_METADATA_SCORE_UPPER_BOUND = IMAGE_SCENE_SCORE_UPPER_BOUND;

export interface ImageEmbeddingEvaluationOptions {
  rootDir?: string;
  releasesRoot?: string;
  releaseVersion?: string;
  manifestPath?: string;
  candidateShardPath?: string;
  buildReportPath?: string;
  promotionAnchorPath?: string;
  outputPath?: string;
  reviewPackPath?: string;
  reviewVerdictsPath?: string;
  emitReviewPack?: boolean;
  reviewerViewOutputPath?: string;
  fusionE2eReportPath?: string;
  textBenchmarkBaselinePath?: string;
  a2aBaselinePath?: string;
  e2eBaselinePath?: string;
  /** Internal test seam; the CLI always derives this value from the selected Git checkout. */
  expectedEvidenceCommitSha?: string;
}

export interface ImageEmbeddingPromotionBinding {
  releaseVersion: string;
  evaluationVersion: string;
  baseManifestChecksum: string;
  promotionAnchorSetChecksum: string;
  buildReportChecksum: string;
  candidateShardChecksum: string;
  reviewPackChecksum: string;
  reviewVerdictsChecksum: string;
  textBenchmarkBaselineChecksum: string;
  a2aBaselineChecksum: string;
  e2eBaselineChecksum: string;
  fusionE2eReportChecksum?: string;
  promotionBindingChecksum: string;
  model: string;
  modelRevision: string;
  modelVariant: string;
  modelArtifactChecksum: string;
  providerVersion: string;
  preprocessingFingerprint: string;
  visualCandidateCount: number;
  recommendedVisualWeight: number;
  visualCalibration: {
    lowerCosine: number;
    upperCosine: number;
  };
  promotionReady: boolean;
  fusionVerificationReady: boolean;
}

interface ImageEmbeddingBuildReportBinding {
  releaseVersion: string;
  baseManifestChecksum: string;
  promotionAnchorSetChecksum: string;
  model: string;
  modelRevision: string;
  modelVariant: string;
  modelArtifactChecksum: string;
  providerVersion: string;
  preprocessingFingerprint: string;
  gates: { coverageReady: boolean };
  candidateShard: ShardInfo;
}

interface EvaluationArtwork extends ImageEmbeddingEvaluationArtwork {
  imageUrl?: string;
  caption: string;
}

interface EvaluationScene extends ImageEmbeddingEvaluationScene {
  imageUrl?: string;
}

interface VisualCalibration {
  lowerCosine: number;
  upperCosine: number;
}

interface RankedScene {
  scene: EvaluationScene;
  metadataScore: number;
  finalScore: number;
}

interface FusedSceneRanking {
  baseline?: RankedScene;
  ranked: RankedScene[];
  visualApplied: boolean;
}

interface VisualPolicySelection {
  recommendedVisualWeight: number;
  visualCalibration: VisualCalibration;
  trainSampleCount: number;
  selectionReady: boolean;
}

export interface ImageEmbeddingEvaluationReport {
  schemaVersion: "image-embedding-evaluation-report.v1";
  releaseVersion: string;
  evaluationVersion: string;
  generatedAt: string;
  weakLabels: ImageEmbeddingWeakLabelEvaluation;
  visualPolicySelection: VisualPolicySelection;
  reviewPack?: ImageEmbeddingMachineReviewPack;
  humanReview: ImageEmbeddingHumanReviewEvaluation;
  baselineBindings: {
    textBenchmarkBaselineChecksum: string;
    a2aBaselineChecksum: string;
    e2eBaselineChecksum: string;
    fusionE2eReportChecksum?: string;
    textBenchmarkBaselineValid: boolean;
    a2aBaselineValid: boolean;
    e2eBaselineValid: boolean;
    fusionE2eReportValid?: boolean;
  };
  gates: {
    bindingIntegrity: boolean;
    bindingFailures: string[];
    buildCoverageReady: boolean;
    artworkHoldoutReady: boolean;
    sceneHoldoutReady: boolean;
    reviewPackReady: boolean;
    humanReviewReady: boolean;
    baselineBindingsReady: boolean;
    fusionE2eReady: boolean;
    visualPolicySelectionReady: boolean;
  };
  promotionBinding: ImageEmbeddingPromotionBinding;
}

export interface ImageEmbeddingEvaluationResult {
  reportPath: string;
  report: ImageEmbeddingEvaluationReport;
  reviewPackPath?: string;
  reviewerViewOutputPath?: string;
}

function sha256Checksum(value: Uint8Array | string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalJson(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical JSON does not permit non-finite numbers.");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  throw new TypeError("Canonical JSON only permits JSON values.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`${label}: expected object.`);
  }
  return value;
}

function expectString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${label}: expected non-empty string.`);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new TypeError(`${label}: expected string array.`);
  }
  return value;
}

function optionalStringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? value
    : [];
}

function scoreBoundedStringArray(value: unknown, label: string, maximum: number): string[] {
  const values = stringArray(value, label);
  assertImageSceneScoreCardinality(values, maximum, label);
  return values;
}

function optionalScoreBoundedStringArray(value: unknown, label: string, maximum: number): string[] {
  const values = optionalStringArray(value);
  assertImageSceneScoreCardinality(values, maximum, label);
  return values;
}

function expectNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label}: expected finite number.`);
  }
  return value;
}

function isInside(parentPath: string, childPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function resolveRootDir(rootDir?: string): string {
  return rootDir ? path.resolve(rootDir) : path.resolve(process.cwd(), "../..");
}

function resolveEvidenceCommitSha(rootDir: string, expectedCommitSha?: string): string | undefined {
  const explicit = expectedCommitSha?.trim();
  if (explicit) {
    if (!/^[a-f0-9]{40}$/u.test(explicit)) {
      throw new TypeError("Expected evidence commit SHA must be a full lowercase SHA-1.");
    }
    return explicit;
  }
  try {
    const commitSha = execFileSync("git", ["-C", rootDir, "rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return /^[a-f0-9]{40}$/u.test(commitSha) ? commitSha : undefined;
  } catch {
    return undefined;
  }
}

function resolveReportDirectory(rootDir: string, releaseVersion: string): string {
  return path.join(rootDir, "data", "curation", "reports", "image-embeddings", releaseVersion);
}

function resolveSafeReleaseShardPath(releaseDir: string, shard: ShardInfo): string {
  if (!shard.url.startsWith("./") || shard.url.includes("\\")) {
    throw new TypeError(`Release shard ${shard.id} has an unsafe URL.`);
  }
  const shardPath = path.resolve(releaseDir, shard.url);
  if (!isInside(releaseDir, shardPath)) {
    throw new TypeError(`Release shard ${shard.id} escapes the release directory.`);
  }
  return shardPath;
}

function readValidatedShardArray(releaseDir: string, shard: ShardInfo): unknown[] {
  const shardPath = resolveSafeReleaseShardPath(releaseDir, shard);
  const bytes = readFileSync(shardPath);
  if (bytes.byteLength !== shard.sizeBytes) {
    throw new TypeError(`Release shard ${shard.id} size does not match its manifest binding.`);
  }
  const parsed = JSON.parse(bytes.toString("utf8")) as unknown;
  if (!Array.isArray(parsed) || parsed.length !== shard.recordCount) {
    throw new TypeError(`Release shard ${shard.id} does not match its record-count binding.`);
  }
  if (sha256Checksum(JSON.stringify(parsed, null, 2)) !== shard.checksum) {
    throw new TypeError(`Release shard ${shard.id} checksum does not match its manifest binding.`);
  }
  return parsed;
}

function indexById(records: unknown[], label: string): Map<string, Record<string, unknown>> {
  const indexed = new Map<string, Record<string, unknown>>();
  for (const [index, value] of records.entries()) {
    const record = expectRecord(value, `${label}[${index}]`);
    const id = expectString(record.id, `${label}[${index}].id`);
    if (indexed.has(id)) {
      throw new TypeError(`${label}: duplicate id ${id}.`);
    }
    indexed.set(id, record);
  }
  return indexed;
}

function parseBaseInputs(input: {
  releaseDir: string;
  manifest: ReturnType<typeof loadReleaseManifest>["manifest"];
}): { artworks: EvaluationArtwork[]; scenes: EvaluationScene[] } {
  const metadata = indexById(input.manifest.shards.metadata.flatMap((shard) =>
    readValidatedShardArray(input.releaseDir, shard)), "metadata");
  const search = indexById(input.manifest.shards.search.flatMap((shard) =>
    readValidatedShardArray(input.releaseDir, shard)), "search");
  const media = indexById(input.manifest.shards.mediaIndex.flatMap((shard) =>
    readValidatedShardArray(input.releaseDir, shard)), "media");
  const scenes = input.manifest.shards.backgroundScenes.flatMap((shard) =>
    readValidatedShardArray(input.releaseDir, shard).map((value, index) => {
      const record = expectRecord(value, `background-scenes:${shard.id}[${index}]`);
      const asset = expectRecord(record.asset, `background-scenes:${shard.id}[${index}].asset`);
      const visualProfile = expectRecord(record.visual_profile, `background-scenes:${shard.id}[${index}].visual_profile`);
      const curationProfile = expectRecord(record.curation_profile, `background-scenes:${shard.id}[${index}].curation_profile`);
      return {
        id: expectString(record.id, `background-scenes:${shard.id}[${index}].id`),
        emotionIds: scoreBoundedStringArray(
          curationProfile.emotion_ids,
          `background-scenes:${shard.id}[${index}].curation_profile.emotion_ids`,
          IMAGE_SCENE_SCORE_CARDINALITY_LIMITS.sceneEmotionIds,
        ),
        artworkPaletteModes: optionalScoreBoundedStringArray(
          curationProfile.artwork_palette_modes,
          `background-scenes:${shard.id}[${index}].curation_profile.artwork_palette_modes`,
          IMAGE_SCENE_SCORE_CARDINALITY_LIMITS.sceneArtworkPaletteModes,
        ),
        sceneType: optionalString(visualProfile.scene_type),
        palette: scoreBoundedStringArray(
          visualProfile.palette,
          `background-scenes:${shard.id}[${index}].visual_profile.palette`,
          IMAGE_SCENE_SCORE_CARDINALITY_LIMITS.scenePalette,
        ),
        imageUrl: optionalString(asset.local_public_path),
      } satisfies EvaluationScene;
    }));
  const sceneIds = new Set<string>();
  for (const scene of scenes) {
    if (sceneIds.has(scene.id)) {
      throw new TypeError(`background-scenes: duplicate id ${scene.id}.`);
    }
    sceneIds.add(scene.id);
  }

  const artworks = [...metadata.entries()].map(([id, record]) => {
    const metadataValue = expectRecord(record.metadata, `metadata:${id}.metadata`);
    const presentation = expectRecord(record.presentation, `metadata:${id}.presentation`);
    const affinity = isRecord(presentation.sceneAffinity) ? presentation.sceneAffinity : {};
    const searchRecord = search.get(id);
    const retrieval = searchRecord && isRecord(searchRecord.retrieval) ? searchRecord.retrieval : {};
    const mediaRecord = media.get(id);
    const mediaValue = mediaRecord && isRecord(mediaRecord.media) ? mediaRecord.media : {};
    return {
      id,
      department: optionalString(metadataValue.department),
      moodTags: scoreBoundedStringArray(
        metadataValue.moodTags,
        `metadata:${id}.metadata.moodTags`,
        IMAGE_SCENE_SCORE_CARDINALITY_LIMITS.artworkMoodTags,
      ),
      colorTags: scoreBoundedStringArray(
        metadataValue.colorTags,
        `metadata:${id}.metadata.colorTags`,
        IMAGE_SCENE_SCORE_CARDINALITY_LIMITS.artworkColorTags,
      ),
      compositionTags: stringArray(metadataValue.compositionTags, `metadata:${id}.metadata.compositionTags`),
      subjectTags: stringArray(metadataValue.subjectTags, `metadata:${id}.metadata.subjectTags`),
      aspectRatioHint: optionalString(mediaValue.aspectRatioHint),
      emotionLabels: optionalScoreBoundedStringArray(
        retrieval.emotionLabels,
        `search:${id}.retrieval.emotionLabels`,
        IMAGE_SCENE_SCORE_CARDINALITY_LIMITS.artworkEmotionLabels,
      ),
      sceneAffinity: {
        paletteModes: optionalScoreBoundedStringArray(
          affinity.paletteModes,
          `metadata:${id}.presentation.sceneAffinity.paletteModes`,
          IMAGE_SCENE_SCORE_CARDINALITY_LIMITS.artworkPaletteModes,
        ),
        sceneTypes: optionalScoreBoundedStringArray(
          affinity.sceneTypes,
          `metadata:${id}.presentation.sceneAffinity.sceneTypes`,
          IMAGE_SCENE_SCORE_CARDINALITY_LIMITS.artworkSceneTypes,
        ),
      },
      caption: expectString(metadataValue.title, `metadata:${id}.metadata.title`),
      imageUrl: optionalString(mediaValue.imageUrlPreview)
        ?? optionalString(mediaValue.baseImageUrl)
        ?? optionalString(mediaValue.imageUrlFull),
    } satisfies EvaluationArtwork;
  }).sort((left, right) => left.id.localeCompare(right.id));

  return { artworks, scenes: scenes.sort((left, right) => left.id.localeCompare(right.id)) };
}

function readJsonFile(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
}

function parseBuildReport(value: unknown): ImageEmbeddingBuildReportBinding {
  const report = expectRecord(value, "Image embedding build report");
  const candidateShard = expectRecord(report.candidateShard, "Image embedding build report.candidateShard");
  const gates = expectRecord(report.gates, "Image embedding build report.gates");
  return {
    releaseVersion: expectString(report.releaseVersion, "Image embedding build report.releaseVersion"),
    baseManifestChecksum: expectString(report.baseManifestChecksum, "Image embedding build report.baseManifestChecksum"),
    promotionAnchorSetChecksum: expectString(report.promotionAnchorSetChecksum, "Image embedding build report.promotionAnchorSetChecksum"),
    model: expectString(report.model, "Image embedding build report.model"),
    modelRevision: expectString(report.modelRevision, "Image embedding build report.modelRevision"),
    modelVariant: expectString(report.modelVariant, "Image embedding build report.modelVariant"),
    modelArtifactChecksum: expectString(report.modelArtifactChecksum, "Image embedding build report.modelArtifactChecksum"),
    providerVersion: expectString(report.providerVersion, "Image embedding build report.providerVersion"),
    preprocessingFingerprint: expectString(report.preprocessingFingerprint, "Image embedding build report.preprocessingFingerprint"),
    gates: { coverageReady: gates.coverageReady === true },
    candidateShard: {
      id: expectString(candidateShard.id, "Image embedding build report.candidateShard.id"),
      url: expectString(candidateShard.url, "Image embedding build report.candidateShard.url"),
      checksum: expectString(candidateShard.checksum, "Image embedding build report.candidateShard.checksum"),
      sizeBytes: expectNumber(candidateShard.sizeBytes, "Image embedding build report.candidateShard.sizeBytes"),
      recordCount: expectNumber(candidateShard.recordCount, "Image embedding build report.candidateShard.recordCount"),
    },
  };
}

function readCandidateRecords(candidateShardPath: string): {
  records: ImageEmbeddingShardRecord[];
  checksum: string;
  sizeBytes: number;
} {
  const bytes = readFileSync(candidateShardPath);
  const parsed = JSON.parse(bytes.toString("utf8")) as unknown;
  const records = parseImageEmbeddingShardRecords(parsed, candidateShardPath);
  return {
    records,
    checksum: sha256Checksum(JSON.stringify(records, null, 2)),
    sizeBytes: bytes.byteLength,
  };
}

function comparable(left: ImageEmbeddingShardRecord, right: ImageEmbeddingShardRecord): boolean {
  return left.dimensions === right.dimensions
    && left.model === right.model
    && left.modelRevision === right.modelRevision
    && left.modelVariant === right.modelVariant
    && left.modelArtifactChecksum === right.modelArtifactChecksum
    && left.preprocessingFingerprint === right.preprocessingFingerprint;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function normalizeMetadataScore(score: number): number {
  return clamp01(score / FROZEN_METADATA_SCORE_UPPER_BOUND);
}

function metadataRanking(artwork: EvaluationArtwork, scenes: EvaluationScene[]): Array<{ scene: EvaluationScene; metadataScore: number }> {
  return scenes.map((scene) => ({
    scene,
    metadataScore: scoreFrozenBackgroundSceneWeakLabel(artwork, scene),
  })).sort((left, right) => right.metadataScore - left.metadataScore || left.scene.id.localeCompare(right.scene.id));
}

function quantile(values: number[], fraction: number): number {
  if (values.length === 0) {
    return 0;
  }
  const index = Math.max(0, Math.min(values.length - 1, Math.floor((values.length - 1) * fraction)));
  return values[index] ?? 0;
}

function chooseVisualCalibration(
  artworks: EvaluationArtwork[],
  scenes: EvaluationScene[],
  trainArtworkIds: string[],
  recordsByArtworkId: Map<string, ImageEmbeddingShardRecord>,
  recordsBySceneId: Map<string, ImageEmbeddingShardRecord>,
): { calibration: VisualCalibration; sampleCount: number } {
  const trainIds = new Set(trainArtworkIds);
  const values: number[] = [];
  for (const artwork of artworks) {
    if (!trainIds.has(artwork.id)) {
      continue;
    }
    const artworkRecord = recordsByArtworkId.get(artwork.id);
    if (!artworkRecord) {
      continue;
    }
    const window = metadataRanking(artwork, scenes).slice(0, VISUAL_CANDIDATE_COUNT);
    if (window.length === 0 || window.some(({ scene }) => {
      const sceneRecord = recordsBySceneId.get(scene.id);
      return !sceneRecord || !comparable(artworkRecord, sceneRecord);
    })) {
      continue;
    }
    for (const { scene } of window) {
      const sceneRecord = recordsBySceneId.get(scene.id);
      if (sceneRecord) {
        values.push(cosineSimilarity(artworkRecord.vector, sceneRecord.vector));
      }
    }
  }
  values.sort((left, right) => left - right);
  const lowerCosine = quantile(values, 0.05);
  const upperCosine = quantile(values, 0.95);
  return {
    calibration: upperCosine > lowerCosine
      ? { lowerCosine, upperCosine }
      : { lowerCosine: -1, upperCosine: 1 },
    sampleCount: values.length,
  };
}

function rankFusedScenes(input: {
  artwork: EvaluationArtwork;
  scenes: EvaluationScene[];
  recordsByArtworkId: Map<string, ImageEmbeddingShardRecord>;
  recordsBySceneId: Map<string, ImageEmbeddingShardRecord>;
  visualWeight: number;
  calibration: VisualCalibration;
}): FusedSceneRanking {
  const metadata = metadataRanking(input.artwork, input.scenes);
  const baseline = metadata[0];
  const artworkRecord = input.recordsByArtworkId.get(input.artwork.id);
  const window = metadata.slice(0, VISUAL_CANDIDATE_COUNT);
  if (!baseline || !artworkRecord || window.length === 0 || window.some(({ scene }) => {
    const sceneRecord = input.recordsBySceneId.get(scene.id);
    return !sceneRecord || !comparable(artworkRecord, sceneRecord);
  })) {
    return {
      baseline: baseline && {
        scene: baseline.scene,
        metadataScore: baseline.metadataScore,
        finalScore: normalizeMetadataScore(baseline.metadataScore),
      },
      ranked: metadata.map((entry) => ({
        scene: entry.scene,
        metadataScore: entry.metadataScore,
        finalScore: normalizeMetadataScore(entry.metadataScore),
      })),
      visualApplied: false,
    };
  }

  return {
    baseline: {
      scene: baseline.scene,
      metadataScore: baseline.metadataScore,
      finalScore: normalizeMetadataScore(baseline.metadataScore),
    },
    ranked: window.map(({ scene, metadataScore }) => {
      const sceneRecord = input.recordsBySceneId.get(scene.id);
      const cosine = sceneRecord ? cosineSimilarity(artworkRecord.vector, sceneRecord.vector) : 0;
      const visualScore = clamp01((cosine - input.calibration.lowerCosine)
        / (input.calibration.upperCosine - input.calibration.lowerCosine));
      return {
        scene,
        metadataScore,
        finalScore: normalizeMetadataScore(metadataScore) * (1 - input.visualWeight) + visualScore * input.visualWeight,
      };
    }).sort((left, right) => right.finalScore - left.finalScore || left.scene.id.localeCompare(right.scene.id)),
    visualApplied: true,
  };
}

function chooseVisualPolicy(input: {
  artworks: EvaluationArtwork[];
  scenes: EvaluationScene[];
  trainArtworkIds: string[];
  recordsByArtworkId: Map<string, ImageEmbeddingShardRecord>;
  recordsBySceneId: Map<string, ImageEmbeddingShardRecord>;
}): VisualPolicySelection {
  const calibration = chooseVisualCalibration(
    input.artworks,
    input.scenes,
    input.trainArtworkIds,
    input.recordsByArtworkId,
    input.recordsBySceneId,
  );
  const trainIds = new Set(input.trainArtworkIds);
  const candidates = VISUAL_WEIGHT_CANDIDATES.map((weight) => {
    let hits = 0;
    let count = 0;
    for (const artwork of input.artworks) {
      if (!trainIds.has(artwork.id)) {
        continue;
      }
      const ranking = rankFusedScenes({
        artwork,
        scenes: input.scenes,
        recordsByArtworkId: input.recordsByArtworkId,
        recordsBySceneId: input.recordsBySceneId,
        visualWeight: weight,
        calibration: calibration.calibration,
      });
      if (!ranking.visualApplied || !ranking.baseline) {
        continue;
      }
      count += 1;
      if (ranking.ranked.slice(0, 3).some((entry) => entry.scene.id === ranking.baseline?.scene.id)) {
        hits += 1;
      }
    }
    return { weight, count, hitRate: count > 0 ? hits / count : 0 };
  }).sort((left, right) => right.hitRate - left.hitRate || left.weight - right.weight);
  const selected = candidates[0] ?? { weight: 0.05, count: 0, hitRate: 0 };
  return {
    recommendedVisualWeight: selected.weight,
    visualCalibration: calibration.calibration,
    trainSampleCount: selected.count,
    selectionReady: selected.count > 0 && calibration.sampleCount > 0,
  };
}

function stratumForArtwork(artwork: EvaluationArtwork): string {
  return `${moodForArtwork(artwork)}|${departmentForArtwork(artwork)}`;
}

function moodForArtwork(artwork: EvaluationArtwork): string {
  return artwork.moodTags.find((value) => value.trim())?.trim().toLowerCase() ?? "unknown";
}

function departmentForArtwork(artwork: EvaluationArtwork): string {
  return artwork.department?.trim().toLowerCase() || "unknown";
}

function readMachineReviewPack(value: unknown): ImageEmbeddingMachineReviewPack {
  const pack = expectRecord(value, "Machine review pack");
  if (!Array.isArray(pack.comparisons)) {
    throw new TypeError("Machine review pack.comparisons: expected array.");
  }
  return pack as unknown as ImageEmbeddingMachineReviewPack;
}

interface ValidatedEvidenceFile {
  provided: boolean;
  checksum: string;
  validation: ImageEmbeddingEvidenceValidation;
}

function missingEvidence(): ValidatedEvidenceFile {
  return {
    provided: false,
    checksum: "missing",
    validation: { valid: false, reasons: [] },
  };
}

function readValidatedEvidence(
  filePath: string | undefined,
  context: ImageEmbeddingEvidenceContext,
  label: string,
  validator: (value: unknown, validationContext: ImageEmbeddingEvidenceContext) => ImageEmbeddingEvidenceValidation,
): ValidatedEvidenceFile {
  if (!filePath) {
    return missingEvidence();
  }
  try {
    const bytes = readFileSync(filePath);
    const checksum = sha256Checksum(bytes);
    const value = JSON.parse(bytes.toString("utf8")) as unknown;
    return {
      provided: true,
      checksum,
      validation: validator(value, context),
    };
  } catch {
    return {
      provided: true,
      checksum: "missing",
      validation: { valid: false, reasons: [`${label} evidence could not be read as JSON.`] },
    };
  }
}

function recordEvidenceFailures(
  evidence: ValidatedEvidenceFile,
  bindingFailures: string[],
): void {
  if (evidence.provided && !evidence.validation.valid) {
    bindingFailures.push(...evidence.validation.reasons);
  }
}

function writeJsonAtomically(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
    renameSync(temporaryPath, filePath);
  } catch (error) {
    try {
      unlinkSync(temporaryPath);
    } catch {
      // Nothing was written or the temporary file has already moved.
    }
    throw error;
  }
}

function invalidatedHumanReview(
  evaluation: ImageEmbeddingHumanReviewEvaluation,
  reason: string,
): ImageEmbeddingHumanReviewEvaluation {
  return {
    ...evaluation,
    valid: false,
    humanReviewComplete: false,
    reasons: [...evaluation.reasons, reason],
  };
}

export async function runImageEmbeddingEvaluation(
  options: ImageEmbeddingEvaluationOptions,
): Promise<ImageEmbeddingEvaluationResult> {
  if (!options.outputPath) {
    throw new TypeError("Image embedding evaluation requires an explicit --output path.");
  }
  if (!options.candidateShardPath || !options.buildReportPath) {
    throw new TypeError("Image embedding evaluation requires --candidate-shard and --build-report.");
  }

  const rootDir = resolveRootDir(options.rootDir);
  const loaded = loadReleaseManifest({
    rootDir,
    releasesRoot: options.releasesRoot,
    releaseVersion: options.releaseVersion,
    manifestPath: options.manifestPath,
  });
  const releaseVersion = options.releaseVersion ?? loaded.releaseVersion;
  if (releaseVersion !== loaded.releaseVersion || loaded.manifest.release.corpusVersion !== releaseVersion) {
    throw new TypeError("Selected release version does not match the base manifest.");
  }
  const reportDirectory = resolveReportDirectory(rootDir, releaseVersion);
  const evidenceCommitSha = resolveEvidenceCommitSha(rootDir, options.expectedEvidenceCommitSha);
  const outputPath = path.resolve(options.outputPath);
  if (isInside(loaded.releaseDir, outputPath)) {
    throw new TypeError("Image embedding evaluation output must remain outside the base release directory.");
  }

  const candidateShardPath = path.resolve(options.candidateShardPath);
  const buildReportPath = path.resolve(options.buildReportPath);
  const promotionAnchorPath = options.promotionAnchorPath
    ? path.resolve(options.promotionAnchorPath)
    : path.join(reportDirectory, "promotion-anchor-set.json");
  const baseManifestChecksum = sha256Checksum(readFileSync(loaded.manifestPath));
  const promotionAnchorSetChecksum = sha256Checksum(readFileSync(promotionAnchorPath));
  const candidate = readCandidateRecords(candidateShardPath);
  const buildReportBytes = readFileSync(buildReportPath);
  const buildReportChecksum = sha256Checksum(buildReportBytes);
  const buildReport = parseBuildReport(JSON.parse(buildReportBytes.toString("utf8")) as unknown);
  const bindingFailures: string[] = [];

  if (buildReport.releaseVersion !== releaseVersion) {
    bindingFailures.push("Build report releaseVersion does not match the selected release.");
  }
  if (buildReport.baseManifestChecksum !== baseManifestChecksum) {
    bindingFailures.push("Build report base manifest checksum does not match.");
  }
  if (buildReport.promotionAnchorSetChecksum !== promotionAnchorSetChecksum) {
    bindingFailures.push("Build report promotion anchor checksum does not match.");
  }
  if (buildReport.candidateShard.checksum !== candidate.checksum) {
    bindingFailures.push("Build report candidate shard checksum does not match.");
  }
  if (buildReport.candidateShard.sizeBytes !== candidate.sizeBytes || buildReport.candidateShard.recordCount !== candidate.records.length) {
    bindingFailures.push("Build report candidate shard size or record count does not match.");
  }
  for (const record of candidate.records) {
    if (record.releaseVersion !== releaseVersion) {
      bindingFailures.push("Candidate shard contains a record from a different release.");
      break;
    }
    if (
      record.model !== buildReport.model
      || record.modelRevision !== buildReport.modelRevision
      || record.modelVariant !== buildReport.modelVariant
      || record.modelArtifactChecksum !== buildReport.modelArtifactChecksum
      || record.providerVersion !== buildReport.providerVersion
      || record.preprocessingFingerprint !== buildReport.preprocessingFingerprint
    ) {
      bindingFailures.push("Candidate shard model provenance does not match the build report.");
      break;
    }
  }

  const base = parseBaseInputs({ releaseDir: loaded.releaseDir, manifest: loaded.manifest });
  const artworkRecordsById = new Map(candidate.records
    .filter((record) => record.entityType === "artwork")
    .map((record) => [record.entityId, record]));
  const sceneRecordsById = new Map(candidate.records
    .filter((record) => record.entityType === "background-scene")
    .map((record) => [record.entityId, record]));
  const weakLabels = evaluateImageEmbeddingWeakLabels({
    releaseVersion,
    evaluationVersion: EVALUATION_VERSION,
    artworks: base.artworks,
    scenes: base.scenes,
    records: candidate.records,
  });
  const visualPolicySelection = chooseVisualPolicy({
    artworks: base.artworks,
    scenes: base.scenes,
    trainArtworkIds: weakLabels.trainArtworkIds,
    recordsByArtworkId: artworkRecordsById,
    recordsBySceneId: sceneRecordsById,
  });
  const reviewInputs = base.artworks.flatMap((artwork) => {
    const ranking = rankFusedScenes({
      artwork,
      scenes: base.scenes,
      recordsByArtworkId: artworkRecordsById,
      recordsBySceneId: sceneRecordsById,
      visualWeight: visualPolicySelection.recommendedVisualWeight,
      calibration: visualPolicySelection.visualCalibration,
    });
    const baseline = ranking.baseline;
    const candidateScene = ranking.ranked[0];
    const baselineRecord = baseline ? sceneRecordsById.get(baseline.scene.id) : undefined;
    const candidateRecord = candidateScene ? sceneRecordsById.get(candidateScene.scene.id) : undefined;
    if (
      !baseline
      || !candidateScene
      || baseline.scene.id === candidateScene.scene.id
      || !baselineRecord
      || !candidateRecord
      || !artwork.imageUrl
      || !baseline.scene.imageUrl
      || !candidateScene.scene.imageUrl
    ) {
      return [];
    }
    return [{
      artworkId: artwork.id,
      stratum: stratumForArtwork(artwork),
      mood: moodForArtwork(artwork),
      department: departmentForArtwork(artwork),
      artworkCaption: artwork.caption,
      artworkImageUrl: artwork.imageUrl,
      baseline: {
        sceneId: baseline.scene.id,
        score: baseline.finalScore,
        fingerprint: baselineRecord.source.fingerprint,
        imageUrl: baseline.scene.imageUrl,
      },
      candidate: {
        sceneId: candidateScene.scene.id,
        score: candidateScene.finalScore,
        fingerprint: candidateRecord.source.fingerprint,
        imageUrl: candidateScene.scene.imageUrl,
      },
    }];
  });
  const generatedReviewPack = buildImageEmbeddingReviewPack({
    releaseVersion,
    evaluationVersion: EVALUATION_VERSION,
    candidateShardChecksum: candidate.checksum,
    comparisons: reviewInputs,
  });
  const reviewPackPath = options.reviewPackPath
    ? path.resolve(options.reviewPackPath)
    : path.join(reportDirectory, "image-embedding-review-pack.json");
  const reviewPack = options.reviewPackPath && !options.emitReviewPack
    ? readMachineReviewPack(readJsonFile(reviewPackPath))
    : generatedReviewPack.pack;
  const reviewPackValidationError = validateImageEmbeddingMachineReviewPack(reviewPack);
  if (reviewPackValidationError) {
    bindingFailures.push(`Review pack is malformed: ${reviewPackValidationError}`);
  }
  if (
    reviewPack.releaseVersion !== releaseVersion
    || reviewPack.evaluationVersion !== EVALUATION_VERSION
    || reviewPack.candidateShardChecksum !== candidate.checksum
  ) {
    bindingFailures.push("Review pack does not bind to the selected release, evaluation version, and candidate shard.");
  }
  const reviewPackMatchesGenerated = reviewPack.reviewPackChecksum === generatedReviewPack.pack.reviewPackChecksum;
  if (!reviewPackMatchesGenerated) {
    bindingFailures.push("Review pack does not match this run's deterministic comparison set.");
  }
  if (options.emitReviewPack) {
    if (isInside(loaded.releaseDir, reviewPackPath)) {
      throw new TypeError("Review pack must remain outside the base release directory.");
    }
    writeJsonAtomically(reviewPackPath, reviewPack);
  }
  const reviewerViewOutputPath = options.reviewerViewOutputPath
    ? path.resolve(options.reviewerViewOutputPath)
    : undefined;
  if (reviewerViewOutputPath) {
    if (isInside(loaded.releaseDir, reviewerViewOutputPath)) {
      throw new TypeError("Reviewer view must remain outside the base release directory.");
    }
    mkdirSync(path.dirname(reviewerViewOutputPath), { recursive: true });
    writeFileSync(reviewerViewOutputPath, renderImageEmbeddingReviewerView(reviewPack));
  }

  const verdictSidecar = options.reviewVerdictsPath
    ? readJsonFile(path.resolve(options.reviewVerdictsPath))
    : undefined;
  let humanReview = evaluateImageEmbeddingHumanReview(reviewPack, verdictSidecar);
  if (bindingFailures.length > 0) {
    humanReview = invalidatedHumanReview(humanReview, "Evaluation input bindings are invalid.");
  }

  const evidenceContext: ImageEmbeddingEvidenceContext = {
    releaseVersion,
    baseManifestChecksum,
    commitSha: evidenceCommitSha,
  };
  const textBenchmarkEvidence = readValidatedEvidence(
    options.textBenchmarkBaselinePath,
    evidenceContext,
    "Text benchmark",
    validateImageEmbeddingTextBenchmarkEvidence,
  );
  const a2aEvidence = readValidatedEvidence(
    options.a2aBaselinePath,
    evidenceContext,
    "A2A",
    validateImageEmbeddingA2aEvidence,
  );
  const e2eEvidence = readValidatedEvidence(
    options.e2eBaselinePath,
    evidenceContext,
    "E2E",
    validateImageEmbeddingE2eEvidence,
  );
  recordEvidenceFailures(textBenchmarkEvidence, bindingFailures);
  recordEvidenceFailures(a2aEvidence, bindingFailures);
  recordEvidenceFailures(e2eEvidence, bindingFailures);
  const textBenchmarkBaselineChecksum = textBenchmarkEvidence.checksum;
  const a2aBaselineChecksum = a2aEvidence.checksum;
  const e2eBaselineChecksum = e2eEvidence.checksum;
  const artworkHoldout = weakLabels.artworkPairwise.holdout;
  const sceneHoldout = weakLabels.sceneTop3.holdout;
  const artworkHoldoutReady = weakLabels.holdoutReadiness.artworkPairwise.minimumSampleMet
    && weakLabels.holdoutReadiness.artworkPairwise.allMajorStrataSufficient
    && artworkHoldout.pairwiseAccuracy >= 0.8
    && artworkHoldout.confidenceInterval.lower >= 0.7;
  const sceneHoldoutReady = weakLabels.holdoutReadiness.sceneTop3.minimumSampleMet
    && weakLabels.holdoutReadiness.sceneTop3.allMajorStrataSufficient
    && sceneHoldout.hitRate >= 0.7
    && sceneHoldout.confidenceInterval.lower >= 0.6;
  const reviewPackReady = generatedReviewPack.minimumSampleMet
    && reviewPackMatchesGenerated
    && !reviewPackValidationError
    && reviewPack.comparisons.length >= 30;
  const humanReviewReady = humanReview.valid
    && humanReview.humanReviewComplete
    && humanReview.completedCount >= 30
    && humanReview.uncertainRate <= 0.1
    && humanReview.candidateAcceptableRate >= 0.8
    && humanReview.candidateRegressionRate <= 0.1;
  const baselineBindingsReady = textBenchmarkEvidence.validation.valid
    && a2aEvidence.validation.valid
    && e2eEvidence.validation.valid;
  const bindingIntegrity = bindingFailures.length === 0;
  const promotionReady = bindingIntegrity
    && buildReport.gates.coverageReady
    && artworkHoldoutReady
    && sceneHoldoutReady
    && reviewPackReady
    && humanReviewReady
    && baselineBindingsReady
    && visualPolicySelection.selectionReady;
  const reviewVerdictsChecksum = humanReview.reviewVerdictsChecksum ?? "missing";
  const promotionBindingPayload = {
    releaseVersion,
    evaluationVersion: EVALUATION_VERSION,
    baseManifestChecksum,
    promotionAnchorSetChecksum,
    buildReportChecksum,
    candidateShardChecksum: candidate.checksum,
    reviewPackChecksum: reviewPack.reviewPackChecksum,
    reviewVerdictsChecksum,
    textBenchmarkBaselineChecksum,
    a2aBaselineChecksum,
    e2eBaselineChecksum,
    model: buildReport.model,
    modelRevision: buildReport.modelRevision,
    modelVariant: buildReport.modelVariant,
    modelArtifactChecksum: buildReport.modelArtifactChecksum,
    providerVersion: buildReport.providerVersion,
    preprocessingFingerprint: buildReport.preprocessingFingerprint,
    visualCandidateCount: VISUAL_CANDIDATE_COUNT,
    recommendedVisualWeight: visualPolicySelection.recommendedVisualWeight,
    visualCalibration: visualPolicySelection.visualCalibration,
    gateEvidence: {
      bindingIntegrity,
      buildCoverageReady: buildReport.gates.coverageReady,
      artworkHoldout: {
        count: weakLabels.holdoutReadiness.artworkPairwise.uniqueArtworkCount,
        pointEstimate: artworkHoldout.pairwiseAccuracy,
        lowerConfidence: artworkHoldout.confidenceInterval.lower,
        allStrataSufficient: weakLabels.holdoutReadiness.artworkPairwise.allStrataSufficient,
      },
      sceneHoldout: {
        count: weakLabels.holdoutReadiness.sceneTop3.uniqueArtworkCount,
        pointEstimate: sceneHoldout.hitRate,
        lowerConfidence: sceneHoldout.confidenceInterval.lower,
        allStrataSufficient: weakLabels.holdoutReadiness.sceneTop3.allStrataSufficient,
      },
      humanReview: {
        valid: humanReview.valid,
        complete: humanReview.humanReviewComplete,
        completedCount: humanReview.completedCount,
        uncertainRate: humanReview.uncertainRate,
        candidateAcceptableRate: humanReview.candidateAcceptableRate,
        candidateRegressionRate: humanReview.candidateRegressionRate,
      },
      baselineBindingsReady,
      visualPolicySelectionReady: visualPolicySelection.selectionReady,
    },
  };
  const promotionBindingChecksum = sha256Checksum(canonicalJson(promotionBindingPayload));
  const fusionEvidenceContext: ImageEmbeddingEvidenceContext & { promotionBindingChecksum: string } = {
    ...evidenceContext,
    promotionBindingChecksum,
  };
  const fusionE2eEvidence = options.fusionE2eReportPath
    ? readValidatedEvidence(
      options.fusionE2eReportPath,
      fusionEvidenceContext,
      "Fusion E2E",
      (value) => validateImageEmbeddingFusionE2eEvidence(value, fusionEvidenceContext),
    )
    : undefined;
  const fusionE2eReportChecksum = fusionE2eEvidence?.checksum;
  const fusionE2eReady = fusionE2eEvidence?.validation.valid === true;
  const fusionVerificationReady = promotionReady && fusionE2eReady;
  const promotionBinding: ImageEmbeddingPromotionBinding = {
    releaseVersion,
    evaluationVersion: EVALUATION_VERSION,
    baseManifestChecksum,
    promotionAnchorSetChecksum,
    buildReportChecksum,
    candidateShardChecksum: candidate.checksum,
    reviewPackChecksum: reviewPack.reviewPackChecksum,
    reviewVerdictsChecksum,
    textBenchmarkBaselineChecksum,
    a2aBaselineChecksum,
    e2eBaselineChecksum,
    fusionE2eReportChecksum,
    promotionBindingChecksum,
    model: buildReport.model,
    modelRevision: buildReport.modelRevision,
    modelVariant: buildReport.modelVariant,
    modelArtifactChecksum: buildReport.modelArtifactChecksum,
    providerVersion: buildReport.providerVersion,
    preprocessingFingerprint: buildReport.preprocessingFingerprint,
    visualCandidateCount: VISUAL_CANDIDATE_COUNT,
    recommendedVisualWeight: visualPolicySelection.recommendedVisualWeight,
    visualCalibration: visualPolicySelection.visualCalibration,
    promotionReady,
    fusionVerificationReady,
  };
  const report: ImageEmbeddingEvaluationReport = {
    schemaVersion: "image-embedding-evaluation-report.v1",
    releaseVersion,
    evaluationVersion: EVALUATION_VERSION,
    generatedAt: new Date().toISOString(),
    weakLabels,
    visualPolicySelection,
    reviewPack,
    humanReview,
    baselineBindings: {
      textBenchmarkBaselineChecksum,
      a2aBaselineChecksum,
      e2eBaselineChecksum,
      fusionE2eReportChecksum,
      textBenchmarkBaselineValid: textBenchmarkEvidence.validation.valid,
      a2aBaselineValid: a2aEvidence.validation.valid,
      e2eBaselineValid: e2eEvidence.validation.valid,
      fusionE2eReportValid: fusionE2eEvidence?.validation.valid,
    },
    gates: {
      bindingIntegrity,
      bindingFailures,
      buildCoverageReady: buildReport.gates.coverageReady,
      artworkHoldoutReady,
      sceneHoldoutReady,
      reviewPackReady,
      humanReviewReady,
      baselineBindingsReady,
      fusionE2eReady,
      visualPolicySelectionReady: visualPolicySelection.selectionReady,
    },
    promotionBinding,
  };
  writeJsonAtomically(outputPath, report);

  return {
    reportPath: outputPath,
    report,
    reviewPackPath: options.emitReviewPack ? reviewPackPath : undefined,
    reviewerViewOutputPath,
  };
}

async function main(): Promise<void> {
  const result = await runImageEmbeddingEvaluation(readImageEmbeddingEvaluationOptions());
  console.log(JSON.stringify({
    releaseVersion: result.report.releaseVersion,
    reportPath: result.reportPath,
    reviewPackPath: result.reviewPackPath,
    reviewerViewOutputPath: result.reviewerViewOutputPath,
    promotionReady: result.report.promotionBinding.promotionReady,
    fusionVerificationReady: result.report.promotionBinding.fusionVerificationReady,
  }, null, 2));
}

if (process.argv[1]?.endsWith("run-image-embedding-evaluation.ts")) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
