import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { ImageSourceCache } from "./image-source-cache";
import {
  resolveImageEmbeddingSource,
  type RemoteImageRequest,
} from "./image-embedding-sources";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL8JwAAAABJRU5ErkJggg==",
  "base64",
);

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
