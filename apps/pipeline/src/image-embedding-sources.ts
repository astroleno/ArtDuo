import { lookup as lookupDns } from "node:dns/promises";
import { realpathSync, readFileSync, statSync } from "node:fs";
import { get as httpsGet } from "node:https";
import { isIP } from "node:net";
import path from "node:path";

import type { ImageEmbeddingEntityType } from "@artduo/contracts";

import {
  ImageSourceCache,
  fingerprintImageSourceBytes,
  fingerprintImageSourceLocator,
  type ImageSourceCacheKey,
} from "./image-source-cache";

export const IMAGE_FETCH_LIMITS = {
  timeoutMs: 15_000,
  maxBytes: 12 * 1024 * 1024,
  maxRedirects: 3,
  maxWidth: 12_000,
  maxHeight: 12_000,
  maxPixels: 48_000_000,
  allowedMediaTypes: ["image/jpeg", "image/png", "image/webp"],
  allowedRemoteHosts: ["images.metmuseum.org"],
} as const;

export type ImageSourceFailureReason =
  | "missing-source"
  | "offline-cache-miss"
  | "invalid-source"
  | "fetch-failed"
  | "decode-failed";

export interface ImageSourceFailure {
  reason: ImageSourceFailureReason;
  message: string;
}

export interface ResolvedImageEmbeddingSource {
  entityType: ImageEmbeddingEntityType;
  entityId: string;
  fieldPath: string;
  bytes: Uint8Array;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
  fingerprint: string;
  sourceLocatorFingerprint: string;
  sourceHost?: string;
}

export type ResolveImageEmbeddingSourceResult =
  | { status: "ready"; source: ResolvedImageEmbeddingSource }
  | { status: "failed"; failure: ImageSourceFailure };

export interface ArtworkImageSourceInput {
  entityType: "artwork";
  entityId: string;
  media: {
    imageUrlPreview?: string;
    baseImageUrl?: string;
    imageUrlFull?: string;
  };
}

export interface BackgroundSceneImageSourceInput {
  entityType: "background-scene";
  entityId: string;
  asset: {
    local_public_path?: string;
  };
}

export type ImageEmbeddingSourceInput = ArtworkImageSourceInput | BackgroundSceneImageSourceInput;

export interface RemoteImageResponse {
  status: number;
  headers: Record<string, string | undefined>;
  bytes: Uint8Array;
}

export type RemoteImageRequest = (
  url: URL,
  options: {
    timeoutMs: number;
    maxBytes: number;
    addresses: Array<{ address: string; family: number }>;
    signal: AbortSignal;
  },
) => Promise<RemoteImageResponse>;

export interface ImageEmbeddingSourceOptions {
  rootDir: string;
  publicRoot?: string;
  cache?: ImageSourceCache;
  refreshSourceCache?: boolean;
  offline?: boolean;
  /** Test-only cap; production may only shorten the fixed 15-second limit. */
  totalTimeoutMs?: number;
  remoteRequest?: RemoteImageRequest;
  dnsLookup?: (hostname: string) => Promise<Array<{ address: string; family: number }>>;
}

interface LocatedSource {
  locator: string;
  fieldPath: string;
  remote: boolean;
}

interface ImageInfo {
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
}

class SourceError extends Error {
  constructor(readonly reason: ImageSourceFailureReason, message: string) {
    super(message);
  }
}

function fail(reason: ImageSourceFailureReason, message: string): never {
  throw new SourceError(reason, message);
}

function isInside(parentPath: string, childPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function isPublicIpv4(address: string): boolean {
  const octets = address.split(".").map((entry) => Number.parseInt(entry, 10));
  if (octets.length !== 4 || octets.some((entry) => !Number.isInteger(entry) || entry < 0 || entry > 255)) {
    return false;
  }
  const [first, second] = octets;
  return !(
    first === 0 || first === 10 || first === 127 ||
    (first === 100 && second! >= 64 && second! <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second! >= 16 && second! <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}

function isPublicAddress(address: string, family: number): boolean {
  if (family === 4) {
    return isIP(address) === 4 && isPublicIpv4(address);
  }
  if (family !== 6 || isIP(address) !== 6) {
    return false;
  }
  const value = parseIpv6Address(address);
  if (value === undefined) {
    return false;
  }

  const first16 = Number(value >> 112n);
  const first32 = Number(value >> 96n);
  const first48 = value >> 80n;
  const high64 = value >> 64n;
  const ipv4Compatible = value >> 32n === 0n;
  const ipv4Mapped = value >> 32n === 0xffffn;
  return !(
    ipv4Compatible || ipv4Mapped ||
    (first16 & 0xfe00) === 0xfc00 || // unique-local fc00::/7
    (first16 & 0xffc0) === 0xfe80 || // link-local fe80::/10
    (first16 & 0xffc0) === 0xfec0 || // deprecated site-local fec0::/10
    (first16 & 0xff00) === 0xff00 || // multicast ff00::/8
    first16 === 0x2002 || // 6to4 (can encapsulate a non-public IPv4 destination)
    first16 === 0x3ffe || // deprecated 6bone
    first16 === 0x5f00 || // IETF reserved SRv6 SID block
    first32 === 0x20010000 || // Teredo 2001::/32
    (first32 & 0xfffffff0) === 0x20010010 || // ORCHIDv2 2001:10::/28
    (first32 & 0xfffffff0) === 0x20010020 || // ORCHID 2001:20::/28
    first32 === 0x20010002 || // benchmarking 2001:2::/48
    first32 === 0x20010db8 || // documentation 2001:db8::/32
    high64 === 0x0100000000000000n || // discard-only 100::/64
    first32 === 0x0064ff9b || // NAT64 well-known prefix 64:ff9b::/96
    first48 === 0x0064ff9b0001n // NAT64 local-use prefix 64:ff9b:1::/48
  );
}

function parseIpv6Address(address: string): bigint | undefined {
  const halves = address.toLowerCase().split("::");
  if (halves.length > 2) {
    return undefined;
  }
  const parseHalf = (half: string): string[] | undefined => {
    if (half === "") {
      return [];
    }
    const groups = half.split(":");
    const last = groups.at(-1);
    if (last?.includes(".")) {
      if (!isIpv4Syntax(last)) {
        return undefined;
      }
      const octets = last.split(".").map(Number);
      groups.splice(-1, 1, ((octets[0]! << 8) | octets[1]!).toString(16), ((octets[2]! << 8) | octets[3]!).toString(16));
    }
    return groups.every((group) => /^[a-f0-9]{1,4}$/u.test(group)) ? groups : undefined;
  };
  const left = parseHalf(halves[0] ?? "");
  const right = parseHalf(halves[1] ?? "");
  if (!left || !right || left.length + right.length > 8 || (halves.length === 1 && left.length !== 8)) {
    return undefined;
  }
  const groups = halves.length === 1
    ? left
    : [...left, ...Array.from({ length: 8 - left.length - right.length }, () => "0"), ...right];
  return groups.reduce((value, group) => (value << 16n) | BigInt(`0x${group}`), 0n);
}

function isIpv4Syntax(address: string): boolean {
  const octets = address.split(".").map((entry) => Number.parseInt(entry, 10));
  return octets.length === 4 && octets.every((entry) => Number.isInteger(entry) && entry >= 0 && entry <= 255);
}

function locateSources(input: ImageEmbeddingSourceInput): LocatedSource[] {
  if (input.entityType === "artwork") {
    const candidates: Array<[string, string | undefined]> = [
      ["media.imageUrlPreview", input.media.imageUrlPreview],
      ["media.baseImageUrl", input.media.baseImageUrl],
      ["media.imageUrlFull", input.media.imageUrlFull],
    ];
    const sources = candidates
      .filter(([, locator]) => typeof locator === "string" && locator.trim() !== "")
      .map(([fieldPath, locator]) => ({ locator: locator!.trim(), fieldPath, remote: true }));
    if (sources.length === 0) {
      fail("missing-source", "Artwork has no usable release image reference.");
    }
    return sources;
  }

  const locator = input.asset.local_public_path?.trim();
  if (!locator) {
    fail("missing-source", "Background scene has no usable public image reference.");
  }
  return [{ locator, fieldPath: "asset.local_public_path", remote: false }];
}

function normalizePublicPath(locator: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(locator);
  } catch {
    fail("invalid-source", "Background scene public path is not valid URL encoding.");
  }
  if (!decoded.startsWith("/") || decoded.includes("\\") || decoded.split("/").includes("..")) {
    fail("invalid-source", "Background scene public path is unsafe.");
  }
  return decoded;
}

function validateRemoteUrl(locator: string): URL {
  let url: URL;
  try {
    url = new URL(locator);
  } catch {
    fail("invalid-source", "Artwork image URL is invalid.");
  }
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    !IMAGE_FETCH_LIMITS.allowedRemoteHosts.includes(url.hostname.toLowerCase() as "images.metmuseum.org")
  ) {
    fail("invalid-source", "Artwork image URL is not an allowed HTTPS source.");
  }
  return url;
}

function mediaTypeFromHeader(value: string | undefined): ImageInfo["mediaType"] {
  const mediaType = value?.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType === "image/jpeg" || mediaType === "image/png" || mediaType === "image/webp") {
    return mediaType;
  }
  fail("fetch-failed", "Image response content type is not allowed.");
}

function preflightImageInfo(bytes: Uint8Array): ImageInfo {
  const png = readPngHeader(bytes);
  const jpeg = readJpegHeader(bytes);
  const webp = readWebpHeader(bytes);
  const info = png ?? jpeg ?? webp;
  if (
    !info || info.width <= 0 || info.height <= 0 ||
    info.width > IMAGE_FETCH_LIMITS.maxWidth || info.height > IMAGE_FETCH_LIMITS.maxHeight ||
    info.width * info.height > IMAGE_FETCH_LIMITS.maxPixels
  ) {
    fail("decode-failed", "Image dimensions exceed decode limits.");
  }
  return info;
}

function readPngHeader(bytes: Uint8Array): ImageInfo | undefined {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24 || signature.some((value, index) => bytes[index] !== value) || Buffer.from(bytes.subarray(12, 16)).toString("ascii") !== "IHDR") {
    return undefined;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { mediaType: "image/png", width: view.getUint32(16), height: view.getUint32(20) };
}

function readJpegHeader(bytes: Uint8Array): ImageInfo | undefined {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return undefined;
  }
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === undefined) {
      return undefined;
    }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = ((bytes[offset + 2] ?? 0) << 8) + (bytes[offset + 3] ?? 0);
    if (length < 2 || offset + 2 + length > bytes.length) {
      return undefined;
    }
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return {
        mediaType: "image/jpeg",
        height: ((bytes[offset + 5] ?? 0) << 8) + (bytes[offset + 6] ?? 0),
        width: ((bytes[offset + 7] ?? 0) << 8) + (bytes[offset + 8] ?? 0),
      };
    }
    offset += 2 + length;
  }
  return undefined;
}

function readWebpHeader(bytes: Uint8Array): ImageInfo | undefined {
  if (bytes.length < 16 || Buffer.from(bytes.subarray(0, 4)).toString("ascii") !== "RIFF" || Buffer.from(bytes.subarray(8, 12)).toString("ascii") !== "WEBP") {
    return undefined;
  }
  const chunk = Buffer.from(bytes.subarray(12, 16)).toString("ascii");
  if (chunk === "VP8X" && bytes.length >= 30) {
    return {
      mediaType: "image/webp",
      width: 1 + (bytes[24] ?? 0) + ((bytes[25] ?? 0) << 8) + ((bytes[26] ?? 0) << 16),
      height: 1 + (bytes[27] ?? 0) + ((bytes[28] ?? 0) << 8) + ((bytes[29] ?? 0) << 16),
    };
  }
  if (chunk === "VP8 " && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return {
      mediaType: "image/webp",
      width: (((bytes[26] ?? 0) | ((bytes[27] ?? 0) << 8)) & 0x3fff),
      height: (((bytes[28] ?? 0) | ((bytes[29] ?? 0) << 8)) & 0x3fff),
    };
  }
  if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    return {
      mediaType: "image/webp",
      width: 1 + (bytes[21] ?? 0) + (((bytes[22] ?? 0) & 0x3f) << 8),
      height: 1 + (((bytes[22] ?? 0) >> 6) & 0x03) + ((bytes[23] ?? 0) << 2) + (((bytes[24] ?? 0) & 0x0f) << 10),
    };
  }
  return undefined;
}

async function decodeImageInfo(bytes: Uint8Array): Promise<ImageInfo> {
  const header = preflightImageInfo(bytes);

  try {
    const transformers = await import("@xenova/transformers");
    const image = await transformers.RawImage.fromBlob(new Blob([bytes], { type: header.mediaType }));
    const { width, height } = image;
    if (
      !Number.isInteger(width) || !Number.isInteger(height) ||
      width <= 0 || height <= 0 ||
      width > IMAGE_FETCH_LIMITS.maxWidth || height > IMAGE_FETCH_LIMITS.maxHeight ||
      width * height > IMAGE_FETCH_LIMITS.maxPixels
    ) {
      fail("decode-failed", "Image dimensions exceed decode limits.");
    }
    return { mediaType: header.mediaType, width, height };
  } catch (error) {
    if (error instanceof SourceError) {
      throw error;
    }
    fail("decode-failed", "Image decode validation failed.");
  }
}

async function defaultDnsLookup(hostname: string): Promise<Array<{ address: string; family: number }>> {
  return lookupDns(hostname, { all: true, verbatim: true });
}

const defaultRemoteRequest: RemoteImageRequest = async (url, options) => new Promise((resolve, reject) => {
  const address = options.addresses[0];
  if (!address) {
    reject(new Error("No validated address available."));
    return;
  }
  const request = httpsGet(url, {
    lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
    signal: options.signal,
  }, (response) => {
    const chunks: Buffer[] = [];
    let sizeBytes = 0;
    response.on("data", (chunk: Buffer) => {
      sizeBytes += chunk.byteLength;
      if (sizeBytes > options.maxBytes) {
        request.destroy(new Error("Image response exceeded byte limit."));
        return;
      }
      chunks.push(chunk);
    });
    response.on("error", reject);
    response.on("end", () => resolve({
      status: response.statusCode ?? 0,
      headers: Object.fromEntries(Object.entries(response.headers).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])),
      bytes: new Uint8Array(Buffer.concat(chunks)),
    }));
  });
  request.setTimeout(options.timeoutMs, () => request.destroy(new Error("Image request timed out.")));
  request.on("error", reject);
});

function resolveTotalTimeoutMs(value: number | undefined): number {
  if (value === undefined) {
    return IMAGE_FETCH_LIMITS.timeoutMs;
  }
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError("Image source total timeout must be a positive integer.");
  }
  return Math.min(value, IMAGE_FETCH_LIMITS.timeoutMs);
}

async function withOverallTimeout<T>(
  timeoutMs: number,
  operation: (deadline: SourceDeadline) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const deadline: SourceDeadline = {
    signal: controller.signal,
    expiresAt: Date.now() + timeoutMs,
  };
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      controller.abort();
      reject(new SourceError("fetch-failed", "Image source request exceeded the total timeout."));
    }, timeoutMs);
    operation(deadline).then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

interface SourceDeadline {
  signal: AbortSignal;
  expiresAt: number;
}

function remainingTimeoutMs(deadline: SourceDeadline): number {
  const remaining = deadline.expiresAt - Date.now();
  if (deadline.signal.aborted || remaining <= 0) {
    fail("fetch-failed", "Image source request exceeded the total timeout.");
  }
  return remaining;
}

async function loadRemoteSource(
  locator: string,
  options: Required<Pick<ImageEmbeddingSourceOptions, "remoteRequest" | "dnsLookup">>,
  deadline: SourceDeadline,
): Promise<{ bytes: Uint8Array; info: ImageInfo; sourceHost: string }> {
  let url = validateRemoteUrl(locator);
  for (let redirects = 0; redirects <= IMAGE_FETCH_LIMITS.maxRedirects; redirects += 1) {
    const timeoutMs = remainingTimeoutMs(deadline);
    const addresses = await options.dnsLookup(url.hostname);
    if (addresses.length === 0 || addresses.some((entry) => !isPublicAddress(entry.address, entry.family))) {
      fail("invalid-source", "Artwork image host did not resolve to public unicast addresses.");
    }
    const response = await options.remoteRequest(url, {
      timeoutMs,
      maxBytes: IMAGE_FETCH_LIMITS.maxBytes,
      addresses,
      signal: deadline.signal,
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.location;
      if (!location || redirects === IMAGE_FETCH_LIMITS.maxRedirects) {
        fail("fetch-failed", "Artwork image redirect could not be completed.");
      }
      url = validateRemoteUrl(new URL(location, url).toString());
      continue;
    }
    if (response.status < 200 || response.status >= 300 || response.bytes.byteLength > IMAGE_FETCH_LIMITS.maxBytes) {
      fail("fetch-failed", "Artwork image response was unsuccessful or exceeded limits.");
    }
    const contentType = mediaTypeFromHeader(response.headers["content-type"]);
    const info = await decodeImageInfo(response.bytes);
    if (info.mediaType !== contentType) {
      fail("fetch-failed", "Image response type does not match image magic bytes.");
    }
    return { bytes: response.bytes, info, sourceHost: url.hostname.toLowerCase() };
  }
  return fail("fetch-failed", "Artwork image redirect limit exceeded.");
}

async function loadLocalSource(locator: string, rootDir: string, publicRoot?: string): Promise<{ bytes: Uint8Array; info: ImageInfo }> {
  const normalizedPath = normalizePublicPath(locator);
  const resolvedPublicRoot = realpathSync(publicRoot ? path.resolve(publicRoot) : path.join(rootDir, "public"));
  const candidatePath = path.resolve(resolvedPublicRoot, `.${normalizedPath}`);
  if (!isInside(resolvedPublicRoot, candidatePath)) {
    fail("invalid-source", "Background scene public path escapes the public root.");
  }
  let resolvedPath: string;
  try {
    resolvedPath = realpathSync(candidatePath);
  } catch {
    fail("missing-source", "Background scene image is not available under the public root.");
  }
  if (!isInside(resolvedPublicRoot, resolvedPath)) {
    fail("invalid-source", "Background scene image resolves outside the public root.");
  }
  if (statSync(resolvedPath).size > IMAGE_FETCH_LIMITS.maxBytes) {
    fail("fetch-failed", "Background scene image exceeds the byte limit.");
  }
  const bytes = new Uint8Array(readFileSync(resolvedPath));
  if (bytes.byteLength > IMAGE_FETCH_LIMITS.maxBytes) {
    fail("fetch-failed", "Background scene image exceeds the byte limit.");
  }
  return { bytes, info: await decodeImageInfo(bytes) };
}

export async function resolveImageEmbeddingSource(
  input: ImageEmbeddingSourceInput,
  options: ImageEmbeddingSourceOptions,
): Promise<ResolveImageEmbeddingSourceResult> {
  try {
    const sources = locateSources(input);
    const totalTimeoutMs = resolveTotalTimeoutMs(options.totalTimeoutMs);
    return await withOverallTimeout(totalTimeoutMs, async (deadline) => {
      let finalFailure: SourceError | undefined;
      for (const located of sources) {
        try {
          remainingTimeoutMs(deadline);
          const safeLocator = located.remote ? located.locator : normalizePublicPath(located.locator);
          const sourceLocatorFingerprint = fingerprintImageSourceLocator(safeLocator);
          const cacheKey: ImageSourceCacheKey = {
            entityType: input.entityType,
            entityId: input.entityId,
            fieldPath: located.fieldPath,
            sourceLocatorFingerprint,
          };
          const cached = options.refreshSourceCache
            ? undefined
            : options.cache?.read(cacheKey, { maxBytes: IMAGE_FETCH_LIMITS.maxBytes });
          if (cached) {
            try {
              const info = await decodeImageInfo(cached.bytes);
              if (info.mediaType !== cached.mediaType || info.width !== cached.width || info.height !== cached.height) {
                fail("decode-failed", "Cached image metadata does not match decoded image bytes.");
              }
              return {
                status: "ready",
                source: {
                  entityType: input.entityType,
                  entityId: input.entityId,
                  fieldPath: located.fieldPath,
                  bytes: cached.bytes,
                  mediaType: info.mediaType,
                  width: info.width,
                  height: info.height,
                  fingerprint: cached.fingerprint,
                  sourceLocatorFingerprint,
                  sourceHost: cached.sourceHost,
                },
              };
            } catch (error) {
              if (!(error instanceof SourceError) || options.offline) {
                throw error;
              }
            }
          }
          if (options.offline) {
            fail("offline-cache-miss", "No matching source bytes are present in the local cache.");
          }

          const loaded = located.remote
            ? await loadRemoteSource(safeLocator, {
              remoteRequest: options.remoteRequest ?? defaultRemoteRequest,
              dnsLookup: options.dnsLookup ?? defaultDnsLookup,
            }, deadline)
            : await loadLocalSource(safeLocator, options.rootDir, options.publicRoot);
          const sourceHost = "sourceHost" in loaded && typeof loaded.sourceHost === "string"
            ? loaded.sourceHost
            : undefined;
          const source = {
            entityType: input.entityType,
            entityId: input.entityId,
            fieldPath: located.fieldPath,
            bytes: loaded.bytes,
            mediaType: loaded.info.mediaType,
            width: loaded.info.width,
            height: loaded.info.height,
            fingerprint: fingerprintImageSourceBytes(loaded.bytes),
            sourceLocatorFingerprint,
            sourceHost,
          } satisfies ResolvedImageEmbeddingSource;
          options.cache?.write(cacheKey, source);

          return { status: "ready", source };
        } catch (error) {
          if (!(error instanceof SourceError)) {
            throw error;
          }
          finalFailure = error;
        }
      }
      throw finalFailure ?? new SourceError("missing-source", "Image source could not be located.");
    });
  } catch (error) {
    if (error instanceof SourceError) {
      return { status: "failed", failure: { reason: error.reason, message: error.message } };
    }
    return { status: "failed", failure: { reason: "fetch-failed", message: "Image source could not be loaded." } };
  }
}
