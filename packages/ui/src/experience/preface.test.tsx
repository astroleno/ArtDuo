import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Preface } from "./preface";
import { ROOM_IMAGE_SIZES, roomImageSrcSet } from "./room-assets";

test("the preface wall requests the published responsive sources with the same credentials as the room", () => {
  const large = "https://assets.aitoshuu.me/walls/large-hash.webp";
  const small = "https://assets.aitoshuu.me/walls/small-hash.webp";
  const markup = renderToStaticMarkup(<Preface block={null} ready onContinue={() => {}} reducedMotion backdropUrl={large} backdropSmallUrl={small} />);
  const image = markup.match(/<img [^>]*class="experience-preface-backdrop"[^>]*>/u)?.[0] ?? "";
  assert.ok(image.includes(`src="${large}"`));
  assert.ok(image.includes(`srcSet="${roomImageSrcSet(large, small)}"`));
  assert.ok(image.includes(`sizes="${ROOM_IMAGE_SIZES}"`));
  assert.match(image, /crossorigin="anonymous"/iu);
  assert.match(image, /fetchPriority="high"/iu);
});
