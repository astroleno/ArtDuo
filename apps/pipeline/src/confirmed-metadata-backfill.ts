import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ArtworkRecord, BackgroundSceneRecord } from "@artduo/contracts";
import { parseArtworkRecords } from "@artduo/contracts";

import type { ImageProbe, OrientationCoverage, SceneCoverageSummary } from "./curation-coverage";
import { enrichArtworkForCuration, summarizeSceneCoverage } from "./curation-coverage";
import { loadBackgroundScenes } from "./release-artifact";
import { buildCandidateRecord, loadConfirmedInputs } from "./release-ready-corpus";

export interface ConfirmedMetadataBackfillOptions {
  rootDir?: string;
  confirmedRoot?: string;
  outputRoot?: string;
  reportRoot?: string;
  inputPath?: string;
  corpusVersion?: string;
  imageProbe?: ImageProbe;
  backgroundScenes?: BackgroundSceneRecord[];
  sceneMatchThreshold?: number;
}

export interface MetadataBackfillCoverageContext {
  theme: string;
  confirmedPath: string;
  reviewRunId?: string;
  coveragePath?: string;
  matchedCount?: number;
  matchedPercent?: number;
  orientationCoverage?: OrientationCoverage;
  themeGateBlockers: string[];
  portfolioGateBlockers: string[];
}

export interface MetadataBackfillReport {
  corpusVersion: string;
  createdAt: string;
  scope: "metadata-backfill-only";
  outputPath: string;
  inputFiles: string[];
  notes: string[];
  counts: {
    confirmedCount: number;
    backfilledCount: number;
    contractValidatedCount: number;
  };
  themes: Record<string, { confirmed: number; backfilled: number }>;
  backfillCounts: {
    description: number;
    storySnippet: number;
    searchText: number;
    moodTags: number;
    colorTags: number;
    aspectRatioHint: number;
    sceneAffinity: number;
  };
  coverageContexts: MetadataBackfillCoverageContext[];
}

export interface MetadataBackfillBuildResult {
  outputPath: string;
  reportPath: string;
  reportMarkdownPath: string;
  report: MetadataBackfillReport;
}

type CoverageTriggers = {
  confirmedBelowThirty?: boolean;
  sceneMatchBelowSixty?: boolean;
  orientationCoverageBelowTarget?: boolean;
  sourceConcentrationAboveSeventy?: boolean;
};

type CoverageReport = {
  runId?: string;
  theme?: string;
  gateThresholds?: {
    confirmedMin?: number;
    orientationMinPercent?: number;
    sceneMatchMinPercent?: number;
    sourceConcentrationMaxPercent?: number;
  };
  sourceCoverage?: Record<string, {
    reviewed?: number;
    reviewedPercent?: number;
    promote?: number;
    hold?: number;
    reject?: number;
  }>;
  sourceConcentration?: {
    dominantSource?: string;
    dominantPercent?: number;
    note?: string;
  };
  emotionCoverage?: Record<string, {
    reviewed?: number;
    promote?: number;
    hold?: number;
    reject?: number;
  }>;
  orientationCoverage?: OrientationCoverage & {
    note?: string;
  };
  estimatedGradeDistribution?: {
    A?: number;
    B?: number;
    C?: number;
  };
  estimatedSceneMatch?: {
    matchedCount?: number;
    matchedPercent?: number;
    note?: string;
    sampledMatches?: Array<{
      sourceArtworkId: string;
      sceneId: string;
      score: number;
      aspectRatioHint?: string;
    }>;
  };
  triggers?: CoverageTriggers;
};

const DEFAULT_GATE_THRESHOLDS = {
  confirmedMin: 30,
  orientationMinPercent: 15,
  sceneMatchMinPercent: 60,
  sourceConcentrationMaxPercent: 70,
};

function resolveRootDir(rootDir?: string): string {
  return rootDir ? path.resolve(rootDir) : path.resolve(process.cwd(), "../..");
}

function resolveConfirmedRoot(rootDir: string, confirmedRoot?: string): string {
  return confirmedRoot ? path.resolve(confirmedRoot) : path.join(rootDir, "data", "curation", "confirmed");
}

function resolveOutputRoot(rootDir: string, outputRoot?: string): string {
  return outputRoot ? path.resolve(outputRoot) : path.join(rootDir, "data", "curation", "metadata-backfill");
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

function inferReviewRunId(theme: string, confirmedPath: string): string | undefined {
  const baseName = path.basename(confirmedPath, path.extname(confirmedPath));
  const prefix = `${theme}--`;

  if (!baseName.startsWith(prefix)) {
    return undefined;
  }

  return baseName.slice(prefix.length) || undefined;
}

function countByGrade(records: ArtworkRecord[]) {
  return records.reduce(
    (acc, record) => {
      acc[record.presentation.grade] += 1;
      return acc;
    },
    { A: 0, B: 0, C: 0 },
  );
}

function toPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return Number(((numerator / denominator) * 100).toFixed(1));
}

function buildSourceCoverage(records: ArtworkRecord[]) {
  const counts = records.reduce<Record<string, number>>((acc, record) => {
    acc[record.source] = (acc[record.source] || 0) + 1;
    return acc;
  }, {});

  return Object.fromEntries(
    Object.entries(counts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([source, reviewed]) => [source, {
        reviewed,
        reviewedPercent: toPercent(reviewed, records.length),
      }]),
  );
}

function mergeSourceCoverage(baseCoverage: CoverageReport | undefined, records: ArtworkRecord[]) {
  const computed = buildSourceCoverage(records);
  const base = baseCoverage?.sourceCoverage ?? {};

  return Object.fromEntries(
    Object.keys({ ...base, ...computed })
      .sort()
      .map((source) => [
        source,
        {
          reviewed: computed[source]?.reviewed ?? base[source]?.reviewed ?? 0,
          reviewedPercent: computed[source]?.reviewedPercent ?? base[source]?.reviewedPercent ?? 0,
          promote: base[source]?.promote ?? 0,
          hold: base[source]?.hold ?? 0,
          reject: base[source]?.reject ?? 0,
        },
      ]),
  );
}

function buildThemeGateBlockers(triggers: CoverageTriggers): string[] {
  return [
    triggers.confirmedBelowThirty ? "confirmed-below-thirty" : undefined,
    triggers.sceneMatchBelowSixty ? "scene-match-below-sixty" : undefined,
    triggers.orientationCoverageBelowTarget ? "orientation-coverage-below-target" : undefined,
  ].filter((value): value is string => Boolean(value));
}

function buildPortfolioGateBlockers(triggers: CoverageTriggers): string[] {
  return [
    triggers.sourceConcentrationAboveSeventy ? "source-concentration-above-seventy" : undefined,
  ].filter((value): value is string => Boolean(value));
}

function buildCoverageContextFromCoverage(
  theme: string,
  confirmedPath: string,
  reviewRunId: string | undefined,
  coveragePath: string | undefined,
  coverage: CoverageReport,
): MetadataBackfillCoverageContext {
  const triggers = coverage.triggers ?? {};

  return {
    theme,
    confirmedPath,
    reviewRunId,
    coveragePath,
    matchedCount: coverage.estimatedSceneMatch?.matchedCount,
    matchedPercent: coverage.estimatedSceneMatch?.matchedPercent,
    orientationCoverage: coverage.orientationCoverage,
    themeGateBlockers: buildThemeGateBlockers(triggers),
    portfolioGateBlockers: buildPortfolioGateBlockers(triggers),
  };
}

function buildUpdatedCoverageReport(
  theme: string,
  confirmedPath: string,
  baseCoverage: CoverageReport | undefined,
  records: ArtworkRecord[],
  matchedCount: number,
  matchedPercent: number,
  orientationCoverage: OrientationCoverage,
  sampledMatches: SceneCoverageSummary["sampledMatches"],
): CoverageReport {
  const gateThresholds = {
    ...DEFAULT_GATE_THRESHOLDS,
    ...(baseCoverage?.gateThresholds ?? {}),
  };
  const sourceCoverage = mergeSourceCoverage(baseCoverage, records);
  const dominantSourceEntry = Object.entries(sourceCoverage)
    .sort((left, right) => (right[1].reviewedPercent ?? 0) - (left[1].reviewedPercent ?? 0))[0];
  const dominantPercent = dominantSourceEntry?.[1]?.reviewedPercent ?? 0;
  const triggers: CoverageTriggers = {
    confirmedBelowThirty: records.length < gateThresholds.confirmedMin,
    sceneMatchBelowSixty: matchedPercent < gateThresholds.sceneMatchMinPercent,
    orientationCoverageBelowTarget:
      orientationCoverage.portraitPercent < gateThresholds.orientationMinPercent
      || orientationCoverage.landscapePercent < gateThresholds.orientationMinPercent
      || orientationCoverage.squarePercent < gateThresholds.orientationMinPercent,
    sourceConcentrationAboveSeventy: dominantPercent > gateThresholds.sourceConcentrationMaxPercent,
  };

  return {
    runId: baseCoverage?.runId,
    theme,
    gateThresholds,
    sourceCoverage,
    sourceConcentration: {
      dominantSource: dominantSourceEntry?.[0] ?? "unknown",
      dominantPercent,
      note: "Updated after metadata-backfill enrichment against the current confirmed set.",
    },
    emotionCoverage: baseCoverage?.emotionCoverage ?? {
      [theme]: {
        reviewed: records.length,
        promote: records.length,
        hold: 0,
        reject: 0,
      },
    },
    orientationCoverage: {
      ...orientationCoverage,
      note: "Orientation inferred from remote image headers when available; remaining unknown items should be revisited in curation backfill.",
    },
    estimatedGradeDistribution: countByGrade(records),
    estimatedSceneMatch: {
      matchedCount,
      matchedPercent,
      note: "Computed against the current background scene catalog after metadata-backfill enrichment.",
      sampledMatches,
    },
    triggers,
  };
}

function buildMarkdownReport(report: MetadataBackfillReport): string {
  const themeLines = Object.entries(report.themes)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([theme, counts]) => `- ${theme}: confirmed ${counts.confirmed}, backfilled ${counts.backfilled}`);
  const coverageLines = report.coverageContexts.length > 0
    ? report.coverageContexts.map((context) => {
        const themeGate = context.themeGateBlockers.length > 0 ? context.themeGateBlockers.join(", ") : "none";
        const portfolioGate = context.portfolioGateBlockers.length > 0 ? context.portfolioGateBlockers.join(", ") : "none";
        const matchedPercent = typeof context.matchedPercent === "number" ? `${context.matchedPercent}%` : "n/a";
        const orientation = context.orientationCoverage
          ? `portrait=${context.orientationCoverage.portraitPercent}% landscape=${context.orientationCoverage.landscapePercent}% square=${context.orientationCoverage.squarePercent}% unknown=${context.orientationCoverage.unknownPercent}%`
          : "orientation=n/a";

        return `- ${context.theme}: matchedPercent=${matchedPercent}; ${orientation}; themeGate=${themeGate}; portfolioGate=${portfolioGate}`;
      })
    : ["- none"];

  return [
    `# Metadata Backfill Report: ${path.basename(report.outputPath)}`,
    "",
    `- scope: \`${report.scope}\``,
    `- output: \`${report.outputPath}\``,
    `- confirmed input count: ${report.counts.confirmedCount}`,
    `- backfilled count: ${report.counts.backfilledCount}`,
    `- contract validated count: ${report.counts.contractValidatedCount}`,
    "",
    "## Notes",
    "",
    ...report.notes.map((note) => `- ${note}`),
    "",
    "## Themes",
    "",
    ...themeLines,
    "",
    "## Backfills",
    "",
    `- description: ${report.backfillCounts.description}`,
    `- storySnippet: ${report.backfillCounts.storySnippet}`,
    `- searchText: ${report.backfillCounts.searchText}`,
    `- moodTags: ${report.backfillCounts.moodTags}`,
    `- colorTags: ${report.backfillCounts.colorTags}`,
    `- aspectRatioHint: ${report.backfillCounts.aspectRatioHint}`,
    `- sceneAffinity: ${report.backfillCounts.sceneAffinity}`,
    "",
    "## Coverage Context",
    "",
    ...coverageLines,
    "",
  ].join("\n");
}

function resolveOutputBaseName(inputFiles: string[], corpusVersion: string): string {
  if (inputFiles.length === 1) {
    return path.basename(inputFiles[0], path.extname(inputFiles[0]));
  }

  return corpusVersion;
}

export async function buildConfirmedMetadataBackfill(
  options: ConfirmedMetadataBackfillOptions = {},
): Promise<MetadataBackfillBuildResult> {
  const rootDir = resolveRootDir(options.rootDir);
  const confirmedRoot = resolveConfirmedRoot(rootDir, options.confirmedRoot);
  const outputRoot = resolveOutputRoot(rootDir, options.outputRoot);
  const reportRoot = resolveReportRoot(rootDir, options.reportRoot);
  const corpusVersion = options.corpusVersion ?? `${new Date().toISOString().slice(0, 10)}-metadata-backfill`;
  const sceneMatchThreshold = options.sceneMatchThreshold ?? DEFAULT_GATE_THRESHOLDS.sceneMatchMinPercent / 100;

  ensureDir(outputRoot);
  ensureDir(reportRoot);

  const inputs = loadConfirmedInputs(confirmedRoot, options.inputPath);
  const outputBaseName = resolveOutputBaseName(inputs.map((input) => input.filePath), corpusVersion);
  const outputPath = path.join(outputRoot, `${outputBaseName}.json`);
  const reportPath = path.join(reportRoot, `metadata-backfill-${outputBaseName}.json`);
  const reportMarkdownPath = path.join(reportRoot, `metadata-backfill-${outputBaseName}.md`);
  const backgroundScenes = options.backgroundScenes ?? loadBackgroundScenes(rootDir);
  const themes: MetadataBackfillReport["themes"] = {};
  const coverageContexts: MetadataBackfillCoverageContext[] = [];
  const backfillCounts: MetadataBackfillReport["backfillCounts"] = {
    description: 0,
    storySnippet: 0,
    searchText: 0,
    moodTags: 0,
    colorTags: 0,
    aspectRatioHint: 0,
    sceneAffinity: 0,
  };

  const records: ArtworkRecord[] = [];

  for (const input of inputs) {
    themes[input.theme] = themes[input.theme] ?? { confirmed: 0, backfilled: 0 };
    themes[input.theme].confirmed += input.records.length;

    const reviewRunId = inferReviewRunId(input.theme, input.filePath);
    const coveragePath = reviewRunId ? path.join(reportRoot, `coverage-${reviewRunId}.json`) : undefined;
    const baseCoverage = coveragePath ? (() => {
      try {
        return readJsonFile<CoverageReport>(coveragePath);
      } catch {
        return undefined;
      }
    })() : undefined;

    const enrichedMatches = await Promise.all(input.records.map(async (confirmedRecord) => {
      const candidate = buildCandidateRecord(confirmedRecord, input.theme, corpusVersion);

      backfillCounts.description += candidate.backfills.description ? 1 : 0;
      backfillCounts.storySnippet += candidate.backfills.storySnippet ? 1 : 0;
      backfillCounts.searchText += candidate.backfills.searchText ? 1 : 0;
      backfillCounts.moodTags += candidate.backfills.moodTags ? 1 : 0;
      backfillCounts.colorTags += candidate.backfills.colorTags ? 1 : 0;

      const enriched = await enrichArtworkForCuration(candidate.record, input.theme, backgroundScenes, {
        imageProbe: options.imageProbe,
        sceneMatchThreshold,
      });

      backfillCounts.aspectRatioHint += enriched.record.media.aspectRatioHint ? 1 : 0;
      backfillCounts.sceneAffinity += enriched.record.presentation.sceneAffinity ? 1 : 0;
      themes[input.theme].backfilled += 1;

      return enriched;
    }));

    const themedRecords = enrichedMatches.map((entry) => entry.record);
    const sceneCoverage = summarizeSceneCoverage(themedRecords, enrichedMatches, sceneMatchThreshold);
    const updatedCoverage = buildUpdatedCoverageReport(
      input.theme,
      input.filePath,
      baseCoverage,
      themedRecords,
      sceneCoverage.matchedCount,
      sceneCoverage.matchedPercent,
      sceneCoverage.orientationCoverage,
      sceneCoverage.sampledMatches,
    );

    if (coveragePath) {
      writeJsonFile(coveragePath, updatedCoverage);
    }

    coverageContexts.push(
      buildCoverageContextFromCoverage(
        input.theme,
        input.filePath,
        reviewRunId,
        coveragePath,
        updatedCoverage,
      ),
    );
    records.push(...themedRecords);
  }

  const validatedRecords = parseArtworkRecords(records, "metadata-backfill");
  writeJsonFile(outputPath, validatedRecords);

  const report: MetadataBackfillReport = {
    corpusVersion,
    createdAt: new Date().toISOString(),
    scope: "metadata-backfill-only",
    outputPath,
    inputFiles: inputs.map((input) => input.filePath),
    notes: [
      "This artifact backfills Phase 1 metadata/retrieval fields and refreshes orientation + scene-match coverage against the current scene catalog.",
      "It still does not clear theme gates or portfolio gates automatically; use the refreshed coverage reports to decide whether a theme is ready for release-ready promotion.",
    ],
    counts: {
      confirmedCount: inputs.reduce((sum, input) => sum + input.records.length, 0),
      backfilledCount: validatedRecords.length,
      contractValidatedCount: validatedRecords.length,
    },
    themes,
    backfillCounts,
    coverageContexts,
  };

  writeJsonFile(reportPath, report);
  writeFileSync(reportMarkdownPath, `${buildMarkdownReport(report)}\n`);

  return {
    outputPath,
    reportPath,
    reportMarkdownPath,
    report,
  };
}
