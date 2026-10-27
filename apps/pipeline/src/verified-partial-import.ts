import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFileSync, constants, cpSync, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { parseArtworkRecord, parseReleaseManifest, parseSemanticIndex, VISUAL_SUBJECTS, SPATIAL_FRAMINGS,
  type ArtworkRecord, type VisualFacts, type SpatialFraming } from "@artduo/contracts";
import { assertSafeReleaseVersion, galleryArtworkDecision, loadReleaseManifest, resolveShardPath } from "@artduo/corpus";
import { createLocalSemanticEncoder, type SemanticEncoder } from "@artduo/corpus/src/local-semantic-provider";
import { createLocalDepthEstimator, LOCAL_DEPTH_MODEL, type DepthEstimator } from "@artduo/corpus/src/local-depth-provider";
import { loadSemanticIndex } from "@artduo/corpus/src/semantic-loader";
import { semanticFingerprint, semanticSourceFingerprint } from "@artduo/corpus/src/semantic-index";
import { buildEmbeddingRecordsWithProvider } from "./embedding-shards";
import { applyImageMeasurement, measureImage } from "./existing-corpus-repair";
import { normalizeRelativeDepth } from "./model-depth-release";
import { artworkToSemanticText, readReleaseArtworks } from "./semantic-release";
import { PublicImageError, publicImageCachePath, readVerifiedPublicImage } from "@artduo/corpus/src/public-image-cache";
import { readCompletedDepthRecovery } from "./verified-import-recovery";

type Link = { url: string; status: string; record: number; queue: string; completedAt: string };
export interface SnapshotCandidate { candidateId: string; institutionKey: string; links: Link[] }
export interface LinkSnapshot { schemaVersion: 1; sourceFile: string; sourceSha256: string; urlCount: number;
  statusCounts: Record<string, number>; candidates: SnapshotCandidate[] }
export interface ImportReview {
  sourceImageSha256: string; reviewedAt: string; reviewer: "local-image-review";
  view: "complete-frontal" | "detail" | "verso" | "installation" | "technical" | "composite" | "cropped" | "unverified";
  facts: VisualFacts; spatialFraming: SpatialFraming; observation: string;
}
export interface VerifiedImportInput {
  candidateId: string; catalogPath: string; sourceImagePath: string; sourceImageUrl: string;
  review: ImportReview;
  editorial: { description: string; moodTags: string[]; colorTags: string[]; compositionTags: string[];
    energyLevel: "low" | "medium" | "high"; valence: "dark" | "mixed" | "bright"; pace: "still" | "gentle" | "active" };
}
export interface ImportDecision { candidateId: string; institutionKey: string; status: "admitted" | "held";
  successfulUrlCount: number; reasons: string[]; sourceImageUrl?: string }
export interface ReviewedImportArtwork {
  record: ArtworkRecord; preview: Buffer; full: Buffer; review: ImportReview; sourceImageUrl: string;
  sourceImageSha256: string; catalogPath: string; catalogSha256: string;
}
type Accepted = ReviewedImportArtwork;
export type PublicReviewedImportArtwork = Omit<ReviewedImportArtwork, "preview" | "full"> & {
  preview?: Buffer; full?: Buffer; modelInputPath?: string;
};
const sha = (value: Buffer | string) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const required = (value: unknown): value is string => typeof value === "string" && Boolean(value.trim());
function readLocal(root: string, filename: string, maxBytes = 30_000_000): Buffer {
  if (path.isAbsolute(filename)) throw new TypeError("Import files must be project-relative");
  const file = realpathSync(path.resolve(root, filename));
  if (!file.startsWith(realpathSync(root) + path.sep)) throw new TypeError("Import file escapes project root");
  const bytes = readFileSync(file);
  if (bytes.length > maxBytes) throw new TypeError("Import file exceeds the bounded size");
  return bytes;
}
function writeJson(filename: string, value: unknown) {
  const serialized = JSON.stringify(value, null, 2);
  mkdirSync(path.dirname(filename), { recursive: true });
  writeFileSync(filename, serialized + "\n");
  return { checksum: sha(serialized), sizeBytes: Buffer.byteLength(serialized + "\n") };
}
export function readVerifiedLinkSnapshot(rootDir: string, csvPath: string): LinkSnapshot {
  // Python's standard CSV reader handles quoted JSON, embedded newlines and UTF-8 BOMs.
  // This is a local read only: no shell expansion, network, or execution of package files.
  const output = execFileSync("python3", [path.join(rootDir, "scripts/read-verified-link-snapshot.py"), csvPath],
    { encoding: "utf8", maxBuffer: 25_000_000 });
  const snapshot = JSON.parse(output) as LinkSnapshot;
  if (snapshot.schemaVersion !== 1 || snapshot.sourceSha256 !== sha(readFileSync(csvPath))
    || !Array.isArray(snapshot.candidates) || new Set(snapshot.candidates.map(row => row.candidateId)).size !== snapshot.candidates.length) {
    throw new TypeError("Snapshot projection identity mismatch");
  }
  return snapshot;
}

export async function assessVerifiedImport(input: {
  rootDir: string; version: string; snapshot: LinkSnapshot; candidates: VerifiedImportInput[]; existing: ArtworkRecord[];
}): Promise<{ accepted: Accepted[]; decisions: ImportDecision[] }> {
  const supplied = new Map(input.candidates.map(candidate => [candidate.candidateId, candidate]));
  const known = new Set(input.snapshot.candidates.map(candidate => candidate.candidateId));
  if (supplied.size !== input.candidates.length || input.candidates.some(candidate => !known.has(candidate.candidateId))) {
    throw new TypeError("Duplicate or unknown intake candidate identity");
  }
  const existingIds = new Set(input.existing.map(record => record.id));
  const imageHashes = new Set(input.existing.map(record => record.media.sourceAssetFingerprint));
  const accepted: Accepted[] = [], decisions: ImportDecision[] = [];
  for (const candidate of input.snapshot.candidates) {
    const decision: ImportDecision = { candidateId: candidate.candidateId, institutionKey: candidate.institutionKey,
      status: "held", successfulUrlCount: candidate.links.filter(link => link.status === "single_success").length, reasons: [] };
    decisions.push(decision);
    const row = supplied.get(candidate.candidateId);
    if (existingIds.has(candidate.candidateId)) { decision.reasons.push("already-in-release"); continue; }
    if (!decision.successfulUrlCount) decision.reasons.push("no-successful-link");
    if (candidate.institutionKey !== "met") decision.reasons.push("source-adapter-required");
    if (!row) {
      decision.reasons.push("missing-candidate-master", "missing-title", "missing-creator", "missing-date", "missing-medium",
        "missing-object-type", "missing-object-record", "missing-asset-rights", "missing-primary-view");
      continue;
    }
    if (decision.reasons.length) continue;
    try {
      const parsed = new URL(row.sourceImageUrl);
      if (parsed.protocol !== "https:" || parsed.hostname !== "images.metmuseum.org" || parsed.username || parsed.password
        || parsed.port || parsed.hash || parsed.search || row.sourceImageUrl !== parsed.href
        || !candidate.links.some(link => link.url === row.sourceImageUrl && link.status === "single_success")) {
        throw new TypeError("source-image-not-verified");
      }
      const catalogBytes = readLocal(input.rootDir, row.catalogPath, 2_000_000);
      const catalog = JSON.parse(catalogBytes.toString("utf8"));
      const facts = catalog.facts;
      if (catalog.schemaVersion !== 1 || catalog.institutionKey !== "met" || !/^met-\d+$/.test(candidate.candidateId)
        || String(catalog.sourceObjectId) !== candidate.candidateId.slice(4)) throw new TypeError("catalog-identity-mismatch");
      for (const field of ["title", "artistDisplayName", "yearLabel", "medium", "classification", "dimensions", "objectUrl", "creditLine"]) {
        if (!required(facts?.[field])) throw new TypeError(`missing-${field}`);
      }
      const objectUrl = `https://www.metmuseum.org/art/collection/search/${catalog.sourceObjectId}`;
      if (facts.objectUrl !== objectUrl || catalog.rights?.status !== "public-domain" || catalog.rights.evidenceUrl !== objectUrl
        || catalog.pageCheck?.publicDomain !== true) throw new TypeError("asset-rights-unconfirmed");
      const rawBytes = readLocal(input.rootDir, catalog.legacyEvidence.path, 8_000_000);
      if (catalog.legacyEvidence.sha256 !== sha(rawBytes)) throw new TypeError("catalog-evidence-changed");
      const raw = JSON.parse(rawBytes.toString("utf8"));
      const rawRows = Array.isArray(raw) ? raw : raw.artworks ?? [];
      const original = rawRows.find((item: any) => String(item.objectID) === String(catalog.sourceObjectId));
      if (!original || original.isPublicDomain !== true || original.source !== "met") throw new TypeError("catalog-source-unconfirmed");
      const mapped: Record<string, unknown> = { title: original.title, artistDisplayName: original.artist, yearLabel: original.year,
        medium: original.medium, classification: original.classification, dimensions: original.dimensions,
        creditLine: original.creditLine, objectUrl: original.objectURL };
      for (const [key, value] of Object.entries(mapped)) {
        if (facts[key] !== value || catalog.pageCheck.facts?.[key] !== value) throw new TypeError(`catalog-fact-conflict:${key}`);
      }
      const full = readLocal(input.rootDir, row.sourceImagePath);
      const fullSha = sha(full), measured = await measureImage(full);
      if (Math.min(measured.width, measured.height) < 320 || Math.max(measured.width, measured.height) < 1600) throw new TypeError("source-image-too-small");
      const review = row.review;
      if (review?.sourceImageSha256 !== fullSha || review.reviewer !== "local-image-review" || !required(review.reviewedAt)
        || review.view !== "complete-frontal" || !required(review.observation) || review.observation.length > 1400
        || !SPATIAL_FRAMINGS.includes(review.spatialFraming)
        || VISUAL_SUBJECTS.some(subject => !["present", "absent", "unknown"].includes(review.facts?.[subject] ?? ""))
        || Object.keys(review.facts).some(subject => !(VISUAL_SUBJECTS as readonly string[]).includes(subject))) throw new TypeError("visual-review-unconfirmed");
      if (!required(row.editorial.description) || !row.editorial.moodTags.length || !row.editorial.colorTags.length) throw new TypeError("editorial-evidence-missing");
      const preview = await sharp(full).rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
      const previewMeasured = await measureImage(preview);
      if (imageHashes.has(sha(preview)) || imageHashes.has(fullSha)) throw new TypeError("duplicate-image");
      const record = parseArtworkRecord({ id: candidate.candidateId, source: "met", sourceArtworkId: String(catalog.sourceObjectId), version: input.version,
        metadata: { title: facts.title, artistDisplayName: facts.artistDisplayName, yearLabel: facts.yearLabel, medium: facts.medium,
          culture: facts.culture || undefined, department: facts.department || undefined, dimensions: facts.dimensions,
          creditLine: facts.creditLine, objectUrl, sourceApiUrl: `https://collectionapi.metmuseum.org/public/collection/v1/objects/${catalog.sourceObjectId}`,
          descriptionClean: row.editorial.description, storySnippet: row.editorial.description,
          moodTags: row.editorial.moodTags, colorTags: row.editorial.colorTags,
          subjectTags: [facts.classification, ...(facts.subjectTags ?? [])], compositionTags: row.editorial.compositionTags },
        retrieval: { searchText: [facts.title, facts.artistDisplayName, facts.medium, row.editorial.description, ...(facts.subjectTags ?? [])].join(". "),
          searchTextShort: `${facts.title}. ${facts.artistDisplayName}`, emotionLabels: row.editorial.moodTags,
          energyLevel: row.editorial.energyLevel, valence: row.editorial.valence, pace: row.editorial.pace,
          spaceSense: review.spatialFraming === "open" ? "open" : "balanced" },
        media: { imageUrlFull: `images/${candidate.candidateId}-full.jpg`, hasMotionAsset: false, mediaVersion: input.version,
          sourceAssetFingerprint: sha(preview), imageUrlPreview: `images/${candidate.candidateId}-preview.jpg` },
        presentation: { grade: "A", gradeLabel: "director-focus", motionProfile: "parallax", narrationMode: "caption" } });
      applyImageMeasurement(record, previewMeasured, `images/${candidate.candidateId}-preview.jpg`);
      if (galleryArtworkDecision({ id: record.id, ...record.metadata }).status !== "eligible") throw new TypeError("not-ready-for-current-gallery");
      imageHashes.add(fullSha); imageHashes.add(sha(preview)); existingIds.add(record.id);
      accepted.push({ record, preview, full, review, sourceImageUrl: row.sourceImageUrl, sourceImageSha256: fullSha,
        catalogPath: row.catalogPath, catalogSha256: sha(catalogBytes) });
      decision.status = "admitted"; decision.sourceImageUrl = row.sourceImageUrl;
    } catch (error) { decision.reasons.push(error instanceof Error ? error.message : String(error)); }
  }
  return { accepted, decisions };
}

export async function buildVerifiedPartialRelease(options: {
  rootDir: string; snapshotCsv: string; intakePath: string; baseVersion: string; version: string;
  encoder?: SemanticEncoder; estimator?: DepthEstimator; activate?: boolean; resume?: boolean;
  onProgress?: (progress: { phase: "semantic" | "depth"; completed: number; total: number }) => void;
}) {
  const root = path.resolve(options.rootDir);
  const base = loadReleaseManifest({ rootDir: root, releaseVersion: options.baseVersion });
  const snapshot = readVerifiedLinkSnapshot(root, options.snapshotCsv);
  const intake = JSON.parse(readLocal(root, options.intakePath, 4_000_000).toString("utf8"));
  if (intake.schemaVersion !== 1 || !Array.isArray(intake.candidates)) throw new TypeError("Invalid verified intake");
  const previous = readReleaseArtworks(base.manifestPath, base.manifest);
  const assessment = await assessVerifiedImport({ rootDir: root, version: options.version, snapshot, candidates: intake.candidates, existing: previous });
  return publishVerifiedIntake({ ...options, snapshot, assessment });
}

/** Both local and public-URL intake use the same immutable publication gates. */
export async function publishVerifiedIntake(options: {
  rootDir: string; baseVersion: string; version: string; snapshot: LinkSnapshot;
  assessment: { accepted: PublicReviewedImportArtwork[]; decisions: ImportDecision[] };
  encoder?: SemanticEncoder; estimator?: DepthEstimator; activate?: boolean;
  onProgress?: (progress: { phase: "semantic" | "depth"; completed: number; total: number }) => void;
  evictProcessedSourceCache?: boolean;
  resume?: boolean; completedDepthRecovery?: string; sourceFailureLog?: string;
}) {
  sharp.concurrency(1);
  sharp.cache({ memory: 32, files: 8, items: 16 });
  const root = path.resolve(options.rootDir), version = assertSafeReleaseVersion(options.version);
  const base = loadReleaseManifest({ rootDir: root, releaseVersion: options.baseVersion });
  const work = path.join(root, "data/curation/verified-import", version);
  const directory = path.join(work, "release"), destination = path.join(root, "data/releases", version);
  if (version === options.baseVersion || existsSync(destination) || existsSync(directory) && !options.resume)
    throw new TypeError("Import version already exists; immutable releases cannot be replaced");
  const checkpointPath = path.join(work, "depth-progress.jsonl");
  const recovered = options.completedDepthRecovery ? readCompletedDepthRecovery(root, options.completedDepthRecovery, version, options.baseVersion) : undefined;
  if (existsSync(directory) && options.resume && !recovered && !existsSync(checkpointPath))
    throw new TypeError("Staging has no verified recovery checkpoint");
  const preprocessing = "whole-frame; EXIF orientation; max-long-edge 768; no enlargement; PNG";
  const completed = new Map<string, any>();
  if (options.resume && existsSync(checkpointPath)) for (const line of readFileSync(checkpointPath, "utf8").split("\n").filter(Boolean)) {
    const saved = JSON.parse(line);
    if (saved.schemaVersion !== 1 || saved.releaseVersion !== version || saved.baseVersion !== options.baseVersion
      || saved.modelWeightsSha256 !== LOCAL_DEPTH_MODEL.weightsSha256 || saved.record.inputPreprocessing !== preprocessing
      || completed.has(saved.record.artworkId)) throw new TypeError("Invalid depth recovery checkpoint");
    completed.set(saved.record.artworkId, saved.record);
  }
  const { snapshot, assessment } = options;
  const previous = readReleaseArtworks(base.manifestPath, base.manifest);
  const baseIndex = loadSemanticIndex({ manifestPath: base.manifestPath, manifest: base.manifest,
    artworks: previous.map(record => ({ id: record.id, text: artworkToSemanticText(record) })) });
  if (!baseIndex) throw new TypeError("A verified semantic base is required");
  const report = { schemaVersion: 1, releaseVersion: version, baseVersion: options.baseVersion, snapshot: {
    file: snapshot.sourceFile, sha256: snapshot.sourceSha256, urlCount: snapshot.urlCount, statusCounts: snapshot.statusCounts },
    candidateCount: snapshot.candidates.length, admittedCount: assessment.accepted.length,
    heldCount: assessment.decisions.filter(row => row.status === "held").length, decisions: assessment.decisions };
  writeJson(path.join(work, "admission-report.json"), report);
  writeJson(path.join(work, "snapshot-projection.json"), snapshot);
  const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const missing = [["candidateId", "institutionKey", "status", "successfulUrlCount", "missingOrBlocked"],
    ...report.decisions.filter(row => row.status === "held").map(row => [row.candidateId, row.institutionKey, row.status, row.successfulUrlCount, row.reasons.join(" | ")])];
  writeFileSync(path.join(work, "missing-materials.csv"), "\ufeff" + missing.map(row => row.map(csvCell).join(",")).join("\n") + "\n");
  if (!assessment.accepted.length) return { report, directory: undefined, activated: false };
  const ledgerPath = path.join(root, "data/curation/visual-reviews", `${options.baseVersion}.json`);
  const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
  if (ledger.schemaVersion !== 2 || ledger.releaseVersion !== options.baseVersion) throw new TypeError("A complete image-bound base ledger is required");
  for (const review of ledger.reviews) {
    const record = previous.find(record => record.id === review.artworkId);
    if (!record || review.imagePath !== record.media.imageUrlPreview) throw new TypeError("Base visual review image changed");
    const remote = record.media.verifiedRemoteImage;
    if (remote ? remote.url !== review.imagePath || remote.sha256 !== review.imageSha256
      : sha(readLocal(root, path.relative(root, path.join(base.releaseDir, review.imagePath)))) !== review.imageSha256) throw new TypeError("Base visual review image changed");
  }
  const records = [...previous.map(record => {
    const next = structuredClone(record); next.version = version;
    if (next.media.depthMap) next.media.depthMap.version = version;
    return next;
  }), ...assessment.accepted.map(item => item.record)];
  const seenIds = new Set(previous.map(record => record.id)), seenImages = new Set(previous.map(record => record.media.sourceAssetFingerprint));
  for (const item of assessment.accepted) {
    parseArtworkRecord(item.record);
    if (seenIds.has(item.record.id) || seenImages.has(item.record.media.sourceAssetFingerprint)
      || item.record.version !== version || galleryArtworkDecision({ id: item.record.id, ...item.record.metadata }).status !== "eligible"
      || sha(readLocal(root, item.catalogPath, 4_000_000)) !== item.catalogSha256) throw new TypeError(`Publication intake changed: ${item.record.id}`);
    seenIds.add(item.record.id); seenImages.add(item.record.media.sourceAssetFingerprint);
  }
  const encoder = options.encoder ?? createLocalSemanticEncoder({ rootDir: root, allowDownload: false });
  let vectors: number[][];
  try {
    if (Object.keys(baseIndex.model).some(key => encoder.model[key as keyof typeof encoder.model] !== baseIndex.model[key as keyof typeof baseIndex.model])) throw new TypeError("Import encoder must match the base semantic model");
    vectors = [];
    for (let offset = 0; offset < assessment.accepted.length; offset += 8) {
      vectors.push(...await encoder.embedDocuments(assessment.accepted.slice(offset, offset + 8).map(item => artworkToSemanticText(item.record))));
      options.onProgress?.({ phase: "semantic", completed: vectors.length, total: assessment.accepted.length });
    }
  } finally { if (!options.encoder) await encoder.dispose(); }
  if (vectors.length !== assessment.accepted.length) throw new TypeError("Import semantic vector count mismatch");
  const indexRecords = parseSemanticIndex({ schemaVersion: 1, releaseVersion: version, sourceFingerprint: "pending", model: baseIndex.model,
    records: [...baseIndex.records, ...assessment.accepted.map((item, offset) => ({ artworkId: item.record.id,
      textFingerprint: semanticFingerprint(artworkToSemanticText(item.record)), vector: vectors[offset] }))] }).records;
  mkdirSync(work, { recursive: true });
  const baseDepth = JSON.parse(readFileSync(path.join(base.releaseDir, "depth-report.json"), "utf8"));
  const inheritedDepth = baseDepth.records.filter((row: any) => previous.some(record => record.id === row.artworkId
    && galleryArtworkDecision({ id: record.id, ...record.metadata }).status === "eligible"));
  if (baseDepth.model?.weightsSha256 !== LOCAL_DEPTH_MODEL.weightsSha256
    || new Set(inheritedDepth.map((row: any) => row.artworkId)).size !== inheritedDepth.length
    || inheritedDepth.length !== previous.filter(record => galleryArtworkDecision({ id: record.id, ...record.metadata }).status === "eligible").length) throw new TypeError("Base depth report is incomplete or uses a different model");
  for (const row of inheritedDepth) {
    const record = previous.find(record => record.id === row.artworkId)!;
    if (row.inputSha256 !== record.media.sourceAssetFingerprint
      || sha(readLocal(root, path.relative(root, path.join(base.releaseDir, row.url)))) !== `sha256:${row.outputSha256}`) throw new TypeError("Base depth evidence changed");
  }
  if (!existsSync(directory)) cpSync(base.releaseDir, directory, { recursive: true, errorOnExist: true, force: false, mode: constants.COPYFILE_FICLONE,
    filter: source => path.dirname(source) !== base.releaseDir || !/-(?:report|progress)\.json$/u.test(path.basename(source)) });
  mkdirSync(path.join(directory, "images"), { recursive: true });
  mkdirSync(path.join(directory, "depth"), { recursive: true });
  let estimator = options.estimator;
  const depthRows: any[] = [];
  try {
    for (const item of assessment.accepted) {
      const record = item.record;
      const remote = record.media.verifiedRemoteImage;
      const url = `depth/${encodeURIComponent(record.id)}.png`;
      const saved = completed.get(record.id);
      if (saved) {
        const bytes = readFileSync(path.join(directory, url));
        const retained = recovered?.records.get(record.id);
        const inputEvidence = /^sha256:[a-f0-9]{64}$/u.test(saved.modelInputSha256)
          || retained?.inputSha256 === saved.inputSha256 && retained?.outputSha256 === saved.outputSha256
            && saved.recoveredFromCompletedRun?.runLogSha256 === recovered?.runLogSha256;
        if (saved.url !== url || saved.inputSha256 !== record.media.sourceAssetFingerprint
          || !inputEvidence
          || sha(bytes) !== `sha256:${saved.outputSha256}` || bytes.subarray(1, 4).toString() !== "PNG"
          || bytes.readUInt32BE(16) !== saved.width || bytes.readUInt32BE(20) !== saved.height)
          throw new TypeError(`Depth recovery checkpoint changed: ${record.id}`);
        record.media.depthMap = { url, version, sourceAssetFingerprint: record.media.sourceAssetFingerprint!, method: "model" };
        depthRows.push(saved);
        options.onProgress?.({ phase: "depth", completed: depthRows.length, total: assessment.accepted.length });
        continue;
      }
      const retainedOutput = recovered?.records.get(record.id);
      if (retainedOutput && remote) {
        const bytes = readFileSync(path.join(directory, url));
        const scale = Math.min(1, 1024 / Math.max(remote.width, remote.height));
        const width = Math.max(1, Math.round(remote.width * scale)), height = Math.max(1, Math.round(remote.height * scale));
        if (item.review.sourceImageSha256 !== remote.sha256 || retainedOutput.inputSha256 !== remote.sha256
          || sha(bytes) !== `sha256:${retainedOutput.outputSha256}` || bytes.subarray(1, 4).toString() !== "PNG"
          || bytes.readUInt32BE(16) !== width || bytes.readUInt32BE(20) !== height)
          throw new TypeError(`Completed model/source evidence changed: ${record.id}`);
        const row = { artworkId: record.id, url, inputSha256: remote.sha256, outputSha256: retainedOutput.outputSha256,
          width, height, sourceWidth: remote.width, sourceHeight: remote.height, inputPreprocessing: preprocessing,
          recoveredFromCompletedRun: { runLogSha256: recovered!.runLogSha256, ordinal: retainedOutput.ordinal,
            rawNormalizationRange: "not-retained-before-interruption", preprocessedInputDigest: "not-retained-before-interruption" } };
        appendFileSync(checkpointPath, JSON.stringify({ schemaVersion: 1, releaseVersion: version, baseVersion: options.baseVersion,
          modelWeightsSha256: LOCAL_DEPTH_MODEL.weightsSha256, record: row }) + "\n");
        record.media.depthMap = { url, version, sourceAssetFingerprint: remote.sha256, method: "model" };
        depthRows.push(row);
        options.onProgress?.({ phase: "depth", completed: depthRows.length, total: assessment.accepted.length });
        continue;
      }
      let inputPath: string, width: number, height: number;
      if (remote) {
        if (item.review.sourceImageSha256 !== remote.sha256) throw new TypeError(`Public image review changed: ${record.id}`);
        try { await readVerifiedPublicImage(root, remote); }
        catch (error) {
          if (options.sourceFailureLog) appendFileSync(options.sourceFailureLog, JSON.stringify({ candidateId: record.id,
            url: remote.url, sha256: remote.sha256, host: error instanceof PublicImageError ? error.host ?? new URL(remote.url).hostname : new URL(remote.url).hostname,
            status: error instanceof PublicImageError ? error.status : undefined,
            reason: "publication-image-fetch-failed", error: error instanceof Error ? error.message : String(error), at: new Date().toISOString() }) + "\n");
          throw error;
        }
        inputPath = publicImageCachePath(root, remote.sha256);
        const scale = Math.min(1, 1024 / Math.max(remote.width, remote.height));
        width = Math.max(1, Math.round(remote.width * scale)); height = Math.max(1, Math.round(remote.height * scale));
      } else {
        if (!item.preview || !item.full) throw new TypeError(`Missing local image bytes: ${record.id}`);
        writeFileSync(path.join(directory, record.media.imageUrlPreview!), item.preview);
        writeFileSync(path.join(directory, record.media.imageUrlFull!), item.full);
        inputPath = path.join(directory, record.media.imageUrlPreview!);
        ({ width, height } = await measureImage(item.preview));
      }
      // Decode and reduce the complete source in libvips before Transformers
      // creates raw pixel arrays. An 80 MP source must not become several full
      // JS copies merely to feed a model whose input is bounded to 768 pixels.
      const modelInput = path.join(work, `depth-input-${encodeURIComponent(record.id)}.png`);
      await sharp(inputPath).rotate().resize({ width: 768, height: 768, fit: "inside", withoutEnlargement: true })
        .png({ compressionLevel: 1 }).toFile(modelInput);
      const modelInputSha256 = sha(readFileSync(modelInput));
      const retained = recovered?.records.get(record.id);
      let range: Record<string, unknown>;
      try {
        if (retained) {
          const bytes = readFileSync(path.join(directory, url));
          if (retained.inputSha256 !== record.media.sourceAssetFingerprint || sha(bytes) !== `sha256:${retained.outputSha256}`
            || bytes.subarray(1, 4).toString() !== "PNG" || bytes.readUInt32BE(16) !== width || bytes.readUInt32BE(20) !== height)
            throw new TypeError(`Original completed depth evidence changed: ${record.id}`);
          range = { recoveredFromCompletedRun: { runLogSha256: recovered!.runLogSha256, ordinal: retained.ordinal,
            rawNormalizationRange: "not-retained-before-interruption" } };
        } else {
          estimator ??= await createLocalDepthEstimator(root);
          const prediction = await estimator.predict(modelInput);
          const normalized = normalizeRelativeDepth(prediction);
          await sharp(normalized.pixels, { raw: { width: prediction.width, height: prediction.height, channels: 1 } })
            .resize(width, height, { kernel: "cubic" }).png().toFile(path.join(directory, url));
          range = { low: normalized.low, high: normalized.high };
        }
      } finally { if (existsSync(modelInput)) unlinkSync(modelInput); }
      record.media.depthMap = { url, version, sourceAssetFingerprint: record.media.sourceAssetFingerprint!, method: "model" };
      const row = { artworkId: record.id, url, inputSha256: record.media.sourceAssetFingerprint,
        outputSha256: sha(readFileSync(path.join(directory, url))).slice(7), width, height,
        ...(remote ? { sourceWidth: remote.width, sourceHeight: remote.height } : {}),
        modelInputSha256, inputPreprocessing: preprocessing, ...range };
      appendFileSync(checkpointPath, JSON.stringify({ schemaVersion: 1, releaseVersion: version, baseVersion: options.baseVersion,
        modelWeightsSha256: LOCAL_DEPTH_MODEL.weightsSha256, record: row }) + "\n");
      depthRows.push(row);
      options.onProgress?.({ phase: "depth", completed: depthRows.length, total: assessment.accepted.length });
      if (remote && options.evictProcessedSourceCache) {
        const cached = publicImageCachePath(root, remote.sha256);
        if (existsSync(cached)) unlinkSync(cached);
      }
    }
  } finally { if (!options.estimator) await estimator?.dispose(); }
  const fallback = await buildEmbeddingRecordsWithProvider(records);
  const manifest = structuredClone(base.manifest);
  manifest.release.corpusVersion = version; manifest.release.createdAt = new Date().toISOString();
  if (assessment.accepted.some(item => item.record.media.verifiedRemoteImage)) manifest.release.contractsVersion = "2026-10-21-public-url-v1";
  const shards = {
    metadata: records.map(({ retrieval, media, ...record }) => record),
    search: records.map(({ id, source, sourceArtworkId, version, retrieval }) => ({ id, source, sourceArtworkId, version, retrieval })),
    mediaIndex: records.map(({ id, source, sourceArtworkId, version, media }) => ({ id, source, sourceArtworkId, version, media })),
    embeddings: fallback,
  };
  for (const kind of ["metadata", "search", "mediaIndex", "embeddings"] as const) {
    const filename = { metadata: "metadata-01.json", search: "search-01.json", mediaIndex: "media-01.json", embeddings: "embeddings-01.json" }[kind];
    manifest.shards[kind] = [{ id: `${kind}-01`, url: `./${filename}`, ...writeJson(path.join(directory, filename), shards[kind]), recordCount: records.length }];
  }
  const index = parseSemanticIndex({ schemaVersion: 1, releaseVersion: version, sourceFingerprint: semanticSourceFingerprint(manifest), model: baseIndex.model,
    records: indexRecords });
  manifest.shards.semanticEmbeddings = [{ id: "semantic-index", url: "./semantic-index.json", ...writeJson(path.join(directory, "semantic-index.json"), index), recordCount: records.length }];
  writeJson(path.join(directory, "manifest.json"), parseReleaseManifest(manifest));
  writeJson(path.join(directory, "depth-report.json"), { schemaVersion: 1, baseVersion: options.baseVersion, releaseVersion: version,
    model: LOCAL_DEPTH_MODEL, normalization: baseDepth.normalization, count: inheritedDepth.length + depthRows.length,
    inheritedCount: inheritedDepth.length, addedCount: depthRows.length, records: [...inheritedDepth, ...depthRows] });
  const nextLedger = { ...ledger, releaseVersion: version,
    scope: `${ledger.scope} New entries retain the same assistant preview-review scope; no museum or independent human verification is claimed.`,
    reviews: [...ledger.reviews, ...assessment.accepted.map(item => ({ artworkId: item.record.id, imagePath: item.record.media.imageUrlPreview,
      imageSha256: item.record.media.sourceAssetFingerprint, reviewedAt: item.review.reviewedAt, reviewer: item.review.reviewer,
      facts: item.review.facts, spatialFraming: item.review.spatialFraming, observation: item.review.observation }))] };
  const newLedgerPath = path.join(root, "data/curation/visual-reviews", `${version}.json`);
  if (existsSync(newLedgerPath)) throw new TypeError("Import visual ledger already exists");
  writeJson(path.join(work, "visual-reviews.json"), nextLedger);
  writeJson(path.join(directory, "visual-reviews.json"), nextLedger);
  writeJson(path.join(directory, "verified-import-report.json"), { ...report, eligibleCount: records.filter(record => galleryArtworkDecision({ id: record.id, ...record.metadata }).status === "eligible").length,
    sourceEvidence: assessment.accepted.map(({ record, sourceImageUrl, sourceImageSha256, catalogPath, catalogSha256 }) => ({ artworkId: record.id, sourceImageUrl, sourceImageSha256, catalogPath, catalogSha256 })),
    depth: { model: LOCAL_DEPTH_MODEL, added: depthRows } });
  const verified = readReleaseArtworks(path.join(directory, "manifest.json"), manifest);
  loadSemanticIndex({ manifestPath: path.join(directory, "manifest.json"), manifest,
    artworks: verified.map(record => ({ id: record.id, text: artworkToSemanticText(record) })) });
  if (verified.length !== previous.length + assessment.accepted.length || verified.some(record => record.version !== version)) throw new TypeError("Import release count/version mismatch");
  for (const record of verified.filter(record => galleryArtworkDecision({ id: record.id, ...record.metadata }).status === "eligible")) {
    const review = nextLedger.reviews.find((row: any) => row.artworkId === record.id);
    if (!review || review.imageSha256 !== record.media.sourceAssetFingerprint || !record.media.depthMap
      || record.media.depthMap.version !== version || record.media.depthMap.sourceAssetFingerprint !== record.media.sourceAssetFingerprint
      || !existsSync(path.join(directory, record.media.depthMap.url))) throw new TypeError(`Incomplete immersive evidence: ${record.id}`);
  }
  if (options.activate) {
    writeJson(newLedgerPath, nextLedger);
    renameSync(directory, destination);
    return { report, directory: destination, activated: true };
  }
  return { report, directory, activated: false };
}
