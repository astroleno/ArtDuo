import { expect, test } from "@playwright/test";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

test("landing page does not horizontally overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBe(false);
});

test("gallery waits for explicit intent when no query is provided", async ({ page }) => {
  await page.goto("/gallery");

  await expect(page.getByRole("heading", { name: "先选择一个策展意图" })).toBeVisible();
  await expect(page.getByTestId("result-card")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "I want a quiet moonlit room" })).toBeVisible();
});

test("gallery shows an empty state for a query with no searchable terms", async ({ page }) => {
  await page.goto("/gallery?query=!!!");

  await expect(page.getByRole("heading", { name: "没有找到可展示作品" })).toBeVisible();
  await expect(page.getByTestId("result-card")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "清空输入" })).toBeVisible();
  await expect(page.getByRole("link", { name: /查看默认展览/ })).toBeVisible();
});

test("gallery uses matched scene backdrops and lazy-loads secondary artworks", async ({ page }) => {
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
  await page.goto("/gallery?query=I+want+a+quiet+moonlit+room");

  await expect(page.locator(".gallery-header")).toHaveCSS("background-image", /artduo-gallery/);
  await expect(page.getByText(/匹配度 \d+\.\d%/).first()).toBeVisible();
  await expect(page.getByTestId("result-card").first().locator("img")).toHaveAttribute("loading", "eager");
  await expect(page.getByTestId("result-card").nth(1).locator("img")).toHaveAttribute("loading", "lazy");
  await expect(page.getByTestId("result-card").nth(1).locator("img")).toHaveAttribute("decoding", "async");
});

test("background scene assets are served by the web app", async ({ page }) => {
  const response = await page.request.get("/artduo-gallery/bg-framed-classical-gallery-light-cream-014.png");

  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/png");
});

test("gallery cards fall back when artwork images fail to load", async ({ page }) => {
  await page.route("**/*", (route) => {
    if (route.request().resourceType() === "image") {
      return route.abort();
    }

    return route.continue();
  });
  await page.goto("/gallery?query=I+want+a+quiet+moonlit+room");

  await expect(page.getByTestId("image-fallback").first()).toBeVisible();
  await expect(page.getByRole("img", { name: /图像暂不可用/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "重试图像" }).first()).toBeVisible();
});

test("unknown artwork detail routes render the not-found state", async ({ page }) => {
  await page.goto("/artwork/not-a-real-artwork");

  await expect(page.getByRole("heading", { name: "作品未找到" })).toBeVisible();
  await expect(page.getByRole("link", { name: "返回 Gallery" })).toBeVisible();
});
