import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesViewingIntent, parseViewingIntent } from "../../lib/viewing-intent";
import type { WebArtwork } from "../../lib/release-catalog";

const artwork = (title: string, subjectTags: string[] = []) => ({ title, subjectTags }) as WebArtwork;

test("fatigue seeks respite, not a disaster carrying a melancholy label", () => {
  const intent = parseViewingIntent("有点累，撑了很久");
  assert.equal(intent.rest, true);
  assert.equal(matchesViewingIntent(artwork("Burning of the Steamship"), intent), false);
  assert.equal(matchesViewingIntent(artwork("Water Lilies"), intent), true);
});

test("explicit war and death requests remain possible even when the visitor is sad", () => {
  for (const query of ["难过，想看战争绘画", "想看死亡题材", "tired, show me a battle"]) {
    const intent = parseViewingIntent(query);
    assert.equal(intent.rest, false);
    assert.equal(matchesViewingIntent(artwork("War and Death", ["battle"]), intent), true);
  }
});

test("subject exclusions have clause scope and never return as emotional aliases", () => {
  for (const query of ["不要森林，想看海", "不想看森林，想看海", "not forest but sea", "不要森林和树木，想看海边"]) {
    const intent = parseViewingIntent(query);
    assert.deepEqual(intent.subjects, ["sea"]);
    assert.deepEqual(intent.excludedSubjects, ["forest"]);
    assert.equal(matchesViewingIntent(artwork("Forest beside the Sea"), intent), false);
    assert.equal(matchesViewingIntent(artwork("Calm Ocean"), intent), true);
    assert.equal(matchesViewingIntent(artwork("Quiet Portrait"), intent), false);
  }
});

test("a distressing current context is not mistaken for the requested subject", () => {
  const intent = parseViewingIntent("看了战争新闻很难过，想平静一下");
  assert.deepEqual(intent.subjects, []);
  assert.equal(intent.rest, true);
  assert.equal(matchesViewingIntent(artwork("A Battle"), intent), false);
});

test("bilingual artist names constrain authorship and preserve exclusions", () => {
  const monet = { ...artwork("Water Lilies"), artistDisplayName: "Claude Monet" };
  const cezanne = { ...artwork("Apples"), artistDisplayName: "Paul Cézanne" };
  assert.equal(matchesViewingIntent(monet, parseViewingIntent("想看莫奈")), true);
  assert.equal(matchesViewingIntent(cezanne, parseViewingIntent("想看莫奈")), false);
  assert.equal(matchesViewingIntent(cezanne, parseViewingIntent("塞尚")), true);
  assert.equal(matchesViewingIntent(monet, parseViewingIntent("不要莫奈")), false);
});

test("Chinese and English subjects use catalog evidence, not medium or affect", () => {
  const intent = parseViewingIntent("想看静物 still life");
  assert.equal(matchesViewingIntent(artwork("Still Life with Apples"), intent), true);
  assert.equal(matchesViewingIntent(artwork("The Old Man", ["quiet", "still"]), intent), false);
  assert.equal(parseViewingIntent("不要明亮，想安静").bright, false);
});
