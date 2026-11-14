import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { artworkOffering, stageFit } from "../../lib/artwork-offering";
import { loadWebReleaseCatalog } from "../../lib/release-catalog";

const rootDir = path.resolve(__dirname, "../../../..");
const catalog = loadWebReleaseCatalog({ rootDir, releaseVersion: "2026-10-13-quality" });
const base = { ...catalog.artworks[0]!, moodTags: [], emotionLabels: [], appearance: undefined, visualEvidence: undefined };

test("editorial tags outside the visitor signal list still describe what a work offers", () => {
  const lively = artworkOffering({ ...base, moodTags: ["lively", "playful"] });
  const solemn = artworkOffering({ ...base, moodTags: ["solemn", "restrained"] });
  const dramatic = artworkOffering({ ...base, moodTags: ["dramatic", "tense"] });
  assert.ok(lively.arousal > solemn.arousal + .25, "lively and playful works are more energetic");
  assert.ok(lively.valence > solemn.valence + .2);
  assert.ok(dramatic.tension > lively.tension + .3, "dramatic works carry tension");
});

test("colourful light raises the offered mood while pale paper and dark fields do not", () => {
  const sunlit = artworkOffering({ ...base, moodTags: ["quiet"], appearance: { meanLightness: .7, brightShare: .5, darkShare: .02, chroma: .24, colorVariation: .5 } });
  const paper = artworkOffering({ ...base, moodTags: ["quiet"], appearance: { meanLightness: .88, brightShare: .9, darkShare: 0, chroma: .01, colorVariation: .02 } });
  const dark = artworkOffering({ ...base, moodTags: ["quiet"], appearance: { meanLightness: .18, brightShare: 0, darkShare: .7, chroma: .06, colorVariation: .1 } });
  assert.ok(sunlit.valence > paper.valence + .05, "blank paper is not bright cheer");
  assert.ok(sunlit.arousal > dark.arousal);
  assert.ok(dark.valence < paper.valence, "a dark field lowers the offered mood");
});

test("observed space and difficult subjects shape intimacy, wonder and tension", () => {
  const facts = (values: Record<string, "present" | "absent">, spatialFraming: "open" | "enclosed") =>
    ({ artworkId: base.id, imagePath: "", imageSha256: "", reviewedAt: "", reviewer: "local-image-review" as const, observation: "", facts: values, spatialFraming });
  const room = artworkOffering({ ...base, moodTags: ["quiet"], visualEvidence: facts({ interior: "present" }, "enclosed") });
  const vista = artworkOffering({ ...base, moodTags: ["quiet"], visualEvidence: facts({ interior: "absent" }, "open") });
  const battle = artworkOffering({ ...base, moodTags: ["quiet"], visualEvidence: facts({ war: "present", death: "present" }, "open") });
  assert.ok(room.intimacy > vista.intimacy + .1);
  assert.ok(vista.wonder > room.wonder + .1);
  assert.ok(battle.tension > vista.tension + .2 && battle.valence < vista.valence);
});

test("stage fit is highest for a matching offering and bounded to 0–1", () => {
  const calm = { valence: .5, arousal: .15, tension: .1, wonder: .3, intimacy: .5 };
  const high = { valence: .9, arousal: .85, tension: .2, wonder: .5, intimacy: .3 };
  assert.ok(stageFit(calm, calm) > stageFit(high, calm) + .2);
  for (const value of [stageFit(calm, high), stageFit(high, calm), stageFit(calm, calm)]) assert.ok(value >= 0 && value <= 1);
});
