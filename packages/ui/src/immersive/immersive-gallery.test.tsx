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
    curatorNote: "Moon room note.",
    transitionFamily: "fade",
  },
  {
    id: "met-2",
    title: "Spring Window",
    detailHref: "/artwork/met-2?query=moon",
    imageUrl: "https://example.test/spring.jpg",
    backgroundSceneUrl: "/artduo-gallery/bg-spring.jpg",
    sceneLabel: "雾白静室",
    sceneMatchReason: "墙面安静下来，脚步自然往里走。",
    stageTone: "wonder",
    emotionalIntensity: 0.72,
    growthStageId: "stage-2",
    growthStageRole: "turn",
    affectState: {
      valence: 0.6,
      arousal: 0.68,
      tension: 0.3,
      wonder: 0.86,
      intimacy: 0.42,
    },
    transitionIntent: "push",
    curatorNote: "Stay with the middle window.",
    transitionFamily: "dissolve",
  },
  {
    id: "met-3",
    title: "Storm Door",
    imageUrl: "https://example.test/storm.jpg",
    curatorNote: "Storm door note.",
    transitionFamily: "depth-push",
  },
];

test("immersive gallery renders next previous controls and quiet progress", () => {
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
  assert.match(markup, /data-route-stage="drift"/);
  assert.match(markup, /data-growth-stage="stage-2"/);
  assert.match(markup, /data-growth-stage-role="turn"/);
  assert.match(markup, /data-affect-intensity="0\.720"/);
  assert.match(markup, />wonder</);
  assert.match(markup, /bg-spring\.jpg/);
  assert.doesNotMatch(markup, /data-testid="immersive-scene-match"/);
  assert.match(markup, /上一幅/);
  assert.match(markup, /下一幅/);
  assert.match(markup, /href="\/artwork\/met-2\?query=moon"[^>]*>查看《Spring Window》详情/);
  assert.doesNotMatch(markup, /aria-label="Open scene/);
  assert.match(markup, /aria-label="观展进度，第 2 幅，共 3 幅"/);
  assert.match(markup, /aria-label="跳到第 1 幅，共 3 幅"/);
  assert.match(markup, /immersive-atmosphere/);
  assert.match(markup, /data-testid="immersive-ambient-audio"/);
  assert.match(markup, /播放背景音乐：Felt Letter/);
  assert.match(markup, /\/ambient-audio\/Felt%20Letter\.mp3/);
  assert.doesNotMatch(markup, /data-testid="immersive-viewing-progress"/);
  assert.doesNotMatch(markup, /aria-label="Viewing progress"/);
  assert.match(markup, /<button[^>]+type="button"/);
});

test("immersive gallery uses preface note and closing at the correct scene positions", () => {
  const renderScene = (selectedUnitId: string) => renderToStaticMarkup(
    <ImmersiveGallery
      galleryHref="/gallery?query=moon"
      getSceneHref={(unit) => `/gallery/local/immersive?query=moon&unit=${unit.id}`}
      preface="Begin with the moon room."
      closing="Leave through a quieter threshold."
      selectedUnitId={selectedUnitId}
      units={units}
    />,
  );

  const firstMarkup = renderScene("met-1");
  const middleMarkup = renderScene("met-2");
  const lastMarkup = renderScene("met-3");

  assert.match(firstMarkup, /data-testid="immersive-preface"[^>]*>Begin with the moon room/);
  assert.match(firstMarkup, /is-opening-title/);
  assert.match(middleMarkup, /data-testid="immersive-note"[^>]*>Stay with the middle window/);
  assert.match(lastMarkup, /data-testid="immersive-closing"[^>]*>Leave through a quieter threshold/);
  assert.match(lastMarkup, /is-closing-title/);
});
