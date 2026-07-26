import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { ImageSourceCache, fingerprintImageSourceBytes, fingerprintImageSourceLocator } from "./image-source-cache";
import {
  resolveImageEmbeddingSource,
  type RemoteImageRequest,
} from "./image-embedding-sources";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL8JwAAAABJRU5ErkJggg==",
  "base64",
);

function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  bytes.set([73, 72, 68, 82], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function tempRoot(): string {
  return mkdtempSync(path.join(os.tmpdir(), "artduo-image-source-"));
}

function remoteResponse(bytes = PNG): RemoteImageRequest {
  return async () => ({ status: 200, headers: { "content-type": "image/png" }, bytes });
}

async function publicDnsLookup() {
  return [{ address: "8.8.8.8", family: 4 }];
}

test("artwork sources use preview before base/full URLs and background sources map through public root", async () => {
  const remote = await resolveImageEmbeddingSource({
    entityType: "artwork",
    entityId: "met-1",
    media: {
      imageUrlPreview: "https://images.metmuseum.org/preview.png",
      baseImageUrl: "https://images.metmuseum.org/base.png",
      imageUrlFull: "https://images.metmuseum.org/full.png",
    },
  }, { rootDir: tempRoot(), remoteRequest: remoteResponse(), dnsLookup: publicDnsLookup });

  assert.equal(remote.status, "ready");
  assert.equal(remote.status === "ready" && remote.source.fieldPath, "media.imageUrlPreview");

  const rootDir = tempRoot();
  const publicDir = path.join(rootDir, "public", "artduo-gallery");
  mkdirSync(publicDir, { recursive: true });
  writeFileSync(path.join(publicDir, "scene.png"), PNG);
  const local = await resolveImageEmbeddingSource({
    entityType: "background-scene",
    entityId: "bg-1",
    asset: { local_public_path: "/artduo-gallery/scene.png" },
  }, { rootDir });

  assert.equal(local.status, "ready");
  assert.equal(local.status === "ready" && local.source.width, 1);
});

test("artwork sources fall back from a failed preview URL to the next safe release URL", async () => {
  const requestedPaths: string[] = [];
  const result = await resolveImageEmbeddingSource({
    entityType: "artwork",
    entityId: "met-1",
    media: {
      imageUrlPreview: "https://images.metmuseum.org/preview.png",
      baseImageUrl: "https://images.metmuseum.org/base.png",
      imageUrlFull: "https://images.metmuseum.org/full.png",
    },
  }, {
    rootDir: tempRoot(),
    dnsLookup: publicDnsLookup,
    remoteRequest: async (url) => {
      requestedPaths.push(url.pathname);
      if (url.pathname === "/preview.png") {
        return { status: 503, headers: {}, bytes: new Uint8Array() };
      }
      return { status: 200, headers: { "content-type": "image/png" }, bytes: PNG };
    },
  });

  assert.equal(result.status, "ready");
  assert.equal(result.status === "ready" && result.source.fieldPath, "media.baseImageUrl");
  assert.deepEqual(requestedPaths, ["/preview.png", "/base.png"]);
});

test("source resolver rejects traversal, symlink escape, non-HTTPS, and invalid image responses", async () => {
  const rootDir = tempRoot();
  const publicDir = path.join(rootDir, "public", "artduo-gallery");
  mkdirSync(publicDir, { recursive: true });
  const outside = path.join(rootDir, "outside.png");
  writeFileSync(outside, PNG);
  symlinkSync(outside, path.join(publicDir, "escape.png"));

  for (const localPublicPath of ["/artduo-gallery/../outside.png", "/artduo-gallery/%2e%2e/outside.png", "/artduo-gallery\\outside.png", "/artduo-gallery/escape.png"]) {
    const result = await resolveImageEmbeddingSource({
      entityType: "background-scene",
      entityId: "bg-1",
      asset: { local_public_path: localPublicPath },
    }, { rootDir });
    assert.equal(result.status, "failed");
    assert.equal(result.status === "failed" && result.failure.reason, "invalid-source");
  }

  const insecure = await resolveImageEmbeddingSource({
    entityType: "artwork",
    entityId: "met-1",
    media: { imageUrlPreview: "http://images.metmuseum.org/preview.png" },
  }, { rootDir, remoteRequest: remoteResponse(), dnsLookup: publicDnsLookup });
  assert.equal(insecure.status, "failed");

  const decodeFailed = await resolveImageEmbeddingSource({
    entityType: "artwork",
    entityId: "met-1",
    media: { imageUrlPreview: "https://images.metmuseum.org/preview.png" },
  }, { rootDir, remoteRequest: remoteResponse(new Uint8Array([1, 2, 3])), dnsLookup: publicDnsLookup });
  assert.equal(decodeFailed.status, "failed");
  assert.equal(decodeFailed.status === "failed" && decodeFailed.failure.reason, "decode-failed");

  const truncatedPng = await resolveImageEmbeddingSource({
    entityType: "artwork",
    entityId: "met-1",
    media: { imageUrlPreview: "https://images.metmuseum.org/truncated.png" },
  }, { rootDir, remoteRequest: remoteResponse(PNG.subarray(0, 24)), dnsLookup: publicDnsLookup });
  assert.equal(truncatedPng.status, "failed");
  assert.equal(truncatedPng.status === "failed" && truncatedPng.failure.reason, "decode-failed");
});

test("source resolver rejects unsafe DNS, redirect targets, byte overages, and content-type spoofing", async () => {
  const rootDir = tempRoot();
  const input = {
    entityType: "artwork" as const,
    entityId: "met-1",
    media: { imageUrlPreview: "https://images.metmuseum.org/preview.png" },
  };

  const privateDns = await resolveImageEmbeddingSource(input, {
    rootDir,
    remoteRequest: remoteResponse(),
    dnsLookup: async () => [{ address: "127.0.0.1", family: 4 }],
  });
  assert.equal(privateDns.status, "failed");
  assert.equal(privateDns.status === "failed" && privateDns.failure.reason, "invalid-source");

  const redirect = await resolveImageEmbeddingSource(input, {
    rootDir,
    dnsLookup: publicDnsLookup,
    remoteRequest: async () => ({
      status: 302,
      headers: { location: "https://localhost/escape.png" },
      bytes: new Uint8Array(),
    }),
  });
  assert.equal(redirect.status, "failed");
  assert.equal(redirect.status === "failed" && redirect.failure.reason, "invalid-source");

  const oversized = await resolveImageEmbeddingSource(input, {
    rootDir,
    dnsLookup: publicDnsLookup,
    remoteRequest: async (_url, options) => ({
      status: 200,
      headers: { "content-type": "image/png" },
      bytes: new Uint8Array(options.maxBytes + 1),
    }),
  });
  assert.equal(oversized.status, "failed");
  assert.equal(oversized.status === "failed" && oversized.failure.reason, "fetch-failed");

  const spoofedContentType = await resolveImageEmbeddingSource(input, {
    rootDir,
    dnsLookup: publicDnsLookup,
    remoteRequest: async () => ({
      status: 200,
      headers: { "content-type": "image/jpeg" },
      bytes: PNG,
    }),
  });
  assert.equal(spoofedContentType.status, "failed");
  assert.equal(spoofedContentType.status === "failed" && spoofedContentType.failure.reason, "fetch-failed");
});

test("source resolver rejects IPv6 loopback, private, site-local, mapped, and IANA-reserved address forms", async () => {
  const rootDir = tempRoot();
  const input = {
    entityType: "artwork" as const,
    entityId: "met-ipv6",
    media: { imageUrlPreview: "https://images.metmuseum.org/preview.png" },
  };

  for (const address of [
    "fec0::1",
    "0:0:0:0:0:0:0:1",
    "::127.0.0.1",
    "::ffff:8.8.8.8",
    "2001:db8::1",
    "2001:0::1",
    "64:ff9b::8.8.8.8",
  ]) {
    const result = await resolveImageEmbeddingSource(input, {
      rootDir,
      remoteRequest: remoteResponse(),
      dnsLookup: async () => [{ address, family: 6 }],
    });
    assert.equal(result.status, "failed", address);
    assert.equal(result.status === "failed" && result.failure.reason, "invalid-source", address);
  }

  const publicIpv6 = await resolveImageEmbeddingSource(input, {
    rootDir,
    remoteRequest: remoteResponse(),
    dnsLookup: async () => [{ address: "2001:4860:4860::8888", family: 6 }],
  });
  assert.equal(publicIpv6.status, "ready");
});

test("source resolver applies the total timeout to DNS and aborts an in-flight remote request", async () => {
  const rootDir = tempRoot();
  const input = {
    entityType: "artwork" as const,
    entityId: "met-1",
    media: { imageUrlPreview: "https://images.metmuseum.org/preview.png" },
  };

  const dnsTimeout = await resolveImageEmbeddingSource(input, {
    rootDir,
    totalTimeoutMs: 5,
    dnsLookup: async () => new Promise(() => undefined),
    remoteRequest: remoteResponse(),
  });
  assert.equal(dnsTimeout.status, "failed");
  assert.equal(dnsTimeout.status === "failed" && dnsTimeout.failure.reason, "fetch-failed");

  let aborted = false;
  const requestTimeout = await resolveImageEmbeddingSource(input, {
    rootDir,
    totalTimeoutMs: 5,
    dnsLookup: publicDnsLookup,
    remoteRequest: async (_url, options) => new Promise((_, reject) => {
      options.signal.addEventListener("abort", () => {
        aborted = true;
        reject(new Error("aborted"));
      }, { once: true });
    }),
  });
  assert.equal(requestTimeout.status, "failed");
  assert.equal(requestTimeout.status === "failed" && requestTimeout.failure.reason, "fetch-failed");
  assert.equal(aborted, true);
});

test("artwork fallback candidates share one total timeout budget", async () => {
  const rootDir = tempRoot();
  let attempts = 0;
  const result = await resolveImageEmbeddingSource({
    entityType: "artwork",
    entityId: "met-timeout",
    media: {
      imageUrlPreview: "https://images.metmuseum.org/preview.png",
      baseImageUrl: "https://images.metmuseum.org/base.png",
      imageUrlFull: "https://images.metmuseum.org/full.png",
    },
  }, {
    rootDir,
    totalTimeoutMs: 10,
    dnsLookup: publicDnsLookup,
    remoteRequest: async (_url, options) => new Promise((_, reject) => {
      attempts += 1;
      options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }),
  });

  assert.equal(result.status, "failed");
  assert.equal(result.status === "failed" && result.failure.reason, "fetch-failed");
  assert.equal(attempts, 1);
});

test("source resolver rejects cache hits whose bytes or metadata do not survive full decode", async () => {
  const rootDir = tempRoot();
  const cacheDir = path.join(rootDir, ".cache", "artduo", "image-sources");
  const cache = new ImageSourceCache(cacheDir);
  const input = {
    entityType: "artwork" as const,
    entityId: "met-cache",
    media: { imageUrlPreview: "https://images.metmuseum.org/preview.png" },
  };
  const key = {
    entityType: input.entityType,
    entityId: input.entityId,
    fieldPath: "media.imageUrlPreview",
    sourceLocatorFingerprint: fingerprintImageSourceLocator(input.media.imageUrlPreview),
  };
  cache.write(key, {
    bytes: PNG.subarray(0, 24),
    mediaType: "image/png",
    width: 1,
    height: 1,
    sourceHost: "images.metmuseum.org",
  });

  const truncated = await resolveImageEmbeddingSource(input, { rootDir, cache, offline: true });
  assert.equal(truncated.status, "failed");
  assert.equal(truncated.status === "failed" && truncated.failure.reason, "decode-failed");

  cache.write(key, {
    bytes: PNG,
    mediaType: "image/png",
    width: 1,
    height: 1,
    sourceHost: "images.metmuseum.org",
  });
  const metadataPath = path.join(cacheDir, readdirSync(cacheDir).find((entry) => entry.endsWith(".json"))!);
  const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as Record<string, unknown>;
  metadata.width = 2;
  metadata.fingerprint = fingerprintImageSourceBytes(PNG);
  writeFileSync(metadataPath, `${JSON.stringify(metadata)}\n`);

  const mismatchedMetadata = await resolveImageEmbeddingSource(input, { rootDir, cache, offline: true });
  assert.equal(mismatchedMetadata.status, "failed");
  assert.equal(mismatchedMetadata.status === "failed" && mismatchedMetadata.failure.reason, "decode-failed");
});

test("source resolver checks local byte size before reading the whole file", async () => {
  const rootDir = tempRoot();
  const publicDir = path.join(rootDir, "public", "artduo-gallery");
  mkdirSync(publicDir, { recursive: true });
  const imagePath = path.join(publicDir, "too-large.png");
  writeFileSync(imagePath, PNG.subarray(0, 1));
  truncateSync(imagePath, 12 * 1024 * 1024 + 1);

  const result = await resolveImageEmbeddingSource({
    entityType: "background-scene",
    entityId: "large-local",
    asset: { local_public_path: "/artduo-gallery/too-large.png" },
  }, { rootDir });
  assert.equal(result.status, "failed");
  assert.equal(result.status === "failed" && result.failure.reason, "fetch-failed");
});

test("source resolver rejects oversized pixel dimensions before full image decode", async () => {
  const result = await resolveImageEmbeddingSource({
    entityType: "artwork",
    entityId: "pixel-bomb",
    media: { imageUrlPreview: "https://images.metmuseum.org/pixel-bomb.png" },
  }, {
    rootDir: tempRoot(),
    dnsLookup: publicDnsLookup,
    remoteRequest: remoteResponse(pngHeader(12_000, 4_001)),
  });

  assert.equal(result.status, "failed");
  assert.equal(result.status === "failed" && result.failure.reason, "decode-failed");
});

test("source resolver serves a cache hit without network and refreshes only when requested", async () => {
  const rootDir = tempRoot();
  const cache = new ImageSourceCache(path.join(rootDir, ".cache", "artduo", "image-sources"));
  let requestCount = 0;
  const remoteRequest: RemoteImageRequest = async () => {
    requestCount += 1;
    return { status: 200, headers: { "content-type": "image/png" }, bytes: PNG };
  };
  const input = {
    entityType: "artwork" as const,
    entityId: "met-1",
    media: { imageUrlPreview: "https://images.metmuseum.org/preview.png?token=secret" },
  };

  assert.equal((await resolveImageEmbeddingSource(input, { rootDir, cache, remoteRequest, dnsLookup: publicDnsLookup })).status, "ready");
  assert.equal((await resolveImageEmbeddingSource(input, { rootDir, cache, remoteRequest, dnsLookup: publicDnsLookup })).status, "ready");
  assert.equal(requestCount, 1);
  assert.equal((await resolveImageEmbeddingSource(input, { rootDir, cache, remoteRequest, dnsLookup: publicDnsLookup, refreshSourceCache: true })).status, "ready");
  assert.equal(requestCount, 2);
});
