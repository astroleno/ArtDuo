import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createPublicMediaManifest, mediaSha256, PUBLIC_MEDIA_PREFIX } from "../../lib/public-media-manifest";
import { uploadPublicMediaObject, verifyPublicMediaAssets, type PublicMediaVerification } from "../../lib/public-media-publish";

const body = new TextEncoder().encode("pixels");
const asset = { id: "artwork:met-1:preview", kind: "preview" as const, sha256: mediaSha256(body), bytes: body.length,
  objectKey: `${PUBLIC_MEDIA_PREFIX}${mediaSha256(body).slice(7)}/preview.webp`, width: 10, height: 10,
  sourceFingerprint: mediaSha256("source"), recipe: "fixture", contentType: "image/webp" as const };
const manifest = createPublicMediaManifest({ releaseVersion: "release-1", sourceManifestSha256: mediaSha256("release"), assets: [asset] });
const origin = "https://assets.aitoshuu.me";
function response(bytes: Uint8Array = body, headers: Record<string, string> = {}) {
  return new Response(new Uint8Array(bytes), { headers: { "content-type": asset.contentType, "content-length": String(body.length),
    "access-control-allow-origin": "*", "cache-control": "public, immutable, max-age=31536000", ...headers } });
}

test("publication verifies exact pixels and resumes without requesting completed objects", async () => {
  let requests = 0;
  const verified = await verifyPublicMediaAssets(manifest, origin, { fetch: async (url, options) => {
    requests++; assert.equal(url, `${origin}/${asset.objectKey}`); assert.equal(options?.redirect, "error");
    return response();
  } });
  assert.equal(verified.transferredBytes, body.length); assert.equal(verified.verified.length, 1);
  assert.deepEqual(await verifyPublicMediaAssets(manifest, origin, { previous: verified, fetch: async () => { throw new Error("Unexpected request"); } }), verified);
  assert.equal(requests, 1);
  await assert.rejects(verifyPublicMediaAssets(manifest, origin, { previous: { ...verified, transferredBytes: 0 } }), /byte total/u);
  await assert.rejects(verifyPublicMediaAssets(manifest, "https://other.test", { previous: verified }), /different publication/u);
});

test("budgets and failed requests remain bounded and persist their receipt", async () => {
  let requests = 0, saved: PublicMediaVerification | undefined;
  const fetch = async () => { requests++; throw new Error("connection lost"); };
  await assert.rejects(verifyPublicMediaAssets(manifest, origin, { maximumBytes: body.length - 1, fetch }), /budget reached/u);
  assert.equal(requests, 0);
  await assert.rejects(verifyPublicMediaAssets(manifest, origin, { fetch, progress: async value => { saved = structuredClone(value); } }), /connection lost/u);
  assert.equal(saved?.requests, 1); assert.equal(saved?.verified.length, 0);
  await assert.rejects(verifyPublicMediaAssets(manifest, origin, { previous: saved, maximumRequests: 1, fetch }), /budget reached/u);
  assert.equal(requests, 1);
  for (const options of [{ maximumBytes: NaN }, { maximumRequests: 0 }, { bytesPerSecond: -1 }]) {
    await assert.rejects(verifyPublicMediaAssets(manifest, origin, { ...options, fetch }), /Invalid verification budget/u);
  }
});

test("wrong bytes, cache policy or cross-origin headers never produce an accepted object", async () => {
  for (const bad of [response(new TextEncoder().encode("pixelf")), response(body, { "cache-control": "private, no-store" }), response(body, { "access-control-allow-origin": "https://aitoshuu.me" })]) {
    let saved: PublicMediaVerification | undefined;
    await assert.rejects(verifyPublicMediaAssets(manifest, origin, { fetch: async () => bad, progress: async value => { saved = structuredClone(value); } }));
    assert.equal(saved?.verified.length, 0); assert.equal(saved?.requests, 1);
  }
});

test("COS upload accepts only an explicit object grant and verifies the local source first", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "artduo-upload-")), file = path.join(root, "preview.webp");
  try {
    await writeFile(file, body);
    const grant = `https://tongye-1327162705.cos.ap-shanghai.myqcloud.com/${asset.objectKey}?q-signature=fixture`;
    let called = false;
    await uploadPublicMediaObject(asset, file, grant, async (_url, options) => {
      called = true; assert.equal(options?.method, "PUT"); assert.equal(options?.redirect, "error");
      const headers = new Headers(options?.headers);
      assert.equal(headers.get("x-cos-acl"), "private"); assert.equal(headers.get("x-cos-forbid-overwrite"), "true");
      assert.equal(headers.get("cache-control"), "public, max-age=31536000, immutable");
      return new Response(null, { status: 200 });
    });
    assert.ok(called);
    await assert.rejects(uploadPublicMediaObject(asset, file, grant.replace(".cos.ap-shanghai.myqcloud.com", ".example.test")), /scoped/u);
    await assert.rejects(uploadPublicMediaObject(asset, file, grant.replace("/preview.webp", "/other.webp")), /scoped/u);
    await writeFile(file, "wrong pixels");
    await assert.rejects(uploadPublicMediaObject(asset, file, grant), /integrity/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});
