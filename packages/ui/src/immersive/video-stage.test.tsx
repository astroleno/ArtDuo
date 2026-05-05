import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { VideoStage } from "./video-stage";

test("video stage falls back to an image when dynamic media is unavailable", () => {
  const markup = renderToStaticMarkup(
    <VideoStage
      title="Still Moon"
      imageUrl="/artworks/still-moon.jpg"
      profile={{
        artworkId: "still-moon",
        grade: "B",
        motionProfile: "ambient-loop",
        displayStrategy: "static-frame",
        transitionIntensity: "moderate",
        usesDynamicMedia: false,
        mediaUrl: "/artworks/still-moon.jpg",
      }}
    />,
  );

  assert.match(markup, /<img/);
  assert.match(markup, /Still Moon artwork/);
  assert.doesNotMatch(markup, /<video/);
});

test("video stage renders dynamic media without swallowing navigation children", () => {
  const markup = renderToStaticMarkup(
    <VideoStage
      title="Moving Storm"
      imageUrl="/artworks/moving-storm.jpg"
      profile={{
        artworkId: "moving-storm",
        grade: "A",
        motionProfile: "push-in",
        displayStrategy: "director-focus",
        transitionIntensity: "dramatic",
        usesDynamicMedia: true,
        mediaUrl: "/artworks/moving-storm.mp4",
        posterUrl: "/artworks/moving-storm-poster.jpg",
      }}
    >
      <a href="/gallery">Back to gallery</a>
    </VideoStage>,
  );

  assert.match(markup, /<video/);
  assert.match(markup, /moving-storm\.mp4/);
  assert.match(markup, /href="\/gallery"/);
});
