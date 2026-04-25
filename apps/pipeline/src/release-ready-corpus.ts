import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ArtworkGrade, ArtworkGradeLabel, ArtworkRecord, MotionProfile, NarrationMode } from "@artduo/contracts";
import { parseArtworkRecord, parseArtworkRecords } from "@artduo/contracts";

export type ConfirmedRecord = {
  sourceArtworkId?: string | null;
  id?: string | null;
  source?: string | null;
  metadata?: {
    title?: string | null;
    artistDisplayName?: string | null;
    yearLabel?: string | null;
    medium?: string | null;
    culture?: string | null;
    department?: string | null;
    classification?: string | null;
    dimensions?: string | null;
    creditLine?: string | null;
    objectUrl?: string | null;
    descriptionRaw?: string | null;
  } | null;
  media?: {
    baseImageUrl?: string | null;
    imageUrlPreview?: string | null;
    imageUrlFull?: string | null;
    aspectRatioHint?: string | null;
    mediaVersion?: string | null;
    sourceAssetFingerprint?: string | null;
  } | null;
  pipeline?: {
    metadataGaps?: string[] | null;
  } | null;
  review?: {
    runId?: string | null;
    decision?: string | null;
    decisionAt?: string | null;
    decisionOwner?: string | null;
    notes?: string | null;
    reasonCodes?: string[] | null;
  } | null;
};

export type ConfirmedInput = {
  filePath: string;
  theme: string;
  records: ConfirmedRecord[];
};

export type CandidateBackfillFlags = {
  description: boolean;
  storySnippet: boolean;
  searchText: boolean;
  moodTags: boolean;
  colorTags: boolean;
};

export type BuildCandidateRecordOptions = {
  unknownAspectCompositionTags?: string[];
};

export interface ReleaseReadyBuildOptions {
  rootDir?: string;
  confirmedRoot?: string;
  metadataBackfillRoot?: string;
  outputRoot?: string;
  reportRoot?: string;
  inputPath?: string;
  corpusVersion?: string;
}

export interface ReleaseReadyExclusion {
  sourceArtworkId: string;
  title: string;
  theme: string;
  sourceFile: string;
  reasons: string[];
}

export interface ReleaseReadyReport {
  corpusVersion: string;
  createdAt: string;
  outputPath: string;
  inputFiles: string[];
  counts: {
    confirmedCount: number;
    releaseReadyCount: number;
    excludedCount: number;
    existingReleaseReadyCount: number;
  };
  themes: Record<string, { confirmed: number; releaseReady: number }>;
  exclusionCounts: Record<string, number>;
  backfillCounts: {
    description: number;
    storySnippet: number;
    searchText: number;
    moodTags: number;
    colorTags: number;
  };
  excludedSamples: ReleaseReadyExclusion[];
}

export interface ReleaseReadyBuildResult {
  outputPath: string;
  reportPath: string;
  reportMarkdownPath: string;
  records: ArtworkRecord[];
  report: ReleaseReadyReport;
}

function resolveRootDir(rootDir?: string): string {
  return rootDir ? path.resolve(rootDir) : path.resolve(process.cwd(), "../..");
}

function resolveConfirmedRoot(rootDir: string, confirmedRoot?: string): string {
  return confirmedRoot ? path.resolve(confirmedRoot) : path.join(rootDir, "data", "curation", "confirmed");
}

function resolveMetadataBackfillRoot(rootDir: string, metadataBackfillRoot?: string): string {
  return metadataBackfillRoot ? path.resolve(metadataBackfillRoot) : path.join(rootDir, "data", "curation", "metadata-backfill");
}

function resolveOutputRoot(rootDir: string, outputRoot?: string): string {
  return outputRoot ? path.resolve(outputRoot) : path.join(rootDir, "data", "curation", "release-ready");
}

function resolveReportRoot(rootDir: string, reportRoot?: string): string {
  return reportRoot ? path.resolve(reportRoot) : path.join(rootDir, "data", "curation", "reports");
}

function ensureDir(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true });
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

export function compactText(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const compacted = String(value).replace(/\s+/g, " ").trim();
  return compacted || undefined;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function inferThemeFromFile(filePath: string): string {
  const basename = path.basename(filePath, path.extname(filePath));
  return basename.split("--")[0] || "curated";
}

function normalizeThemeTag(theme: string): string {
  return theme
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "curated";
}

function discoverLatestThemeFiles(root: string): string[] {
  const latestByTheme = new Map<string, string>();
  const fileNames = readdirSync(root)
    .filter((fileName) => fileName.endsWith(".json"))
    .sort();

  for (const fileName of fileNames) {
    latestByTheme.set(normalizeThemeTag(inferThemeFromFile(fileName)), path.join(root, fileName));
  }

  return [...latestByTheme.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, filePath]) => filePath);
}

export function loadConfirmedInputs(confirmedRoot: string, inputPath?: string): ConfirmedInput[] {
  const filePaths = inputPath
    ? [path.resolve(inputPath)]
    : discoverLatestThemeFiles(confirmedRoot);

  return filePaths.map((filePath) => ({
    filePath,
    theme: normalizeThemeTag(inferThemeFromFile(filePath)),
    records: readJsonFile<ConfirmedRecord[]>(filePath),
  }));
}

type ReleaseReadyInput = {
  theme: string;
  filePath: string;
  reviewCleared: boolean;
  records: ArtworkRecord[];
  provenance: "metadata-backfill" | "confirmed";
};

function loadLatestArtworkInputs(metadataBackfillRoot: string): ReleaseReadyInput[] {
  return discoverLatestThemeFiles(metadataBackfillRoot).map((filePath) => ({
    theme: normalizeThemeTag(inferThemeFromFile(filePath)),
    filePath,
    reviewCleared: true,
    records: parseArtworkRecords(readJsonFile<unknown>(filePath), filePath),
    provenance: "metadata-backfill" as const,
  }));
}

function loadReleaseReadyInputs(
  confirmedRoot: string,
  metadataBackfillRoot: string,
  inputPath?: string,
): ReleaseReadyInput[] {
  if (inputPath) {
    const resolvedPath = path.resolve(inputPath);
    const payload = readJsonFile<unknown>(resolvedPath);
    const theme = normalizeThemeTag(inferThemeFromFile(resolvedPath));

    try {
      return [{
        theme,
        filePath: resolvedPath,
        reviewCleared: true,
        records: parseArtworkRecords(payload, resolvedPath),
        provenance: "metadata-backfill",
      }];
    } catch {
      return loadConfirmedInputs(confirmedRoot, resolvedPath).map((input) => ({
        theme: input.theme,
        filePath: input.filePath,
        reviewCleared: true,
        records: input.records.map((record) => buildCandidateRecord(record, input.theme, "release-ready-input").record),
        provenance: "confirmed" as const,
      }));
    }
  }

  const preferred = new Map<string, ReleaseReadyInput>();

  try {
    for (const input of loadLatestArtworkInputs(metadataBackfillRoot)) {
      preferred.set(input.theme, input);
    }
  } catch {
    // metadata-backfill may not exist yet; fall through to confirmed inputs
  }

  for (const input of loadConfirmedInputs(confirmedRoot)) {
    if (preferred.has(input.theme)) {
      continue;
    }

    preferred.set(input.theme, {
      theme: input.theme,
      filePath: input.filePath,
      reviewCleared: true,
      records: input.records.map((record) => buildCandidateRecord(record, input.theme, "release-ready-input").record),
      provenance: "confirmed",
    });
  }

  return [...preferred.values()].sort((left, right) => left.theme.localeCompare(right.theme));
}

function buildSourceAssetFingerprint(record: ConfirmedRecord): string | undefined {
  const explicit = compactText(record.media?.sourceAssetFingerprint);
  if (explicit) {
    return explicit;
  }

  const source = [
    compactText(record.media?.baseImageUrl),
    compactText(record.media?.imageUrlPreview),
    compactText(record.media?.imageUrlFull),
  ]
    .filter((value): value is string => Boolean(value))
    .join("|");

  if (!source) {
    return undefined;
  }

  return `sha256:${createHash("sha256").update(source).digest("hex")}`;
}

function deriveEnergyLevel(theme: string): "low" | "medium" | "high" {
  const low = new Set(["calm", "contemplation", "grief", "melancholy", "serenity", "silence"]);
  const high = new Set(["awe", "fear", "hope", "mystery", "surprise", "tension", "wonder"]);

  if (low.has(theme)) {
    return "low";
  }
  if (high.has(theme)) {
    return "high";
  }
  return "medium";
}

function deriveValence(theme: string): "dark" | "mixed" | "bright" {
  const dark = new Set(["fear", "grief", "melancholy", "mystery", "tension"]);
  const bright = new Set(["admiration", "awe", "hope", "joy", "serenity", "wonder"]);

  if (dark.has(theme)) {
    return "dark";
  }
  if (bright.has(theme)) {
    return "bright";
  }
  return "mixed";
}

function derivePace(energyLevel: "low" | "medium" | "high"): "still" | "gentle" | "active" {
  if (energyLevel === "low") {
    return "still";
  }
  if (energyLevel === "high") {
    return "active";
  }
  return "gentle";
}

function deriveSpaceSense(aspectRatioHint: "portrait" | "landscape" | "square" | undefined): "close" | "balanced" | "open" {
  if (aspectRatioHint === "portrait") {
    return "close";
  }
  if (aspectRatioHint === "landscape") {
    return "open";
  }
  return "balanced";
}

function deriveGradeLabel(grade: ArtworkGrade): ArtworkGradeLabel {
  if (grade === "A") {
    return "director-focus";
  }
  if (grade === "B") {
    return "emotional-pillar";
  }
  return "ambient-bridge";
}

function deriveMotionProfile(grade: ArtworkGrade): MotionProfile {
  return grade === "A" ? "ambient-loop" : "static";
}

function deriveNarrationMode(description: string | undefined): NarrationMode {
  return description ? "caption" : "none";
}

function extractColorTags(text: string): string[] {
  const normalized = text.toLowerCase();
  const paletteTerms = [
    "amber",
    "beige",
    "black",
    "blue",
    "brown",
    "charcoal",
    "cream",
    "gold",
    "green",
    "ivory",
    "mahogany",
    "marble",
    "ochre",
    "red",
    "sage",
    "sepia",
    "silver",
    "stone",
    "taupe",
    "terracotta",
    "umber",
    "walnut",
    "white",
    "wood",
    "yellow",
  ];

  const tags = paletteTerms.filter((term) => normalized.includes(term));
  return tags.length > 0 ? tags : ["unknown-palette"];
}

function deriveStorySnippet(
  title: string,
  artistDisplayName: string,
  description: string | undefined,
  reviewNotes: string | undefined,
): string {
  const firstSentence = [description, reviewNotes]
    .map((value) => compactText(value))
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(/[.!?]/))
    .map((value) => value.trim())
    .find(Boolean);

  if (firstSentence) {
    return firstSentence.length > 140 ? `${firstSentence.slice(0, 137)}...` : firstSentence;
  }

  return `${title} by ${artistDisplayName}`;
}

function deriveSubjectTags(record: ConfirmedRecord, theme: string): string[] {
  const metadata = record.metadata;
  const tags = unique(
    [
      compactText(metadata?.classification),
      compactText(metadata?.medium),
      compactText(metadata?.culture),
      compactText(metadata?.department),
      theme,
    ].filter((value): value is string => Boolean(value)),
  );

  return tags.length > 0 ? tags.slice(0, 6) : ["curated-work"];
}

function deriveCompositionTags(
  aspectRatioHint: "portrait" | "landscape" | "square" | undefined,
  unknownAspectCompositionTags: string[] = ["single-subject", "curated-promote"],
): string[] {
  if (aspectRatioHint === "portrait") {
    return ["single-subject", "portrait-bias"];
  }
  if (aspectRatioHint === "landscape") {
    return ["wide-frame", "scene-bias"];
  }
  if (aspectRatioHint === "square") {
    return ["centered", "square-frame"];
  }
  return unknownAspectCompositionTags;
}

function normalizeAspectRatioHint(value: string | undefined): "portrait" | "landscape" | "square" | undefined {
  if (value === "portrait" || value === "landscape" || value === "square") {
    return value;
  }
  return undefined;
}

function inferSource(record: ConfirmedRecord): "met" | "custom" {
  return record.source === "custom" ? "custom" : "met";
}

function inferSourceArtworkId(record: ConfirmedRecord): string | undefined {
  const explicit = compactText(record.sourceArtworkId);
  if (explicit) {
    return explicit;
  }

  const id = compactText(record.id);
  if (!id) {
    return undefined;
  }

  return id.startsWith("met-") ? id.slice(4) : id;
}

function deriveFallbackDescription(record: ConfirmedRecord, theme: string, title: string, artistDisplayName: string): string {
  const metadata = record.metadata;
  const supporting = [
    compactText(metadata?.classification),
    compactText(metadata?.medium),
    compactText(metadata?.culture),
    compactText(metadata?.department),
    compactText(record.review?.notes),
  ]
    .filter((value): value is string => Boolean(value))
    .join(". ");

  if (!supporting) {
    return `${title} by ${artistDisplayName}. Curated for the ${theme} lane.`;
  }

  return `${title} by ${artistDisplayName}. ${supporting}.`;
}

function deriveGrade(record: ConfirmedRecord, descriptionWasBackfilled: boolean): ArtworkGrade {
  const metadataGaps = record.pipeline?.metadataGaps ?? [];
  const hasClassification = Boolean(compactText(record.metadata?.classification));
  const hasFullImage = Boolean(compactText(record.media?.imageUrlFull));

  if (!descriptionWasBackfilled && metadataGaps.length === 0 && hasClassification && hasFullImage) {
    return "A";
  }

  return "B";
}

function buildDuplicateKeys(record: ArtworkRecord): string[] {
  const normalizedTitle = compactText(record.metadata.title)?.toLowerCase();
  const normalizedArtist = compactText(record.metadata.artistDisplayName)?.toLowerCase();
  const keys = [`source:${record.source}:${record.sourceArtworkId}`];

  if (record.media.sourceAssetFingerprint) {
    keys.push(`fingerprint:${record.media.sourceAssetFingerprint}`);
  }

  if (normalizedTitle) {
    keys.push(`title:${normalizedTitle}`);
  }

  if (normalizedTitle && normalizedArtist) {
    keys.push(`title-artist:${normalizedTitle}:${normalizedArtist}`);
  }

  return keys;
}

export function buildCandidateRecord(
  record: ConfirmedRecord,
  theme: string,
  corpusVersion: string,
  options: BuildCandidateRecordOptions = {},
): {
  record: ArtworkRecord;
  backfills: CandidateBackfillFlags;
} {
  const source = inferSource(record);
  const sourceArtworkId = inferSourceArtworkId(record) ?? "unknown-source-id";
  const title = compactText(record.metadata?.title) ?? "Untitled";
  const artistDisplayName =
    compactText(record.metadata?.artistDisplayName) ??
    compactText(record.metadata?.culture) ??
    compactText(record.metadata?.department) ??
    "Unknown Artist";
  const descriptionRaw = compactText(record.metadata?.descriptionRaw);
  const description = descriptionRaw ?? deriveFallbackDescription(record, theme, title, artistDisplayName);
  const descriptionWasBackfilled = !descriptionRaw;
  const storySnippet = deriveStorySnippet(title, artistDisplayName, descriptionRaw, compactText(record.review?.notes));
  const moodTags = [theme];
  const medium = compactText(record.metadata?.medium);
  const colorTags = extractColorTags([title, medium, description].filter(Boolean).join(" "));
  const subjectTags = deriveSubjectTags(record, theme);
  const aspectRatioHint = normalizeAspectRatioHint(compactText(record.media?.aspectRatioHint));
  const energyLevel = deriveEnergyLevel(theme);
  const grade = deriveGrade(record, descriptionWasBackfilled);
  const searchText = [
    title,
    artistDisplayName,
    description,
    theme,
    ...subjectTags,
  ]
    .filter(Boolean)
    .join(" ");

  const candidate: ArtworkRecord = {
    id: compactText(record.id) ?? `${source}-${sourceArtworkId}`,
    source,
    sourceArtworkId,
    version: corpusVersion,
    metadata: {
      title,
      artistDisplayName,
      yearLabel: compactText(record.metadata?.yearLabel),
      medium,
      culture: compactText(record.metadata?.culture),
      department: compactText(record.metadata?.department),
      dimensions: compactText(record.metadata?.dimensions),
      creditLine: compactText(record.metadata?.creditLine),
      objectUrl: compactText(record.metadata?.objectUrl),
      sourceApiUrl: source === "met"
        ? `https://collectionapi.metmuseum.org/public/collection/v1/objects/${sourceArtworkId}`
        : undefined,
      descriptionRaw: description,
      descriptionClean: description,
      storySnippet,
      moodTags,
      colorTags,
      subjectTags,
      compositionTags: deriveCompositionTags(aspectRatioHint, options.unknownAspectCompositionTags),
    },
    retrieval: {
      searchText,
      searchTextShort: [title, artistDisplayName].filter(Boolean).join(" "),
      emotionLabels: moodTags,
      energyLevel,
      valence: deriveValence(theme),
      pace: derivePace(energyLevel),
      spaceSense: deriveSpaceSense(aspectRatioHint),
      keywordBoosts: subjectTags.slice(0, 4),
    },
    media: {
      baseImageUrl:
        compactText(record.media?.baseImageUrl) ??
        compactText(record.media?.imageUrlPreview) ??
        compactText(record.media?.imageUrlFull),
      imageUrlPreview:
        compactText(record.media?.imageUrlPreview) ??
        compactText(record.media?.baseImageUrl) ??
        compactText(record.media?.imageUrlFull),
      imageUrlFull: compactText(record.media?.imageUrlFull),
      aspectRatioHint,
      hasMotionAsset: false,
      mediaVersion: compactText(record.media?.mediaVersion),
      sourceAssetFingerprint: buildSourceAssetFingerprint(record),
    },
    presentation: {
      grade,
      gradeLabel: deriveGradeLabel(grade),
      motionProfile: deriveMotionProfile(grade),
      narrationMode: deriveNarrationMode(description),
    },
  };

  return {
    record: candidate,
    backfills: {
      description: descriptionWasBackfilled,
      storySnippet: !compactText(record.metadata?.descriptionRaw),
      searchText: true,
      moodTags: true,
      colorTags: true,
    },
  };
}

function validateReleaseReadyMinimums(record: ArtworkRecord, reviewCleared: boolean): string[] {
  const reasons: string[] = [];

  if (!reviewCleared) {
    reasons.push("missing-promote-review");
  }
  if (!compactText(record.sourceArtworkId)) {
    reasons.push("missing-source-artwork-id");
  }
  if (!compactText(record.metadata.title)) {
    reasons.push("missing-title");
  }
  if (!compactText(record.metadata.artistDisplayName)) {
    reasons.push("missing-artist-display-name");
  }
  if (!compactText(record.metadata.descriptionRaw) && !compactText(record.metadata.descriptionClean)) {
    reasons.push("missing-description");
  }
  if (!compactText(record.metadata.storySnippet)) {
    reasons.push("missing-story-snippet");
  }
  if (!compactText(record.retrieval.searchText)) {
    reasons.push("missing-search-text");
  }
  if (record.metadata.moodTags.length === 0) {
    reasons.push("missing-mood-tags");
  }
  if (record.metadata.colorTags.length === 0) {
    reasons.push("missing-color-tags");
  }
  if (!record.media.baseImageUrl && !record.media.imageUrlPreview) {
    reasons.push("missing-base-image");
  }
  if (!record.media.mediaVersion && !record.media.sourceAssetFingerprint) {
    reasons.push("missing-media-version");
  }

  return reasons;
}

function buildMarkdownReport(report: ReleaseReadyReport): string {
  const themeLines = Object.entries(report.themes)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([theme, counts]) => `- ${theme}: confirmed ${counts.confirmed}, release-ready ${counts.releaseReady}`);
  const exclusionLines = Object.entries(report.exclusionCounts).length > 0
    ? Object.entries(report.exclusionCounts).map(([reason, count]) => `- ${reason}: ${count}`)
    : ["- none"];
  const sampleLines = report.excludedSamples.length > 0
    ? report.excludedSamples.map((item) => `- ${item.sourceArtworkId} (${item.theme}): ${item.reasons.join(", ")}`)
    : ["- none"];

  return [
    `# Release Ready Report: ${report.corpusVersion}`,
    "",
    `- output: \`${report.outputPath}\``,
    `- confirmed input count: ${report.counts.confirmedCount}`,
    `- release-ready count: ${report.counts.releaseReadyCount}`,
    `- excluded count: ${report.counts.excludedCount}`,
    `- existing release-ready count: ${report.counts.existingReleaseReadyCount}`,
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
    "",
    "## Exclusions",
    "",
    ...exclusionLines,
    "",
    "## Excluded Samples",
    "",
    ...sampleLines,
    "",
  ].join("\n");
}

function loadExistingReleaseReadyRecords(outputRoot: string, outputPath: string): ArtworkRecord[] {
  try {
    const files = readdirSync(outputRoot)
      .filter((fileName) => fileName.endsWith(".json"))
      .map((fileName) => path.join(outputRoot, fileName))
      .filter((filePath) => filePath !== outputPath)
      .sort();

    return files.flatMap((filePath) => parseArtworkRecords(readJsonFile<unknown>(filePath), filePath));
  } catch {
    return [];
  }
}

function writeJsonFile(filePath: string, data: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

export function buildReleaseReadyCorpus(options: ReleaseReadyBuildOptions = {}): ReleaseReadyBuildResult {
  const rootDir = resolveRootDir(options.rootDir);
  const confirmedRoot = resolveConfirmedRoot(rootDir, options.confirmedRoot);
  const metadataBackfillRoot = resolveMetadataBackfillRoot(rootDir, options.metadataBackfillRoot);
  const outputRoot = resolveOutputRoot(rootDir, options.outputRoot);
  const reportRoot = resolveReportRoot(rootDir, options.reportRoot);
  const corpusVersion = options.corpusVersion ?? new Date().toISOString().slice(0, 10);

  ensureDir(outputRoot);
  ensureDir(reportRoot);

  const outputPath = path.join(outputRoot, `${corpusVersion}.json`);
  const reportPath = path.join(reportRoot, `release-ready-${corpusVersion}.json`);
  const reportMarkdownPath = path.join(reportRoot, `release-ready-${corpusVersion}.md`);
  const inputs = loadReleaseReadyInputs(confirmedRoot, metadataBackfillRoot, options.inputPath);
  const existingRecords = loadExistingReleaseReadyRecords(outputRoot, outputPath);
  const seenDuplicateKeys = new Set(existingRecords.flatMap((record) => buildDuplicateKeys(record)));

  const accepted: ArtworkRecord[] = [];
  const exclusions: ReleaseReadyExclusion[] = [];
  const themes: ReleaseReadyReport["themes"] = {};
  const exclusionCounts: Record<string, number> = {};
  const backfillCounts = {
    description: 0,
    storySnippet: 0,
    searchText: 0,
    moodTags: 0,
    colorTags: 0,
  };

  for (const input of inputs) {
    themes[input.theme] = themes[input.theme] ?? { confirmed: 0, releaseReady: 0 };
    themes[input.theme].confirmed += input.records.length;

    for (const sourceRecord of input.records) {
      const record = {
        ...sourceRecord,
        version: corpusVersion,
      };
      const backfills = {
        description: false,
        storySnippet: false,
        searchText: false,
        moodTags: false,
        colorTags: false,
      };
      const reasons = validateReleaseReadyMinimums(record, input.reviewCleared);
      const duplicateKeys = buildDuplicateKeys(record);

      if (duplicateKeys.some((key) => seenDuplicateKeys.has(key))) {
        reasons.push("duplicate");
      }

      if (reasons.length === 0) {
        try {
          parseArtworkRecord(record, `release-ready:${record.sourceArtworkId}`);
        } catch (error) {
          reasons.push(`contract:${error instanceof Error ? error.message : "validation failed"}`);
        }
      }

      if (reasons.length > 0) {
        const dedupedReasons = unique(reasons);
        dedupedReasons.forEach((reason) => {
          exclusionCounts[reason] = (exclusionCounts[reason] || 0) + 1;
        });
        exclusions.push({
          sourceArtworkId: record.sourceArtworkId,
          title: record.metadata.title,
          theme: input.theme,
          sourceFile: input.filePath,
          reasons: dedupedReasons,
        });
        continue;
      }

      duplicateKeys.forEach((key) => seenDuplicateKeys.add(key));
      accepted.push(record);
      themes[input.theme].releaseReady += 1;
      backfillCounts.description += backfills.description ? 1 : 0;
      backfillCounts.storySnippet += backfills.storySnippet ? 1 : 0;
      backfillCounts.searchText += backfills.searchText ? 1 : 0;
      backfillCounts.moodTags += backfills.moodTags ? 1 : 0;
      backfillCounts.colorTags += backfills.colorTags ? 1 : 0;
    }
  }

  const validatedRecords = parseArtworkRecords(accepted, "release-ready");
  writeJsonFile(outputPath, validatedRecords);

  const report: ReleaseReadyReport = {
    corpusVersion,
    createdAt: new Date().toISOString(),
    outputPath,
    inputFiles: inputs.map((input) => input.filePath),
    counts: {
      confirmedCount: inputs.reduce((sum, input) => sum + input.records.length, 0),
      releaseReadyCount: validatedRecords.length,
      excludedCount: exclusions.length,
      existingReleaseReadyCount: existingRecords.length,
    },
    themes,
    exclusionCounts,
    backfillCounts,
    excludedSamples: exclusions.slice(0, 20),
  };

  writeJsonFile(reportPath, report);
  writeJsonFile(path.join(reportRoot, `release-ready-${corpusVersion}.excluded.json`), exclusions);
  writeFileSync(reportMarkdownPath, `${buildMarkdownReport(report)}\n`);

  return {
    outputPath,
    reportPath,
    reportMarkdownPath,
    records: validatedRecords,
    report,
  };
}

export function buildReleaseReadyCorpusToTempDir(options: Omit<ReleaseReadyBuildOptions, "outputRoot" | "reportRoot"> = {}): ReleaseReadyBuildResult {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "artduo-release-ready-tests-"));

  return buildReleaseReadyCorpus({
    ...options,
    outputRoot: path.join(tempRoot, "release-ready"),
    reportRoot: path.join(tempRoot, "reports"),
  });
}
