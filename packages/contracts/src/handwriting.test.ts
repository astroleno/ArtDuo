import assert from "node:assert/strict";
import test from "node:test";
import { HANDWRITING_CARD_VERSION, keepsakeDraftIdentity, keepsakeWritingText, parseKeepsakeDraft } from "./handwriting";

const draft = { exhibitionId: "ex-one", artworkId: "smk-KMS1", releaseVersion: "2026-10-24-da3-curated-630", closingText: "停一会，再出发。",
  viewerSignature: "观展人", styleCode: "1", cardVersion: HANDWRITING_CARD_VERSION, contentDigest: "a".repeat(64) };
test("keepsake identity binds exact confirmed text, independent signature and artwork", () => {
  assert.deepEqual(parseKeepsakeDraft({ ...draft, arbitraryImageUrl: "https://invalid.test" }), draft);
  assert.equal(keepsakeWritingText(draft), "停一会，再出发。\n观展人");
  const identity = keepsakeDraftIdentity(draft);
  for (const change of [{ closingText: "新的寄语" }, { viewerSignature: "另一个人" }, { artworkId: "met-1" }, { styleCode: "2" }, { releaseVersion: "another" }]) assert.notEqual(keepsakeDraftIdentity({ ...draft, ...change }), identity);
});
test("draft parsing rejects invalid versions, control characters, paths and oversized writing", () => {
  for (const change of [{ cardVersion: "other" }, { artworkId: "../secret" }, { contentDigest: "a" }, { closingText: "字".repeat(2001) }, { viewerSignature: "人\n作品作者" }, { closingText: "\u0000" }]) assert.throws(() => parseKeepsakeDraft({ ...draft, ...change }));
});
