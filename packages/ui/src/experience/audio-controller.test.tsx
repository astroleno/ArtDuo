import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AudioButton } from "./audio-controller";

test("pending audio offers cancellation and a readable status without claiming playback", () => {
  const markup = renderToStaticMarkup(<AudioButton state="loading" onToggle={() => {}} />);
  assert.match(markup, /aria-label="取消环境音加载"/);
  assert.match(markup, /aria-pressed="false"/);
  assert.match(markup, /正在准备环境音/);
  assert.match(markup, /aria-live="polite"/);
  assert.doesNotMatch(markup, /disabled|环境音已开/);
  const failure = renderToStaticMarkup(<AudioButton state="error" onToggle={() => {}} />);
  assert.match(failure, /aria-label="重试环境音"/);
  assert.match(failure, /环境音暂时无法播放，可以重试/);
});
