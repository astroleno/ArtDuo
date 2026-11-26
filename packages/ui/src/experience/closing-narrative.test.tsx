import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Closing } from "./closing";
import { closingLookbackForExit, resolveClosingNarrative, restoreClosingLookback, selectClosingLookback } from "./closing-narrative";
import { keepsakeTextEdit } from "./handwritten-keepsake";
import { createExperienceState, experienceReducer } from "./state";
import type { ExhibitionSnapshot, ExperienceUnit } from "./types";
import { createViewingSession, restoreViewingSession, settleViewingClock } from "./viewing-session";

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
  const withoutScript = renderToStaticMarkup(<Closing lastUnit={red} closing={null} noScriptText={snapshot.closing.text} omittedUnitCount={0}
    reducedMotion onRevisit={() => {}} onRestart={() => {}} />);
  assert.match(withoutScript, /<div id="experience-closing-title"><p[^>]+>正在收拢这段观看。<\/p><noscript><style>[^<]+display: none;[^<]+<\/style><h1>红室里的色调在这里收住。<\/h1><\/noscript><\/div>/u);
});

test("the earlier and actual last work earn a view-based closing, even across a skipped work", () => {
  const flowers = unit("rijksmuseum-200119006", "Flowers in a vase", "红色大花、蓝紫小花与黄色花朵插在小瓶中。");
  const vase = unit("met-436293", "Still life", "高脚花瓶插着浅色与紫色花朵。");
  const offer = { ...snapshot, exhibitionId: "offer", units: [flowers, ball, vase, red], routeOrder: [ball.artwork.id, flowers.artwork.id, red.artwork.id, vase.artwork.id] };
  const session = { ...createViewingSession(offer), observations: [
    { artworkId: ball.artwork.id, viewingMs: 2000, readingMs: 0, zoomMs: 0, visits: 1, returns: 0, zooms: 0, completedVisits: 1 },
    { artworkId: flowers.artwork.id, viewingMs: 1000, readingMs: 0, zoomMs: 0, visits: 2, returns: 1, zooms: 0, completedVisits: 1 },
    { artworkId: vase.artwork.id, viewingMs: 200, readingMs: 9000, zoomMs: 9000, visits: 1, returns: 0, zooms: 2, completedVisits: 0 },
  ] };
  assert.equal(selectClosingLookback(offer, session, vase.artwork.id), undefined, "reading and zoom alone do not earn the close");
  assert.equal(restoreClosingLookback(offer, session, vase), undefined, "direct links cannot turn accrued times into a lookback");
  const settled = settleViewingClock(session, { artworkId: vase.artwork.id, mode: "viewing", since: 200 }, 1000);
  const selected = selectClosingLookback(offer, settled, vase.artwork.id);
  assert.deepEqual(selected, { earlierId: flowers.artwork.id, lastId: vase.artwork.id, order: offer.routeOrder });
  const cache = restoreViewingSession(JSON.stringify({ ...settled, closingLookback: selected }), offer)!;
  const lookback = restoreClosingLookback(offer, cache, vase);
  assert.equal(lookback?.block.text, "先前那幅，红色大花、蓝紫小花与黄色花朵插在小瓶中。最后这幅，高脚花瓶插着浅色与紫色花朵。");
  assert.deepEqual(closingLookbackForExit(offer, cache, vase.artwork.id, false), selected, "a quick revisit retains the proven pair");
  assert.equal(closingLookbackForExit(offer, settled, vase.artwork.id, false), undefined, "an unready exit cannot establish a pair");
  assert.equal(resolveClosingNarrative(offer, vase, lookback).block, lookback?.block);
  assert.equal(restoreClosingLookback(offer, { ...cache, observations: [] }, vase), undefined);
  assert.equal(restoreClosingLookback({ ...offer, exhibitionId: "other" }, cache, vase), undefined);
  assert.equal(restoreClosingLookback(offer, { ...cache, order: [flowers.artwork.id, ball.artwork.id, red.artwork.id, vase.artwork.id] }, vase), undefined);
  assert.equal(restoreClosingLookback(offer, cache, ball), undefined);
  assert.equal(restoreClosingLookback({ ...offer, units: [opening, ball, vase, red] }, cache, vase), undefined);
  const unrelated = selectClosingLookback(offer, { ...settled, observations: settled.observations.filter(item => item.artworkId !== flowers.artwork.id) }, vase.artwork.id);
  assert.equal(unrelated?.earlierId, ball.artwork.id);
  assert.match(restoreClosingLookback(offer, { ...settled, closingLookback: unrelated }, vase)?.block.text ?? "", /^先前那幅，门洞深处.+最后这幅，高脚花瓶/u);
});
