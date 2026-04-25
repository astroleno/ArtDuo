import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { parseArtworkRecords, parseReleaseManifest, type ArtworkRecord } from "@artduo/contracts";

import { buildReleaseArtifact } from "./release-artifact";

export interface MetadataBackfillPreviewOptions {
  rootDir?: string;
  metadataBackfillRoot?: string;
  outputRoot?: string;
  reportRoot?: string;
  inputPath?: string;
  previewVersion?: string;
}

type PreviewInput = {
  theme: string;
  filePath: string;
  records: ArtworkRecord[];
};

type MetadataBackfillContext = {
  theme?: string;
  matchedPercent?: number;
  themeGateBlockers?: string[];
  portfolioGateBlockers?: string[];
};

type MetadataBackfillReport = {
  coverageContexts?: MetadataBackfillContext[];
};

export interface MetadataBackfillPreviewThemeReport {
  theme: string;
  inputPath: string;
  recordCount: number;
  matchedPercent?: number;
  themeGateBlockers: string[];
  portfolioGateBlockers: string[];
}

export interface MetadataBackfillPreviewReport {
  previewVersion: string;
  createdAt: string;
  scope: "preview-only";
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
    previewRecordCount: number;
    backgroundSceneCount: number;
  };
  themes: MetadataBackfillPreviewThemeReport[];
  notes: string[];
}

export interface MetadataBackfillPreviewBuildResult {
  outputDir: string;
  reportPath: string;
  reportMarkdownPath: string;
  report: MetadataBackfillPreviewReport;
}

function resolveRootDir(rootDir?: string): string {
  return rootDir ? path.resolve(rootDir) : path.resolve(process.cwd(), "../..");
}

function resolveMetadataBackfillRoot(rootDir: string, metadataBackfillRoot?: string): string {
  return metadataBackfillRoot
    ? path.resolve(metadataBackfillRoot)
    : path.join(rootDir, "data", "curation", "metadata-backfill");
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

function loadPreviewInputs(metadataBackfillRoot: string, inputPath?: string): PreviewInput[] {
  const filePaths = inputPath
    ? [path.resolve(inputPath)]
    : (() => {
        const latestByTheme = new Map<string, string>();
        const fileNames = readdirSync(metadataBackfillRoot)
          .filter((fileName) => fileName.endsWith(".json"))
          .sort();

        for (const fileName of fileNames) {
          latestByTheme.set(inferThemeFromFile(fileName), path.join(metadataBackfillRoot, fileName));
        }

        return [...latestByTheme.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([, filePath]) => filePath);
      })();

  return filePaths.map((filePath) => ({
    theme: inferThemeFromFile(filePath),
    filePath,
    records: parseArtworkRecords(readJsonFile<unknown>(filePath), filePath),
  }));
}

function readThemeContext(reportRoot: string, input: PreviewInput): MetadataBackfillContext {
  const reportPath = path.join(
    reportRoot,
    `metadata-backfill-${path.basename(input.filePath, path.extname(input.filePath))}.json`,
  );

  try {
    const report = readJsonFile<MetadataBackfillReport>(reportPath);
    return report.coverageContexts?.find((context) => context.theme === input.theme) ?? {};
  } catch {
    return {};
  }
}

function buildMarkdownReport(report: MetadataBackfillPreviewReport): string {
  const themeLines = report.themes.map((theme) => {
    const matchedPercent = typeof theme.matchedPercent === "number" ? `${theme.matchedPercent}%` : "n/a";
    const themeGate = theme.themeGateBlockers.length > 0 ? theme.themeGateBlockers.join(", ") : "none";
    const portfolioGate = theme.portfolioGateBlockers.length > 0 ? theme.portfolioGateBlockers.join(", ") : "none";

    return `- ${theme.theme}: records=${theme.recordCount}; matchedPercent=${matchedPercent}; themeGate=${themeGate}; portfolioGate=${portfolioGate}`;
  });

  return [
    `# Metadata Preview Report: ${report.previewVersion}`,
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
    `- preview records: ${report.counts.previewRecordCount}`,
    `- background scenes: ${report.counts.backgroundSceneCount}`,
    "",
    "## Themes",
    "",
    ...themeLines,
    "",
  ].join("\n");
}

function writeMergedCorpus(records: ArtworkRecord[], previewVersion: string): string {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "artduo-metadata-preview-"));
  const corpusPath = path.join(tempDir, `${previewVersion}.json`);
  writeJsonFile(corpusPath, records);
  return corpusPath;
}

export function buildMetadataBackfillPreview(
  options: MetadataBackfillPreviewOptions = {},
): MetadataBackfillPreviewBuildResult {
  const rootDir = resolveRootDir(options.rootDir);
  const metadataBackfillRoot = resolveMetadataBackfillRoot(rootDir, options.metadataBackfillRoot);
  const outputRoot = resolveOutputRoot(rootDir, options.outputRoot);
  const reportRoot = resolveReportRoot(rootDir, options.reportRoot);
  const previewVersion = options.previewVersion ?? `${new Date().toISOString().slice(0, 10)}-metadata-preview`;

  ensureDir(outputRoot);
  ensureDir(reportRoot);

  const inputs = loadPreviewInputs(metadataBackfillRoot, options.inputPath);
  const mergedRecords = inputs.flatMap((input) => input.records);
  const corpusPath = writeMergedCorpus(mergedRecords, previewVersion);
  const artifact = buildReleaseArtifact({
    rootDir,
    outputRoot,
    corpusPath,
    corpusVersion: previewVersion,
    backgroundCatalogVersion: previewVersion,
  });

  parseReleaseManifest(artifact.manifest);

  const themes = inputs.map((input) => {
    const context = readThemeContext(reportRoot, input);

    return {
      theme: input.theme,
      inputPath: input.filePath,
      recordCount: input.records.length,
      matchedPercent: context.matchedPercent,
      themeGateBlockers: context.themeGateBlockers ?? [],
      portfolioGateBlockers: context.portfolioGateBlockers ?? [],
    };
  });

  const report: MetadataBackfillPreviewReport = {
    previewVersion,
    createdAt: new Date().toISOString(),
    scope: "preview-only",
    outputDir: artifact.outputDir,
    manifestPath: artifact.manifestPath,
    metadataPath: artifact.metadataPath,
    searchPath: artifact.searchPath,
    mediaIndexPath: artifact.mediaIndexPath,
    backgroundScenesPath: artifact.backgroundScenesPath,
    inputFiles: inputs.map((input) => input.filePath),
    counts: {
      inputThemeCount: inputs.length,
      inputRecordCount: mergedRecords.length,
      previewRecordCount: artifact.records.artworks.length,
      backgroundSceneCount: artifact.records.backgroundScenes.length,
    },
    themes,
    notes: [
      "This preview consumes metadata-backfill artifacts and writes preview-only shards for retrieval, copy, and downstream exploration.",
      "It does not promote any theme to release-ready and does not clear theme or portfolio gates.",
    ],
  };

  const reportPath = path.join(reportRoot, `metadata-preview-${previewVersion}.json`);
  const reportMarkdownPath = path.join(reportRoot, `metadata-preview-${previewVersion}.md`);
  writeJsonFile(reportPath, report);
  writeFileSync(reportMarkdownPath, `${buildMarkdownReport(report)}\n`);

  return {
    outputDir: artifact.outputDir,
    reportPath,
    reportMarkdownPath,
    report,
  };
}
