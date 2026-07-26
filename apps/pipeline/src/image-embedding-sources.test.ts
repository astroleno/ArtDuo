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
