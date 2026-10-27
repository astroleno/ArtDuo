// Node-only: the browser never receives cache paths or performs source requests.
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { VerifiedRemoteImage } from "@artduo/contracts";

export const PUBLIC_IMAGE_HOSTS = new Set([
  "images.metmuseum.org", "media.getty.edu", "kokoelma.kansallisgalleria.fi",
  "iiif.micr.io", "ids.si.edu", "iip.smk.dk", "iip-thumb.smk.dk", "api.smk.dk",
  "smithsonian-open-access.s3-us-west-2.amazonaws.com",
]);
export const PUBLIC_IMAGE_MAX_BYTES = 30_000_000;
export const publicImageDigest = (bytes: Buffer) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

export class PublicImageError extends Error {
  constructor(readonly code: string, readonly host?: string, readonly status?: number) { super(code); }
}

const hostQueues = new Map<string, Promise<void>>();
async function reserveImageHost(host: string): Promise<() => void> {
  const previous = hostQueues.get(host) ?? Promise.resolve();
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const queued = previous.then(() => held);
  hostQueues.set(host, queued);
  await previous;
  return () => { release(); if (hostQueues.get(host) === queued) hostQueues.delete(host); };
}

export function assertPublicImageUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new PublicImageError("invalid-public-image-url"); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash || (url.port && url.port !== "443")
    || !PUBLIC_IMAGE_HOSTS.has(url.hostname) || value !== value.trim() || /[\r\n]/u.test(value)) {
    throw new PublicImageError("unapproved-public-image-url", url.hostname);
  }
  return url;
}

/** One attempt, bounded through the last byte; redirects are validated before fetching. */
export async function fetchPublicImage(value: string, options: {
  fetchImpl?: typeof fetch; timeoutMs?: number; stoppedHosts?: Set<string>; kind?: "image" | "iiif-info";
} = {}): Promise<{ body: Buffer; contentType: string; finalUrl: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 120_000);
  let current = value;
  let releaseHost: (() => void) | undefined;
  const maxBytes = options.kind === "iiif-info" ? 256_000 : PUBLIC_IMAGE_MAX_BYTES;
  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      const url = assertPublicImageUrl(current);
      if (options.stoppedHosts?.has(url.hostname)) throw new PublicImageError("source-host-stopped", url.hostname);
      releaseHost = await reserveImageHost(url.hostname);
      controller.signal.throwIfAborted();
      if (options.stoppedHosts?.has(url.hostname)) throw new PublicImageError("source-host-stopped", url.hostname);
      const response = await (options.fetchImpl ?? fetch)(current, { redirect: "manual", signal: controller.signal,
        headers: { Accept: options.kind === "iiif-info" ? "application/json,application/ld+json" : "image/jpeg,image/png,image/webp,image/avif", "User-Agent": "ArtDuo/1.0 (verified museum image import)" } });
      if ([401, 403, 429].includes(response.status)) {
        options.stoppedHosts?.add(url.hostname);
        await response.body?.cancel();
        throw new PublicImageError("source-access-stopped", url.hostname, response.status);
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location || redirects === 3) throw new PublicImageError("invalid-image-redirect", url.hostname);
        current = new URL(location, current).href;
        assertPublicImageUrl(current);
        releaseHost(); releaseHost = undefined;
        continue;
      }
      const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
      const lengthHeader = response.headers.get("content-length");
      const expected = lengthHeader === null ? undefined : Number(lengthHeader);
      if (expected !== undefined && expected > maxBytes) {
        await response.body?.cancel(); throw new PublicImageError("image-body-too-large", url.hostname, response.status);
      }
      const validType = options.kind === "iiif-info" ? /^(?:application\/(?:json|ld\+json))$/u.test(contentType)
        : /^(?:image\/(?:jpeg|jpg|png|webp|avif)|application\/octet-stream)$/u.test(contentType);
      if (response.status !== 200 || !response.body || !validType
        || expected !== undefined && (!Number.isSafeInteger(expected) || expected <= 0)) {
        await response.body?.cancel();
        throw new PublicImageError("invalid-image-response", url.hostname, response.status);
      }
      const reader = response.body.getReader(), chunks: Buffer[] = [];
      const abortReader = () => { void reader.cancel().catch(() => undefined); };
      controller.signal.addEventListener("abort", abortReader, { once: true });
      let total = 0;
      try {
        for (;;) {
          const chunk = await reader.read();
          controller.signal.throwIfAborted();
          if (chunk.done) break;
          total += chunk.value.byteLength;
          if (total > maxBytes) { await reader.cancel(); throw new PublicImageError("image-body-too-large", url.hostname, response.status); }
          chunks.push(Buffer.from(chunk.value));
        }
      } finally { controller.signal.removeEventListener("abort", abortReader); reader.releaseLock(); }
      // Fetch may decompress Content-Encoding; only identity lengths compare to decoded bytes.
      if (!total || expected !== undefined && !response.headers.get("content-encoding") && expected !== total) {
        throw new PublicImageError("incomplete-image-body", url.hostname);
      }
      return { body: Buffer.concat(chunks, total), contentType, finalUrl: current };
    }
    throw new PublicImageError("invalid-image-redirect");
  } catch (error) {
    if (controller.signal.aborted) throw new PublicImageError("image-transfer-timeout", new URL(value).hostname);
    throw error;
  } finally { releaseHost?.(); clearTimeout(timer); }
}

export function publicImageCachePath(rootDir: string, fingerprint: string): string {
  if (!/^sha256:[a-f0-9]{64}$/u.test(fingerprint)) throw new PublicImageError("invalid-image-fingerprint");
  return path.join(rootDir, ".cache/artduo-public-images", `${fingerprint.slice(7)}.bin`);
}

export function readCachedPublicImage(rootDir: string, ref: VerifiedRemoteImage): Buffer | undefined {
  assertPublicImageUrl(ref.url);
  const filename = publicImageCachePath(rootDir, ref.sha256);
  if (!existsSync(filename)) {
    const preserved = path.join(rootDir, "data/sources/public-url/preserved-images", `${ref.sha256.slice(7)}.bin`);
    if (!existsSync(preserved)) return undefined;
    if (statSync(preserved).size !== ref.byteLength || ref.byteLength > PUBLIC_IMAGE_MAX_BYTES) throw new PublicImageError("image-cache-size-mismatch");
    const bytes = readFileSync(preserved);
    if (publicImageDigest(bytes) !== ref.sha256) throw new PublicImageError("image-cache-fingerprint-mismatch");
    cachePublicImage(rootDir, ref, bytes);
    return bytes;
  }
  if (statSync(filename).size !== ref.byteLength || ref.byteLength > PUBLIC_IMAGE_MAX_BYTES) throw new PublicImageError("image-cache-size-mismatch");
  const bytes = readFileSync(filename);
  if (publicImageDigest(bytes) !== ref.sha256) throw new PublicImageError("image-cache-fingerprint-mismatch");
  return bytes;
}

export function cachePublicImage(rootDir: string, ref: VerifiedRemoteImage, bytes: Buffer): string {
  assertPublicImageUrl(ref.url);
  if (bytes.length !== ref.byteLength || bytes.length > PUBLIC_IMAGE_MAX_BYTES || publicImageDigest(bytes) !== ref.sha256) throw new PublicImageError("image-response-fingerprint-mismatch");
  const filename = publicImageCachePath(rootDir, ref.sha256);
  if (!existsSync(filename)) {
    mkdirSync(path.dirname(filename), { recursive: true });
    const temporary = `${filename}.${randomUUID()}.tmp`;
    try { writeFileSync(temporary, bytes, { flag: "wx" }); renameSync(temporary, filename); }
    finally { if (existsSync(temporary)) unlinkSync(temporary); }
  } else { readCachedPublicImage(rootDir, ref); }
  return filename;
}

const inFlight = new Map<string, Promise<Buffer>>();
const runtimeStoppedHosts = new Set<string>();
export async function readVerifiedPublicImage(rootDir: string, ref: VerifiedRemoteImage): Promise<Buffer> {
  const cached = readCachedPublicImage(rootDir, ref);
  if (cached) return cached;
  const key = `${path.resolve(rootDir)}:${ref.url}:${ref.sha256}`;
  let job = inFlight.get(key);
  if (!job) {
    job = (async () => {
      const image = await fetchPublicImage(ref.url, { stoppedHosts: runtimeStoppedHosts });
      cachePublicImage(rootDir, ref, image.body);
      return image.body;
    })().finally(() => inFlight.delete(key));
    inFlight.set(key, job);
  }
  return job;
}
