import React from "react";
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SculptureCanvas } from "./sculpture-canvas";
import type { SculptureRoomScene, SculptureWork } from "./sculpture-types";

test("a sculpture fallback does not create an HTTP image preload that drops its CDN referrer policy", () => {
  const html = renderToStaticMarkup(<SculptureCanvas work={{ id: "bust", posterUrl: "https://assets.aitoshuu.me/bust-poster.png" } as SculptureWork}
    room={{} as SculptureRoomScene} url="https://assets.aitoshuu.me/bust.glb" input={{ x: 0, y: 0 }} paused={false} followEnabled
    onPoster={() => {}} onState={() => {}} />);
  assert.doesNotMatch(html, /<link[^>]+rel="preload"/iu);
  assert.match(html, /referrerpolicy="no-referrer"/iu);
  assert.match(html, /crossorigin="anonymous"/iu);
  assert.match(html, /正在请入雕塑/u);
});
