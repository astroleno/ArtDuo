import { createHash } from "node:crypto";

export const PUBLIC_MEDIA_PREFIX = "artduo/media-v1/objects/";
export const PUBLIC_MEDIA_CACHE_CONTROL = "public, max-age=31536000, immutable";
export const PUBLIC_ROOM_IDS = ["bg-004", "bg-012", "bg-015", "bg-022", "bg-027", "bg-034"] as const;
export const PUBLIC_AUDIO_TRACKS = ["Awakening.mp3", "Felt Letter.mp3", "First Words.mp3"] as const;

export interface PublicMediaAsset {
  id: string;
  kind: "preview" | "depth" | "background" | "room" | "audio" | "sculpture";
  objectKey: string;
  sha256: string;
  bytes: number;
  contentType: "image/webp" | "image/png" | "audio/mpeg" | "model/gltf-binary";
  width?: number;
  height?: number;
  sourceFingerprint?: string;
  recipe?: string;
}
export interface PublicMediaManifest {
  schemaVersion: 1;
  releaseVersion: string;
  sourceManifestSha256: string;
  assets: PublicMediaAsset[];
  manifestSha256: string;
}

export const mediaSha256 = (bytes: string | Uint8Array): string => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const HASH = /^sha256:[a-f0-9]{64}$/u;
const RELEASE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u;
const ARTWORK = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]|%[A-Fa-f0-9]{2}){0,127}$/u;
const AUDIO_PATHS = new Set(PUBLIC_AUDIO_TRACKS.map(name => `/ambient-audio/${encodeURIComponent(name)}`));

export function publicMediaId(kind: "preview" | "depth", artworkId: string): string {
  if (!ARTWORK.test(artworkId)) throw new TypeError("Invalid public artwork identity");
  return `artwork:${artworkId}:${kind}`;
}

export function staticMediaId(url: string): string {
  if (!/^\/artduo-gallery\/(?:[A-Za-z0-9_-]+\.png|lighting\/v2\/bg-\d{3}-(?:960\.webp|1600\.webp|depth\.png|normal\.png))$/u.test(url)
    && !/^\/artduo-sculptures\/[a-z]+(?:-[a-z]+)*-(?:(?:compact|reference)\.glb|poster\.png)$/u.test(url)
    && !AUDIO_PATHS.has(url)) throw new TypeError("Unapproved public media path");
  return `static:${url}`;
}

function manifestBody(value: Omit<PublicMediaManifest, "manifestSha256">) {
  return { schemaVersion: value.schemaVersion, releaseVersion: value.releaseVersion, sourceManifestSha256: value.sourceManifestSha256,
    assets: value.assets.map(asset => ({ id: asset.id, kind: asset.kind, objectKey: asset.objectKey, sha256: asset.sha256, bytes: asset.bytes,
      contentType: asset.contentType, ...(asset.width === undefined ? {} : { width: asset.width, height: asset.height }),
      ...(asset.sourceFingerprint === undefined ? {} : { sourceFingerprint: asset.sourceFingerprint }), ...(asset.recipe === undefined ? {} : { recipe: asset.recipe }) })) };
}

export function createPublicMediaManifest(value: Omit<PublicMediaManifest, "schemaVersion" | "manifestSha256">): PublicMediaManifest {
  const body = manifestBody({ schemaVersion: 1, ...value, assets: [...value.assets].sort((a, b) => a.id.localeCompare(b.id, "en")) });
  return parsePublicMediaManifest({ ...body, manifestSha256: mediaSha256(JSON.stringify(body)) });
}

/** Reject unknown data as well as invalid paths: this artifact is safe to publish. */
export function parsePublicMediaManifest(value: unknown): PublicMediaManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Invalid public media manifest");
  const row = value as PublicMediaManifest;
  if (Object.keys(row).some(key => !["schemaVersion", "releaseVersion", "sourceManifestSha256", "assets", "manifestSha256"].includes(key))
    || row.schemaVersion !== 1 || typeof row.releaseVersion !== "string" || !RELEASE.test(row.releaseVersion) || !HASH.test(row.sourceManifestSha256)
    || !HASH.test(row.manifestSha256) || !Array.isArray(row.assets) || !row.assets.length || row.assets.length > 20000) throw new TypeError("Invalid public media manifest identity");
  const ids = new Set<string>();
  for (const asset of row.assets) {
    if (!asset || typeof asset !== "object" || Object.keys(asset).some(key => !["id", "kind", "objectKey", "sha256", "bytes", "contentType", "width", "height", "sourceFingerprint", "recipe"].includes(key))
      || typeof asset.id !== "string" || ids.has(asset.id) || !HASH.test(asset.sha256) || !Number.isSafeInteger(asset.bytes) || asset.bytes < 1 || asset.bytes > 16_000_000) throw new TypeError("Invalid public media asset");
    ids.add(asset.id);
    const image = asset.contentType === "image/png" || asset.contentType === "image/webp";
    if (image && (!Number.isInteger(asset.width) || !Number.isInteger(asset.height) || asset.width! < 1 || asset.height! < 1 || asset.width! * asset.height! > 20_000_000)) throw new TypeError("Invalid public image dimensions");
    const extension = asset.contentType === "image/webp" ? ".webp" : asset.contentType === "image/png" ? ".png" : asset.contentType === "audio/mpeg" ? ".mp3" : asset.contentType === "model/gltf-binary" ? ".glb" : undefined;
    if (!extension || !new RegExp(`^${PUBLIC_MEDIA_PREFIX}${asset.sha256.slice(7)}/[A-Za-z0-9_-]+\\${extension}$`, "u").test(asset.objectKey)) throw new TypeError("Invalid public object key");
    if (asset.kind === "preview" || asset.kind === "depth") {
      const match = /^artwork:(.+):(preview|depth)$/u.exec(asset.id);
      if (!match || !ARTWORK.test(match[1]!) || match[2] !== asset.kind || !HASH.test(asset.sourceFingerprint ?? "") || typeof asset.recipe !== "string" || !asset.recipe || asset.recipe.length > 200
        || (asset.kind === "preview" ? asset.contentType !== "image/webp" : asset.contentType !== "image/png")) throw new TypeError("Invalid public artwork binding");
    } else {
      if (!asset.id.startsWith("static:")) throw new TypeError("Invalid static media identity");
      const url = asset.id.slice(7);
      if (staticMediaId(url) !== asset.id || (asset.kind === "sculpture" ? !url.startsWith("/artduo-sculptures/") || (url.endsWith(".glb") ? asset.contentType !== "model/gltf-binary" : asset.contentType !== "image/png")
        : asset.kind === "audio" ? !AUDIO_PATHS.has(url) || asset.contentType !== "audio/mpeg"
        : asset.kind === "background" ? !/^\/artduo-gallery\/[A-Za-z0-9_-]+\.png$/u.test(url) || asset.contentType !== "image/png"
          : asset.kind !== "room" || !url.startsWith("/artduo-gallery/lighting/v2/") || !image)) throw new TypeError("Invalid static media kind");
    }
  }
  const body = manifestBody(row);
  if (mediaSha256(JSON.stringify(body)) !== row.manifestSha256) throw new TypeError("Public media manifest integrity mismatch");
  return { ...body, manifestSha256: row.manifestSha256 };
}
