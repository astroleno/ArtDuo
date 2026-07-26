import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, truncateSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  ImageSourceCache,
  fingerprintImageSourceLocator,
} from "./image-source-cache";

const BYTES = new Uint8Array([137, 80, 78, 71]);

test("image source cache validates locator identity before returning cached bytes", () => {
  const cache = new ImageSourceCache(path.join(mkdtempSync(path.join(os.tmpdir(), "artduo-image-cache-")), "cache"));
  const locator = "https://images.metmuseum.org/CRDImages/ep/original/DP1.jpg?token=secret&size=large";
  const locatorFingerprint = fingerprintImageSourceLocator(locator);
  const key = {
    entityType: "artwork" as const,
    entityId: "met-1",
    fieldPath: "media.imageUrlPreview",
    sourceLocatorFingerprint: locatorFingerprint,
  };

  cache.write(key, {
    bytes: BYTES,
    mediaType: "image/png",
    width: 1,
    height: 1,
    sourceHost: "images.metmuseum.org",
  });

  assert.deepEqual(cache.read(key)?.bytes, BYTES);
  assert.equal(cache.read({ ...key, sourceLocatorFingerprint: `sha256:${"b".repeat(64)}` }), undefined);
});

test("source locator fingerprints redact auth query values while preserving resource selectors", () => {
  const first = fingerprintImageSourceLocator("https://images.metmuseum.org/CRDImages/ep/original/DP1.jpg?token=one&size=large");
  const second = fingerprintImageSourceLocator("https://images.metmuseum.org/CRDImages/ep/original/DP1.jpg?token=two&size=large");
  const differentResource = fingerprintImageSourceLocator("https://images.metmuseum.org/CRDImages/ep/original/DP1.jpg?token=two&size=small");

  assert.equal(first, second);
  assert.notEqual(first, differentResource);
});

test("image source cache checks on-disk size before reading source bytes", () => {
  const cacheRoot = path.join(mkdtempSync(path.join(os.tmpdir(), "artduo-image-cache-")), "cache");
  const cache = new ImageSourceCache(cacheRoot);
  const key = {
    entityType: "artwork" as const,
    entityId: "met-oversized-cache",
    fieldPath: "media.imageUrlPreview",
    sourceLocatorFingerprint: fingerprintImageSourceLocator("https://images.metmuseum.org/oversized.png"),
  };
  cache.write(key, {
    bytes: BYTES,
    mediaType: "image/png",
    width: 1,
    height: 1,
  });
  const bytesPath = path.join(cacheRoot, readdirSync(cacheRoot).find((entry) => entry.endsWith(".bin"))!);
  truncateSync(bytesPath, 12 * 1024 * 1024 + 1);

  assert.equal(cache.read(key, { maxBytes: 12 * 1024 * 1024 }), undefined);
});
