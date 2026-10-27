import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { publicImageCachePath, readCachedPublicImage } from "@artduo/corpus/src/public-image-cache";
import { loadReleaseManifest } from "@artduo/corpus";
import { readReleaseArtworks } from "./semantic-release";
import { publishVerifiedIntake, readVerifiedLinkSnapshot } from "./verified-partial-import";
import { archivePublicSourceEvidence, writePublicUrlGapReport } from "./public-url-report";
import { acquirePublicImages, assessPublicReviews, readPublicImageReceipts, readPublicImageArtifacts, readPublicUrlIntake,
  writePublicImportJson, type PublicVisualReview } from "./public-url-intake";

const args = process.argv.slice(2);
function argument(name: string, fallback?: string): string {
  const index = args.indexOf(name), value = index < 0 ? fallback : args[index + 1];
  if (!value || value.startsWith("--")) throw new TypeError(`Missing ${name}`);
  return value;
}
async function main() {
  const rootDir = path.resolve(__dirname, "../../..");
  const version = argument("--version", "2026-10-21-verified-public-url"), baseVersion = argument("--base", "2026-10-21-verified-partial");
  const stage = argument("--stage", "status");
  const publishedManifest = path.join(rootDir, "data/releases", version, "manifest.json");
  if (existsSync(publishedManifest)) {
    if (stage !== "status") throw new TypeError("Import version already exists; immutable releases cannot be replaced");
    const published = loadReleaseManifest({ rootDir, releaseVersion: version });
    const report = JSON.parse(readFileSync(path.join(published.releaseDir, "verified-import-report.json"), "utf8"));
    console.log(JSON.stringify({ stage, candidateCount: report.candidateCount, ready: report.admittedCount, activated: true,
      eligibleCount: report.eligibleCount }));
    return;
  }
  const inputDir = path.resolve(rootDir, argument("--input", ".cache/artduo-public-import/input/ArtDuo_原始候选主包_证据恢复整合_20261021"));
  const policyPath = path.join(rootDir, "data/sources/public-url/2026-10-21/policy-evidence.json");
  const workDir = path.join(rootDir, "data/curation/public-url-import", version);
  const assessmentPath = path.join(workDir, "assessment.json");
  const frozenReady: string[] = args.includes("--resume") && existsSync(assessmentPath)
    ? JSON.parse(readFileSync(assessmentPath, "utf8")).ready : [];
  const failureLog = path.join(workDir, "publication-image-failures.jsonl");
  const failures = existsSync(failureLog) ? readFileSync(failureLog, "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line)) : [];
  const intake = readPublicUrlIntake(rootDir, inputDir, policyPath);
  writePublicImportJson(path.join(workDir, "intake.json"), intake);
  const base = loadReleaseManifest({ rootDir, releaseVersion: baseVersion });
  const existing = readReleaseArtworks(base.manifestPath, base.manifest);
  if (stage === "acquire") {
    const controller = new AbortController();
    const stop = () => controller.abort();
    process.once("SIGINT", stop);
    const fetchImpl: typeof fetch = async (url, init) => {
      const began = new Date().toISOString();
      try {
        const response = await fetch(url, init);
        appendFileSync(path.join(workDir, "request-headers.jsonl"), JSON.stringify({ url: String(url), began, at: new Date().toISOString(),
          status: response.status, contentType: response.headers.get("content-type"), contentLength: response.headers.get("content-length"), location: response.headers.get("location") }) + "\n");
        return response;
      } catch (error) {
        appendFileSync(path.join(workDir, "request-headers.jsonl"), JSON.stringify({ url: String(url), began, at: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error) }) + "\n");
        throw error;
      }
    };
    let receipts;
    try { receipts = await acquirePublicImages({ rootDir, intake, workDir, existingIds: new Set(existing.map(row => row.id)),
      fetchImpl,
      historicalOnly: args.includes("--historical-only"), signal: controller.signal,
      recoverClientErrors: args.includes("--recover-client-errors"),
      onProgress: progress => console.log(JSON.stringify(progress)) }); }
    finally { process.off("SIGINT", stop); }
    console.log(JSON.stringify({ stage, candidateCount: intake.candidateCount, fetched: [...receipts.values()].filter(row => row.status === "fetched").length,
      failed: [...receipts.values()].filter(row => row.status === "held").length, interrupted: controller.signal.aborted }));
    return;
  }
  const reviewsPath = path.join(workDir, "reviews.json");
  const reviews: PublicVisualReview[] = existsSync(reviewsPath) ? JSON.parse(readFileSync(reviewsPath, "utf8")).reviews : [];
  const assessment = await assessPublicReviews({ rootDir, version, intake, existing, reviews,
    receipts: readPublicImageReceipts(path.join(workDir, "image-receipts.jsonl")),
    artifacts: readPublicImageArtifacts(path.join(workDir, "image-receipts.jsonl")),
    deferMissingSourceCache: stage === "publish" && args.includes("--stream-sources"),
    catalogDir: path.join(rootDir, "data/sources/public-url/2026-10-21/catalogs") });
  const maximum = Number(argument("--max-new-artworks", "0"));
  if (!Number.isSafeInteger(maximum) || maximum < 0) throw new TypeError("Invalid --max-new-artworks");
  const recoveredFailures = new Set<string>();
  for (const failure of failures) {
    if ([401, 403, 429].includes(failure.status)) continue;
    const item = assessment.accepted.find(item => item.record.id === failure.candidateId);
    const ref = item?.record.media.verifiedRemoteImage;
    if (ref && ref.url === failure.url && ref.sha256 === failure.sha256 && readCachedPublicImage(rootDir, ref)) {
      recoveredFailures.add(failure.candidateId);
      appendFileSync(path.join(workDir, "publication-image-recoveries.jsonl"), JSON.stringify({ candidateId: failure.candidateId,
        url: ref.url, sha256: ref.sha256, at: new Date().toISOString(), kind: "previously-verified-original-artifact-restored", networkRequests: 0 }) + "\n");
    }
  }
  const failed = new Set(failures.filter(row => !recoveredFailures.has(row.candidateId)).map(row => row.candidateId));
  const stoppedHosts = new Set(failures.filter(row => [401, 403, 429].includes(row.status)).map(row => row.host));
  const stoppedSources = new Set(failures.filter(row => [401, 403, 429].includes(row.status))
    .map(row => intake.candidates.find(candidate => candidate.candidateId === row.candidateId)?.institutionKey));
  assessment.accepted = assessment.accepted.filter(item => {
    const blockedHost = stoppedHosts.has(new URL(item.sourceImageUrl).hostname) || stoppedSources.has(item.record.source);
    if (!failed.has(item.record.id) && !blockedHost) return true;
    const decision = assessment.decisions.find(row => row.candidateId === item.record.id)!;
    decision.status = "held"; decision.reasons = [blockedHost ? "source-access-stopped" : "publication-image-fetch-failed"];
    return false;
  });
  if (maximum && assessment.accepted.length > maximum) {
    // All entries have passed the same gates. Reuse currently verified caches
    // first to avoid needless source requests; stop at the user's fixed scope.
    const positions = new Map(frozenReady.map((id, index) => [id, index]));
    assessment.accepted.sort((a, b) => frozenReady.length
      ? (positions.get(a.record.id) ?? Infinity) - (positions.get(b.record.id) ?? Infinity)
      : Number(existsSync(publicImageCachePath(rootDir, b.record.media.sourceAssetFingerprint!)))
        - Number(existsSync(publicImageCachePath(rootDir, a.record.media.sourceAssetFingerprint!))));
    const deferred = new Set(assessment.accepted.slice(maximum).map(item => item.record.id));
    assessment.accepted = assessment.accepted.slice(0, maximum);
    for (const decision of assessment.decisions) if (deferred.has(decision.candidateId)) {
      decision.status = "held"; decision.reasons = ["round-capacity-deferred"];
    }
  }
  writePublicImportJson(path.join(workDir, "assessment.json"), { candidateCount: intake.candidateCount,
    ready: assessment.accepted.map(row => row.record.id), decisions: assessment.decisions });
  writePublicUrlGapReport({ workDir, intake, decisions: assessment.decisions, reviews, activated: false });
  if (stage === "status") {
    console.log(JSON.stringify({ stage, candidateCount: intake.candidateCount, reviewed: reviews.length, ready: assessment.accepted.length }));
    return;
  }
  if (stage !== "publish") throw new TypeError("Expected --stage acquire, status or publish");
  archivePublicSourceEvidence({ rootDir, inputDir, catalogDir: path.join(rootDir, "data/sources/public-url/2026-10-21/catalogs"), accepted: assessment.accepted });
  const snapshot = readVerifiedLinkSnapshot(rootDir, path.join(inputDir, "05_链接核验附表_独立口径/ArtDuo_4867链接核验总表.csv"));
  const byId = new Map(snapshot.candidates.map(row => [row.candidateId, row]));
  snapshot.candidates = intake.candidates.map(row => byId.get(row.candidateId) ?? { candidateId: row.candidateId, institutionKey: row.institutionKey, links: [] });
  const result = await publishVerifiedIntake({ rootDir, version, baseVersion, snapshot, assessment, activate: args.includes("--activate"),
    resume: args.includes("--resume"),
    completedDepthRecovery: args.includes("--recover-completed-depth") ? argument("--recover-completed-depth") : undefined,
    sourceFailureLog: failureLog,
    evictProcessedSourceCache: args.includes("--stream-sources"),
    onProgress: progress => console.log(JSON.stringify(progress)) });
  writePublicUrlGapReport({ workDir, intake, decisions: assessment.decisions, reviews, activated: result.activated });
  console.log(JSON.stringify({ admitted: result.report.admittedCount, activated: result.activated, directory: result.directory }));
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
