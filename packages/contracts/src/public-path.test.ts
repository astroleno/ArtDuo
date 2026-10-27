import test from "node:test";
import assert from "node:assert/strict";
import { appPath, normalizeAppBasePath, stripAppBasePath } from "./public-path";

test("subpath URLs preserve query, fragments, case and existing prefixes", () => {
  for (const path of ["/", "/?view=experience", "/gallery?query=%E9%BA%A6%E7%94%B0#work", "/api/handwriting/jobs/x", "/artduo-artwork/met-11145", "/ambient-audio/First%20Words.mp3"]) {
    const publicUrl = appPath(path, "/ArtDuo");
    assert.ok(publicUrl.startsWith("/ArtDuo"));
    assert.equal(stripAppBasePath(publicUrl, "/ArtDuo"), path);
    assert.equal(appPath(publicUrl, "/ArtDuo"), publicUrl);
  }
  assert.equal(appPath("/ArtDuo-old/gallery", "/ArtDuo"), "/ArtDuo/ArtDuo-old/gallery");
  assert.equal(stripAppBasePath("/ArtDuo-old/gallery", "/ArtDuo"), "/ArtDuo-old/gallery");
});

test("external media and root deployments remain unchanged; malformed configuration fails", () => {
  for (const path of ["https://museum.example/work", "//museum.example/work", "blob:https://tongye.me/x", "data:image/png;base64,x", "#credits", "relative.webp"]) assert.equal(appPath(path, "/ArtDuo"), path);
  assert.equal(appPath("/gallery?view=route", ""), "/gallery?view=route");
  assert.equal(normalizeAppBasePath("/ArtDuo/"), "/ArtDuo");
  for (const path of ["ArtDuo", "//ArtDuo", "/../ArtDuo", "/ArtDuo?x", "/%41rtDuo", "https://tongye.me/ArtDuo"]) assert.throws(() => normalizeAppBasePath(path));
});
