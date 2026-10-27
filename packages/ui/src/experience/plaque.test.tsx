import React from "react";
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Plaque } from "./plaque";
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
  assert.match(unknown.slice(0, unknown.indexOf("</button>")), /作者尚待核实/u);
});
