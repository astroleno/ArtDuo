import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { parseReleaseManifest, type ArtworkRecord } from "@artduo/contracts";

import { buildReleaseArtifact } from "./release-artifact";
import { buildCandidateRecord, loadConfirmedInputs } from "./release-ready-corpus";

const PREVIEW_UNKNOWN_ASPECT_COMPOSITION_TAGS = ["single-subject", "unknown-aspect-ratio"];

export interface CandidatePreviewOptions {
  rootDir?: string;
  candidateRoot?: string;
  outputRoot?: string;
  reportRoot?: string;
  inputPath?: string;
  previewVersion?: string;
}

type CandidatePreviewInput = {
  theme: string;
  filePath: string;
  records: ReturnType<typeof loadConfirmedInputs>[number]["records"];
};

export interface CandidatePreviewThemeReport {
  theme: string;
  inputPaths: string[];
  inputRunCount: number;
  inputCount: number;
  previewCount: number;
  duplicateCount: number;
}

export interface CandidatePreviewReport {
  previewVersion: string;
  createdAt: string;
  scope: "candidate-preview-only";
  outputDir: string;
  manifestPath: string;
  metadataPath: string;
  searchPath: string;
  mediaIndexPath: string;
  backgroundScenesPath: string;
  inputFiles: string[];
  counts: {
    inputThemeCount: number;
    inputRecordCount: number;
    duplicateCount: number;
    previewRecordCount: number;
    backgroundSceneCount: number;
  };
  themes: CandidatePreviewThemeReport[];
  notes: string[];
}

export interface CandidatePreviewBuildResult {
  outputDir: string;
  reportPath: string;
  reportMarkdownPath: string;
  report: CandidatePreviewReport;
}

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

function loadCandidateInputs(candidateRoot: string, inputPath?: string): CandidatePreviewInput[] {
  const filePaths = inputPath
    ? [path.resolve(inputPath)]
    : (() => {
        const fileNames = readdirSync(candidateRoot)
          .filter((fileName) => fileName.endsWith(".json"))
          .sort();
        return fileNames.map((fileName) => path.join(candidateRoot, fileName));
      })();
  const grouped = new Map<string, CandidatePreviewInput>();

  for (const filePath of filePaths) {
    const theme = inferThemeFromFile(filePath);
    const records = readJsonFile<CandidatePreviewInput["records"]>(filePath);
    const existing = grouped.get(theme);

    if (!existing) {
      grouped.set(theme, {
        theme,
        filePath,
        records,
      });
      continue;
    }

    existing.filePath = `${existing.filePath}::${filePath}`;
    existing.records.push(...records);
  }

  return [...grouped.values()].sort((left, right) => left.theme.localeCompare(right.theme));
}

function writeMergedCorpus(records: ArtworkRecord[], previewVersion: string): string {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "artduo-candidate-preview-"));
  const corpusPath = path.join(tempDir, `${previewVersion}.json`);
  writeJsonFile(corpusPath, records);
  return corpusPath;
}

function buildMarkdownReport(report: CandidatePreviewReport): string {
  const themeLines = report.themes.map((theme) =>
    `- ${theme.theme}: runs=${theme.inputRunCount}; input=${theme.inputCount}; preview=${theme.previewCount}; duplicates=${theme.duplicateCount}`);

  return [
    `# Candidate Preview Report: ${report.previewVersion}`,
    "",
    `- scope: \`${report.scope}\``,
    `- output dir: \`${report.outputDir}\``,
    `- manifest: \`${report.manifestPath}\``,
    `- metadata shard: \`${report.metadataPath}\``,
    `- search shard: \`${report.searchPath}\``,
    `- media index shard: \`${report.mediaIndexPath}\``,
    `- background scenes shard: \`${report.backgroundScenesPath}\``,
    "",
    "## Notes",
    "",
    ...report.notes.map((note) => `- ${note}`),
    "",
    "## Counts",
    "",
    `- themes: ${report.counts.inputThemeCount}`,
    `- input records: ${report.counts.inputRecordCount}`,
    `- duplicates removed: ${report.counts.duplicateCount}`,
    `- preview records: ${report.counts.previewRecordCount}`,
    `- background scenes: ${report.counts.backgroundSceneCount}`,
    "",
    "## Themes",
    "",
    ...themeLines,
    "",
  ].join("\n");
}

export function buildCandidatePreview(options: CandidatePreviewOptions = {}): CandidatePreviewBuildResult {
  const rootDir = resolveRootDir(options.rootDir);
  const candidateRoot = resolveCandidateRoot(rootDir, options.candidateRoot);
  const outputRoot = resolveOutputRoot(rootDir, options.outputRoot);
  const reportRoot = resolveReportRoot(rootDir, options.reportRoot);
  const previewVersion = options.previewVersion ?? `${new Date().toISOString().slice(0, 10)}-candidate-preview`;

  ensureDir(outputRoot);
  ensureDir(reportRoot);

  const inputs = loadCandidateInputs(candidateRoot, options.inputPath);
  const seen = new Set<string>();
  let duplicateCount = 0;

  const themes = inputs.map((input) => {
    let previewCount = 0;
    let themeDuplicateCount = 0;

    for (const candidateRecord of input.records) {
      const key = `${candidateRecord.source || "met"}:${candidateRecord.sourceArtworkId || candidateRecord.id || "unknown"}`;
      if (seen.has(key)) {
        duplicateCount += 1;
        themeDuplicateCount += 1;
        continue;
      }

      seen.add(key);
      previewCount += 1;
    }

    return {
      theme: input.theme,
      inputPaths: input.filePath.split("::"),
      inputRunCount: input.filePath.split("::").length,
      inputCount: input.records.length,
      previewCount,
      duplicateCount: themeDuplicateCount,
    };
  });

  seen.clear();
  const mergedRecords = inputs.flatMap((input) =>
    input.records.flatMap((candidateRecord) => {
      const key = `${candidateRecord.source || "met"}:${candidateRecord.sourceArtworkId || candidateRecord.id || "unknown"}`;
      if (seen.has(key)) {
        return [];
      }

      seen.add(key);
      return [buildCandidateRecord(candidateRecord, input.theme, previewVersion, {
        unknownAspectCompositionTags: PREVIEW_UNKNOWN_ASPECT_COMPOSITION_TAGS,
      }).record];
    }),
  );

  const corpusPath = writeMergedCorpus(mergedRecords, previewVersion);
  const artifact = buildReleaseArtifact({
    rootDir,
    outputRoot,
    corpusPath,
    corpusVersion: previewVersion,
    backgroundCatalogVersion: previewVersion,
  });

  parseReleaseManifest(artifact.manifest);

  const report: CandidatePreviewReport = {
    previewVersion,
    createdAt: new Date().toISOString(),
    scope: "candidate-preview-only",
    outputDir: artifact.outputDir,
    manifestPath: artifact.manifestPath,
    metadataPath: artifact.metadataPath,
    searchPath: artifact.searchPath,
    mediaIndexPath: artifact.mediaIndexPath,
    backgroundScenesPath: artifact.backgroundScenesPath,
    inputFiles: inputs.flatMap((input) => input.filePath.split("::")),
    counts: {
      inputThemeCount: inputs.length,
      inputRecordCount: inputs.reduce((sum, input) => sum + input.records.length, 0),
      duplicateCount,
      previewRecordCount: artifact.records.artworks.length,
      backgroundSceneCount: artifact.records.backgroundScenes.length,
    },
    themes,
    notes: [
      "This preview consumes candidate-pool artifacts for quantity-oriented browsing and retrieval exploration.",
      "It is not review-cleared, not theme-gate-cleared, and must not be treated as release-ready.",
    ],
  };

  const reportPath = path.join(reportRoot, `candidate-preview-${previewVersion}.json`);
  const reportMarkdownPath = path.join(reportRoot, `candidate-preview-${previewVersion}.md`);
  writeJsonFile(reportPath, report);
  writeFileSync(reportMarkdownPath, `${buildMarkdownReport(report)}\n`);

  return {
    outputDir: artifact.outputDir,
    reportPath,
    reportMarkdownPath,
    report,
  };
}
