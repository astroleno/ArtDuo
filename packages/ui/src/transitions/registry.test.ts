import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveTransitionModule } from "./registry";

test("transition registry resolves known transition families", () => {
  const transition = resolveTransitionModule("light-swell");

  assert.equal(transition.family, "light-swell");
  assert.equal(transition.className, "immersive-transition-light-swell");
});

test("transition registry falls back to fade when a module is unavailable", () => {
  const transition = resolveTransitionModule("depth-push", {
    fade: {
      family: "fade",
      className: "fallback-fade",
      durationMs: 200,
    },
  });

  assert.equal(transition.family, "fade");
  assert.equal(transition.className, "fallback-fade");
});
