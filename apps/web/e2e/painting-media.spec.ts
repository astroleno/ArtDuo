import { expect, test } from "@playwright/test";

test("bundled painting images are versioned, decodable, and available without museum requests", async ({ page, request }) => {
  const version = "2026-10-06-paintings";
  for (const variant of ["preview", "full"]) {
    const url = `/artduo-artwork/artic-16568?releaseVersion=${version}&variant=${variant}`;
    const response = await request.get(url);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/jpeg");
    expect(response.headers()["x-artduo-release-version"]).toBe(version);
    expect(response.headers()["cache-control"]).toContain("immutable");
    await page.goto(url);
    expect(await page.locator("img").evaluate(async (image: HTMLImageElement) => { await image.decode(); return image.naturalWidth; })).toBeGreaterThan(500);
  }
  expect((await request.get(`/artduo-artwork/artic-16568?releaseVersion=2026-04-25-curation-b`)).status()).toBe(404);
});
