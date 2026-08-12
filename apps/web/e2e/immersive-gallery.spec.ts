import { expect, test } from "@playwright/test";

import { gotoApp } from "./helpers";

const FULL_HARD_FILTER_QUERY = "不要太明亮，想要暗红和深木色，像睡前，但不要悲伤";
const FROZEN_RELEASE_VERSION = "2026-04-25-curation-b";
const INDEPENDENT_FORBIDDEN_ARTWORK_IDS = new Set([
  "met-10790", "met-10821", "met-197459", "met-207121", "met-241205", "met-246311", "met-247487",
  "met-248160", "met-248420", "met-248601", "met-248609", "met-251395", "met-253483", "met-282190",
  "met-336228", "met-337542", "met-35994", "met-372886", "met-376264", "met-37789", "met-38012",
  "met-382737", "met-382741", "met-383409", "met-391598", "met-392595", "met-39328", "met-396220",
  "met-400260", "met-42562", "met-435713", "met-436141", "met-436267", "met-436504", "met-436603",
  "met-436615", "met-436616", "met-436622", "met-436679", "met-437097", "met-437748", "met-437749",
  "met-437812", "met-437900", "met-437903", "met-438120", "met-438156", "met-446183", "met-44858",
  "met-451023", "met-451728", "met-459024", "met-459376", "met-468697", "met-471869", "met-472301",
  "met-477499", "met-50897", "met-643364", "met-662131", "met-729602", "met-729663", "met-73646",
  "met-737764", "met-74100", "met-742689", "met-828433", "met-829412", "met-902212", "met-923689",
]);

test("immersive gallery opens from gallery and preserves the release-backed exhibition", async ({ page }) => {
  await gotoApp(page, "/gallery?query=I+want+a+quiet+moonlit+room&view=route");
  await expect(page.getByText(`馆藏 ${FROZEN_RELEASE_VERSION}`)).toBeVisible();

  await page.getByRole("link", { name: "进入这场观展" }).click();

  await expect(page).toHaveURL(/\/gallery\/local\/immersive\?query=I\+want\+a\+quiet\+moonlit\+room/);
  await expect(page.getByRole("main")).toHaveClass(/immersive-shell/);
  await expect(page.getByRole("main")).toHaveCSS("background-image", /artduo-gallery/);
  await expect(page.getByRole("img")).toBeVisible();
  await expect(page.locator(".immersive-atmosphere")).toBeVisible();
  await expect(page.getByTestId("immersive-preface")).toBeVisible();
  await expect(page.getByRole("link", { name: "换一句愿望" })).toBeVisible();
  await expect(page.getByLabel(/观展进度/)).toBeVisible();

  await gotoApp(page, `/gallery/local/immersive?${new URLSearchParams({ query: FULL_HARD_FILTER_QUERY })}`);
  await expect(page.getByLabel(/观展进度，第 1 幅，共 12 幅/)).toBeVisible();
  for (let index = 1; index <= 12; index += 1) {
    if (index > 1) {
      await page.getByRole("button", { name: `跳到第 ${index} 幅，共 12 幅` }).click();
    }
    const detailHref = await page.getByRole("link", { name: /查看《.*》详情/ }).getAttribute("href");
    const artworkId = detailHref?.match(/^\/artwork\/(met-[^?]+)/)?.[1];

    expect(artworkId, `scene ${index} should expose a release artwork detail link`).toBeTruthy();
    expect(
      INDEPENDENT_FORBIDDEN_ARTWORK_IDS.has(artworkId ?? ""),
      `scene ${index} must not expose forbidden artwork ${artworkId}`,
    ).toBe(false);
  }
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
