import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { ARTWORK_SOURCES, VISUAL_SUBJECTS, SPATIAL_FRAMINGS, parseArtworkRecord, type ArtworkSource,
  type VerifiedRemoteImage, type ArtworkRecord, type VisualFacts } from "@artduo/contracts";
import { galleryArtworkDecision } from "@artduo/corpus";
import { assertPublicImageUrl, cachePublicImage, fetchPublicImage, publicImageCachePath, publicImageDigest,
  PublicImageError, readCachedPublicImage } from "@artduo/corpus/src/public-image-cache";
import { applyImageMeasurement, measureImage } from "./existing-corpus-repair";
import type { ImportDecision, ImportReview, PublicReviewedImportArtwork } from "./verified-partial-import";

type SourceObject = Record<string, any>;
export interface PublicImageCandidate {
  url: string; historicalStatus: "single_success" | "not_measured"; queue: string; assetKey: string;
  isPrimary: boolean; view?: string; licence?: string; attribution?: string;
  licenceEvidenceStatus: string; evidence: SourceObject[]; objectSource: SourceObject;
  iiifImageServiceUrl?: string; originalUrl?: string;
  nativeDimensions?: { width: number; height: number; source: SourceObject; widthPointer: string; heightPointer: string };
  derivation?: { kind: "iiif-full-frame-bounded"; serviceUrl: string; size: string; quality: "default" | "native";
    infoUrl: string; infoSha256: string; infoKind?: "iiif-info-response" | "archived-source-record";
    originalWidth: number; originalHeight: number; maximumLongEdge: number };
}
export interface PublicIntakeCandidate {
  candidateId: string; institutionKey: string; identity: SourceObject; facts: SourceObject;
  presentationMode: string; reasons: string[]; images: PublicImageCandidate[];
  sourceEvidence: SourceObject; metadataEvidence: string[]; candidateLineSha256: string;
}
export interface PublicIntake { schemaVersion: 1; candidateCount: number; candidates: PublicIntakeCandidate[]; inputFiles: Record<string, string> }
export interface PublicImageReceipt {
  candidateId: string; status: "fetched" | "held"; at: string; reasons: string[];
  image?: PublicImageCandidate; ref?: VerifiedRemoteImage;
  supersedes?: string; correctionKind?: "client-guard-correction" | "primary-image-selection-correction" | "declared-service-adapter-correction" | "receipt-schema-upgrade" | "client-storage-recovery";
}
export interface PublicVisualReview extends ImportReview {
  candidateId: string;
  editorial: { description: string; moodTags: string[]; colorTags: string[]; compositionTags: string[];
    energyLevel: "low" | "medium" | "high"; valence: "dark" | "mixed" | "bright"; pace: "still" | "gentle" | "active" };
}
export const publicImportHash = (bytes: string | Buffer) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
export function writePublicImportJson(filename: string, value: unknown) {
  mkdirSync(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${randomUUID()}.tmp`;
  try { writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n", { flag: "wx" }); renameSync(temporary, filename); }
  finally { if (existsSync(temporary)) unlinkSync(temporary); }
}

export function readPublicUrlIntake(rootDir: string, inputDir: string, policyPath: string): PublicIntake {
  const raw = execFileSync("python3", [path.join(rootDir, "scripts/read-public-url-intake.py"), inputDir, policyPath], { encoding: "utf8", maxBuffer: 70_000_000 });
  const intake = JSON.parse(raw) as PublicIntake;
  if (intake.schemaVersion !== 1 || intake.candidates.length !== intake.candidateCount
    || new Set(intake.candidates.map(row => row.candidateId)).size !== intake.candidateCount) throw new TypeError("Invalid public URL intake identities");
  return intake;
}

function nonAuthorReference(creator: SourceObject): boolean {
  if (/^publisher$/iu.test(String(creator.role ?? "").trim())) return true;
  const fields = [creator.nameOriginal, creator.attribution, creator.role].filter(Boolean).map(String);
  return fields.some(value => /\b(?:formerly|earlier|previously)\s+(?:attributed|ascribed)\s+to\b/iu.test(value)
    || /^(?:copy\s+)?after(?:\s|$)/iu.test(value.trim()));
}

export function publicCandidateReasons(row: PublicIntakeCandidate): string[] {
  const reasons = [...row.reasons];
  const facts = row.facts, creators = facts.creators as SourceObject[] | undefined;
  if (!(ARTWORK_SOURCES as readonly string[]).includes(row.institutionKey)) reasons.push("source-adapter-required");
  if (!String(facts.titleOriginal ?? "").trim()) reasons.push("missing-title");
  if (!creators?.some(creator => typeof creator.nameOriginal === "string" && creator.nameOriginal.trim())) reasons.push("missing-creator-name");
  else if (!creators.some(creator => String(creator.nameOriginal ?? "").trim() && !nonAuthorReference(creator))) reasons.push("missing-current-creator");
  if (!String(facts.dateDisplay ?? "").trim()) reasons.push("missing-date");
  if (!String(facts.medium ?? "").trim()) reasons.push("missing-medium");
  if (!String(facts.objectType ?? "").trim()) reasons.push("missing-object-type");
  if (!["flat-image", "scroll"].includes(row.presentationMode)) reasons.push(`unsupported-presentation:${row.presentationMode}`);
  if (galleryArtworkDecision({ id: row.candidateId, medium: facts.medium ?? undefined, subjectTags: [facts.objectType ?? ""] }).status !== "eligible") reasons.push("not-ready-for-current-gallery");
  if (!row.images.length) reasons.push("no-bound-licensed-public-image");
  return [...new Set(reasons)];
}

function imageQuality(url: string): number {
  if (/\/full\/(?:max|full)\//u.test(url)) return 20000;
  const dimensions = url.match(/\/full\/!?([0-9]+),([0-9]*)\//u);
  if (dimensions) return Math.max(Number(dimensions[1]), Number(dimensions[2] || "0"));
  const fng = url.match(/\/jpg\/(\d+)\//u);
  if (fng) return Number(fng[1]);
  if (/thumb/iu.test(url)) return 300;
  return 10000;
}

export function choosePublicImage(row: PublicIntakeCandidate): PublicImageCandidate | undefined {
  return [...row.images].filter(image => { try { assertPublicImageUrl(image.url); return true; } catch { return false; } }).sort((a, b) => {
    // Do not choose a known thumbnail simply because it once transferred.
    const rank = (image: PublicImageCandidate) => (imageQuality(image.url) >= 1600 ? 100000 : 0)
      + (image.historicalStatus === "single_success" ? 50000 : 0) + (image.isPrimary ? 1_000_000 : 0) + imageQuality(image.url);
    return rank(b) - rank(a) || a.url.localeCompare(b.url);
  })[0];
}

export function readPublicImageReceipts(filename: string): Map<string, PublicImageReceipt> {
  if (!existsSync(filename)) return new Map();
  const rows = readFileSync(filename, "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line) as PublicImageReceipt);
  const latest = new Map<string, PublicImageReceipt>();
  for (const row of rows) {
    const previous = latest.get(row.candidateId);
    if (previous && (row.supersedes !== publicImportHash(JSON.stringify(previous)) || !["client-guard-correction", "primary-image-selection-correction", "declared-service-adapter-correction", "receipt-schema-upgrade", "client-storage-recovery"].includes(row.correctionKind ?? ""))) throw new TypeError("Unexplained duplicate acquisition receipt");
    latest.set(row.candidateId, row);
  }
  return latest;
}

/** A failed main-image improvement does not erase an already decoded alternative. */
export function readPublicImageArtifacts(filename: string): Map<string, PublicImageReceipt[]> {
  const result = new Map<string, PublicImageReceipt[]>();
  if (!existsSync(filename)) return result;
  readPublicImageReceipts(filename); // Validate every supersedes link before using history.
  for (const line of readFileSync(filename, "utf8").split("\n").filter(Boolean)) {
    const receipt = JSON.parse(line) as PublicImageReceipt;
    if (receipt.status !== "fetched" || !receipt.ref) continue;
    const previous = result.get(receipt.candidateId) ?? [];
    result.set(receipt.candidateId, [receipt, ...previous.filter(row => row.ref?.sha256 !== receipt.ref?.sha256)]);
  }
  return result;
}

/** A size derivative retains the whole image. It never changes the region or bypasses a refusal. */
async function boundedIiifImage(image: PublicImageCandidate, options: { rootDir: string; workDir: string; fetchImpl?: typeof fetch; stoppedHosts: Set<string> }): Promise<PublicImageCandidate> {
  const service = image.iiifImageServiceUrl?.replace(/\/$/u, "");
  const sourceHost = assertPublicImageUrl(image.url).hostname;
  const directWhole = service && image.url.startsWith(service + "/full/") && /\/full\/[^/]+\/0\/(?:default|native)\.jpg$/u.test(image.url);
  const declaredSmkPrimary = image.isPrimary && ["api.smk.dk", "iip-thumb.smk.dk"].includes(sourceHost)
    && service?.startsWith("https://iip.smk.dk/iiif/");
  const declaredSmithsonian = sourceHost === "ids.si.edu" && service?.startsWith("https://ids.si.edu/ids/iiif/");
  if (!service || !(directWhole || declaredSmkPrimary || declaredSmithsonian)) throw new TypeError("bounded-whole-image-service-unconfirmed");
  assertPublicImageUrl(service + "/info.json");
  const archived = image.nativeDimensions;
  const useArchived = archived && [archived.width, archived.height].every(n => Number.isSafeInteger(n) && n > 0);
  const infoUrl = useArchived ? archived.source.sourceRecordUrl : service + "/info.json";
  const infoBytes = useArchived ? Buffer.from(JSON.stringify({ evidenceType: "archived-source-record", width: archived.width, height: archived.height,
    serviceUrl: service, source: archived.source, widthPointer: archived.widthPointer, heightPointer: archived.heightPointer }))
    : (await fetchPublicImage(infoUrl, { ...options, kind: "iiif-info", timeoutMs: 20000 })).body;
  const value = JSON.parse(infoBytes.toString("utf8"));
  const infoId = value.id ?? value["@id"];
  if (typeof infoId === "string" && infoId.replace(/^http:/u, "https:").replace(/\/$/u, "") !== service) throw new TypeError("image-info-service-mismatch");
  const width = value.width, height = value.height;
  if (![width, height].every(n => Number.isSafeInteger(n) && n > 0)) throw new TypeError("bounded-image-native-dimensions-unconfirmed");
  const infoSha256 = publicImageDigest(infoBytes);
  const basename = infoSha256.slice(7) + ".json";
  mkdirSync(path.join(options.workDir, "iiif-info"), { recursive: true });
  writeFileSync(path.join(options.workDir, "iiif-info", basename), infoBytes);
  const size = Math.max(width, height) > 4000 ? "!4000,4000" : "full";
  const quality = new URL(service).hostname === "iip.smk.dk" ? "native" as const : "default" as const;
  return { ...image, originalUrl: image.originalUrl ?? image.url, url: `${service}/full/${size}/0/${quality}.jpg`, historicalStatus: "not_measured",
    derivation: { kind: "iiif-full-frame-bounded", serviceUrl: service, size, quality, infoUrl, infoSha256,
      infoKind: useArchived ? "archived-source-record" : "iiif-info-response",
      originalWidth: width, originalHeight: height, maximumLongEdge: Math.min(4000, Math.max(width, height)) } };
}

/** Acquire all qualified candidates; successful historical URLs are processed first. */
export async function acquirePublicImages(options: { rootDir: string; intake: PublicIntake; existingIds: Set<string>; workDir: string;
  fetchImpl?: typeof fetch; delayMs?: number; recoverClientErrors?: boolean; historicalOnly?: boolean; signal?: AbortSignal;
  onProgress?: (progress: Record<string, unknown>) => void }) {
  mkdirSync(options.workDir, { recursive: true });
  sharp.concurrency(1);
  sharp.cache({ memory: 32, files: 8, items: 16 });
  const filename = path.join(options.workDir, "image-receipts.jsonl");
  const receipts = readPublicImageReceipts(filename);
  const stopFile = path.join(options.workDir, "stopped-hosts.json");
  const stoppedHosts = new Set<string>(existsSync(stopFile) ? JSON.parse(readFileSync(stopFile, "utf8")) : []);
  const byHost = new Map<string, Array<{ row: PublicIntakeCandidate; image: PublicImageCandidate }>>();
  const preflightHolds: Array<{ candidateId: string; reasons: string[] }> = [];
  const deferred: string[] = [];
  const append = (row: PublicImageReceipt) => { appendFileSync(filename, JSON.stringify(row) + "\n"); receipts.set(row.candidateId, row); };
  for (const previous of [...receipts.values()]) {
    const image = previous.image, legacy = image?.derivation;
    if (!previous.ref || !image || !legacy || legacy.serviceUrl) continue;
    const match = image.url.match(/^(.*)\/full\/([^/]+)\/0\/(default|native)\.jpg$/u);
    if (!match || legacy.infoUrl !== match[1] + "/info.json") throw new TypeError("Legacy derivative receipt cannot be upgraded safely");
    append({ ...previous, at: new Date().toISOString(), supersedes: publicImportHash(JSON.stringify(previous)), correctionKind: "receipt-schema-upgrade",
      image: { ...image, derivation: { ...legacy, serviceUrl: match[1], size: match[2], quality: match[3] as "default" | "native" } } });
  }
  for (const row of options.intake.candidates) {
    const previous = receipts.get(row.candidateId);
    const storageCorrection = options.recoverClientErrors && previous?.status === "held" && previous.correctionKind !== "client-storage-recovery"
      && previous.reasons.some(reason => /ENOSPC|No space left on device/iu.test(reason));
    const primaryCorrection = options.recoverClientErrors && row.institutionKey === "smk" && previous?.image && !previous.image.isPrimary
      && choosePublicImage(row)?.isPrimary && previous.correctionKind !== "primary-image-selection-correction"
      && !previous.reasons.some(reason => reason.includes("source-access-stopped") || reason.includes("source-host-stopped"));
    const serviceCorrection = options.recoverClientErrors && previous?.status === "held" && previous.correctionKind !== "declared-service-adapter-correction"
      && previous.reasons.includes("bounded-whole-image-service-unconfirmed") && choosePublicImage(row)?.iiifImageServiceUrl;
    const correctable = options.recoverClientErrors && previous?.status === "held" && !previous.correctionKind
      && previous.reasons.some(reason => reason.startsWith("image-body-too-large")
        || reason === "bounded-whole-image-service-unconfirmed" && previous.image?.iiifImageServiceUrl
        || reason === "unapproved-public-image-url" && previous.image?.url.startsWith("https://ids.si.edu/"));
    if (previous && !correctable && !primaryCorrection && !serviceCorrection && !storageCorrection || options.existingIds.has(row.candidateId)) continue;
    const reasons = publicCandidateReasons(row), image = choosePublicImage(row);
    if (!image) reasons.push("no-supported-public-image-url");
    if (reasons.length || !image) { preflightHolds.push({ candidateId: row.candidateId, reasons: [...new Set(reasons)] }); continue; }
    if (options.historicalOnly && !row.images.some(image => image.historicalStatus === "single_success")) { deferred.push(row.candidateId); continue; }
    const host = row.institutionKey === "smk" && image.isPrimary && image.iiifImageServiceUrl
      ? assertPublicImageUrl(image.iiifImageServiceUrl).hostname : assertPublicImageUrl(image.url).hostname;
    byHost.set(host, [...(byHost.get(host) ?? []), { row, image }]);
  }
  writePublicImportJson(path.join(options.workDir, "preflight-holds.json"), preflightHolds);
  writePublicImportJson(path.join(options.workDir, "deferred-queue.json"), { historicalOnly: options.historicalOnly ?? false,
    reason: "No historical successful URL; awaiting a later current-image acquisition. This is queue priority, not a missing-data claim.", candidates: deferred });
  let completed = receipts.size;
  let fatalError: unknown;
  // One stream per source host; separate museum hosts can proceed independently.
  const outcomes = await Promise.allSettled([...byHost].map(async ([host, rows]) => { try {
    let consecutiveTimeouts = 0;
    const recent = [...receipts.values()].filter(receipt => receipt.image && new URL(receipt.image.url).hostname === host).slice(-3);
    for (const receipt of recent) consecutiveTimeouts = receipt.reasons.includes("image-transfer-timeout") ? consecutiveTimeouts + 1 : 0;
    if (consecutiveTimeouts >= 3) stoppedHosts.add(host);
    rows.sort((a, b) => Number(b.image.historicalStatus === "single_success") - Number(a.image.historicalStatus === "single_success")
      || Number(/Monet/u.test(b.row.facts.creators?.map((c: SourceObject) => c.nameOriginal).join(" ") ?? "")) - Number(/Monet/u.test(a.row.facts.creators?.map((c: SourceObject) => c.nameOriginal).join(" ") ?? ""))
      || a.row.candidateId.localeCompare(b.row.candidateId));
    for (const { row, image: originalImage } of rows) {
      if (fatalError || options.signal?.aborted) break;
      let image = originalImage;
      const receipt: PublicImageReceipt = { candidateId: row.candidateId, at: new Date().toISOString(), status: "held", reasons: [], image };
      const previous = receipts.get(row.candidateId);
      if (previous) {
        receipt.supersedes = publicImportHash(JSON.stringify(previous));
        receipt.correctionKind = previous.reasons.some(reason => /ENOSPC|No space left on device/iu.test(reason)) ? "client-storage-recovery"
          : previous.image && !previous.image.isPrimary && originalImage.isPrimary ? "primary-image-selection-correction"
          : previous.reasons.includes("bounded-whole-image-service-unconfirmed") ? "declared-service-adapter-correction" : "client-guard-correction";
      }
      try {
        if (stoppedHosts.has(host)) throw new PublicImageError("source-host-stopped", host);
        if (image.isPrimary && image.iiifImageServiceUrl && ["api.smk.dk", "iip-thumb.smk.dk"].includes(assertPublicImageUrl(image.url).hostname)
          || previous?.reasons.some(reason => reason.startsWith("image-body-too-large") || reason === "bounded-whole-image-service-unconfirmed")) {
          image = await boundedIiifImage(image, { ...options, stoppedHosts });
        }
        receipt.image = image;
        let fetched;
        try { fetched = await fetchPublicImage(image.url, { fetchImpl: options.fetchImpl, stoppedHosts }); }
        catch (error) {
          if (!(error instanceof PublicImageError) || error.code !== "image-body-too-large" || image.derivation) throw error;
          image = await boundedIiifImage(image, { ...options, stoppedHosts });
          receipt.image = image;
          fetched = await fetchPublicImage(image.url, { fetchImpl: options.fetchImpl, stoppedHosts });
        }
        receipt.image = image;
        let metadata = await sharp(fetched.body, { limitInputPixels: false }).metadata();
        if ((metadata.width ?? 0) * (metadata.height ?? 0) > 80_000_000 && !image.derivation) {
          image = await boundedIiifImage(image, { ...options, stoppedHosts });
          fetched = await fetchPublicImage(image.url, { fetchImpl: options.fetchImpl, stoppedHosts });
          metadata = await sharp(fetched.body, { limitInputPixels: 80_000_000 }).metadata();
          receipt.image = image;
        }
        const measured = await measureImage(fetched.body);
        if (Math.min(measured.width, measured.height) < 320 || Math.max(measured.width, measured.height) < 1600) throw new TypeError("image-resolution-insufficient");
        if (measured.width * measured.height > 80_000_000 || (metadata.pages ?? 1) !== 1) throw new TypeError("unsupported-image-geometry");
        const mime = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif" }[measured.format];
        if (!mime) throw new TypeError("unsupported-browser-image-format");
        receipt.ref = { url: image.url, sha256: publicImageDigest(fetched.body), width: measured.width, height: measured.height,
          byteLength: fetched.body.length, contentType: mime as VerifiedRemoteImage["contentType"], verifiedAt: new Date().toISOString() };
        cachePublicImage(options.rootDir, receipt.ref, fetched.body);
        if ((metadata.orientation ?? 1) !== 1) {
          await sharp(fetched.body).rotate().png().toFile(publicImageCachePath(options.rootDir, receipt.ref.sha256) + ".oriented.png");
        }
        receipt.status = "fetched";
        consecutiveTimeouts = 0;
      } catch (error) {
        if (error instanceof Error && (/ENOSPC|No space left on device/iu.test(error.message)
          || "code" in error && ["ENOSPC", "EIO", "EROFS"].includes(String(error.code)))) throw error;
        receipt.reasons.push(error instanceof PublicImageError ? `${error.code}${error.status ? `:HTTP-${error.status}` : ""}` : error instanceof Error ? error.message : String(error));
        if (error instanceof PublicImageError && error.code === "image-transfer-timeout") {
          consecutiveTimeouts++;
          if (consecutiveTimeouts >= 3) {
            stoppedHosts.add(host);
            writePublicImportJson(path.join(options.workDir, `source-stop-${host}.json`), { host, reason: "three-consecutive-transfer-timeouts", at: new Date().toISOString() });
          }
        }
      }
      append(receipt); completed++;
      writePublicImportJson(stopFile, [...stoppedHosts].sort());
      options.onProgress?.({ completed, total: options.intake.candidateCount, host, candidateId: row.candidateId, status: receipt.status, reasons: receipt.reasons });
      if (!stoppedHosts.has(host)) await new Promise(resolve => setTimeout(resolve, options.delayMs ?? 2000));
    }
  } catch (error) { fatalError ??= error; throw error; } }));
  const errors = outcomes.filter((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected").map(outcome => outcome.reason);
  if (errors.length) throw new AggregateError(errors, "Public image acquisition failed; completed receipts are preserved");
  return receipts;
}

function creatorLabel(creator: SourceObject): string {
  const original = String(creator.nameOriginal ?? "").trim();
  // Display only the name in the author slot; retain source lifespans in the catalog.
  const name = original.replace(/\s*\((?:(?:ca?\.?|about)\s*)?\d{3,4}\s*[-–—]\s*(?:(?:ca?\.?)\s*)?\d{3,4}\)\s*$/iu, "").trim();
  const qualifier = String(creator.attribution ?? "").trim();
  if (!name) return "";
  if (qualifier && /\b(?:attributed|after|workshop|follower|circle|school|possibly|probably|studio|copy|manner)\b/iu.test(qualifier)
    && !/\b(?:attributed|after|workshop|follower|circle|school|possibly|probably|studio|copy|manner)\b/iu.test(name)) {
    return qualifier.includes(name) ? qualifier : `${qualifier} ${name}`;
  }
  if (qualifier && qualifier.toLowerCase() !== "unknown" && !qualifier.includes(name) && !original.includes(qualifier)) return `${name} (${qualifier})`;
  return name;
}

export function formatCatalogDimensions(value: unknown): string | undefined {
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return undefined;
    if (!text.startsWith("[") && !text.startsWith("{")) return text;
    try { return formatCatalogDimensions(JSON.parse(text)); } catch { return undefined; }
  }
  if (!Array.isArray(value)) return undefined;
  if (value.every(entry => typeof entry === "string")) return value.filter(Boolean).join("; ") || undefined;
  const grouped = new Map<string, string[]>();
  const typeLabels: Record<string, string> = { height: "高", width: "宽", depth: "深", length: "长", diameter: "直径" };
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || !["cm", "mm", "in", "inch", "inches"].includes(entry.unit)) continue;
    const parts: Record<string, string> = { Netto: "净尺寸", Brutto: "总尺寸", billedmaal: "画面尺寸", bladmaal: "纸张尺寸", rammemaal: "含框尺寸" };
    const part = parts[entry.part] ?? "";
    const values = Array.isArray(entry.measurements) ? entry.measurements.map(String) : entry.value !== undefined ? [String(entry.value)] : [];
    if (!values.length || values.some((value: string) => !/^\d+(?:\.\d+)?$/u.test(value))) continue;
    const description = `${typeLabels[entry.type] ?? ""}${values.join(" × ")}${entry.unit}`;
    grouped.set(part, [...(grouped.get(part) ?? []), description]);
  }
  return [...grouped].map(([part, measures]) => `${part ? part + " " : ""}${measures.join(" × ")}`).join("；") || undefined;
}

export function completePublicFacts(present: string[], absent: string[]): VisualFacts {
  if (new Set(present).size !== present.length || new Set(absent).size !== absent.length
    || [...present, ...absent].some(subject => !(VISUAL_SUBJECTS as readonly string[]).includes(subject)) || present.some(subject => absent.includes(subject))) throw new TypeError("Invalid or conflicting visual subjects");
  return Object.fromEntries(VISUAL_SUBJECTS.map(subject => [subject, present.includes(subject) ? "present" : absent.includes(subject) ? "absent" : "unknown"]));
}

export async function assessPublicReviews(options: { rootDir: string; version: string; intake: PublicIntake;
  receipts: Map<string, PublicImageReceipt>; reviews: PublicVisualReview[]; existing: ArtworkRecord[]; catalogDir: string;
  artifacts?: Map<string, PublicImageReceipt[]>;
  /** Publication revalidates these exact bytes through the public cache reader before inference. */
  deferMissingSourceCache?: boolean;
}): Promise<{ accepted: PublicReviewedImportArtwork[]; decisions: ImportDecision[] }> {
  const accepted: PublicReviewedImportArtwork[] = [], decisions: ImportDecision[] = [];
  const reviews = new Map(options.reviews.map(row => [row.candidateId, row]));
  if (reviews.size !== options.reviews.length || options.reviews.some(row => !options.intake.candidates.some(c => c.candidateId === row.candidateId))) throw new TypeError("Duplicate or unknown visual review identity");
  const ids = new Set(options.existing.map(record => record.id)), hashes = new Set(options.existing.map(record => record.media.sourceAssetFingerprint));
  for (const row of options.intake.candidates) {
    const decision: ImportDecision = { candidateId: row.candidateId, institutionKey: row.institutionKey, status: "held", reasons: [],
      successfulUrlCount: row.images.filter(image => image.historicalStatus === "single_success").length };
    decisions.push(decision);
    if (ids.has(row.candidateId)) { decision.reasons.push("already-in-release"); continue; }
    decision.reasons.push(...publicCandidateReasons(row));
    const review = reviews.get(row.candidateId);
    const alternatives = options.artifacts?.get(row.candidateId) ?? [];
    // The operator chooses the exact reviewed file, never an arbitrary later download.
    const receipt = alternatives.find(artifact => artifact.ref?.sha256 === review?.sourceImageSha256)
      ?? options.receipts.get(row.candidateId);
    if (!receipt || receipt.status !== "fetched" || !receipt.ref || !receipt.image) decision.reasons.push(...(receipt?.reasons.length ? receipt.reasons : ["public-image-not-validated"]));
    if (!review) decision.reasons.push("visual-review-pending");
    if (decision.reasons.length || !receipt?.ref || !receipt.image || !review) continue;
    try {
      const ref = receipt.ref;
      const sourceBound = row.images.some(image => image.assetKey === receipt.image?.assetKey && (image.url === ref.url
        || image.url === receipt.image?.originalUrl && receipt.image.derivation?.kind === "iiif-full-frame-bounded"
          && receipt.image.derivation.serviceUrl === image.iiifImageServiceUrl?.replace(/\/$/u, "")
          && ref.url === `${receipt.image.derivation.serviceUrl}/full/${receipt.image.derivation.size}/0/${receipt.image.derivation.quality}.jpg`));
      const cacheExists = existsSync(publicImageCachePath(options.rootDir, ref.sha256));
      if (!sourceBound || (cacheExists || !options.deferMissingSourceCache) && !readCachedPublicImage(options.rootDir, ref)) throw new TypeError("public-image-evidence-changed");
      if (receipt.image.derivation) {
        const derivation = receipt.image.derivation;
        if (!/^sha256:[a-f0-9]{64}$/u.test(derivation.infoSha256)) throw new TypeError("invalid-image-info-fingerprint");
        const infoFile = path.join(options.rootDir, "data/curation/public-url-import", options.version, "iiif-info", derivation.infoSha256.slice(7) + ".json");
        const infoBytes = readFileSync(infoFile), info = JSON.parse(infoBytes.toString("utf8"));
        if (derivation.infoKind === "archived-source-record") {
          const sourceImage = row.images.find(image => image.assetKey === receipt.image?.assetKey && image.url === receipt.image?.originalUrl);
          const native = sourceImage?.nativeDimensions;
          if (!native || info.evidenceType !== "archived-source-record" || info.source?.fileSha256 !== native.source.fileSha256
            || info.widthPointer !== native.widthPointer || info.heightPointer !== native.heightPointer
            || info.width !== native.width || info.height !== native.height) throw new TypeError("archived-native-dimension-evidence-changed");
        }
        if (publicImageDigest(infoBytes) !== derivation.infoSha256 || info.width !== derivation.originalWidth || info.height !== derivation.originalHeight
          || Math.max(ref.width, ref.height) > Math.min(4000, Math.max(info.width, info.height))
          || derivation.size !== (Math.max(info.width, info.height) > 4000 ? "!4000,4000" : "full")
          || Math.abs(ref.width / ref.height / (info.width / info.height) - 1) > 0.002) throw new TypeError("bounded-image-info-or-aspect-mismatch");
      }
      if (hashes.has(ref.sha256)) throw new TypeError("duplicate-image");
      if (review.sourceImageSha256 !== ref.sha256 || review.reviewer !== "local-image-review" || review.view !== "complete-frontal"
        || !Number.isFinite(Date.parse(review.reviewedAt)) || !review.observation.trim() || review.observation.length > 1400
        || !SPATIAL_FRAMINGS.includes(review.spatialFraming) || VISUAL_SUBJECTS.some(subject => !["present", "absent", "unknown"].includes(review.facts[subject] ?? ""))
        || Object.keys(review.facts).some(subject => !(VISUAL_SUBJECTS as readonly string[]).includes(subject))) throw new TypeError("visual-review-unconfirmed");
      const editorial = review.editorial;
      if (!editorial.description.trim() || !editorial.moodTags.length || !editorial.colorTags.length) throw new TypeError("editorial-evidence-missing");
      const facts = row.facts, creators = (facts.creators as SourceObject[]).filter(creator => !nonAuthorReference(creator)).map(creatorLabel).filter(Boolean);
      const dimensions = formatCatalogDimensions(facts.dimensionsRaw);
      const record = parseArtworkRecord({ id: row.candidateId, source: row.institutionKey as ArtworkSource, sourceArtworkId: String(row.identity.sourceObjectId), version: options.version,
        metadata: { title: facts.titleOriginal.trim(), artistDisplayName: creators.join("; "), yearLabel: facts.dateDisplay.trim(), medium: facts.medium.trim(),
          culture: facts.culture || undefined, dimensions: dimensions || undefined, creditLine: [facts.creditLine, receipt.image.attribution].filter(Boolean).join(". ") || undefined,
          objectUrl: row.identity.canonicalObjectUrl || undefined, sourceApiUrl: row.identity.sourceApiUrl || undefined,
          descriptionClean: editorial.description, storySnippet: editorial.description, moodTags: editorial.moodTags, colorTags: editorial.colorTags,
          subjectTags: [facts.objectType], compositionTags: editorial.compositionTags },
        retrieval: { searchText: [facts.titleOriginal, ...creators, facts.medium, facts.objectType, editorial.description].join(". "),
          emotionLabels: editorial.moodTags, energyLevel: editorial.energyLevel, valence: editorial.valence, pace: editorial.pace,
          spaceSense: review.spatialFraming === "open" ? "open" : review.spatialFraming === "enclosed" ? "close" : "balanced" },
        media: { imageUrlPreview: ref.url, imageUrlFull: ref.url, hasMotionAsset: false, mediaVersion: options.version,
          sourceAssetFingerprint: ref.sha256, verifiedRemoteImage: ref },
        presentation: { grade: "A", gradeLabel: "director-focus", motionProfile: "parallax", narrationMode: "caption" } });
      applyImageMeasurement(record, { width: ref.width, height: ref.height, format: ref.contentType.slice(6), sha256: ref.sha256.slice(7) }, ref.url);
      const filename = path.join(options.catalogDir, `${createHash("sha256").update(row.candidateId).digest("hex").slice(0, 24)}.json`);
      const catalog = { schemaVersion: 1, candidate: row, receipt, reviewScope: "Assistant review of current-source proportional preview; no museum or independent human authentication claimed." };
      writePublicImportJson(filename, catalog);
      accepted.push({ record, review, sourceImageUrl: ref.url, sourceImageSha256: ref.sha256,
        catalogPath: path.relative(options.rootDir, filename), catalogSha256: publicImportHash(readFileSync(filename)),
        modelInputPath: existsSync(publicImageCachePath(options.rootDir, ref.sha256) + ".oriented.png") ? publicImageCachePath(options.rootDir, ref.sha256) + ".oriented.png" : undefined });
      hashes.add(ref.sha256); ids.add(record.id); decision.status = "admitted"; decision.sourceImageUrl = ref.url;
    } catch (error) { decision.reasons.push(error instanceof Error ? error.message : String(error)); }
  }
  return { accepted, decisions };
}
