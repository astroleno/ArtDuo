import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { mediaSha256, parsePublicMediaManifest, PUBLIC_MEDIA_CACHE_CONTROL, type PublicMediaAsset, type PublicMediaManifest } from "./public-media-manifest";
import { publicMediaOrigin } from "./public-media";

export interface PublicMediaReceipt { id: string; sha256: string; bytes: number; status: number; cache?: string; contentType?: string; cacheControl?: string }
export interface PublicMediaVerification {
  manifestSha256: string; origin: string; transferredBytes: number; requests: number; verified: PublicMediaReceipt[];
}
type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function validHeaders(response: Response, asset: PublicMediaAsset): void {
  const cache = new Set((response.headers.get("cache-control") ?? "").split(",").map(part => part.trim().toLowerCase()));
  if (response.status !== 200 || response.headers.get("content-type")?.split(";")[0] !== asset.contentType
    || Number(response.headers.get("content-length")) !== asset.bytes || response.headers.get("access-control-allow-origin") !== "*"
    || !["public", "immutable", "max-age=31536000"].every(value => cache.has(value))) throw new TypeError(`Public media response mismatch: ${asset.id} (HTTP ${response.status})`);
}

/** Bounded verification of our manifest only; resumes already verified immutable objects. */
export async function verifyPublicMediaAssets(value: PublicMediaManifest, originValue: string, options: {
  fetch?: Fetch; previous?: PublicMediaVerification; maximumBytes?: number; maximumRequests?: number; bytesPerSecond?: number;
  progress?: (result: PublicMediaVerification) => Promise<void>;
} = {}): Promise<PublicMediaVerification> {
  const manifest = parsePublicMediaManifest(value), origin = publicMediaOrigin(originValue), request = options.fetch ?? fetch;
  const result: PublicMediaVerification = options.previous ? structuredClone(options.previous)
    : { manifestSha256: manifest.manifestSha256, origin, transferredBytes: 0, requests: 0, verified: [] };
  if (result.manifestSha256 !== manifest.manifestSha256 || result.origin !== origin) throw new TypeError("Verification receipt belongs to a different publication");
  const maximumBytes = options.maximumBytes ?? 1_000_000_000, maximumRequests = options.maximumRequests ?? 1500;
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1 || !Number.isSafeInteger(maximumRequests) || maximumRequests < 1
    || (options.bytesPerSecond !== undefined && (!Number.isFinite(options.bytesPerSecond) || options.bytesPerSecond <= 0))) throw new TypeError("Invalid verification budget");
  const completed = new Map(result.verified.map(row => [row.id, row]));
  if (completed.size !== result.verified.length || !Number.isSafeInteger(result.transferredBytes) || result.transferredBytes < 0
    || !Number.isSafeInteger(result.requests) || result.requests < completed.size) throw new TypeError("Invalid verification receipt");
  for (const receipt of result.verified) {
    const asset = manifest.assets.find(row => row.id === receipt.id);
    if (!asset || asset.sha256 !== receipt.sha256 || asset.bytes !== receipt.bytes || receipt.status !== 200) throw new TypeError("Invalid verified object receipt");
  }
  if (result.transferredBytes < result.verified.reduce((sum, receipt) => sum + receipt.bytes, 0)) throw new TypeError("Invalid verification byte total");
  const started = Date.now(), previousBytes = result.transferredBytes;
  const pace = async () => {
    const delay = options.bytesPerSecond ? (result.transferredBytes - previousBytes) * 1000 / options.bytesPerSecond - (Date.now() - started) : 0;
    if (delay > 0) await sleep(Math.min(delay, 30_000));
  };
  for (const asset of manifest.assets) {
    if (completed.has(asset.id)) continue;
    if (result.requests >= maximumRequests || result.transferredBytes + asset.bytes > maximumBytes) throw new RangeError("Public media verification budget reached");
    result.requests++;
    let response: Response | undefined;
    try {
      response = await request(`${origin}/${asset.objectKey}`, { headers: { Origin: "https://tongye.me", "Accept-Encoding": "identity" }, redirect: "error", signal: AbortSignal.timeout(45_000) });
      validHeaders(response, asset);
      const reader = response.body?.getReader();
      if (!reader) throw new TypeError("Public media response has no body");
      const digest = createHash("sha256"); let bytes = 0;
      try {
        while (true) {
          const part = await reader.read(); if (part.done) break;
          bytes += part.value.byteLength; result.transferredBytes += part.value.byteLength;
          if (bytes > asset.bytes || result.transferredBytes > maximumBytes) throw new RangeError("Public media response exceeded its verified size");
          digest.update(part.value); await pace();
        }
      } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
      if (bytes !== asset.bytes || `sha256:${digest.digest("hex")}` !== asset.sha256) throw new TypeError(`CDN pixel integrity mismatch: ${asset.id}`);
      result.verified.push({ id: asset.id, sha256: asset.sha256, bytes, status: response.status, contentType: asset.contentType,
        cacheControl: response.headers.get("cache-control") ?? undefined, cache: response.headers.get("x-cache-lookup") ?? undefined });
      await options.progress?.(result);
    } catch (error) {
      await response?.body?.cancel().catch(() => undefined);
      await options.progress?.(result);
      throw error;
    }
  }
  return result;
}

/** Presigned grants are explicit, scoped inputs. No account key discovery or browser-session export. */
export async function uploadPublicMediaObject(asset: PublicMediaAsset, file: string, grantUrl: string, request: Fetch = fetch): Promise<void> {
  const grant = new URL(grantUrl);
  if (grant.protocol !== "https:" || !/^[a-z0-9-]+\.cos\.[a-z0-9-]+\.myqcloud\.com$/u.test(grant.hostname)
    || grant.username || grant.password || grant.hash || grant.pathname !== `/${asset.objectKey}` || !grant.searchParams.has("q-signature")) throw new TypeError("Upload grant is not scoped to this COS object");
  const body = await readFile(file);
  if (body.length !== asset.bytes || mediaSha256(body) !== asset.sha256) throw new TypeError("Upload source integrity mismatch");
  const response = await request(grant.href, { method: "PUT", body: new Uint8Array(body), redirect: "error", signal: AbortSignal.timeout(60_000), headers: {
    "Content-Type": asset.contentType, "Content-Length": String(asset.bytes), "Content-MD5": createHash("md5").update(body).digest("base64"),
    "Cache-Control": PUBLIC_MEDIA_CACHE_CONTROL, "x-cos-acl": "private", "x-cos-forbid-overwrite": "true", "x-cos-tagging": "project=artduo",
  } });
  await response.body?.cancel().catch(() => undefined);
  if (!response.ok) throw new Error(`Scoped COS upload failed (HTTP ${response.status})`);
}
