import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ImageLightbox } from "./image-lightbox";

test("image lightbox renders artwork image and caption", () => {
  const markup = renderToStaticMarkup(
    <ImageLightbox
      unit={{
        id: "met-1",
        title: "Quiet Moon",
        artistDisplayName: "Unknown Artist",
        yearLabel: "1888",
        imageUrl: "https://example.test/quiet-moon.jpg",
        imageUrlFull: "https://example.test/quiet-moon-full.jpg",
      }}
    />,
  );

  assert.match(markup, /Quiet Moon/);
  assert.match(markup, /Unknown Artist, 1888/);
  assert.match(markup, /quiet-moon\.jpg/);
  assert.match(markup, /打开《Quiet Moon》大图/);
  assert.doesNotMatch(markup, /quiet-moon-full\.jpg/);
  assert.match(markup, /data-detail-state="idle"/);
  assert.match(markup, /data-image-state="loading"/);
  assert.match(markup, /作品图像正在显影/);
});

test("image lightbox renders trusted border crop metadata", () => {
  const markup = renderToStaticMarkup(
    <ImageLightbox
      unit={{
        id: "met-1",
        title: "Quiet Moon",
        imageUrl: "https://example.test/quiet-moon.jpg",
        visualPresentation: {
          contentBounds: { x: 0.08, y: 0.12, width: 0.84, height: 0.74 },
          contentAspectRatio: 1.45,
          cropStrategy: "trim-border",
          confidence: 0.82,
          whiteBorderRatio: 0.24,
          source: "fixture-vlm",
        },
      }}
    />,
  );

  assert.match(markup, /data-visual-crop="trim-border"/);
  assert.match(markup, /immersive-image-crop/);
  assert.match(markup, /--immersive-content-aspect-ratio:1\.45/);
  assert.match(markup, /--crop-image-width:119\.0476190476190[45]%/);
});
