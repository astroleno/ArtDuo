import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { appPath } from "@artduo/contracts";
import { projectRootFromCwd } from "../../api/src/runtime/environment";
import { mediaSha256, parsePublicMediaManifest, publicMediaId, staticMediaId, type PublicMediaAsset, type PublicMediaManifest } from "./public-media-manifest";
import { PUBLIC_AUDIO_TRACKS, PUBLIC_ROOM_IDS } from "./public-media-manifest";
import { isGalleryArtwork } from "./artwork-eligibility";
import type { WebReleaseCatalog } from "./release-catalog";

const loaded = new Map<string, { revision: string; sourceRevision: string; manifest: PublicMediaManifest; index: Map<string, PublicMediaAsset> }>();
type Environment = Record<string, string | undefined>;

export function publicMediaOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new TypeError("Public media requires an HTTPS origin");
  return url.origin;
}

/** Server-only resolution; credentials and the full manifest never reach React props. */
export function readPublicMediaConfiguration(options: { rootDir?: string; environment?: Environment } = {}) {
  const environment = options.environment ?? process.env;
  const mode = environment.ARTDUO_MEDIA_MODE ?? "local";
  if (mode === "local") return undefined;
  if (mode !== "cdn") throw new TypeError("Invalid public media mode");
  const origin = publicMediaOrigin(environment.ARTDUO_MEDIA_ORIGIN ?? "");
  const root = options.rootDir ?? projectRootFromCwd();
  const filename = environment.ARTDUO_MEDIA_MANIFEST;
  if (!filename) throw new TypeError("CDN mode requires a verified public media manifest");
  const file = path.resolve(root, filename), stat = statSync(file, { bigint: true });
  if (!stat.isFile() || stat.size > 8_000_000n) throw new TypeError("Invalid public media manifest file");
  const revision = `${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`;
  const cacheKey = `${root}\n${file}`;
  const sourcePath = (release: string) => path.join(root, "data/releases", release, "manifest.json");
  const sourceRevision = (release: string) => { const value = statSync(sourcePath(release), { bigint: true }); return `${value.ino}:${value.size}:${value.mtimeNs}:${value.ctimeNs}`; };
  let entry = loaded.get(cacheKey);
  if (!entry || entry.revision !== revision || entry.sourceRevision !== sourceRevision(entry.manifest.releaseVersion)) {
    const manifest = parsePublicMediaManifest(JSON.parse(readFileSync(file, "utf8")));
    if (mediaSha256(readFileSync(sourcePath(manifest.releaseVersion))) !== manifest.sourceManifestSha256) throw new TypeError("Public media release mismatch");
    entry = { revision, sourceRevision: sourceRevision(manifest.releaseVersion), manifest, index: new Map(manifest.assets.map(asset => [asset.id, asset])) };
    loaded.set(cacheKey, entry);
    while (loaded.size > 4) loaded.delete(loaded.keys().next().value!);
  }
  return { origin, manifest: entry.manifest, index: entry.index };
}

export function publicMediaUrl(id: string, localUrl: string, releaseVersion?: string, options?: Parameters<typeof readPublicMediaConfiguration>[0]): string {
  const configuration = readPublicMediaConfiguration(options);
  if (!configuration || !releaseVersion || configuration.manifest.releaseVersion !== releaseVersion) return appPath(localUrl);
  const asset = configuration.index.get(id);
  if (!asset) throw new TypeError(`Media is missing from active CDN manifest: ${id}`);
  return `${configuration.origin}/${asset.objectKey}`;
}

export function publicStaticMediaUrl(url: string, releaseVersion: string): string {
  return publicMediaUrl(staticMediaId(url), url, releaseVersion);
}

export function publicArtworkMediaUrl(id: string, variant: "preview" | "depth", localUrl: string, releaseVersion?: string): string {
  return publicMediaUrl(publicMediaId(variant, id), localUrl, releaseVersion);
}

export function verifyPublicMediaCoverage(catalog: WebReleaseCatalog, options?: Parameters<typeof readPublicMediaConfiguration>[0]) {
  const configuration = readPublicMediaConfiguration(options);
  if (!configuration) return { mode: "local" as const, assets: 0, bytes: 0 };
  if (configuration.manifest.releaseVersion !== catalog.releaseVersion) throw new TypeError("Active CDN manifest release mismatch");
  const expected = new Set<string>();
  for (const artwork of catalog.artworks.filter(isGalleryArtwork)) {
    const media = catalog.artworkRecordById.get(artwork.id)!.media;
    for (const variant of ["preview", "depth"] as const) {
      const id = publicMediaId(variant, artwork.id), asset = configuration.index.get(id);
      if (!asset || asset.sourceFingerprint !== media.sourceAssetFingerprint) throw new TypeError(`CDN source binding mismatch: ${id}`);
      if (variant === "depth" && (media.depthMap?.version !== catalog.releaseVersion || media.depthMap.sourceAssetFingerprint !== asset.sourceFingerprint)) throw new TypeError(`CDN depth binding mismatch: ${id}`);
      expected.add(id);
    }
  }
  for (const scene of catalog.backgroundSceneRecordById.values()) expected.add(staticMediaId(scene.asset.local_public_path));
  for (const id of PUBLIC_ROOM_IDS) for (const suffix of ["960.webp", "1600.webp", "depth.png", "normal.png"]) expected.add(staticMediaId(`/artduo-gallery/lighting/v2/${id}-${suffix}`));
  for (const track of PUBLIC_AUDIO_TRACKS) expected.add(staticMediaId(`/ambient-audio/${encodeURIComponent(track)}`));
  if (expected.size !== configuration.index.size || [...expected].some(id => !configuration.index.has(id))) throw new TypeError("CDN manifest does not cover the complete public release");
  return { mode: "cdn" as const, assets: expected.size, bytes: configuration.manifest.assets.reduce((sum, row) => sum + row.bytes, 0) };
}
