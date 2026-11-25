import React from "react";
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Plaque } from "./plaque";
import { experienceArtistName } from "./artwork-credits";
import type { ExperienceUnit } from "./types";

test("the small label contains only title, artist and period while the reading layer retains the note", () => {
  const unit = { artwork: { metadata: { title: "The Bedroom", artistDisplayName: "Vincent van Gogh", yearLabel: "1889" } },
    curatorNote: { text: "A curatorial note belongs in the reader", source: "grounded" },
    caption: { text: "Recorded description" }, rationale: { text: "Selection context" },
    media: { previewUrl: "/same-verified-preview.jpg", fullUrl: "/same-full.jpg" },
  } as ExperienceUnit;
  const markup = renderToStaticMarkup(<Plaque unit={unit} expanded={false} onToggle={() => {}} onDetail={() => {}} />);
  const label = markup.slice(0, markup.indexOf("</button>"));
  for (const value of ["The Bedroom", "Vincent van Gogh", "1889"]) assert.ok(label.includes(value));
  assert.ok(!label.includes(unit.curatorNote!.text));
  assert.ok(!label.includes("作品资料 ↗"));
  assert.ok(!markup.includes(unit.media.previewUrl), "a closed reader must not compete with the visible artwork for image bytes");
  const reader = renderToStaticMarkup(<Plaque unit={unit} expanded={true} onToggle={() => {}} onDetail={() => {}} />);
  assert.ok(reader.includes(unit.curatorNote!.text));
  assert.ok(reader.includes('data-narrative-source="grounded"'));
  assert.ok(!reader.includes("Selection context"), "generic route guidance must not repeat below the dedicated note");
});

test("reading has one primary note, optional source description, and a nonempty fallback", () => {
  const unit = { artwork: { id: "one", metadata: { title: "A work", artistDisplayName: "An artist" } },
    curatorNote: { text: "先看面部和手背的亮处。", source: "grounded" },
    caption: { text: "面部与手背较亮，周围有密集排线。", source: "grounded" },
    rationale: { text: "先停在画面上。", source: "fallback" }, media: { previewUrl: "/one.jpg" },
  } as ExperienceUnit;
  const render = () => renderToStaticMarkup(<Plaque unit={unit} expanded onToggle={() => {}} onDetail={() => {}} />);
  const reader = render();
  assert.equal(reader.split(unit.curatorNote!.text).length - 1, 1);
  assert.match(reader, /<details class="experience-source-description"><summary>馆藏说明<\/summary>/u);
  assert.doesNotMatch(reader, /<details[^>]*open|先停在画面上/u);
  unit.caption.text = unit.curatorNote!.text;
  assert.doesNotMatch(render(), /<summary>馆藏说明/u);
  unit.curatorNote = undefined;
  const fallback = render();
  assert.equal(fallback.split(unit.caption.text).length - 1, 1);
  assert.match(fallback, /experience-reading-note/u);
});

test("source roles keep publishers out of the label and leave the same artwork visible while reading", () => {
  const unit = { artwork: { id: "smk-KKS3423", metadata: { title: "Læsende gammel kone", artistDisplayName: "Ancher, Anna; Alfred Jacobsens Forlag", yearLabel: "1896" } },
    displayCredits: { artistDisplayName: "Ancher, Anna", publishers: ["Alfred Jacobsens Forlag"] },
    caption: { text: "Recorded description" }, rationale: { text: "Selection context" }, media: { previewUrl: "/verified-3423.jpg", fullUrl: "/full-3423.jpg" },
  } as ExperienceUnit;
  const markup = renderToStaticMarkup(<Plaque unit={unit} expanded={true} onToggle={() => {}} onDetail={() => {}} />);
  const label = markup.slice(0, markup.indexOf("</button>"));
  assert.ok(label.includes("Ancher, Anna"));
  assert.ok(!label.includes("Alfred"));
  assert.match(markup, /<dt>出版<\/dt><dd[^>]*>Alfred Jacobsens Forlag<\/dd>/u);
  assert.match(markup, /alt="阅读时参照《Læsende gammel kone》"/u);
  assert.match(markup, /src="\/verified-3423.jpg"/u);
  assert.equal(unit.artwork.metadata.artistDisplayName, "Ancher, Anna; Alfred Jacobsens Forlag");
  unit.displayCredits!.artistDisplayName = null;
  const unknown = renderToStaticMarkup(<Plaque unit={unit} expanded={false} onToggle={() => {}} onDetail={() => {}} />);
  assert.doesNotMatch(unknown.slice(0, unknown.indexOf("</button>")), /作者尚待核实|experience-plaque-artist|Alfred/u);
  assert.match(unknown, /<p class="experience-reading-byline">1896<\/p>/u);
  assert.match(unknown, /<dt>出版<\/dt><dd[^>]*>Alfred Jacobsens Forlag<\/dd>/u);
  assert.equal(experienceArtistName(unit), "作者尚待核实", "the closing and card helper keeps its established fallback");
});

function renderLabel(metadata: Partial<ExperienceUnit["artwork"]["metadata"]>, artworkKind: "painting" | "sculpture" = "painting") {
  const unit = { artwork: { id: "one", metadata: { title: "A work", ...metadata } }, caption: { text: "Recorded description", source: "grounded" },
    media: { previewUrl: "/verified.jpg", fullUrl: "/full.jpg" } } as ExperienceUnit;
  const markup = renderToStaticMarkup(<Plaque unit={unit} expanded={false} artworkKind={artworkKind} measureWidth={156} onSizeChange={() => {}} onToggle={() => {}} />);
  const visible = markup.match(/class="experience-plaque-heading"[^>]*>([\s\S]*?)<\/button>/u)?.[1];
  const measurement = markup.match(/class="experience-plaque-measure"[^>]*><div[^>]*width:156px[^>]*>([\s\S]*?)<\/div>/u)?.[1];
  assert.ok(visible);
  assert.equal(visible, measurement, "layout measures the same source-backed fields as the visible label");
  return { unit, markup, visible };
}

test("missing or blank credit, year and dimensions create no label lines or empty reader rows", () => {
  for (const metadata of [{}, { artistDisplayName: "  \n ", yearLabel: "   ", dimensions: "\t  " }]) {
    const { markup, visible } = renderLabel({ ...metadata, medium: "Oil on canvas", culture: "French", creditLine: "Museum credit" });
    assert.equal(visible, "<strong>A work</strong>");
    assert.doesNotMatch(markup, /experience-reading-byline|馆方尺寸|作者尚待核实|尺寸尚待核实/u);
    for (const text of ["Oil on canvas", "French", "Museum credit"]) assert.ok(markup.includes(text));
  }
  const { markup, visible } = renderLabel({ yearLabel: "1890–1893", dimensions: "50 × 30 cm\nFramed: 62 × 42 cm" });
  assert.match(visible, /experience-plaque-period">1890–1893/u);
  assert.doesNotMatch(visible, /experience-plaque-artist/u);
  assert.match(markup, /<p class="experience-reading-byline">1890–1893<\/p>/u);
  assert.match(markup, /<dt>馆方尺寸<\/dt><dd[^>]*>50 × 30 cm\nFramed: 62 × 42 cm<\/dd>/u);
});

test("explicit anonymity, attribution qualifiers and sculpture credit stay as recorded", () => {
  for (const name of ["Unknown", "佚名", "Attributed to Rembrandt", "School of Antwerp"]) {
    const { markup, visible } = renderLabel({ artistDisplayName: name }, "sculpture");
    assert.ok(visible.includes(`experience-plaque-artist">${name}</span>`));
    assert.ok(markup.includes(`<p class="experience-reading-byline">${name}</p>`));
    assert.match(markup, /返回雕塑/u);
    assert.doesNotMatch(markup, /作者尚待核实|馆方尺寸/u);
  }
});
