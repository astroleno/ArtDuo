import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Closing } from "./closing";
import { resolveClosingNarrative } from "./closing-narrative";
import { keepsakeTextEdit } from "./handwritten-keepsake";
import { createExperienceState, experienceReducer } from "./state";
import type { ExhibitionSnapshot, ExperienceUnit } from "./types";

const unit = (id: string, title: string, text?: string) => ({
  artwork: { id, metadata: { title } },
  exhibition: { unitId: `unit-${id}`, artworkId: id },
  media: { previewUrl: `/${id}.jpg`, fullUrl: `/${id}-full.jpg` },
  closingObservation: text ? { text, source: "fallback" } : undefined,
  curatorNote: { text: "照原展序回想前一幅画。", source: "grounded" },
} as ExperienceUnit);
const opening = unit("a", "第一幅");
const ball = unit("met-436927", "Masquerade Ball", "门洞深处，暖黄灯光在两扇拱窗之间聚成局部亮点。");
const red = unit("smk-KMS8654", "The Artist's Mother in the Red Room");
const snapshot = {
  units: [opening, ball, red],
  closing: { text: "红室里的色调在这里收住。", source: "fallback" },
  narrativePending: true,
} as ExhibitionSnapshot;

test("a changed end uses that work, while middle-only changes keep the original stream", () => {
  const routed = { ...snapshot, units: [opening, red, ball] };
  const closingState = experienceReducer(createExperienceState(routed, { phase: "walk", unitId: ball.exhibition.unitId }), { type: "NEXT" }, routed);
  const actual = routed.units.find(work => work.exhibition.unitId === closingState.lastUnitId);
  assert.deepEqual(resolveClosingNarrative(snapshot, actual), { block: ball.closingObservation, pending: false });
  assert.equal(experienceReducer(closingState, { type: "REVISIT" }, routed).unitId, ball.exhibition.unitId);
  for (const originalEnd of [[ball, opening, red], [opening, ball, red]]) {
    assert.deepEqual(resolveClosingNarrative(snapshot, originalEnd.at(-1)), { block: snapshot.closing, pending: true });
  }
  const streamed = { ...snapshot, closing: { text: "原展的后续文字", source: "grounded" as const } };
  assert.deepEqual(resolveClosingNarrative(streamed, ball), { block: ball.closingObservation, pending: false });
  assert.equal(resolveClosingNarrative(streamed, red).block, streamed.closing);
});

test("old snapshots use a neutral title and empty or single routes retain their original close", () => {
  const old = { ...ball, closingObservation: undefined };
  assert.deepEqual(resolveClosingNarrative(snapshot, old), { block: { text: "这次看到《Masquerade Ball》。", source: "fallback" }, pending: false });
  assert.equal(resolveClosingNarrative({ ...snapshot, units: [red] }, red).block, snapshot.closing);
  assert.equal(resolveClosingNarrative({ ...snapshot, units: [] }, undefined).block, snapshot.closing);
});

test("keepsake metadata edits keep a same-artwork default in sync with the currently presented text", () => {
  const artwork = "same-artwork";
  const fallback = "暂用结语", grounded = "后到的经核结语";
  const signature = keepsakeTextEdit(undefined, "viewerSignature", "观展人", fallback, artwork);
  const style = keepsakeTextEdit(signature, "styleCode", "style", fallback, artwork);
  const textFor = (edit: string | undefined, original: string, form: string) => edit === artwork ? form : original;
  assert.equal(textFor(style, grounded, fallback), grounded);
  assert.equal(keepsakeTextEdit(undefined, "closingText", fallback, fallback, artwork), undefined, "restored metadata-only draft");
  const custom = keepsakeTextEdit(style, "closingText", "我写的寄语", fallback, artwork);
  assert.equal(textFor(keepsakeTextEdit(custom, "viewerSignature", "新署名", grounded, artwork), grounded, "我写的寄语"), "我写的寄语");
  assert.equal(keepsakeTextEdit(custom, "closingText", grounded, grounded, artwork), undefined);
});

test("the alternate ending is readable without a preview, while a pending original waits", () => {
  const ending = resolveClosingNarrative(snapshot, ball);
  const lastUnit = { ...ball, media: { ...ball.media, previewUrl: "" } };
  const markup = renderToStaticMarkup(<Closing lastUnit={lastUnit} closing={ending.block} omittedUnitCount={0} reducedMotion onRevisit={() => {}} onRestart={() => {}} />);
  assert.match(markup, /门洞深处，暖黄灯光在两扇拱窗之间聚成局部亮点。/u);
  assert.match(markup, /作品图片暂时无法显示/u);
  assert.match(markup, /<button type="button">保存分享图/u);
  assert.doesNotMatch(markup, /红室|前一幅画/u);
  const pending = renderToStaticMarkup(<Closing lastUnit={red} closing={null} omittedUnitCount={0} reducedMotion onRevisit={() => {}} onRestart={() => {}} />);
  assert.match(pending, /正在收拢这段观看/u);
  assert.match(pending, /<button disabled="" type="button">保存分享图/u);
});
