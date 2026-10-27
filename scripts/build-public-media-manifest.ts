import { copyFile, link, lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { inspectPublicMediaImage } from "../apps/web/lib/public-media-image";
import { runtimeDirectories } from "../apps/api/src/runtime/environment";
import { readArtworkPreview, PREVIEW_RECIPE } from "../apps/web/lib/artwork-preview";
import { isGalleryArtwork } from "../apps/web/lib/artwork-eligibility";
import { loadWebReleaseCatalog } from "../apps/web/lib/release-catalog";
import { resolveReleaseAssetPath } from "../apps/web/lib/release-media-path";
import { createPublicMediaManifest, mediaSha256, publicMediaId, staticMediaId, PUBLIC_AUDIO_TRACKS, PUBLIC_MEDIA_PREFIX, PUBLIC_ROOM_IDS, type PublicMediaAsset } from "../apps/web/lib/public-media-manifest";

export interface PublicMediaUploadSource { objectKey: string; file: string; sha256: string; bytes: number; contentType: string }

async function safeFile(root: string, relative: string): Promise<string> {
  const base = await realpath(root), file = path.resolve(base, relative), rel = path.relative(base, file);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel) || !(await lstat(file)).isFile()) throw new TypeError("Public media file is outside its approved root");
  const actual = await realpath(file), actualRelative = path.relative(base, actual);
  if (actualRelative.startsWith("..") || path.isAbsolute(actualRelative)) throw new TypeError("Public media symlink escapes its approved root");
  return actual;
}

export async function buildPublicMediaManifest(root: string, releaseVersion?: string) {
  const catalog = loadWebReleaseCatalog({ rootDir: root, releaseVersion });
  const assets: PublicMediaAsset[] = [], sources: PublicMediaUploadSource[] = [];
  async function add(file: string, identity: Omit<PublicMediaAsset, "objectKey" | "sha256" | "bytes" | "width" | "height">, expectedSha256?: string) {
    const body = await readFile(file), sha256 = mediaSha256(body);
    if (expectedSha256 && sha256 !== expectedSha256) throw new TypeError(`Public media fingerprint mismatch: ${identity.id}`);
    const name = path.basename(file).replace(/[^A-Za-z0-9_.-]/gu, "-").replaceAll(".", "-").replace(/-(webp|png|mp3)$/u, ".$1");
    const objectKey = `${PUBLIC_MEDIA_PREFIX}${sha256.slice(7)}/${name}`;
    let dimensions: { width?: number; height?: number } = {};
    if (identity.contentType.startsWith("image/")) {
      dimensions = await inspectPublicMediaImage(body, identity.contentType);
    } else if (!(body.subarray(0, 3).toString() === "ID3" || body[0] === 0xff && (body[1]! & 0xe0) === 0xe0)) throw new TypeError("Invalid public audio file");
    const asset = { ...identity, objectKey, sha256, bytes: body.length, ...dimensions };
    assets.push(asset); sources.push({ objectKey, file, sha256, bytes: body.length, contentType: identity.contentType });
  }
  const depthReportBytes = await readFile(path.join(catalog.releaseDir, "depth-report.json"));
  const depthReport = JSON.parse(depthReportBytes.toString()) as {
    releaseVersion: string; records: Array<{ artworkId: string; outputSha256: string; sourceAssetFingerprint: string; url: string }> };
  if (depthReport.releaseVersion !== catalog.releaseVersion) throw new TypeError("Depth report release mismatch");
  const depthRecords = new Map(depthReport.records.map(record => [record.artworkId, record]));
  const previewsRoot = path.join(runtimeDirectories(root).state, "artwork-previews");
  for (const artwork of catalog.artworks.filter(isGalleryArtwork)) {
    const media = catalog.artworkRecordById.get(artwork.id)!.media;
    const source = media.sourceAssetFingerprint;
    if (!/^sha256:[a-f0-9]{64}$/u.test(source ?? "")) throw new TypeError("Artwork has no verified source fingerprint");
    const base = `${source!.slice(7)}-${PREVIEW_RECIPE}`;
    await safeFile(previewsRoot, `${base}.json`);
    const previewFile = await safeFile(previewsRoot, `${base}.webp`);
    const preview = await readArtworkPreview(root, source!);
    if (!preview) throw new TypeError(`Prepared preview is unavailable: ${artwork.id}`);
    await add(previewFile, { id: publicMediaId("preview", artwork.id), kind: "preview", contentType: "image/webp", sourceFingerprint: source, recipe: PREVIEW_RECIPE }, preview.sha256);
    const depth = media.depthMap, evidence = depthRecords.get(artwork.id);
    if (!depth || depth.version !== catalog.releaseVersion || depth.sourceAssetFingerprint !== source || !evidence || evidence.sourceAssetFingerprint !== source || evidence.url !== depth.url) throw new TypeError(`Depth source binding mismatch: ${artwork.id}`);
    const depthFile = resolveReleaseAssetPath(catalog.releaseDir, depth.url);
    if (!depthFile) throw new TypeError(`Depth file unavailable: ${artwork.id}`);
    await add(depthFile, { id: publicMediaId("depth", artwork.id), kind: "depth", contentType: "image/png", sourceFingerprint: source, recipe: `depth-report-${mediaSha256(depthReportBytes)}` }, `sha256:${evidence.outputSha256}`);
  }
  for (const scene of catalog.backgroundSceneRecordById.values()) {
    const url = scene.asset.local_public_path;
    await add(await safeFile(path.join(root, "public"), url.slice(1)), { id: staticMediaId(url), kind: "background", contentType: "image/png" });
  }
  const lighting = JSON.parse(await readFile(path.join(root, "public/artduo-gallery/lighting/v2/report.json"), "utf8")) as {
    records: Array<{ sceneId: string; sourceUrl: string; inputSha256: string; outputs: Array<{ url: string; sha256: string }> }> };
  for (const id of PUBLIC_ROOM_IDS) {
    const record = lighting.records.find(record => record.sceneId === id);
    if (!record || record.outputs.length !== 4) throw new TypeError(`Prepared room missing: ${id}`);
    const background = assets.find(asset => asset.id === staticMediaId(record.sourceUrl));
    if (background?.sha256 !== `sha256:${record.inputSha256}`) throw new TypeError(`Room source mismatch: ${id}`);
    for (const output of record.outputs) {
      await add(await safeFile(path.join(root, "public"), output.url.slice(1)), { id: staticMediaId(output.url), kind: "room", contentType: output.url.endsWith(".webp") ? "image/webp" : "image/png" }, `sha256:${output.sha256}`);
    }
  }
  for (const track of PUBLIC_AUDIO_TRACKS) {
    await add(await safeFile(path.join(root, "public"), track), { id: staticMediaId(`/ambient-audio/${encodeURIComponent(track)}`), kind: "audio", contentType: "audio/mpeg" });
  }
  return { manifest: createPublicMediaManifest({ releaseVersion: catalog.releaseVersion, sourceManifestSha256: mediaSha256(await readFile(catalog.manifestPath)), assets }), sources };
}

async function main() {
  const arg = (key: string) => { const index = process.argv.indexOf(key); return index < 0 ? undefined : process.argv[index + 1]; };
  const root = path.resolve(arg("--root") ?? process.cwd()), output = arg("--output");
  if (!output) throw new TypeError("--output is required");
  const { manifest, sources } = await buildPublicMediaManifest(root, arg("--release"));
  await mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await writeFile(output, JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600 });
  await writeFile(`${output}.upload.json`, JSON.stringify(sources, null, 2) + "\n", { mode: 0o600 });
  const staging = arg("--upload-dir");
  if (staging) for (const source of sources) {
    const destination = path.resolve(staging, source.objectKey);
    await mkdir(path.dirname(destination), { recursive: true });
    try { await link(source.file, destination); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") await copyFile(source.file, destination); }
    if (mediaSha256(await readFile(destination)) !== source.sha256) throw new TypeError("Staged public media integrity mismatch");
  }
  console.log(JSON.stringify({ releaseVersion: manifest.releaseVersion, assets: manifest.assets.length, bytes: sources.reduce((sum, row) => sum + row.bytes, 0), manifestSha256: manifest.manifestSha256, output, staged: Boolean(staging) }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
