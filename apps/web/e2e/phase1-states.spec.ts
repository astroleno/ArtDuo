import { expect, test } from "@playwright/test";

test("gallery shows an empty state for a query with no searchable terms", async ({ page }) => {
  await page.goto("/gallery?query=!!!");

  await expect(page.getByRole("heading", { name: "没有找到可展示作品" })).toBeVisible();
  await expect(page.getByTestId("result-card")).toHaveCount(0);
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
  await expect(page.getByRole("button", { name: "Retry image" }).first()).toBeVisible();
});

test("unknown artwork detail routes render the not-found state", async ({ page }) => {
  await page.goto("/artwork/not-a-real-artwork");

  await expect(page.getByRole("heading", { name: "作品未找到" })).toBeVisible();
  await expect(page.getByRole("link", { name: "返回 Gallery" })).toBeVisible();
});
