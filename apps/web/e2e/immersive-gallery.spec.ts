import { expect, test } from "@playwright/test";

import { gotoApp } from "./helpers";

test("immersive gallery opens from gallery and preserves the release-backed exhibition", async ({ page }) => {
  await gotoApp(page, "/gallery?query=I+want+a+quiet+moonlit+room&view=route");

  await page.getByRole("link", { name: "进入这场观展" }).click();

  await expect(page).toHaveURL(/\/gallery\/local\/immersive\?query=I\+want\+a\+quiet\+moonlit\+room/);
  await expect(page.getByRole("main")).toHaveClass(/immersive-shell/);
  await expect(page.getByRole("main")).toHaveCSS("background-image", /artduo-gallery/);
  await expect(page.getByRole("img")).toBeVisible();
  await expect(page.locator(".immersive-atmosphere")).toBeVisible();
  await expect(page.getByTestId("immersive-preface")).toBeVisible();
  await expect(page.getByRole("link", { name: "换一句愿望" })).toBeVisible();
  await expect(page.getByLabel(/观展进度/)).toBeVisible();
});

test("immersive gallery can move between scenes and preserve query state", async ({ page }) => {
  await gotoApp(page, "/gallery?query=I+want+a+quiet+moonlit+room&view=route");
  await page.getByRole("link", { name: "进入这场观展" }).click();

  const firstTitle = await page.getByTestId("immersive-scene-title").textContent();
  await expect(page.getByRole("main")).toHaveClass(/immersive-transition-fade/);

  const secondSceneTarget = page.getByRole("button", { name: /跳到第 2 幅/ });
  const secondSceneBox = await secondSceneTarget.boundingBox();
  expect(secondSceneBox?.width).toBeGreaterThanOrEqual(44);
  expect(secondSceneBox?.height).toBeGreaterThanOrEqual(44);

  await page.getByRole("button", { name: "下一幅" }).click();

  await expect(page).toHaveURL(/query=I\+want\+a\+quiet\+moonlit\+room/);
  await expect(page).toHaveURL(/unit=met-/);
  await expect(page.getByRole("main")).toHaveClass(/immersive-transition-dissolve/);
  await expect(page.getByTestId("immersive-scene-title")).not.toHaveText(firstTitle ?? "");
  await expect(page.getByRole("button", { name: "上一幅" })).toBeVisible();
});

test("artwork detail can enter immersive gallery at the current artwork", async ({ page }) => {
  await gotoApp(page, "/artwork/met-247010?query=I+want+a+quiet+moonlit+room&backgroundSceneId=bg-001&retrievalScore=0.5&matchedTokens=quiet");
  const heading = await page.getByRole("heading", { level: 1 }).textContent();

  await page.getByRole("link", { name: /沉浸观展/ }).click();

  await expect(page).toHaveURL(/\/gallery\/local\/immersive/);
  await expect(page).toHaveURL(/unit=met-247010/);
  await expect(page.getByRole("button", { name: `打开《${heading ?? ""}》大图` })).toBeVisible();
});

test("immersive gallery mobile layout scrolls without clipping progress", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoApp(page, "/gallery/local/immersive?query=I+want+a+quiet+moonlit+room");

  const shellOverflowY = await page.locator(".immersive-shell").evaluate((element) => getComputedStyle(element).overflowY);
  const footerPosition = await page.locator(".immersive-footer").evaluate((element) => getComputedStyle(element).position);
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

  expect(shellOverflowY).toBe("auto");
  expect(footerPosition).toBe("sticky");
  expect(hasHorizontalOverflow).toBe(false);
});
