import { mkdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import { gotoApp } from "./helpers";

const evidenceDir = resolve(process.cwd(), "../../docs/assets/experience-integration-acceptance");

test("entry opens artwork directly, with optional notes, detail, closing, revisit, restart and share", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  mkdirSync(evidenceDir, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoApp(page, "/?view=experience");
  await expect(page).toHaveTitle(/ArtDuo/);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: resolve(evidenceDir, "entry-1440.png"), fullPage: true });

  const queryInput = page.getByLabel("写下一句此刻的心情或观看愿望");
  await queryInput.fill("有点累，撑了很久");
  await expect(queryInput).toHaveValue("有点累，撑了很久");
  await page.getByRole("button", { name: "开始观展" }).click();
  await expect(page).toHaveURL(/\/gallery\/local\/immersive\?.*view=experience/, { timeout: 20_000 });
  await expect(page.locator(".experience-preface")).toHaveCount(0);

  await expect(page.getByTestId("experience-room")).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/phase=walk.*artworkId=(?:met|artic)-/);
  const firstArtworkId = new URL(page.url()).searchParams.get("artworkId");
  // A cold Next dev server compiles the image proxy on first use; production
  // timing is checked separately by measure-experience-performance.mjs.
  await expect(page.locator(".experience-art-lightbox")).toHaveAttribute("data-image-state", "ready", { timeout: 20_000 });
  await expect.poll(() => page.evaluate(() => performance.getEntriesByName("artduo.experience.first-artwork-actionable").length), { timeout: 20_000 }).toBe(1);
  await page.mouse.move(12, 880);
  await page.screenshot({ path: resolve(evidenceDir, "walk-1440.png"), fullPage: true });
  await expect(page.getByRole("navigation", { name: "展览情绪阶段" })).toBeHidden();
  await page.getByText("本次展览", { exact: true }).click();
  await expect(page.locator(".experience-route-panel")).toBeVisible();
  await expect(page.locator(".experience-route-panel")).toContainText("12 件作品");
  await page.keyboard.press("Escape");
  await expect(page.locator(".experience-route-panel")).toBeHidden();
  await page.getByRole("button", { name: "展开完整展签" }).click();
  await expect(page.getByRole("button", { name: "进入详细讲解" })).toBeVisible();
  await page.getByRole("button", { name: "进入详细讲解" }).click();

  await expect(page).toHaveURL(/\/artwork\/(?:met|artic)-/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "返回刚才的位置" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("experience-room")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`phase=walk.*artworkId=${firstArtworkId}`));
  await expect(page.locator(".experience-walk")).not.toHaveClass(/is-transitioning/);

  for (let index = 1; index < 12; index += 1) {
    await page.getByRole("button", { name: "下一件作品" }).click();
    await expect(page.locator(".experience-room-meta span").last()).toHaveText(`${String(index + 1).padStart(2, "0")} / 12`);
    await expect(page.getByTestId("experience-room")).toHaveAttribute("data-display-mode", "wall-painting");
  }
  await expect(page.locator(".experience-room-meta span").last()).toHaveText("12 / 12");
  const lastArtworkId = new URL(page.url()).searchParams.get("artworkId");
  await page.getByRole("button", { name: "进入结语" }).click();
  await expect(page.locator(".experience-closing")).toBeVisible();
  await expect(page).toHaveURL(/phase=closing.*artworkId=(?:met|artic)-/);
  const closingText = await page.locator(".experience-closing h1 .sr-only").textContent();
  await expect(page.locator('.experience-closing h1 span[aria-hidden="true"]')).toHaveText(closingText ?? "", { timeout: 30_000 });
  await expect(page.locator(".experience-closing-image")).toHaveAttribute("data-image-state", "ready", { timeout: 20_000 });
  await page.screenshot({ path: resolve(evidenceDir, "closing-1440.png"), fullPage: true });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "保存分享图" }).click();
  const download = await downloadPromise;
  const shareCardPath = resolve(evidenceDir, "share-card.png");
  await download.saveAs(shareCardPath);
  expect(statSync(shareCardPath).size).toBeGreaterThan(5_000);

  await page.getByRole("button", { name: "回看最后一件" }).click();
  await expect(page.getByTestId("experience-room")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`phase=walk.*artworkId=${lastArtworkId}`));
  await page.getByRole("button", { name: "进入结语" }).click();
  await expect(page.locator(".experience-closing")).toBeVisible();
  await page.getByRole("button", { name: "重新选一组" }).click();
  await expect(page).toHaveURL(/\/?view=experience.*query=/);
  await expect(page.getByLabel("写下一句此刻的心情或观看愿望")).toHaveValue("有点累，撑了很久");
  expect(errors).toEqual([]);
});

test("phone entry stays readable and a suggested topic opens the first artwork in one click", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await gotoApp(page, "/?view=experience");
  await expect(page.getByRole("heading", { name: "想看些什么？" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  const field = await page.getByLabel("写下一句此刻的心情或观看愿望").boundingBox();
  const submit = await page.getByRole("button", { name: "开始观展" }).boundingBox();
  expect(field!.y + field!.height).toBeLessThan(submit!.y);
  await page.screenshot({ path: resolve(evidenceDir, "entry-320.png"), fullPage: true });
  await page.getByRole("button", { name: "安静的月光" }).click();
  await expect(page.getByTestId("experience-room")).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/phase=walk/);
  await expect(page.locator(".experience-preface")).toHaveCount(0);
  await expect(page.locator(".experience-art-lightbox")).toHaveAttribute("data-image-state", "ready");
  await expect.poll(() => page.evaluate(() => performance.getEntriesByName("artduo.experience.first-artwork-actionable").length)).toBe(1);
  await page.screenshot({ path: resolve(evidenceDir, "walk-320-compact.png"), fullPage: true });
  await page.getByText("本次展览", { exact: true }).click();
  const panel = await page.locator(".experience-route-panel").boundingBox();
  expect(panel!.x).toBeGreaterThanOrEqual(0);
  expect(panel!.x + panel!.width).toBeLessThanOrEqual(320);
});
