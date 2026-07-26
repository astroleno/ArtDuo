import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { loadReleaseManifest, resolveShardPath } from "@artduo/corpus";
import type {
  ArtworkMediaRefs,
  ArtworkMetadata,
  ArtworkSource,
  ArtworkVisualPresentation,
  AspectRatioHint,
  ShardInfo,
  VisualCropStrategy,
} from "@artduo/contracts";

const BUILDER_VERSION = "visual-presentation-preview.v1";
const DEFAULT_LIMIT = 120;

const PAPER_WORK_TERMS = [
  "albumen",
  "charcoal",
  "drawing",
  "engraving",
  "etching",
  "gelatin silver",
  "graphite",
  "ink",
  "lithograph",
  "paper",
  "pastel",
  "photograph",
  "photogravure",
  "print",
  "salted paper",
  "silver print",
  "watercolor",
  "watercolour",
  "woodcut",
];

const HIGH_SIGNAL_DEPARTMENTS = [
  "drawings and prints",
  "photographs",
];

export interface VisualPresentationPreviewOptions {
  rootDir?: string;
  releasesRoot?: string;
  releaseVersion?: string;
  manifestPath?: string;
  reportRoot?: string;
  outputPath?: string;
  limit?: number;
}

export type VisualPresentationPriority = "high" | "medium" | "low";

export interface VisualPresentationCandidate {
  id: string;
  source: ArtworkSource;
  sourceArtworkId: string;
  title: string;
  artistDisplayName?: string;
  medium?: string;
  department?: string;
  imageUrlPreview?: string;
  imageUrlFull?: string;
  baseImageUrl?: string;
  aspectRatioHint?: AspectRatioHint;
  priority: VisualPresentationPriority;
  recommendedCropStrategy: VisualCropStrategy;
  reasonCodes: string[];
  vlmPrompt: string;
}

export interface VisualPresentationPreviewReport {
  releaseVersion: string;
  createdAt: string;
  scope: "visual-presentation-vlm-worklist";
  builderVersion: string;
  manifestPath: string;
  reportPath: string;
  limit: number;
  counts: {
    totalMediaRecords: number;
    metadataRecords: number;
    mediaRecordsWithoutMetadata: number;
    alreadyAnnotatedCount: number;
    signalCandidateCount: number;
    emittedCandidateCount: number;
  };
  candidates: VisualPresentationCandidate[];
  notes: string[];
}

export interface VisualPresentationPreviewResult {
  reportPath: string;
  reportMarkdownPath: string;
  report: VisualPresentationPreviewReport;
}

interface MetadataShardRecord {
  id: string;
  source: ArtworkSource;
  sourceArtworkId: string;
  version: string;
  metadata: ArtworkMetadata;
}

interface MediaShardRecord {
  id: string;
  source: ArtworkSource;
  sourceArtworkId: string;
  version: string;
  media: ArtworkMediaRefs;
}

interface IndexedShardRecord<T> {
  shard: ShardInfo;
  shardPath: string;
  record: T;
}

function resolveRootDir(rootDir?: string): string {
  return rootDir ? path.resolve(rootDir) : path.resolve(process.cwd(), "../..");
}

function resolveReportRoot(rootDir: string, reportRoot?: string): string {
  return reportRoot ? path.resolve(reportRoot) : path.join(rootDir, "data", "curation", "reports", "visual-presentation");
}

function ensureDir(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true });
}

function writeJsonFile(filePath: string, data: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function readJsonArray(filePath: string): unknown[] {
  const value = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  if (!Array.isArray(value)) {
    throw new TypeError(`${filePath}: expected JSON array`);
  }

  return value;
}

function expectRecord(value: unknown, pathLabel: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${pathLabel}: expected object`);
  }

  return value as Record<string, unknown>;
}

function readRequiredString(source: Record<string, unknown>, key: string, pathLabel: string): string {
  const value = source[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${pathLabel}.${key}: expected non-empty string`);
  }

  return value;
}

function loadMetadataRecords(manifestPath: string, shards: ShardInfo[]): IndexedShardRecord<MetadataShardRecord>[] {
  return shards.flatMap((shard) => {
    const shardPath = resolveShardPath(manifestPath, shard);
    return readJsonArray(shardPath).map((value, index) => {
      const pathLabel = `${shardPath}[${index}]`;
      const record = expectRecord(value, pathLabel);
      const metadata = expectRecord(record.metadata, `${pathLabel}.metadata`) as unknown as ArtworkMetadata;

      return {
        shard,
        shardPath,
        record: {
          id: readRequiredString(record, "id", pathLabel),
          source: readRequiredString(record, "source", pathLabel) as ArtworkSource,
          sourceArtworkId: readRequiredString(record, "sourceArtworkId", pathLabel),
          version: readRequiredString(record, "version", pathLabel),
          metadata,
        },
      };
    });
  });
}

function loadMediaRecords(manifestPath: string, shards: ShardInfo[]): IndexedShardRecord<MediaShardRecord>[] {
  return shards.flatMap((shard) => {
    const shardPath = resolveShardPath(manifestPath, shard);
    return readJsonArray(shardPath).map((value, index) => {
      const pathLabel = `${shardPath}[${index}]`;
      const record = expectRecord(value, pathLabel);
      const media = expectRecord(record.media, `${pathLabel}.media`) as unknown as ArtworkMediaRefs;

      return {
        shard,
        shardPath,
        record: {
          id: readRequiredString(record, "id", pathLabel),
          source: readRequiredString(record, "source", pathLabel) as ArtworkSource,
          sourceArtworkId: readRequiredString(record, "sourceArtworkId", pathLabel),
          version: readRequiredString(record, "version", pathLabel),
          media,
        },
      };
    });
  });
}

function normalizedText(...values: Array<string | undefined>): string {
  return values
    .filter((value): value is string => typeof value === "string" && value.trim() !== "")
    .join(" ")
    .toLowerCase();
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function hasTrustedVisualPresentation(value: ArtworkVisualPresentation | undefined): boolean {
  if (!value) {
    return false;
  }

  return Boolean(value.contentBounds && value.contentAspectRatio && value.cropStrategy && (value.confidence ?? 0) >= 0.62);
}

function inferReasonCodes(metadata: ArtworkMetadata): string[] {
  const departmentText = normalizedText(metadata.department);
  const mediumText = normalizedText(metadata.medium, metadata.descriptionClean, metadata.descriptionRaw);
  const subjectText = normalizedText(...metadata.subjectTags, ...metadata.compositionTags);
  const reasonCodes: string[] = [];

  if (includesAny(departmentText, HIGH_SIGNAL_DEPARTMENTS)) {
    reasonCodes.push("department-paper-or-photo");
  }

  if (includesAny(mediumText, PAPER_WORK_TERMS)) {
    reasonCodes.push("medium-paper-print-photo");
  }

  if (includesAny(subjectText, ["print", "prints", "photograph", "photographs", "drawing", "drawings"])) {
    reasonCodes.push("tag-paper-print-photo");
  }

  if (normalizedText(metadata.dimensions).includes("sheet")) {
    reasonCodes.push("dimensions-sheet");
  }

  return [...new Set(reasonCodes)];
}

function priorityForReasonCodes(reasonCodes: string[]): VisualPresentationPriority {
  if (reasonCodes.includes("department-paper-or-photo") || reasonCodes.includes("medium-paper-print-photo")) {
    return "high";
  }

  return reasonCodes.length > 0 ? "medium" : "low";
}

function recommendCropStrategy(priority: VisualPresentationPriority): VisualCropStrategy {
  return priority === "low" ? "preserve-paper" : "trim-border";
}

function sortCandidatePriority(left: VisualPresentationCandidate, right: VisualPresentationCandidate): number {
  const order: Record<VisualPresentationPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return order[left.priority] - order[right.priority] || left.title.localeCompare(right.title);
}

function buildVlmPrompt(candidate: Omit<VisualPresentationCandidate, "vlmPrompt">): string {
  return [
    "Inspect this artwork image for immersive display.",
    "Return JSON only with this shape:",
    "{\"contentBounds\":{\"x\":0,\"y\":0,\"width\":1,\"height\":1},\"contentAspectRatio\":1,\"whiteBorderRatio\":0,\"cropStrategy\":\"trim-border|preserve-paper|focus-subject\",\"confidence\":0,\"notes\":[\"short reason\"]}",
    "Use normalized image coordinates. contentBounds should enclose the meaningful artwork content, excluding scanner beds, mats, blank outer frames, or UI-like borders.",
    "If the blank paper itself is intrinsic to the artwork, preserve it and choose preserve-paper.",
    "Choose trim-border when the current image has a removable white/cream outer frame that weakens immersive display.",
    `Artwork: ${candidate.title}`,
    candidate.artistDisplayName ? `Artist: ${candidate.artistDisplayName}` : undefined,
    candidate.medium ? `Medium: ${candidate.medium}` : undefined,
    candidate.department ? `Department: ${candidate.department}` : undefined,
    `Initial recommendation: ${candidate.recommendedCropStrategy}`,
    `Reason codes: ${candidate.reasonCodes.join(", ")}`,
  ].filter((line): line is string => typeof line === "string").join("\n");
}

function buildMarkdownReport(report: VisualPresentationPreviewReport): string {
  const candidateLines = report.candidates.map((candidate) =>
    `- [${candidate.priority}] ${candidate.id}: ${candidate.title}; strategy=${candidate.recommendedCropStrategy}; reasons=${candidate.reasonCodes.join(", ")}`);

  return [
    `# Visual Presentation Preview: ${report.releaseVersion}`,
    "",
    `- scope: \`${report.scope}\``,
    `- builder: \`${report.builderVersion}\``,
    `- manifest: \`${report.manifestPath}\``,
    `- report: \`${report.reportPath}\``,
    "",
    "## Counts",
    "",
    `- metadata records: ${report.counts.metadataRecords}`,
    `- media records: ${report.counts.totalMediaRecords}`,
    `- media without metadata: ${report.counts.mediaRecordsWithoutMetadata}`,
    `- already annotated: ${report.counts.alreadyAnnotatedCount}`,
    `- signal candidates: ${report.counts.signalCandidateCount}`,
    `- emitted candidates: ${report.counts.emittedCandidateCount}`,
    "",
    "## Notes",
    "",
    ...report.notes.map((note) => `- ${note}`),
    "",
    "## Candidates",
    "",
    ...candidateLines,
    "",
  ].join("\n");
}

export function buildVisualPresentationPreview(options: VisualPresentationPreviewOptions = {}): VisualPresentationPreviewResult {
  const rootDir = resolveRootDir(options.rootDir);
  const loaded = loadReleaseManifest({
    rootDir,
    releasesRoot: options.releasesRoot,
    releaseVersion: options.releaseVersion,
    manifestPath: options.manifestPath,
  });
  const reportRoot = resolveReportRoot(rootDir, options.reportRoot);
  const reportDir = path.join(reportRoot, loaded.releaseVersion);
  const reportPath = options.outputPath
    ? path.resolve(options.outputPath)
    : path.join(reportDir, "visual-presentation-preview.json");
  const reportMarkdownPath = reportPath.replace(/\.json$/u, ".md");
  const limit = options.limit !== undefined && Number.isFinite(options.limit) && options.limit > 0
    ? options.limit
    : DEFAULT_LIMIT;

  ensureDir(path.dirname(reportPath));

  const metadataRecords = loadMetadataRecords(loaded.manifestPath, loaded.manifest.shards.metadata);
  const mediaRecords = loadMediaRecords(loaded.manifestPath, loaded.manifest.shards.mediaIndex);
  const metadataById = new Map(metadataRecords.map((entry) => [entry.record.id, entry.record]));

  let alreadyAnnotatedCount = 0;
  let mediaRecordsWithoutMetadata = 0;
  const candidates: VisualPresentationCandidate[] = [];

  for (const mediaEntry of mediaRecords) {
    const mediaRecord = mediaEntry.record;
    const metadataRecord = metadataById.get(mediaRecord.id);

    if (!metadataRecord) {
      mediaRecordsWithoutMetadata += 1;
      continue;
    }

    if (hasTrustedVisualPresentation(mediaRecord.media.visualPresentation)) {
      alreadyAnnotatedCount += 1;
      continue;
    }

    const reasonCodes = inferReasonCodes(metadataRecord.metadata);
    if (reasonCodes.length === 0) {
      continue;
    }

    const priority = priorityForReasonCodes(reasonCodes);
    const candidateWithoutPrompt = {
      id: mediaRecord.id,
      source: mediaRecord.source,
      sourceArtworkId: mediaRecord.sourceArtworkId,
      title: metadataRecord.metadata.title,
      artistDisplayName: metadataRecord.metadata.artistDisplayName,
      medium: metadataRecord.metadata.medium,
      department: metadataRecord.metadata.department,
      imageUrlPreview: mediaRecord.media.imageUrlPreview,
      imageUrlFull: mediaRecord.media.imageUrlFull,
      baseImageUrl: mediaRecord.media.baseImageUrl,
      aspectRatioHint: mediaRecord.media.aspectRatioHint,
      priority,
      recommendedCropStrategy: recommendCropStrategy(priority),
      reasonCodes,
    } satisfies Omit<VisualPresentationCandidate, "vlmPrompt">;

    candidates.push({
      ...candidateWithoutPrompt,
      vlmPrompt: buildVlmPrompt(candidateWithoutPrompt),
    });
  }

  candidates.sort(sortCandidatePriority);

  const emittedCandidates = candidates.slice(0, limit);
  const report: VisualPresentationPreviewReport = {
    releaseVersion: loaded.releaseVersion,
    createdAt: new Date().toISOString(),
    scope: "visual-presentation-vlm-worklist",
    builderVersion: BUILDER_VERSION,
    manifestPath: loaded.manifestPath,
    reportPath,
    limit,
    counts: {
      totalMediaRecords: mediaRecords.length,
      metadataRecords: metadataRecords.length,
      mediaRecordsWithoutMetadata,
      alreadyAnnotatedCount,
      signalCandidateCount: candidates.length,
      emittedCandidateCount: emittedCandidates.length,
    },
    candidates: emittedCandidates,
    notes: [
      "This report is a VLM worklist only. It does not mutate release shards or update corpus checksums.",
      "Use VLM output to populate media.visualPresentation after validation, then rebuild release artifacts.",
      "The worklist prioritizes likely paper, print, drawing, and photograph records because they often contain removable capture mats or white borders.",
    ],
  };

  writeJsonFile(reportPath, report);
  writeFileSync(reportMarkdownPath, `${buildMarkdownReport(report)}\n`);

  return {
    reportPath,
    reportMarkdownPath,
    report,
  };
}
