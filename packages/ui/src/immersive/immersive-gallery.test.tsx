import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ImmersiveGallery } from "./immersive-gallery";
import type { ImmersiveGalleryUnit } from "./scene-orchestrator";

const units: ImmersiveGalleryUnit[] = [
  {
    id: "met-1",
    title: "Moon Room",
    imageUrl: "https://example.test/moon.jpg",
    transitionFamily: "fade",
  },
  {
    id: "met-2",
    title: "Spring Window",
    imageUrl: "https://example.test/spring.jpg",
    backgroundSceneUrl: "/artduo-gallery/bg-spring.jpg",
    transitionFamily: "dissolve",
  },
  {
    id: "met-3",
    title: "Storm Door",
    imageUrl: "https://example.test/storm.jpg",
    transitionFamily: "depth-push",
  },
];

test("immersive gallery renders next previous and clickable progress scene links", () => {
  const markup = renderToStaticMarkup(
    <ImmersiveGallery
      galleryHref="/gallery?query=moon"
      getSceneHref={(unit) => `/gallery/local/immersive?query=moon&unit=${unit.id}`}
      preface="Begin with the moon room."
      closing="Leave through a quieter threshold."
      selectedUnitId="met-2"
      units={units}
    />,
  );

  assert.match(markup, /Spring Window/);
  assert.match(markup, /immersive-transition-dissolve/);
  assert.match(markup, /bg-spring\.jpg/);
  assert.match(markup, /Previous scene/);
  assert.match(markup, /Next scene/);
  assert.match(markup, /aria-label="Open scene 1 of 3"/);
  assert.match(markup, /immersive-atmosphere/);
  assert.match(markup, /data-testid="immersive-emotion-curve"/);
  assert.match(markup, /unit=met-3/);
});
