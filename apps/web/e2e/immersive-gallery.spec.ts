import { expect, test } from "@playwright/test";

test("immersive gallery opens from gallery and preserves the release-backed exhibition", async ({ page }) => {
  await page.goto("/gallery?query=I+want+a+quiet+moonlit+room");

  await page.getByRole("link", { name: /沉浸观展/ }).click();

  await expect(page).toHaveURL(/\/gallery\/local\/immersive\?query=I\+want\+a\+quiet\+moonlit\+room/);
  await expect(page.getByRole("main")).toHaveClass(/immersive-shell/);
  await expect(page.getByRole("main")).toHaveCSS("background-image", /artduo-gallery/);
  await expect(page.getByRole("img")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Gallery" })).toBeVisible();
  await expect(page.getByLabel("Immersive gallery progress")).toBeVisible();
});

test("immersive gallery can move between scenes and preserve query state", async ({ page }) => {
  await page.goto("/gallery?query=I+want+a+quiet+moonlit+room");
  await page.getByRole("link", { name: /沉浸观展/ }).click();

  const firstTitle = await page.getByTestId("immersive-scene-title").textContent();
  await expect(page.getByRole("main")).toHaveClass(/immersive-transition-fade/);

  const secondSceneTarget = page.getByRole("link", { name: "Open scene 2" });
  const secondSceneBox = await secondSceneTarget.boundingBox();
  expect(secondSceneBox?.width).toBeGreaterThanOrEqual(44);
  expect(secondSceneBox?.height).toBeGreaterThanOrEqual(44);

  await page.getByRole("link", { name: "Next scene" }).click();

  await expect(page).toHaveURL(/query=I\+want\+a\+quiet\+moonlit\+room/);
  await expect(page).toHaveURL(/unit=met-/);
  await expect(page.getByRole("main")).toHaveClass(/immersive-transition-dissolve/);
  await expect(page.getByTestId("immersive-scene-title")).not.toHaveText(firstTitle ?? "");
  await expect(page.getByRole("link", { name: "Previous scene" })).toBeVisible();
});

test("artwork detail can enter immersive gallery at the current artwork", async ({ page }) => {
  await page.goto("/gallery?query=I+want+a+quiet+moonlit+room");
  await page.getByTestId("result-card").first().getByRole("link", { name: /打开详情/ }).click();
  const heading = await page.getByRole("heading", { level: 1 }).textContent();

  await page.getByRole("link", { name: /沉浸观展/ }).click();

  await expect(page).toHaveURL(/\/gallery\/local\/immersive/);
  await expect(page.getByRole("heading", { name: heading ?? "" })).toBeVisible();
});

test("immersive gallery mobile layout scrolls without clipping progress", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/gallery/local/immersive?query=I+want+a+quiet+moonlit+room");

  const shellOverflowY = await page.locator(".immersive-shell").evaluate((element) => getComputedStyle(element).overflowY);
  const footerPosition = await page.locator(".immersive-footer").evaluate((element) => getComputedStyle(element).position);
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

  expect(shellOverflowY).toBe("auto");
  expect(footerPosition).toBe("sticky");
  expect(hasHorizontalOverflow).toBe(false);
});
