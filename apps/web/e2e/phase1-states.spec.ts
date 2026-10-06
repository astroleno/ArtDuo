import { expect, test } from "@playwright/test";

import { gotoApp } from "./helpers";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

test("landing page does not horizontally overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoApp(page, "/");

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBe(false);
});

test("gallery waits for explicit intent when no query is provided", async ({ page }) => {
  await gotoApp(page, "/gallery");

  await expect(page.getByRole("heading", { name: "先选择一个策展意图" })).toBeVisible();
  await expect(page.getByTestId("result-card")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "安静的月光" })).toBeVisible();
});

test("gallery shows an empty state for a query with no searchable terms", async ({ page }) => {
  await gotoApp(page, "/gallery?view=route&query=!!!");

  await expect(page.getByRole("heading", { name: "没有找到可展示作品" })).toBeVisible();
  await expect(page.getByTestId("result-card")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "清空输入" })).toBeVisible();
  await expect(page.getByRole("link", { name: /查看默认展览/ })).toBeVisible();
});

test("route preview uses matched scene backdrops and prioritizes the opening artwork", async ({ page }) => {
  await page.route("**/*", (route) => {
    if (route.request().resourceType() === "image") {
      return route.fulfill({
        body: ONE_PIXEL_PNG,
        contentType: "image/png",
        status: 200,
      });
    }

    return route.continue();
  });
  await gotoApp(page, "/gallery?view=route&query=I+want+a+quiet+moonlit+room");

  await expect(page.locator(".gallery-header.has-scene-backdrop")).toHaveCSS("background-image", /artduo-gallery/);
  await expect(page.getByTestId("gallery-route-stop")).toHaveCount(3);
});

test("background scene assets are served by the web app", async ({ page }) => {
  const response = await page.request.get("/artduo-gallery/bg-framed-classical-gallery-light-cream-014.png");

  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/png");
});

test("classic immersive artwork exposes its image fallback when loading fails", async ({ page }) => {
  await page.route("**/*", (route) => {
    if (route.request().resourceType() === "image") {
      return route.abort();
    }

    return route.continue();
  });
  await gotoApp(page, "/gallery/local/immersive?query=I+want+a+quiet+moonlit+room");

  await expect(page.getByText("画面稍后归位").first()).toBeVisible();
});

test("unknown artwork detail routes render the not-found state", async ({ page }) => {
  await gotoApp(page, "/artwork/not-a-real-artwork");

  await expect(page.getByRole("heading", { name: "作品未找到" })).toBeVisible();
  await expect(page.getByRole("link", { name: "返回 Gallery" })).toBeVisible();
});
