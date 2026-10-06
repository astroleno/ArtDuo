import { expect, test } from "@playwright/test";

const fixtureUrl = `/e2e-experience?${new URLSearchParams({ query: "有点累，撑了很久", releaseVersion: "2026-04-25-curation-b", artworkId: "met-662131", recipeVersion: "experience-v1", phase: "walk" })}`;

test("streamed preparation stays escapable at ten and twenty seconds and recovers on retry", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "experience-test-delay", value: "30000", url: baseURL! }]);
  await page.goto(fixtureUrl, { waitUntil: "commit" });
  await expect(page.getByRole("heading", { name: "正在为你准备展厅" })).toBeVisible();
  await expect(page.getByRole("link", { name: "返回修改愿望" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("准备时间较长", { timeout: 15_000 });
  await expect(page.getByRole("link", { name: "重试准备" })).toBeVisible({ timeout: 15_000 });
  await context.clearCookies();
  await page.getByRole("link", { name: "重试准备" }).click();
  await expect(page.getByTestId("experience-room")).toBeVisible();
  // The image proxy allows 12s for its upstream headers; this assertion checks
  // recovery rather than the separate production performance budget.
  await expect(page.locator(".experience-art-lightbox")).toHaveAttribute("data-image-state", "ready", { timeout: 20_000 });
});

test("a server preparation error exposes the real route boundary and can retry", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "experience-test-fail", value: "1", url: baseURL! }]);
  await page.goto(fixtureUrl, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "这次观展可以重新尝试" })).toBeVisible();
  await expect(page.getByRole("link", { name: "返回画廊" })).toBeVisible();
  await context.clearCookies();
  await page.getByRole("button", { name: "重新载入" }).click();
  await expect(page.getByTestId("experience-room")).toBeVisible();
});

test("valid depth renders, a lost context leaves a usable static artwork, and bad depth falls back", async ({ page }) => {
  await page.goto(`${fixtureUrl}&depth=valid`);
  const canvas = page.locator(".experience-depth-canvas");
  await expect(canvas).toHaveAttribute("data-depth-state", "ready");
  const loseSupported = await canvas.evaluate((element) => {
    const gl = (element as HTMLCanvasElement).getContext("webgl");
    const extension = gl?.getExtension("WEBGL_lose_context");
    extension?.loseContext();
    return Boolean(extension);
  });
  expect(loseSupported).toBe(true);
  await expect(canvas).toHaveAttribute("data-depth-state", "static");
  await expect(page.locator(".experience-art-lightbox")).toHaveAttribute("data-image-state", "ready");
  await page.getByRole("button", { name: "下一件作品" }).click();
  await expect(page.locator(".experience-room-meta span").last()).toHaveText("02 / 12");
  await expect(page.locator(".experience-depth-canvas")).toHaveAttribute("data-depth-state", "ready");
  await page.goto(`${fixtureUrl}&depth=invalid`);
  await expect(page.locator(".experience-depth-canvas")).toHaveAttribute("data-depth-state", "static", { timeout: 20_000 });
  await expect(page.locator(".experience-art-lightbox")).toHaveAttribute("data-image-state", "ready");
});

test("the experience renderer handles unsupported WebGL without hiding its static image", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type.startsWith("webgl") || type === "experimental-webgl") return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.goto(`${fixtureUrl}&depth=valid`);
  await expect(page.locator(".experience-depth-canvas")).toHaveAttribute("data-depth-state", "static");
  await expect(page.locator(".experience-art-lightbox")).toHaveAttribute("data-image-state", "ready");
  await page.getByRole("button", { name: /放大.+并进入沉浸体验/ }).click();
  await expect(page.getByRole("dialog")).toHaveAttribute("data-depth-status", "static");
});
