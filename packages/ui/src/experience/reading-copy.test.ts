import assert from "node:assert/strict";
import test from "node:test";
import { displaySourceCredit, sameReadingText } from "./reading-copy";

test("repeated source credits collapse without removing distinct museums or punctuation in names", () => {
  assert.equal(displaySourceCredit("Gift of Charles Lang Freer. Gift of Charles Lang Freer"), "Gift of Charles Lang Freer");
  const getty = "The J. Paul Getty Museum, Los Angeles";
  assert.equal(displaySourceCredit(`${getty}. ${getty}`), getty);
  assert.equal(displaySourceCredit("Museum A; Gift of Museum B"), "Museum A; Gift of Museum B");
  assert.equal(displaySourceCredit(undefined), undefined);
});

test("only equivalent complete reading text is suppressed; different evidence survives", () => {
  assert.equal(sameReadingText("  水面延伸到远处。", "水面延伸到远处"), true);
  assert.equal(sameReadingText("A quiet bay.", "A quiet bay"), true);
  assert.equal(sameReadingText("水面延伸到远处。", "水面延伸到远处，近岸有船。"), false);
  assert.equal(sameReadingText(undefined, ""), false);
});
