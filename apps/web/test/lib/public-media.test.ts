import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createPublicMediaManifest, mediaSha256, publicMediaId, PUBLIC_MEDIA_PREFIX } from "../../lib/public-media-manifest";
import { publicMediaOrigin, publicMediaUrl, readPublicMediaConfiguration, verifyPublicMediaCoverage } from "../../lib/public-media";
import { loadWebReleaseCatalog } from "../../lib/release-catalog";

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "artduo-cdn-")), release = path.join(root, "data/releases/release-1");
  mkdirSync(release, { recursive: true });
  writeFileSync(path.join(release, "manifest.json"), "release");
  const asset = { id: publicMediaId("preview", "met-1"), kind: "preview" as const, sha256: mediaSha256("pixels"),
    objectKey: `${PUBLIC_MEDIA_PREFIX}${mediaSha256("pixels").slice(7)}/preview.webp`, bytes: 6, width: 10, height: 10,
    sourceFingerprint: mediaSha256("source"), recipe: "fixture", contentType: "image/webp" as const };
  const manifest = createPublicMediaManifest({ releaseVersion: "release-1", sourceManifestSha256: mediaSha256("release"), assets: [asset] });
  const file = path.join(release, "public-media-manifest.json");
  writeFileSync(file, JSON.stringify(manifest));
  const options = { rootDir: root, environment: { ARTDUO_MEDIA_MODE: "cdn", ARTDUO_MEDIA_ORIGIN: "https://assets.aitoshuu.me", ARTDUO_MEDIA_MANIFEST: file } };
  return { root, release, file, asset, manifest, options };
}

test("CDN resolution preserves releases, missing historical coverage and local rollback", () => {
  const f = fixture();
  try {
    const local = "/artduo-artwork/met-1?previewVersion=1&releaseVersion=release-1";
    assert.equal(publicMediaUrl(f.asset.id, local, "release-1", f.options), `https://assets.aitoshuu.me/${f.asset.objectKey}`);
    assert.equal(publicMediaUrl(f.asset.id, local, "older-release", f.options), local);
    assert.equal(publicMediaUrl(f.asset.id, local, "release-1", { ...f.options, environment: { ARTDUO_MEDIA_MODE: "local" } }), local);
    assert.throws(() => publicMediaUrl(publicMediaId("depth", "met-1"), local, "release-1", f.options), /missing/u);
    assert.equal(readPublicMediaConfiguration({ environment: {} }), undefined);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("invalid delivery configuration fails closed and file changes invalidate the cache", () => {
  const f = fixture();
  try {
    for (const origin of ["http://assets.aitoshuu.me", "https://assets.aitoshuu.me/path", "https://x@y.test", "https://a.test?token=bad"]) assert.throws(() => publicMediaOrigin(origin));
    readPublicMediaConfiguration(f.options);
    writeFileSync(path.join(f.release, "manifest.json"), "changed-release");
    assert.throws(() => readPublicMediaConfiguration(f.options), /release mismatch/u);
    writeFileSync(path.join(f.release, "manifest.json"), "release");
    writeFileSync(f.file, JSON.stringify({ ...f.manifest, manifestSha256: mediaSha256("corrupt") }));
    assert.throws(() => readPublicMediaConfiguration(f.options), /integrity/u);
    assert.throws(() => readPublicMediaConfiguration({ environment: { ARTDUO_MEDIA_MODE: "unknown" } }), /mode/u);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("activation requires the complete current release, rooms, audio and source bindings", () => {
  const root = path.resolve(__dirname, "../../../.."), catalog = loadWebReleaseCatalog({ rootDir: root, releaseVersion: "2026-10-24-da3-curated-630" });
  const manifest = JSON.parse(readFileSync(path.join(catalog.releaseDir, "public-media-manifest.json"), "utf8"));
  const temporary = mkdtempSync(path.join(os.tmpdir(), "artduo-cdn-coverage-"));
  const release = path.join(temporary, "data/releases", catalog.releaseVersion), file = path.join(release, "public-media-manifest.json");
  mkdirSync(release, { recursive: true });
  writeFileSync(path.join(release, "manifest.json"), readFileSync(catalog.manifestPath));
  const options = { rootDir: temporary, environment: { ARTDUO_MEDIA_MODE: "cdn", ARTDUO_MEDIA_ORIGIN: "https://assets.aitoshuu.me", ARTDUO_MEDIA_MANIFEST: file } };
  const save = (assets = manifest.assets) => writeFileSync(file, JSON.stringify(createPublicMediaManifest({ ...manifest, assets })));
  try {
    save();
    assert.deepEqual(verifyPublicMediaCoverage(catalog, options), { mode: "cdn", assets: 1337, bytes: 301551722 });
    assert.throws(() => verifyPublicMediaCoverage({ ...catalog, releaseVersion: "another-release" }, options), /release mismatch/u);
    for (const kind of ["preview", "depth", "background", "room", "audio"]) {
      const removed = manifest.assets.findIndex((asset: { kind: string }) => asset.kind === kind);
      save(manifest.assets.filter((_asset: unknown, index: number) => index !== removed));
      assert.throws(() => verifyPublicMediaCoverage(catalog, options), /binding mismatch|complete public release/u);
    }
    const altered = structuredClone(manifest.assets);
    altered.find((asset: { kind: string }) => asset.kind === "preview").sourceFingerprint = mediaSha256("different original");
    save(altered);
    assert.throws(() => verifyPublicMediaCoverage(catalog, options), /source binding mismatch/u);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});
