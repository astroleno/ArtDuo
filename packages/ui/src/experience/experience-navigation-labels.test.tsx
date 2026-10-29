import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExperienceShell } from "./experience-shell";
import { Preface } from "./preface";
import { Plaque } from "./plaque";
import type { ExhibitionSnapshot, ExperienceUnit } from "./types";

const unit = { exhibition: { unitId: "unit-one", order: 0 }, stageId: null, scene: null,
  artwork: { id: "one", source: "met", metadata: { title: "The Bay", artistDisplayName: "An artist", colorTags: [], compositionTags: [] }, media: {}, presentation: {} },
  media: { previewUrl: "/preview.jpg", fullUrl: "/full.jpg" },
  caption: { text: "蓝色海湾。", source: "grounded" }, rationale: { text: "", source: "fallback" },
} as ExperienceUnit;
const snapshot: ExhibitionSnapshot = { schemaVersion: 1, recipeVersion: "experience-v2", exhibitionId: "test-labels", curationId: "one", releaseVersion: "test",
  query: "海湾 & 树影？", title: "Test", preface: { text: "前言。", source: "grounded" }, closing: { text: "结语。", source: "grounded" },
  stages: [], units: [unit], omittedUnitCount: 0,
};

test("preface and closing brand exits preserve the request without relying on a caller-provided href", () => {
  for (const initialPosition of [{ phase: "preface" }, { phase: "closing", lastUnitId: "unit-one" }] as const) {
    const markup = renderToStaticMarkup(<ExperienceShell snapshot={snapshot} initialPosition={initialPosition} onPositionChange={() => {}} onDetail={() => {}} onRestart={() => {}} />);
    const link = markup.match(/<a[^>]*class="experience-exit"[^>]*>/u)?.[0];
    assert.ok(link);
    const href = link.match(/href="([^"]+)"/u)![1]!.replaceAll("&amp;", "&");
    const url = new URL(href, "https://example.test");
    assert.equal(url.searchParams.get("query"), snapshot.query);
    assert.equal(url.searchParams.get("view"), "experience");
    assert.match(link, /aria-label="ArtDuo，返回入口"/u);
    if (initialPosition.phase === "preface") assert.doesNotMatch(markup, /前言。/u, "SSR waits for the tab's presented version instead of flashing new prose");
  }
});

test("visible action text remains the native name and reader labels retain artwork identity", () => {
  const preface = renderToStaticMarkup(<Preface block={snapshot.preface} ready onContinue={() => {}} reducedMotion />);
  const start = preface.match(/<button[^>]*>进入展厅/u)?.[0];
  assert.ok(start); assert.doesNotMatch(start, /aria-label/u);
  for (const artworkKind of ["painting", "sculpture"] as const) {
    const reader = renderToStaticMarkup(<Plaque unit={unit} expanded onToggle={() => {}} artworkKind={artworkKind} />);
    const trigger = reader.match(/<button[^>]*class="experience-plaque-heading"[^>]*>(.*?)<\/button>/u)?.[0];
    assert.ok(trigger); assert.match(trigger, /The Bay/u); assert.doesNotMatch(trigger, /aria-label/u);
    assert.match(reader, artworkKind === "painting" ? />返回画作 /u : />返回雕塑 /u);
    assert.doesNotMatch(reader, /aria-label="收起完整展签"/u);
  }
});
