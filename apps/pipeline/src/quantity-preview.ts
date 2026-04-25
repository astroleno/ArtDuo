import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { parseReleaseManifest, type ArtworkRecord } from "@artduo/contracts";

import { buildReleaseArtifact, loadArtworkRecords } from "./release-artifact";
import { buildCandidateRecord } from "./release-ready-corpus";

const DEFAULT_TARGET_COUNT = 500;
const PREVIEW_UNKNOWN_ASPECT_COMPOSITION_TAGS = ["single-subject", "unknown-aspect-ratio"];
const DEFAULT_LEGACY_EMOTIONS = [
  "wonder",
  "mystery",
  "contemplation",
  "serenity",
  "optimism",
  "regret",
  "despair",
  "desolation",
];

type CandidatePoolRecord = {
  sourceArtworkId?: string | null;
  id?: string | null;
  source?: string | null;
};

export interface QuantityPreviewOptions {
  rootDir?: string;
  candidateRoot?: string;
  outputRoot?: string;
  reportRoot?: string;
  previewVersion?: string;
  targetCount?: number;
}

export interface QuantityPreviewReport {
  previewVersion: string;
  createdAt: string;
  scope: "quantity-preview-only";
  outputDir: string;
  manifestPath: string;
  metadataPath: string;
  searchPath: string;
  mediaIndexPath: string;
  backgroundScenesPath: string;
  provenancePath: string;
  candidateInputFiles: string[];
  counts: {
    targetCount: number;
    candidateUniqueCount: number;
    legacyBoostCount: number;
    legacyFallbackCount: number;
    finalPreviewCount: number;
    backgroundSceneCount: number;
  };
  legacyBoost: {
    emotionIds: string[];
  };
  notes: string[];
}

export interface QuantityPreviewBuildResult {
  outputDir: string;
  reportPath: string;
  reportMarkdownPath: string;
  report: QuantityPreviewReport;
}

type QuantityPreviewProvenanceRecord = {
  id: string;
  source: string;
  sourceArtworkId: string;
  previewSource: "candidate-pool" | "legacy-boost" | "legacy-fallback";
  inputTheme?: string;
  candidateInputPath?: string;
  matchedLegacyEmotionIds?: string[];
};

function resolveRootDir(rootDir?: string): string {
  return rootDir ? path.resolve(rootDir) : path.resolve(process.cwd(), "../..");
}

function resolveCandidateRoot(rootDir: string, candidateRoot?: string): string {
  return candidateRoot ? path.resolve(candidateRoot) : path.join(rootDir, "data", "curation", "candidate-pool");
}

function resolveOutputRoot(rootDir: string, outputRoot?: string): string {
  return outputRoot ? path.resolve(outputRoot) : path.join(rootDir, "data", "curation", "preview");
}

function resolveReportRoot(rootDir: string, reportRoot?: string): string {
  return reportRoot ? path.resolve(reportRoot) : path.join(rootDir, "data", "curation", "reports");
}

function ensureDir(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true });
}

function writeJsonFile(filePath: string, data: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function inferThemeFromFile(filePath: string): string {
  const basename = path.basename(filePath, path.extname(filePath));
  return basename.split("--")[0] || "curated";
}

function writeMergedCorpus(records: ArtworkRecord[], previewVersion: string): string {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "artduo-quantity-preview-"));
  const corpusPath = path.join(tempDir, `${previewVersion}.json`);
  writeJsonFile(corpusPath, records);
  return corpusPath;
}

function buildMarkdownReport(report: QuantityPreviewReport): string {
  return [
    `# Quantity Preview Report: ${report.previewVersion}`,
    "",
    `- scope: \`${report.scope}\``,
    `- output dir: \`${report.outputDir}\``,
    `- manifest: \`${report.manifestPath}\``,
    `- metadata shard: \`${report.metadataPath}\``,
    `- search shard: \`${report.searchPath}\``,
    `- media index shard: \`${report.mediaIndexPath}\``,
    `- background scenes shard: \`${report.backgroundScenesPath}\``,
    `- provenance sidecar: \`${report.provenancePath}\``,
    "",
    "## Notes",
    "",
    ...report.notes.map((note) => `- ${note}`),
    "",
    "## Counts",
    "",
    `- target count: ${report.counts.targetCount}`,
    `- candidate unique count: ${report.counts.candidateUniqueCount}`,
    `- legacy boost count: ${report.counts.legacyBoostCount}`,
    `- legacy fallback count: ${report.counts.legacyFallbackCount}`,
    `- final preview count: ${report.counts.finalPreviewCount}`,
    `- background scenes: ${report.counts.backgroundSceneCount}`,
    "",
    "## Legacy Boost",
    "",
    `- emotion ids: ${report.legacyBoost.emotionIds.join(", ")}`,
    "",
  ].join("\n");
}

function normalizeEmotionTokens(record: ArtworkRecord): string[] {
  return [
    ...(record.retrieval.emotionLabels ?? []),
    ...(record.metadata.moodTags ?? []),
  ]
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean);
}

function buildRecordKey(record: Pick<ArtworkRecord, "source" | "sourceArtworkId">): string {
  return `${record.source}:${record.sourceArtworkId}`;
}

export function buildQuantityPreview(options: QuantityPreviewOptions = {}): QuantityPreviewBuildResult {
  const rootDir = resolveRootDir(options.rootDir);
  const candidateRoot = resolveCandidateRoot(rootDir, options.candidateRoot);
  const outputRoot = resolveOutputRoot(rootDir, options.outputRoot);
  const reportRoot = resolveReportRoot(rootDir, options.reportRoot);
  const previewVersion = options.previewVersion ?? `${new Date().toISOString().slice(0, 10)}-quantity-preview`;
  const targetCount = options.targetCount ?? DEFAULT_TARGET_COUNT;

  ensureDir(outputRoot);
  ensureDir(reportRoot);

  const candidateFiles = readdirSync(candidateRoot)
    .filter((fileName) => fileName.endsWith(".json"))
    .sort()
    .map((fileName) => path.join(candidateRoot, fileName));

  const seen = new Set<string>();
  const candidateRecords: ArtworkRecord[] = [];
  const provenanceRecords: QuantityPreviewProvenanceRecord[] = [];

  for (const filePath of candidateFiles) {
    const theme = inferThemeFromFile(filePath);
    const records = readJsonFile<CandidatePoolRecord[]>(filePath);

    for (const candidateRecord of records) {
      const key = `${candidateRecord.source || "met"}:${candidateRecord.sourceArtworkId || candidateRecord.id || "unknown"}`;
      if (seen.has(key)) {
        continue;
      }

      const previewRecord = buildCandidateRecord(candidateRecord, theme, previewVersion, {
        unknownAspectCompositionTags: PREVIEW_UNKNOWN_ASPECT_COMPOSITION_TAGS,
      }).record;

      seen.add(key);
      candidateRecords.push(previewRecord);
      provenanceRecords.push({
        id: previewRecord.id,
        source: previewRecord.source,
        sourceArtworkId: previewRecord.sourceArtworkId,
        previewSource: "candidate-pool",
        inputTheme: theme,
        candidateInputPath: filePath,
      });
    }
  }

  const legacyEmotionSet = new Set(DEFAULT_LEGACY_EMOTIONS);
  const allLegacyRecords = loadArtworkRecords(rootDir, previewVersion);
  const legacyBoostRecords: ArtworkRecord[] = [];
  const legacyFallbackRecords: ArtworkRecord[] = [];

  for (const record of allLegacyRecords) {
    const key = buildRecordKey(record);
    if (seen.has(key)) {
      continue;
    }

    const remaining = targetCount - (candidateRecords.length + legacyBoostRecords.length + legacyFallbackRecords.length);
    if (remaining <= 0) {
      break;
    }

    const matchesLegacyEmotion = normalizeEmotionTokens(record).some((token) => legacyEmotionSet.has(token));
    if (matchesLegacyEmotion) {
      seen.add(key);
      legacyBoostRecords.push(record);
      provenanceRecords.push({
        id: record.id,
        source: record.source,
        sourceArtworkId: record.sourceArtworkId,
        previewSource: "legacy-boost",
        matchedLegacyEmotionIds: [...new Set(normalizeEmotionTokens(record).filter((token) => legacyEmotionSet.has(token)))],
      });
    }
  }

  for (const record of allLegacyRecords) {
    const key = buildRecordKey(record);
    if (seen.has(key)) {
      continue;
    }

    const remaining = targetCount - (candidateRecords.length + legacyBoostRecords.length + legacyFallbackRecords.length);
    if (remaining <= 0) {
      break;
    }

    seen.add(key);
    legacyFallbackRecords.push(record);
    provenanceRecords.push({
      id: record.id,
      source: record.source,
      sourceArtworkId: record.sourceArtworkId,
      previewSource: "legacy-fallback",
    });
  }

  const mergedRecords = [...candidateRecords, ...legacyBoostRecords, ...legacyFallbackRecords];
  const corpusPath = writeMergedCorpus(mergedRecords, previewVersion);
  const artifact = buildReleaseArtifact({
    rootDir,
    outputRoot,
    corpusPath,
    corpusVersion: previewVersion,
    backgroundCatalogVersion: previewVersion,
  });

  parseReleaseManifest(artifact.manifest);

  const provenancePath = path.join(artifact.outputDir, "provenance-01.json");
  writeJsonFile(provenancePath, provenanceRecords);

  const report: QuantityPreviewReport = {
    previewVersion,
    createdAt: new Date().toISOString(),
    scope: "quantity-preview-only",
    outputDir: artifact.outputDir,
    manifestPath: artifact.manifestPath,
    metadataPath: artifact.metadataPath,
    searchPath: artifact.searchPath,
    mediaIndexPath: artifact.mediaIndexPath,
    backgroundScenesPath: artifact.backgroundScenesPath,
    provenancePath,
    candidateInputFiles: candidateFiles,
    counts: {
      targetCount,
      candidateUniqueCount: candidateRecords.length,
      legacyBoostCount: legacyBoostRecords.length,
      legacyFallbackCount: legacyFallbackRecords.length,
      finalPreviewCount: artifact.records.artworks.length,
      backgroundSceneCount: artifact.records.backgroundScenes.length,
    },
    legacyBoost: {
      emotionIds: DEFAULT_LEGACY_EMOTIONS,
    },
    notes: [
      "This preview is quantity-oriented. It merges current candidate-pool records with a clearly separated legacy Met boost to reach the requested pool size.",
      "It is not review-cleared, not gate-cleared, and must not be treated as release-ready.",
    ],
  };

  const reportPath = path.join(reportRoot, `quantity-preview-${previewVersion}.json`);
  const reportMarkdownPath = path.join(reportRoot, `quantity-preview-${previewVersion}.md`);
  writeJsonFile(reportPath, report);
  writeFileSync(reportMarkdownPath, `${buildMarkdownReport(report)}\n`);

  return {
    outputDir: artifact.outputDir,
    reportPath,
    reportMarkdownPath,
    report,
  };
}
