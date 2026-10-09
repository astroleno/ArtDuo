import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import { gotoApp } from "./helpers";

const evidenceDir = resolve(process.cwd(), "../../docs/assets/experience-integration-acceptance");
const directWalkUrl = "/gallery/local/immersive?" + new URLSearchParams({
  query: "有点累，撑了很久",
  view: "experience",
  recipeVersion: "experience-v1",
  phase: "walk",
});

test("experience room stays in bounds at 320, 390, 844 landscape and desktop widths", async ({ page }) => {
  test.setTimeout(60_000);
  mkdirSync(evidenceDir, { recursive: true });
  const cases = [
    { width: 320, height: 568, screenshot: "walk-320.png" as string | undefined },
    { width: 390, height: 844, screenshot: "walk-390.png" as string | undefined },
    { width: 844, height: 390, screenshot: undefined as string | undefined },
    { width: 1440, height: 900, screenshot: undefined as string | undefined },
  ] as const;

  await gotoApp(page, directWalkUrl);
  await expect(page.locator(".experience-art-lightbox")).toHaveAttribute("data-image-state", "ready");
  await expect.poll(() => page.evaluate(() => performance.getEntriesByName("artduo.experience.first-artwork-actionable").length)).toBe(1);
  for (const viewport of cases) {
    const previousStyle = await page.locator(".experience-plaque-position").getAttribute("style");
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await expect.poll(async () => page.locator(".experience-plaque-position").getAttribute("style"), { timeout: 5_000 }).not.toBe(previousStyle);
    await expect(page.getByTestId("experience-room")).toBeVisible();
    const bounds = await page.locator(".experience-plaque-position").boundingBox();
    const navBounds = await page.locator(".experience-walk-controls").boundingBox();
    const brandBounds = await page.locator(".experience-mark").boundingBox();
    const metaBounds = await page.locator(".experience-room-meta").boundingBox();
    const frameBounds = await page.locator(".experience-frame-shadow").boundingBox();
    const imageBounds = await page.locator(".experience-art-lightbox .immersive-preview-image").boundingBox();
    expect(bounds).not.toBeNull();
    expect(navBounds).not.toBeNull();
    expect(brandBounds).not.toBeNull();
    expect(metaBounds).not.toBeNull();
    expect(imageBounds).not.toBeNull();
    expect(imageBounds!.x).toBeGreaterThanOrEqual(frameBounds!.x);
    expect(imageBounds!.y).toBeGreaterThanOrEqual(frameBounds!.y);
    expect(imageBounds!.x + imageBounds!.width).toBeLessThanOrEqual(frameBounds!.x + frameBounds!.width + 1);
    expect(imageBounds!.y + imageBounds!.height).toBeLessThanOrEqual(frameBounds!.y + frameBounds!.height + 1);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(navBounds!.y - 8);
    expect(brandBounds!.x + brandBounds!.width).toBeLessThanOrEqual(metaBounds!.x - 4);
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await page.getByRole("button", { name: "展开完整展签" }).click();
    const reading = page.getByRole("dialog", { name: /Water Lilies/ });
    await expect(reading).toBeVisible();
    const readingBounds = await reading.boundingBox();
    expect(readingBounds!.x).toBeGreaterThanOrEqual(0);
    expect(readingBounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(readingBounds!.height).toBeLessThanOrEqual(viewport.height);
    await expect(reading).toContainText("媒材");
    const plaqueCanReachEnd = await page.locator(".experience-reading-body").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      return element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
    });
    expect(plaqueCanReachEnd).toBe(true);
    await page.locator(".experience-reading-body").evaluate((element) => { element.scrollTop = 0; });
    expect(Number.parseFloat(await page.locator(".experience-caption").evaluate((element) => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    expect(Number.parseFloat(await page.locator(".experience-plaque-detail dd").first().evaluate((element) => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(14);
    const navigationButton = await page.locator(".experience-walk-controls button").first().boundingBox();
    expect(navigationButton).not.toBeNull();
    expect(navigationButton!.width).toBeGreaterThanOrEqual(44);
    expect(navigationButton!.height).toBeGreaterThanOrEqual(44);
    if (viewport.screenshot) {
      await page.screenshot({ path: resolve(evidenceDir, `reading-${viewport.width}.png`), fullPage: true });
    }
    await page.keyboard.press("Escape");
    await expect(reading).toBeHidden();
    await expect(page.getByRole("button", { name: "展开完整展签" })).toBeFocused();
    expect(await page.locator(".experience-frame-shadow").boundingBox()).toEqual(frameBounds);
    if (viewport.screenshot) await page.screenshot({ path: resolve(evidenceDir, viewport.screenshot), fullPage: true });
  }
});

test("walk supports keyboard navigation, reduced motion and focus restoration from the detail overlay", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoApp(page, directWalkUrl);
  await expect(page.getByTestId("experience-room")).toHaveClass(/is-reduced-motion/);
  await expect(page.locator(".experience-depth-canvas")).toHaveCount(0);

  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".experience-room-meta span").last()).toHaveText("02 / 12");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".experience-room-meta span").last()).toHaveText("01 / 12");

  const trigger = page.getByRole("button", { name: /放大.+并进入沉浸体验/ });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const detail = page.getByRole("dialog", { name: /沉浸观看/ });
  await expect(detail).toBeVisible();
  const expandedUrl = page.url();
  for (const key of ["ArrowRight", "ArrowLeft", "ArrowRight"]) {
    await page.keyboard.press(key);
    await expect(detail).toBeVisible();
    await expect(page.locator(".experience-room-meta span").last()).toHaveText("01 / 12");
    expect(page.url()).toBe(expandedUrl);
  }
  await page.keyboard.press("Tab");
  expect(await detail.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(detail).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".experience-room-meta span").last()).toHaveText("02 / 12");
});
