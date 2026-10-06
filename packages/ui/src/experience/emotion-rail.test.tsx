import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { ExperienceStage } from "./types";
import { EmotionRail } from "./emotion-rail";

const stages: ExperienceStage[] = [
  { id: "opening", role: "threshold", label: "慢慢安静", valence: 0.2, arousal: 0.1, tension: 0.1, wonder: 0.1, intimacy: 0.2, intensity: 0.2, transitionIntent: "fade" },
  { id: "drift", role: "turn", label: "向外展开", valence: 0.4, arousal: 0.5, tension: 0.3, wonder: 0.4, intimacy: 0.3, intensity: 0.5, transitionIntent: "drift" },
];

test("emotion rail disables stages without works and leaves populated stages selectable", () => {
  const html = renderToStaticMarkup(<EmotionRail
    activeStageId="drift"
    availableStageIds={["drift"]}
    onSelect={() => undefined}
    stages={stages}
  />);

  const buttons = html.match(/<button\b[^>]*>/g) ?? [];
  assert.match(buttons[0] ?? "", /aria-label="1\. 慢慢安静"/);
  assert.match(buttons[0] ?? "", /disabled=""/);
  assert.match(buttons[1] ?? "", /aria-label="2\. 向外展开，当前阶段"/);
  assert.match(buttons[1] ?? "", /aria-current="step"/);
  assert.doesNotMatch(buttons[1] ?? "", /disabled=""/);
});
