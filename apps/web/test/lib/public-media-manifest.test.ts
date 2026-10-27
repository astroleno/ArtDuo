import assert from "node:assert/strict";
import test from "node:test";
import { createPublicMediaManifest, mediaSha256, parsePublicMediaManifest, publicMediaId, staticMediaId, PUBLIC_MEDIA_PREFIX, type PublicMediaAsset } from "../../lib/public-media-manifest";

export const fixtureAsset = (): PublicMediaAsset => ({ id: publicMediaId("preview", "smk-KKS10933%2F11"), kind: "preview",
  sha256: mediaSha256("pixels"), objectKey: `${PUBLIC_MEDIA_PREFIX}${mediaSha256("pixels").slice(7)}/preview.webp`,
  bytes: 6, width: 1600, height: 1000, sourceFingerprint: mediaSha256("source"), recipe: "inside-1600-webp84-v1", contentType: "image/webp" });

test("public delivery preserves encoded museum identifiers and binds immutable bytes", () => {
  const manifest = createPublicMediaManifest({ releaseVersion: "release-1", sourceManifestSha256: mediaSha256("release"), assets: [fixtureAsset()] });
  assert.deepEqual(parsePublicMediaManifest(JSON.parse(JSON.stringify(manifest))), manifest);
  assert.match(manifest.assets[0]!.id, /smk-KKS10933%2F11/u);
  assert.throws(() => parsePublicMediaManifest({ ...manifest, query: "private wish" }), /identity/u);
  const damaged = structuredClone(manifest); damaged.assets[0]!.bytes++;
  assert.throws(() => parsePublicMediaManifest(damaged), /integrity/u);
});

test("publication rejects traversal, private objects, duplicate identities and mismatched hashes", () => {
  assert.throws(() => staticMediaId("/api/handwriting/jobs/private/assets/layer"));
  assert.throws(() => staticMediaId("/artduo-gallery/../private.png"));
  assert.throws(() => publicMediaId("depth", "../escape"));
  const asset = fixtureAsset(), make = (assets: PublicMediaAsset[]) => createPublicMediaManifest({ releaseVersion: "release-1", sourceManifestSha256: mediaSha256("release"), assets });
  assert.throws(() => make([asset, asset]), /asset/u);
  assert.throws(() => make([{ ...asset, objectKey: "private/handwriting/layer.png" }]), /key/u);
  assert.throws(() => make([{ ...asset, sourceFingerprint: "unverified" }]), /binding/u);
  assert.throws(() => make([{ ...asset, sha256: mediaSha256("other pixels") }]), /key/u);
  assert.throws(() => make([{ ...asset, width: 0 }]), /dimensions/u);
});

test("static publication permits the existing rooms and three opted-in tracks only", () => {
  assert.equal(staticMediaId("/ambient-audio/Felt%20Letter.mp3"), "static:/ambient-audio/Felt%20Letter.mp3");
  assert.equal(staticMediaId("/artduo-gallery/lighting/v2/bg-004-960.webp"), "static:/artduo-gallery/lighting/v2/bg-004-960.webp");
  assert.throws(() => staticMediaId("/ambient-audio/private.mp3"));
  assert.throws(() => staticMediaId("/artduo-gallery/report.json"));
});

test("sculpture publication permits GLBs and posters while rejecting raw scans, metadata and a mismatched MIME", () => {
  const hash = mediaSha256("glb"), asset: PublicMediaAsset = { id: staticMediaId("/artduo-sculptures/venus-milo-compact.glb"), kind: "sculpture",
    objectKey: `${PUBLIC_MEDIA_PREFIX}${hash.slice(7)}/venus-milo-compact.glb`, sha256: hash, bytes: 3, contentType: "model/gltf-binary" };
  const make = (row: PublicMediaAsset) => createPublicMediaManifest({ releaseVersion: "sculptures-1", sourceManifestSha256: mediaSha256("source"), assets: [row] });
  assert.equal(make(asset).assets[0]!.contentType, "model/gltf-binary");
  assert.throws(() => make({ ...asset, kind: "room" }));
  assert.throws(() => make({ ...asset, contentType: "audio/mpeg" }));
  assert.throws(() => staticMediaId("/artduo-sculptures/venus-milo.stl"));
  assert.throws(() => staticMediaId("/artduo-sculptures/sources.json"));
  assert.throws(() => staticMediaId("/artduo-sculptures/../private.png"));
});
