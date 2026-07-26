import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ImageEmbeddingEntityType } from "@artduo/contracts";

export interface ImageSourceCacheKey {
  entityType: ImageEmbeddingEntityType;
  entityId: string;
  fieldPath: string;
  sourceLocatorFingerprint: string;
}

export interface CachedImageSource {
  fingerprint: string;
  sourceLocatorFingerprint: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  sizeBytes: number;
  width: number;
  height: number;
  fetchedAt: string;
  sourceHost?: string;
}

export interface CachedImageSourceValue extends CachedImageSource {
  bytes: Uint8Array;
}

const SENSITIVE_QUERY_KEYS = /(?:api[-_]?key|auth(?:orization)?|credential|key|signature|sig|token)/iu;
const SHA256_CHECKSUM = /^sha256:[a-f0-9]{64}$/iu;
export const IMAGE_SOURCE_CACHE_SCHEMA_VERSION = 2;

export interface ImageSourceCacheReadOptions {
  maxBytes?: number;
}

function sha256(value: Uint8Array | string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function assertSafePublicPath(value: string): string {
  const decoded = decodeURIComponent(value);
  if (!decoded.startsWith("/") || decoded.includes("\\") || decoded.split("/").includes("..")) {
    throw new TypeError("Image source locator must be a safe public URL path.");
  }

  return decoded;
}

export function normalizeImageSourceLocator(locator: string): string {
  if (locator.startsWith("/")) {
    return assertSafePublicPath(locator);
  }

  const url = new URL(locator);
  url.username = "";
  url.password = "";
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (SENSITIVE_QUERY_KEYS.test(key)) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  return url.toString();
}

export function fingerprintImageSourceLocator(locator: string): string {
  return sha256(normalizeImageSourceLocator(locator));
}

export function fingerprintImageSourceBytes(bytes: Uint8Array): string {
  return sha256(bytes);
}

function cacheEntryId(key: ImageSourceCacheKey): string {
  return sha256(JSON.stringify({ schemaVersion: IMAGE_SOURCE_CACHE_SCHEMA_VERSION, key })).slice("sha256:".length);
}

function isSafeCachedMetadata(value: unknown, key: ImageSourceCacheKey): value is CachedImageSource {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const metadata = value as Record<string, unknown>;
  return (
    typeof metadata.fingerprint === "string" && SHA256_CHECKSUM.test(metadata.fingerprint) &&
    metadata.sourceLocatorFingerprint === key.sourceLocatorFingerprint &&
    (metadata.mediaType === "image/jpeg" || metadata.mediaType === "image/png" || metadata.mediaType === "image/webp") &&
    typeof metadata.sizeBytes === "number" && Number.isInteger(metadata.sizeBytes) && metadata.sizeBytes >= 0 &&
    typeof metadata.width === "number" && Number.isInteger(metadata.width) && metadata.width > 0 &&
    typeof metadata.height === "number" && Number.isInteger(metadata.height) && metadata.height > 0 &&
    typeof metadata.fetchedAt === "string" &&
    (metadata.sourceHost === undefined || typeof metadata.sourceHost === "string")
  );
}

export class ImageSourceCache {
  constructor(private readonly rootDir: string) {}

  read(key: ImageSourceCacheKey, options: ImageSourceCacheReadOptions = {}): CachedImageSourceValue | undefined {
    try {
      const entryId = cacheEntryId(key);
      const bytesPath = path.join(this.rootDir, `${entryId}.bin`);
      const metadataPath = path.join(this.rootDir, `${entryId}.json`);
      if (!existsSync(bytesPath) || !existsSync(metadataPath)) {
        return undefined;
      }

      const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as unknown;
      if (!isSafeCachedMetadata(metadata, key)) {
        return undefined;
      }
      if (options.maxBytes !== undefined && metadata.sizeBytes > options.maxBytes) {
        return undefined;
      }
      const fileSize = statSync(bytesPath).size;
      if (fileSize !== metadata.sizeBytes || (options.maxBytes !== undefined && fileSize > options.maxBytes)) {
        return undefined;
      }
      const bytes = new Uint8Array(readFileSync(bytesPath));
      if (bytes.byteLength !== metadata.sizeBytes || fingerprintImageSourceBytes(bytes) !== metadata.fingerprint) {
        return undefined;
      }

      return { ...metadata, bytes };
    } catch {
      return undefined;
    }
  }

  write(
    key: ImageSourceCacheKey,
    value: Omit<CachedImageSourceValue, "fingerprint" | "sourceLocatorFingerprint" | "fetchedAt" | "sizeBytes">,
  ): CachedImageSource {
    const entryId = cacheEntryId(key);
    mkdirSync(this.rootDir, { recursive: true });
    const bytes = new Uint8Array(value.bytes);
    const metadata: CachedImageSource = {
      fingerprint: fingerprintImageSourceBytes(bytes),
      sourceLocatorFingerprint: key.sourceLocatorFingerprint,
      mediaType: value.mediaType,
      sizeBytes: bytes.byteLength,
      width: value.width,
      height: value.height,
      fetchedAt: new Date().toISOString(),
      sourceHost: value.sourceHost,
    };
    const suffix = `${process.pid}-${Date.now()}`;
    const bytesPath = path.join(this.rootDir, `${entryId}.bin`);
    const metadataPath = path.join(this.rootDir, `${entryId}.json`);
    const temporaryBytesPath = path.join(this.rootDir, `${entryId}.${suffix}.bin.tmp`);
    const temporaryMetadataPath = path.join(this.rootDir, `${entryId}.${suffix}.json.tmp`);

    writeFileSync(temporaryBytesPath, bytes);
    writeFileSync(temporaryMetadataPath, `${JSON.stringify(metadata)}\n`);
    renameSync(temporaryBytesPath, bytesPath);
    renameSync(temporaryMetadataPath, metadataPath);

    return metadata;
  }
}
