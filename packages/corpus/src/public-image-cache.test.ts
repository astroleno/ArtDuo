import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertPublicImageUrl, cachePublicImage, fetchPublicImage, publicImageDigest, readCachedPublicImage } from "./public-image-cache";
import type { VerifiedRemoteImage } from "@artduo/contracts";

const url = "https://media.getty.edu/iiif/image/verified/full/max/0/default.jpg";
const reply = (response: Response) => (async () => response) as typeof fetch;

test("public image URLs reject credentials, private hosts, HTTP and unapproved redirects before requesting them", async () => {
  for (const value of ["http://media.getty.edu/image.jpg", "https://127.0.0.1/image.jpg", "https://media.getty.edu.evil.test/image.jpg", "https://user:secret@media.getty.edu/image.jpg", "https://media.getty.edu:8443/image.jpg"]) {
    assert.throws(() => assertPublicImageUrl(value));
  }
  let requests = 0;
  const fetchImpl = (async () => { requests++; return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } }); }) as typeof fetch;
  await assert.rejects(fetchPublicImage(url, { fetchImpl }), /unapproved-public-image-url/);
  assert.equal(requests, 1);
});

test("a complete image body is bounded and HTML, SVG, partial status and truncated bodies cannot masquerade as success", async () => {
  const valid = await fetchPublicImage(url, { fetchImpl: reply(new Response("abc", { headers: { "content-type": "image/jpeg", "content-length": "3" } })) });
  assert.equal(valid.body.toString(), "abc");
  for (const response of [
    new Response("<html>error</html>", { headers: { "content-type": "text/html" } }),
    new Response("<svg/>", { headers: { "content-type": "image/svg+xml" } }),
    new Response("part", { status: 206, headers: { "content-type": "image/jpeg" } }),
    new Response("abc", { headers: { "content-type": "image/jpeg", "content-length": "5" } }),
    new Response("x", { headers: { "content-type": "image/jpeg", "content-length": "30000001" } }),
  ]) await assert.rejects(fetchPublicImage(url, { fetchImpl: reply(response) }));
});

test("the timeout remains active after headers and aborts a body that never completes", async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { "content-type": "image/jpeg" } });
  const began = Date.now();
  await assert.rejects(fetchPublicImage(url, { timeoutMs: 15, fetchImpl: reply(response) }), /image-transfer-timeout/);
  assert.ok(cancelled); assert.ok(Date.now() - began < 500);
});

test("access denial stops the source host without a second request or another URL", async () => {
  const stoppedHosts = new Set<string>(); let count = 0;
  const fetchImpl = (async () => { count++; return new Response("denied", { status: 403 }); }) as typeof fetch;
  await assert.rejects(fetchPublicImage(url, { fetchImpl, stoppedHosts }), /source-access-stopped/);
  await assert.rejects(fetchPublicImage(url + "?another", { fetchImpl, stoppedHosts }), /source-host-stopped/);
  assert.equal(count, 1);
});

test("content-addressed image cache requires the exact accepted body and detects replacement", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "artduo-public-cache-"));
  const body = Buffer.from("an image already decoded at intake");
  const ref: VerifiedRemoteImage = { url, sha256: publicImageDigest(body), width: 1600, height: 1200,
    byteLength: body.length, contentType: "image/jpeg", verifiedAt: "2026-10-21T00:00:00Z" };
  try {
    assert.equal(readCachedPublicImage(root, ref), undefined);
    const filename = cachePublicImage(root, ref, body);
    assert.deepEqual(readCachedPublicImage(root, ref), body);
    assert.throws(() => cachePublicImage(root, ref, Buffer.from("wrong")), /fingerprint-mismatch/);
    writeFileSync(filename, Buffer.alloc(body.length));
    assert.throws(() => readCachedPublicImage(root, ref), /fingerprint-mismatch/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a preserved verified original restores an evicted cache without masking corrupted bytes", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "artduo-preserved-image-"));
  const body = Buffer.from("a previously verified complete original");
  const ref: VerifiedRemoteImage = { url, sha256: publicImageDigest(body), width: 1600, height: 1200,
    byteLength: body.length, contentType: "image/jpeg", verifiedAt: "2026-10-21T00:00:00Z" };
  const directory = path.join(root, "data/sources/public-url/preserved-images");
  mkdirSync(directory, { recursive: true });
  const preserved = path.join(directory, `${ref.sha256.slice(7)}.bin`);
  try {
    writeFileSync(preserved, body);
    assert.deepEqual(readCachedPublicImage(root, ref), body);
    const cached = cachePublicImage(root, ref, body); assert.ok(existsSync(cached));
    writeFileSync(cached, Buffer.alloc(body.length));
    assert.throws(() => readCachedPublicImage(root, ref), /fingerprint-mismatch/);
    rmSync(cached); writeFileSync(preserved, Buffer.alloc(body.length));
    assert.throws(() => readCachedPublicImage(root, ref), /fingerprint-mismatch/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
