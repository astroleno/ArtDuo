import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DirectorFocus } from "./director-focus";

test("director focus marks A-grade artwork as the strongest presentation", () => {
  const markup = renderToStaticMarkup(
    <DirectorFocus
      profile={{
        artworkId: "focus",
        grade: "A",
        motionProfile: "push-in",
        displayStrategy: "director-focus",
        transitionIntensity: "dramatic",
        usesDynamicMedia: true,
        mediaUrl: "/focus.mp4",
        focusTarget: { x: 0.42, y: 0.36, radius: 0.18 },
      }}
    >
      <p>Focus copy</p>
    </DirectorFocus>,
  );

  assert.match(markup, /is-director-focus/);
  assert.match(markup, /data-grade="A"/);
  assert.match(markup, /data-focus-x="42"/);
  assert.match(markup, /Focus copy/);
});

test("director focus keeps lower grades in a supporting presentation", () => {
  const markup = renderToStaticMarkup(
    <DirectorFocus
      profile={{
        artworkId: "ambient",
        grade: "C",
        motionProfile: "static",
        displayStrategy: "static-frame",
        transitionIntensity: "soft",
        usesDynamicMedia: false,
        mediaUrl: "/ambient.jpg",
      }}
    />,
  );

  assert.match(markup, /is-supporting-focus/);
  assert.match(markup, /data-grade="C"/);
});
