import { link, mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createPublicMediaManifest, mediaSha256, parsePublicMediaManifest, PUBLIC_MEDIA_PREFIX, staticMediaId, type PublicMediaAsset } from "../apps/web/lib/public-media-manifest";
import { inspectPublicMediaImage } from "../apps/web/lib/public-media-image";
import type { PublicMediaUploadSource } from "./build-public-media-manifest";

export async function buildSculptureMedia(root: string, directory = path.join(root, "apps/web/public/artduo-sculptures")) {
  const sourceBytes = await readFile(path.join(directory, "sources.json"));
  const source = JSON.parse(sourceBytes.toString()) as { models: Array<{ id: string; variants: Record<"compact" | "reference", { filename: string; sha256: string; bytes: number }>; poster: { filename: string; sha256: string; bytes: number } }> };
  const assets: PublicMediaAsset[] = [], sources: PublicMediaUploadSource[] = [];
  for (const model of source.models) for (const variant of [model.variants.compact, model.variants.reference, model.poster]) {
    if (!/^[a-z-]+-(?:(?:compact|reference)\.glb|poster\.png)$/u.test(variant.filename) || !variant.filename.startsWith(model.id + "-")) throw new TypeError("Invalid sculpture asset path");
    const file = path.join(directory, variant.filename), body = await readFile(file), sha256 = mediaSha256(body);
    if (sha256 !== `sha256:${variant.sha256}` || body.length !== variant.bytes) throw new TypeError("Prepared sculpture fingerprint mismatch");
    const isGlb = variant.filename.endsWith(".glb");
    if (isGlb && (body.length < 20 || body.readUInt32LE(0) !== 0x46546c67 || body.readUInt32LE(4) !== 2 || body.readUInt32LE(8) !== body.length)) throw new TypeError("Invalid prepared GLB");
    const dimensions = isGlb ? {} : await inspectPublicMediaImage(body, "image/png");
    const asset: PublicMediaAsset = { id: staticMediaId(`/artduo-sculptures/${variant.filename}`), kind: "sculpture", sha256, bytes: body.length,
      contentType: isGlb ? "model/gltf-binary" : "image/png", objectKey: `${PUBLIC_MEDIA_PREFIX}${sha256.slice(7)}/${variant.filename}`, ...dimensions };
    assets.push(asset); sources.push({ ...asset, file });
  }
  // Reuse the already-published photo/depth/normal objects; do not re-upload or
  // mutate the painting manifest and its exact release-coverage contract.
  const existing = parsePublicMediaManifest(JSON.parse(await readFile(path.join(root, "data/releases/2026-10-24-da3-curated-630/public-media-manifest.json"), "utf8")));
  for (const id of ["bg-022", "bg-034"]) for (const suffix of ["960.webp", "1600.webp", "depth.png", "normal.png"]) {
    const url = `/artduo-gallery/lighting/v2/${id}-${suffix}`, previous = existing.assets.find(asset => asset.id === staticMediaId(url));
    if (!previous) throw new TypeError("Published sculpture room dependency missing");
    // The existing bg-034 normal object has correct PNG bytes but text/plain
    // metadata. Publish a correctly typed alias for this new collection; never
    // overwrite an immutable object or change an older painting release.
    const asset = id === "bg-034" && suffix === "normal.png" ? { ...previous,
      objectKey: `${PUBLIC_MEDIA_PREFIX}${previous.sha256.slice(7)}/sculpture-bg-034-normal.png` } : previous;
    const file = path.join(root, "public", url.slice(1));
    if (mediaSha256(await readFile(file)) !== asset.sha256) throw new TypeError("Room derivative has changed since publication");
    assets.push(asset); sources.push({ ...asset, file });
  }
  return { manifest: createPublicMediaManifest({ releaseVersion: "sculptures-2026-10-27", sourceManifestSha256: mediaSha256(sourceBytes), assets }), sources };
}

async function main() {
  const arg = (key: string) => { const i = process.argv.indexOf(key); return i < 0 ? undefined : process.argv[i + 1]; };
  const root = path.resolve(arg("--root") ?? process.cwd()), output = arg("--output"), staging = arg("--upload-dir");
  if (!output) throw new TypeError("--output is required");
  const result = await buildSculptureMedia(root, arg("--prepared-dir") && path.resolve(arg("--prepared-dir")!));
  const previous = arg("--previous-manifest") ? parsePublicMediaManifest(JSON.parse(await readFile(path.resolve(arg("--previous-manifest")!), "utf8"))) : undefined;
  const published = new Set(previous?.assets.map(asset => asset.objectKey) ?? []);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(result.manifest, null, 2) + "\n");
  await writeFile(output + ".upload.json", JSON.stringify(result.sources, null, 2) + "\n", { mode: 0o600 });
  if (staging) for (const source of result.sources.filter(source => !published.has(source.objectKey) && result.manifest.assets.some(asset => (asset.kind === "sculpture" || asset.objectKey.endsWith("/sculpture-bg-034-normal.png")) && asset.objectKey === source.objectKey))) {
    const file = path.join(staging, source.objectKey);
    await mkdir(path.dirname(file), { recursive: true });
    try { await link(source.file, file); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") await copyFile(source.file, file); }
    if (mediaSha256(await readFile(file)) !== source.sha256) throw new TypeError("Staged sculpture integrity mismatch");
  }
  console.log(JSON.stringify({ assets: result.manifest.assets.length, bytes: result.manifest.assets.reduce((n, a) => n + a.bytes, 0), manifestSha256: result.manifest.manifestSha256 }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
