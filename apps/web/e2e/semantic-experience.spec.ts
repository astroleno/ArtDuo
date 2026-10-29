import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const evidenceDir = resolve(process.env.ARTDUO_EVIDENCE_DIR ?? "/tmp/artduo-semantic-experience");
const entry = `/gallery/local/immersive?${new URLSearchParams({ query: "有点累，撑了很久", view: "experience", recipeVersion: "experience-v2", releaseVersion: "2026-10-15-experience", phase: "walk" })}`;

test("semantic exhibition keeps its identity, quiets pointer chrome and protects keyboard reading", async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  mkdirSync(evidenceDir, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(entry, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("experience-room")).toBeVisible({ timeout: 45_000 });
  await expect(page.locator(".experience-art-lightbox")).toHaveAttribute("data-image-state", "ready", { timeout: 20_000 });
  await expect(page.locator(".experience-depth-canvas")).toHaveAttribute("data-depth-state", "ready", { timeout: 20_000 });
  await expect(page.getByTestId("experience-room")).toHaveAttribute("data-scene-state", "ready", { timeout: 20_000 });
  const id = new URL(page.url()).searchParams.get("curationId");
  expect(id).toMatch(/^[a-f0-9]{64}$/);
  await expect(page.locator(".experience-curator-note")).toHaveCount(0);
  await page.mouse.move(15, 200);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("navigation", { name: "展览阶段概览" })).toHaveCount(0);
  await page.screenshot({ path: resolve(evidenceDir, "semantic-room-1440.png") });
  await page.mouse.click(15, 200);
  await expect(page.getByTestId("experience-shell")).toHaveAttribute("data-chrome-visible", "false", { timeout: 6_000 });
  await expect(page.locator(".experience-room-header")).toHaveCSS("opacity", "0");
  await page.screenshot({ path: resolve(evidenceDir, "semantic-room-idle.png") });
  await page.mouse.move(20, 200);
  await expect(page.getByTestId("experience-shell")).toHaveAttribute("data-chrome-visible", "true");
  await page.keyboard.press("Tab");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".experience-room-meta span").last()).toHaveText(/02 \/ 0[567]/);
  await page.waitForTimeout(3_700);
  await expect(page.getByTestId("experience-shell")).toHaveAttribute("data-chrome-visible", "true");
  const artworkId = new URL(page.url()).searchParams.get("artworkId");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("experience-room")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("curationId")).toBe(id);
  expect(new URL(page.url()).searchParams.get("artworkId")).toBe(artworkId);
  for (const size of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(size);
    await page.mouse.move(5, 150);
    await expect(page.getByTestId("experience-shell")).toHaveAttribute("data-chrome-visible", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(size.width);
    const frame = await page.locator(".experience-frame-shadow").boundingBox();
    await expect(page.locator(".experience-rail-compact")).toHaveCount(0);
    expect(frame!.y).toBeGreaterThanOrEqual(76);
    await page.screenshot({ path: resolve(evidenceDir, `semantic-room-${size.width}.png`) });
    await page.mouse.move(10, 150);
    await expect(page.getByTestId("experience-shell")).toHaveAttribute("data-chrome-visible", "true");
    await page.locator(".experience-plaque-heading").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.locator(".experience-reading-note")).not.toBeEmpty();
    await page.waitForTimeout(3_400);
    await expect(page.getByTestId("experience-shell")).toHaveAttribute("data-chrome-visible", "true");
    await page.keyboard.press("Escape");
  }
  expect(errors).toEqual([]);
});

test("real release depth enters the artwork and reduced motion retains the static original", async ({ page }) => {
  test.setTimeout(100_000);
  await page.goto(entry, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".experience-depth-canvas")).toHaveAttribute("data-depth-state", "ready", { timeout: 45_000 });
  await page.locator(".immersive-lightbox-trigger").click();
  await expect(page.getByRole("dialog")).toHaveAttribute("data-depth-status", "ready", { timeout: 20_000 });
  await expect(page.locator(".experience-depth-canvas")).toHaveCount(0);
  await page.mouse.move(900, 500);
  await page.screenshot({ path: resolve(evidenceDir, "semantic-enter-artwork.png") });
  await page.keyboard.press("Escape");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".experience-depth-canvas")).toHaveCount(0);
  await expect(page.locator(".experience-art-lightbox")).toHaveAttribute("data-image-state", "ready");
  await page.locator(".immersive-lightbox-trigger").click();
  await expect(page.getByRole("dialog")).toHaveAttribute("data-depth-status", "static");
  await page.keyboard.press("Escape");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.route("**/artduo-artwork/**", (route) => new URL(route.request().url()).searchParams.get("variant") === "depth"
    ? route.fulfill({ status: 503, body: "test missing depth" }) : route.continue());
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".experience-depth-canvas")).toHaveAttribute("data-depth-state", "static", { timeout: 20_000 });
  await expect(page.locator(".experience-art-lightbox")).toHaveAttribute("data-image-state", "ready");
});
