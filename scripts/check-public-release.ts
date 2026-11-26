import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { stripAppBasePath } from "../packages/contracts/src/public-path";
import { createLocalSemanticEncoder } from "../packages/corpus/src/local-semantic-provider";
import { assertPublicImageUrl, publicImageCachePath } from "../packages/corpus/src/public-image-cache";
import { readVerifiedSemanticArtifact } from "../packages/corpus/src/semantic-loader";
import { runtimePolicy } from "../apps/api/src/runtime/request-policy";
import { inspectReleaseReadiness } from "../apps/web/lib/release-readiness";
import { loadWebReleaseCatalog } from "../apps/web/lib/release-catalog";
import { isGalleryArtwork } from "../apps/web/lib/artwork-eligibility";
import { resolveReleaseAssetPath } from "../apps/web/lib/release-media-path";
import { readArtworkPreview } from "../apps/web/lib/artwork-preview";
import { verifyPublicMediaCoverage } from "../apps/web/lib/public-media";
import { checkReleaseObservation, type ExpectedObservation } from "./check-release-observation";

function expectedObservation(args: string[]): ExpectedObservation | undefined {
  const fields = ["--expected-release", "--expected-observation-sha256", "--expected-observation-checksum"];
  const enabled = args.includes("--expect-observation");
  if (!enabled && fields.every(field => !args.includes(field))) return undefined;
  const [releaseVersion, fileSha256, contentChecksum] = fields.map(field => {
    const indices = args.flatMap((arg, index) => arg === field ? [index] : []);
    return indices.length === 1 ? args[indices[0]! + 1] : undefined;
  });
  if (!enabled || !releaseVersion || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/u.test(releaseVersion)
    || !fileSha256 || !contentChecksum || ![fileSha256, contentChecksum].every(value => /^[a-f0-9]{64}$/u.test(value)))
    throw new Error("Invalid expected observation arguments");
  return { releaseVersion, fileSha256, contentChecksum };
}

async function isolatedObservationCheck(root: string, expected: ExpectedObservation) {
  const state = mkdtempSync(path.join(os.tmpdir(), "artduo-release-observation-"));
  const { ARTDUO_STATE_DIR, ARTDUO_OBSERVABILITY } = process.env;
  process.env.ARTDUO_STATE_DIR = state;
  process.env.ARTDUO_OBSERVABILITY = "0";
  try { return await checkReleaseObservation(root, state, expected); }
  catch { return { ok: false, reason: "probe-unavailable", indexStatus: "unchecked", retrieval: "not-run", actualSelectionVersion: null }; }
  finally {
    if (ARTDUO_STATE_DIR === undefined) delete process.env.ARTDUO_STATE_DIR; else process.env.ARTDUO_STATE_DIR = ARTDUO_STATE_DIR;
    if (ARTDUO_OBSERVABILITY === undefined) delete process.env.ARTDUO_OBSERVABILITY; else process.env.ARTDUO_OBSERVABILITY = ARTDUO_OBSERVABILITY;
    rmSync(state, { recursive: true, force: true });
  }
}

async function main() {
  const root = process.cwd(), local = process.argv.includes("--local");
  const expected = expectedObservation(process.argv.slice(2));
  const policy = runtimePolicy(root);
  if (!local && !policy.publicMode) throw new Error("Public release check requires ARTDUO_PUBLIC_MODE=1 and production configuration; --local checks this workstation only");
  mkdirSync(policy.state, { recursive: true, mode: 0o700 });
  const probe = path.join(policy.state, `.preflight-${randomUUID()}`);
  try {
    writeFileSync(probe, "persistent-volume-check", { flag: "wx", mode: 0o600 });
    renameSync(probe, `${probe}.ready`);
    if (readFileSync(`${probe}.ready`, "utf8") !== "persistent-volume-check") throw new Error("Persistent directory readback failed");
  } finally { for (const file of [probe, `${probe}.ready`]) if (existsSync(file)) unlinkSync(file); }
  const readiness = inspectReleaseReadiness(root);
  if (!readiness.ok) throw new Error(`Readiness failed: ${JSON.stringify(readiness.checks)}`);
  const catalog = loadWebReleaseCatalog({ rootDir: root });
  const observation = expected && await isolatedObservationCheck(root, expected);
  if (observation && !observation.ok) {
    console.error(JSON.stringify({ ok: false, observation }));
    process.exitCode = 1;
    return;
  }
  const mediaDelivery = verifyPublicMediaCoverage(catalog, { rootDir: root });
  for (const shard of [...catalog.manifest.shards.metadata, ...catalog.manifest.shards.search, ...(catalog.manifest.shards.semanticEmbeddings ?? [])]) readVerifiedSemanticArtifact(catalog.manifestPath, shard);
  let images = 0, depthMaps = 0, remoteImages = 0, preparedPreviews = 0;
  for (const artwork of catalog.artworks.filter(isGalleryArtwork)) {
    const media = catalog.artworkRecordById.get(artwork.id)!.media;
    if (await readArtworkPreview(root, media.sourceAssetFingerprint)) preparedPreviews++;
    if (media.verifiedRemoteImage) {
      const remote = media.verifiedRemoteImage;
      assertPublicImageUrl(remote.url);
      const preserved = path.join(root, "data/sources/public-url/preserved-images", `${remote.sha256.slice(7)}.bin`);
      const cached = publicImageCachePath(root, remote.sha256);
      const file = existsSync(preserved) ? preserved : cached;
      if (!existsSync(file)) {
        remoteImages++;
        if (process.argv.includes("--offline")) throw new Error(`Verified image is not packaged for offline delivery: ${artwork.id}`);
      } else {
        const bytes = readFileSync(file);
        if (bytes.length !== remote.byteLength || `sha256:${createHash("sha256").update(bytes).digest("hex")}` !== remote.sha256) throw new Error(`Image integrity failed: ${artwork.id}`);
      }
    } else if (!resolveReleaseAssetPath(catalog.releaseDir, artwork.imageUrl)) throw new Error(`Artwork has no local deployment image: ${artwork.id}`);
    images++;
    if (media.depthMap) {
      if (!resolveReleaseAssetPath(catalog.releaseDir, media.depthMap.url)) throw new Error(`Depth map missing: ${artwork.id}`);
      depthMaps++;
    }
  }
  if (!local && preparedPreviews !== images) throw new Error(`Prepare all previews before public release: ${preparedPreviews}/${images}`);
  const roomAssets = JSON.parse(readFileSync(path.join(root, "public/artduo-gallery/lighting/v2/report.json"), "utf8"));
  for (const id of ["bg-004", "bg-012", "bg-015", "bg-022", "bg-027", "bg-034"]) {
    const scene = catalog.backgroundSceneRecordById.get(id);
    if (!scene?.asset.local_public_path.startsWith("/") || !existsSync(path.join(root, "public", stripAppBasePath(scene.asset.local_public_path)))) throw new Error(`Gallery background is not packaged: ${id}`);
    const record = roomAssets.records?.find((row: { sceneId: string }) => row.sceneId === id);
    for (const kind of ["depth", "normal", "background-960", "background-1600"]) {
      const asset = record?.outputs.find((row: { kind: string }) => row.kind === kind);
      if (!asset || !asset.url.startsWith(`/artduo-gallery/lighting/v2/${id}-`)) throw new Error(`Missing gallery asset: ${id}/${kind}`);
      const bytes = readFileSync(path.join(root, "public", asset.url));
      if (createHash("sha256").update(bytes).digest("hex") !== asset.sha256) throw new Error(`Gallery asset integrity failed: ${id}/${kind}`);
    }
  }
  let semanticWarmupMs: number | undefined;
  if (process.argv.includes("--warm")) {
    const encoder = createLocalSemanticEncoder({ rootDir: root, allowDownload: false }), started = performance.now();
    try { await encoder.warmup?.(); semanticWarmupMs = Math.round(performance.now() - started); } finally { await encoder.dispose(); }
  }
  console.log(JSON.stringify({ ...readiness, mode: local ? "local-only" : "production-configuration", images, depthMaps, remoteImages, preparedPreviews, mediaDelivery,
    delivery: remoteImages ? "Verified remote images are fetched and fingerprint-checked on first use; upstream availability is required" : "All eligible images are available locally",
    semanticWarmupMs, observation, quota: { concurrency: policy.concurrency, dailyRequests: policy.dailyRequests, dailyReservedTokens: policy.dailyTokens },
    stillRequires: ["TLS and proxy validation on the chosen host", "persistent-volume restart rehearsal on that host", "user approval before public release"] }, null, 2));
}
main().catch(error => { console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) })); process.exitCode = 1; });
