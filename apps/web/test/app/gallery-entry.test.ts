import assert from "node:assert/strict";
import test from "node:test";
import GalleryPage from "../../app/gallery/page";

test("empty legacy gallery links return to the current entry without curating another exhibition", async () => {
  for (const params of [{}, { view: "route" }, { view: "route", query: "  " }]) {
    await assert.rejects(GalleryPage({ searchParams: Promise.resolve(params) }), error => {
      const digest = (error as Error & { digest?: string }).digest;
      return Boolean(digest?.startsWith("NEXT_REDIRECT;") && digest.includes(";/?view=experience;"));
    });
  }
});
