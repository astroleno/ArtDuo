import assert from "node:assert/strict";
import { test } from "node:test";

import { gradeArtworks } from "../../src/services/curation/grade-artworks";

test("grade artworks assigns stable A/B/C grades from ranked candidates", () => {
  const input = [
    { artworkId: "art-3", score: 0.71 },
    { artworkId: "art-1", score: 0.98 },
    { artworkId: "art-5", score: 0.12 },
    { artworkId: "art-2", score: 0.83 },
    { artworkId: "art-4", score: 0.43 },
  ];

  const firstRun = gradeArtworks(input);
  const secondRun = gradeArtworks([...input].reverse());

  assert.deepEqual(
    firstRun.map((item) => `${item.artworkId}:${item.grade}:${item.gradeLabel}:${item.displayStrategy}`),
    [
      "art-1:A:director-focus:director-focus",
      "art-2:B:emotional-pillar:motion-frame",
      "art-3:B:emotional-pillar:motion-frame",
      "art-4:C:ambient-bridge:static-frame",
      "art-5:C:ambient-bridge:static-frame",
    ],
  );
  assert.deepEqual(secondRun, firstRun);
});

test("grade artworks keeps explicit grade overrides but still normalizes labels", () => {
  const graded = gradeArtworks([
    { artworkId: "ambient", score: 0.99, preferredGrade: "C" },
    { artworkId: "focus", score: 0.1, preferredGrade: "A" },
  ]);

  assert.equal(graded[0]?.artworkId, "ambient");
  assert.equal(graded[0]?.grade, "C");
  assert.equal(graded[0]?.gradeLabel, "ambient-bridge");
  assert.equal(graded[1]?.grade, "A");
  assert.equal(graded[1]?.displayStrategy, "director-focus");
});
