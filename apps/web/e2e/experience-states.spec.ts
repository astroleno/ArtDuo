import { expect, test } from "@playwright/test";

import { gotoApp } from "./helpers";

const query = "有点累，撑了很久";
const experienceUrl = `/gallery/local/immersive?${new URLSearchParams({ query, view: "experience", recipeVersion: "experience-v1", phase: "preface" })}`;

test("empty results, unsupported releases and recipes have visible recovery paths", async ({ page }) => {
  await gotoApp(page, `/gallery/local/immersive?${new URLSearchParams({ query: "!!!", view: "experience", recipeVersion: "experience-v1", phase: "preface" })}`);
  await expect(page.getByTestId("experience-empty")).toBeVisible();
  await expect(page.getByRole("link", { name: "查看经典路线" })).toBeVisible();

  await gotoApp(page, `/gallery/local/immersive?${new URLSearchParams({ query, view: "experience", releaseVersion: "release-does-not-exist", recipeVersion: "experience-v1", phase: "preface" })}`);
  await expect(page.getByRole("heading", { name: "这个馆藏版本暂时无法打开" })).toBeVisible();
  await expect(page.getByRole("link", { name: "重新策展" })).toBeVisible();

  await gotoApp(page, `/gallery/local/immersive?${new URLSearchParams({ query, view: "experience", recipeVersion: "future-recipe", phase: "preface" })}`);
  await expect(page.getByRole("heading", { name: "此体验版本暂不可用" })).toBeVisible();
});

test("failed artwork media keeps the plaque and offers retry and navigation", async ({ page }) => {
  await page.route("**/artduo-artwork/**", (route) => route.fulfill({ status: 503, body: "test media unavailable" }));
  await gotoApp(page, experienceUrl);
  await page.getByRole("button", { name: /跳过前言/ }).click();

  await expect(page.getByRole("status")).toContainText("这件作品暂时无法载入");
  expect(await page.evaluate(() => performance.getEntriesByName("artduo.experience.first-artwork-visible").length)).toBe(0);
  expect(await page.evaluate(() => performance.getEntriesByName("artduo.experience.first-artwork-actionable").length)).toBe(0);
  await expect(page.getByRole("button", { name: "展开完整展签" })).toBeVisible();
  await expect(page.getByRole("button", { name: "下一件作品" })).toBeEnabled();
  await page.getByRole("button", { name: "重试载入" }).click();
  await expect(page.getByRole("status")).toContainText("这件作品暂时无法载入");
  await page.unroute("**/artduo-artwork/**");
  await page.getByRole("button", { name: "重试载入" }).click();
  await expect(page.locator(".experience-art-lightbox")).toHaveAttribute("data-image-state", "ready");
  await expect.poll(() => page.evaluate(() => performance.getEntriesByName("artduo.experience.first-artwork-visible").length)).toBe(1);
  await page.getByRole("button", { name: "下一件作品" }).click();
  await expect(page.getByTestId("experience-room")).toBeVisible();
});

test("first artwork milestones wait for a decoded visible image instead of the walk shell", async ({ page }) => {
  let releaseImage!: () => void;
  const imageGate = new Promise<void>((resolve) => { releaseImage = resolve; });
  await page.route("**/artduo-artwork/**", async (route) => { await imageGate; await route.continue(); });
  await page.goto(experienceUrl, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /跳过前言/ }).click();
  await expect(page.getByTestId("experience-room")).toBeVisible();
  await expect(page.locator(".experience-art-lightbox")).toHaveAttribute("data-image-state", "loading");
  expect(await page.evaluate(() => performance.getEntriesByName("artduo.experience.first-artwork-visible").length)).toBe(0);
  expect(await page.evaluate(() => performance.getEntriesByName("artduo.experience.first-artwork-actionable").length)).toBe(0);
  const releasedAt = await page.evaluate(() => performance.now());
  releaseImage();
  await expect(page.locator(".experience-art-lightbox")).toHaveAttribute("data-image-state", "ready");
  await expect.poll(() => page.evaluate(() => performance.getEntriesByName("artduo.experience.first-artwork-actionable").length)).toBe(1);
  const marks = await page.evaluate(() => ["visible", "actionable"].map((phase) => performance.getEntriesByName(`artduo.experience.first-artwork-${phase}`)[0]!.startTime));
  expect(marks[0]).toBeGreaterThan(releasedAt);
  expect(marks[1]).toBeGreaterThanOrEqual(marks[0]!);
  await page.getByRole("button", { name: "下一件作品" }).click();
  await expect(page.locator(".experience-room-meta span").last()).toHaveText("02 / 12");
  expect(await page.evaluate(() => performance.getEntriesByName("artduo.experience.first-artwork-visible").length)).toBe(1);
});

test("missing depth maps keep the artwork static and fully usable", async ({ page }) => {
  await gotoApp(page, experienceUrl);
  await page.getByRole("button", { name: /跳过前言/ }).click();

  await expect(page.getByTestId("experience-room")).toBeVisible();
  await expect(page.locator(".experience-depth-canvas")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /放大.+并进入沉浸体验/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "下一件作品" })).toBeEnabled();
});

test("rapid navigation queues one final step and does not lock the room", async ({ page }) => {
  await gotoApp(page, experienceUrl);
  await page.getByRole("button", { name: /跳过前言/ }).click();

  const nextButton = page.getByRole("button", { name: "下一件作品" });
  await expect(nextButton).toBeEnabled();
  await nextButton.evaluate((element) => {
    for (let index = 0; index < 5; index += 1) {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  });

  await expect(page.locator(".experience-room-meta span").last()).toHaveText("03 / 12", { timeout: 5_000 });
  await expect(page.locator(".experience-walk")).not.toHaveClass(/is-transitioning/);
  await expect(page.getByRole("button", { name: "下一件作品" })).toBeEnabled();
});

test("a failed room background uses the neutral wall while the artwork remains available", async ({ page }) => {
  await page.route("**/artduo-gallery/**", (route) => route.fulfill({ status: 503, body: "test background unavailable" }));
  await gotoApp(page, experienceUrl);
  await page.getByRole("button", { name: /跳过前言/ }).click();

  await expect(page.getByTestId("experience-room")).toBeVisible();
  await expect(page.locator(".experience-room-fallback")).toBeVisible();
  await expect(page.locator("img.experience-room-backdrop")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /放大.+并进入沉浸体验/ })).toBeVisible();
});

test("an offline transition preserves the already prepared exhibition", async ({ page, context }) => {
  await gotoApp(page, experienceUrl);
  await page.getByRole("button", { name: /跳过前言/ }).click();
  await context.setOffline(true);
  await expect(page.getByRole("status")).toContainText("离线浏览");
  await page.getByRole("button", { name: "下一件作品" }).click();
  await expect(page.getByTestId("experience-room")).toBeVisible();
  await expect(page.locator(".experience-room-meta span").last()).toHaveText("02 / 12");
  await context.setOffline(false);
  await expect(page.locator(".sr-only").filter({ hasText: "网络已恢复" })).toBeVisible();
});

test("detail content remains usable while a slow explanation fails and can be retried", async ({ page }) => {
  let requestCount = 0;
  await page.route("**/api/artworks/*/explanation", async (route) => {
    requestCount += 1;
    if (requestCount === 1) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "temporarily unavailable" }) });
      return;
    }
    await route.continue();
  });

  await gotoApp(page, experienceUrl);
  await page.getByRole("button", { name: /跳过前言/ }).click();
  await page.getByRole("button", { name: "展开完整展签" }).click();
  await page.getByRole("button", { name: "进入详细讲解" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "生成这件作品的讲解" }).click();
  await expect(page.getByTestId("explanation-slot")).toContainText("正在整理作品线索");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "重试讲解" })).toBeVisible();
  await page.getByRole("button", { name: "重试讲解" }).click();
  await expect(page.getByTestId("explanation-slot")).toContainText("is explained from the release-grounded artwork metadata");
});

test("unsupported WebGL degrades the classic detail overlay to its static image", async ({ page }) => {
  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext as (this: HTMLCanvasElement, type: string, ...args: unknown[]) => RenderingContext | null;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") return null;
      return originalGetContext.apply(this, [type, ...args]);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await gotoApp(page, `/gallery/local/immersive?${new URLSearchParams({ query, view: "classic" })}`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /放大.+并进入沉浸体验/ }).click();
  const detail = page.getByRole("dialog", { name: /沉浸观看/ });
  await expect(detail).toBeVisible();
  await expect(detail).toHaveAttribute("data-depth-status", "static");
  await expect(detail.locator("img.immersive-detail-fallback")).toBeVisible();
});
