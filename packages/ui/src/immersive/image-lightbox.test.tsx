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
      }}
    />,
  );

  assert.match(markup, /Quiet Moon/);
  assert.match(markup, /Unknown Artist, 1888/);
  assert.match(markup, /quiet-moon\.jpg/);
});
