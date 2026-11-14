import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExperienceWaitingFrame } from "./waiting-frame";
import { Preface } from "./preface";

test("the waiting frame keeps the visitor's own sentence where the preface will appear", () => {
  const markup = renderToStaticMarkup(<ExperienceWaitingFrame query="下雨天，想看点安静的画" tier="normal" returnHref="/?query=x" />);
  assert.match(markup, /class="experience-waiting[^"]*"/u);
  assert.match(markup, /<h1[^>]*class="experience-waiting-echo"[^>]*>“下雨天，想看点安静的画”<\/h1>/u);
  assert.match(markup, /aria-busy="true"/u);
  assert.doesNotMatch(markup, /<button/u, "nothing to press while the exhibition is being prepared");
  assert.doesNotMatch(markup, /返回修改/u, "no exit offered during a normal wait");
});

test("a long wait offers a quiet way back, and a stalled one a retry, without leaving the frame", () => {
  const long = renderToStaticMarkup(<ExperienceWaitingFrame query="q" tier="long-wait" returnHref="/?query=q" />);
  assert.match(long, /还在为这句话挑选作品/u);
  assert.match(long, /href="\/\?query=q"[^>]*>返回修改/u);
  assert.doesNotMatch(long, /重试/u);
  const stalled = renderToStaticMarkup(<ExperienceWaitingFrame query="q" tier="retry" returnHref="/?query=q" retryHref="/gallery?q" />);
  assert.match(stalled, /href="\/gallery\?q"[^>]*>重试准备/u);
  assert.match(renderToStaticMarkup(<ExperienceWaitingFrame query="" tier="normal" returnHref="/" />), /正在为你挑选作品/u, "no empty quotation marks");
});

test("a preface whose text has not arrived continues the waiting frame instead of a placeholder", () => {
  const markup = renderToStaticMarkup(<Preface block={null} pending query="下雨天，想看点安静的画" count={6} ready onContinue={() => {}} reducedMotion />);
  assert.match(markup, /“下雨天，想看点安静的画”/u);
  assert.doesNotMatch(markup, /这次展览正在展开/u);
  const button = markup.match(/<button[^>]*>进入展厅/u)?.[0] ?? "";
  assert.match(button, /disabled=""/u, "the visitor cannot skip a preface that does not exist yet");
  const arrived = renderToStaticMarkup(<Preface block={{ text: "先看这间暗室。", source: "grounded" }} pending={false} query="q" count={6} ready onContinue={() => {}} reducedMotion />);
  assert.doesNotMatch(arrived.match(/<button[^>]*>进入展厅/u)?.[0] ?? "", /disabled/u);
  const settledWithoutText = renderToStaticMarkup(<Preface block={null} pending={false} query="q" count={6} ready onContinue={() => {}} reducedMotion />);
  assert.doesNotMatch(settledWithoutText.match(/<button[^>]*>进入展厅/u)?.[0] ?? "", /disabled/u, "a failed preface never blocks entry");
});
