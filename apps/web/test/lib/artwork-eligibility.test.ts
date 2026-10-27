import assert from "node:assert/strict";
import { test } from "node:test";

import { classifyArtworkEligibility, galleryArtworkDecision, isGalleryArtwork } from "../../lib/artwork-eligibility";

test("paintings, drawings, prints and calligraphy qualify independently of their depicted subject", () => {
  for (const medium of ["Oil on wood", "Oil on copper", "Fresco", "Hand-colored lithograph", "Etching", "Hanging scroll; ink and color on silk", "Charcoal on white wove paper"]) {
    assert.equal(isGalleryArtwork({ medium, subjectTags: ["architecture", "bowl", "bronze statue"] }), true, medium);
  }
  assert.equal(isGalleryArtwork({ subjectTags: ["Paintings", "The Cloisters"] }), true);
  assert.equal(isGalleryArtwork({ subjectTags: ["Drawings"], department: "European Sculpture and Decorative Arts" }), true);
});

test("publication and derivative prints retain their identity but leave default exhibitions", () => {
  for (const artwork of [
    { id: "met-828433", medium: "Etching", subjectTags: ["Prints"] },
    { id: "met-372886", medium: "Wood engraving; proof", subjectTags: ["Prints"] },
    { id: "met-366377", medium: "Etching", subjectTags: ["Prints"] },
    { id: "met-436203", medium: "Oil on canvas", subjectTags: ["Paintings"] },
    { id: "met-459024", medium: "Tempera and gold on wood", subjectTags: ["Paintings"] },
    { medium: "Type-metal engraving and letterpress on buff paper", subjectTags: ["Prints"] },
  ]) {
    assert.equal(classifyArtworkEligibility(artwork), "flat-artwork");
    assert.equal(galleryArtworkDecision(artwork).status, "specialist-only");
    assert.equal(isGalleryArtwork(artwork), false);
  }
  assert.equal(isGalleryArtwork({ medium: "Engraving", subjectTags: ["Prints"] }), true);
  assert.equal(isGalleryArtwork({ medium: "Oil painted terracotta", subjectTags: [] }), false);
  for (const medium of ["Four sliding-door panels; ink and color on paper", "Album of ten leaves; ink on silk", "Handscroll; ink and color on silk"]) {
    assert.equal(isGalleryArtwork({ medium, subjectTags: ["Paintings"] }), true);
  }
});

test("photographs, painted objects, architecture, bound books and uncertain material do not enter a painting exhibition", () => {
  for (const artwork of [
    { medium: "Wood, iron, resin, ceramic, plant fiber, textile, pigment", subjectTags: ["Wood-Sculpture"] },
    { medium: "Limestone", subjectTags: ["Sculpture-Architectural"] },
    { medium: "Oil painted terracotta", subjectTags: ["Sculpture"] },
    { medium: "Painted enamel, partly gilt, on copper.", subjectTags: ["Enamels"] },
    { medium: "Albumen silver print from glass negative", subjectTags: ["Prints"] },
    { medium: "Gelatin-coated salted paper print (vernis-cuir)", subjectTags: ["Photographs"] },
    { medium: "Tempera, gold, and ink on parchment; leather binding", subjectTags: ["Codices"] },
    { medium: "Porcelain", subjectTags: ["Ceramics-Porcelain"] },
    { medium: "Bronze", subjectTags: [] },
    { medium: "Wood", subjectTags: [] },
    { subjectTags: ["quiet", "serenity"] },
    { id: "met-37789", medium: "Opaque watercolor and gold on board", subjectTags: ["Paintings"] },
    { id: "met-902212", medium: "Hanging scroll; gold and malachite on paper", subjectTags: ["Paintings"] },
  ]) assert.equal(isGalleryArtwork(artwork), false, JSON.stringify(artwork));
  assert.equal(classifyArtworkEligibility({ medium: "Unknown", subjectTags: [] }), "unclassified");
});
