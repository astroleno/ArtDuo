import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

test("default entrance keeps its dark layout and classic curation retains identity and real depth", async ({ page }) => {
  test.setTimeout(120_000);
  const evidence = process.env.ARTDUO_EVIDENCE_DIR ?? "/tmp/artduo-semantic-experience";
  mkdirSync(evidence, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page).toHaveTitle(/ArtDuo/);
    await expect(page.locator(".home-shell")).toBeVisible();
    await expect(page.getByLabel("策展意图")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    await page.screenshot({ path: resolve(evidence, `classic-entry-${viewport.width}.png`), fullPage: true });
  }
  await page.getByLabel("策展意图").fill("有点累，撑了很久");
  await page.getByRole("button", { name: "生成观展路线" }).click();
  await expect(page.locator(".immersive-shell")).toBeVisible({ timeout: 45_000 });
  const id = new URL(page.url()).searchParams.get("curationId");
  expect(id).toMatch(/^[a-f0-9]{64}$/);
  const title = await page.getByTestId("immersive-scene-title").innerText();
  await page.reload();
  await expect(page.getByTestId("immersive-scene-title")).toHaveText(title);
  expect(new URL(page.url()).searchParams.get("curationId")).toBe(id);
  await page.getByRole("button", { name: /放大.+并进入沉浸体验/ }).click();
  await expect(page.getByRole("dialog", { name: /沉浸观看/ })).toHaveAttribute("data-depth-status", "ready", { timeout: 20_000 });
  await page.screenshot({ path: resolve(evidence, "classic-depth-390.png") });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: /沉浸观看/ })).toBeHidden();
  await page.getByRole("button", { name: "下一幅", exact: true }).click();
  await expect(page.getByTestId("immersive-scene-title")).not.toHaveText(title);
  expect(new URL(page.url()).searchParams.get("curationId")).toBe(id);
  expect(errors).toEqual([]);
});
