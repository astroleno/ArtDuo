import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const evidence = process.env.ARTDUO_EVIDENCE_DIR ?? "/tmp/artduo-room-lighting";
test.use({ viewport: { width: 1440, height: 900 } });
const artwork = (query: string, artworkId: string) => "/gallery/local/immersive?" + new URLSearchParams({
  query, artworkId, view: "experience", recipeVersion: "experience-v1", releaseVersion: "2026-10-15-experience", phase: "walk",
});
const bedroom = artwork("The Bedroom", "artic-28560");
const scroll = artwork("Woman lost in thought beneath a wutong tree", "met-737764");
const beach = artwork("The Beach at Sainte-Adresse", "artic-14598");
async function openRoom(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("experience-room")).toHaveAttribute("data-scene-state", "ready", { timeout: 30_000 });
  await expect(page.locator(".experience-art-lightbox")).toHaveAttribute("data-image-state", "ready", { timeout: 30_000 });
  await page.keyboard.press("Tab");
}

test("museum labels stay small, grow on hover and keep commentary in the reader", async ({ page }) => {
  mkdirSync(evidence, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await openRoom(page, scroll);
  const label = page.locator(".experience-plaque");
  const base = await label.boundingBox();
  expect(base!.width).toBeLessThanOrEqual(125);
  expect(base!.height).toBeLessThanOrEqual(90);
  await expect(page.locator(".experience-plaque-heading")).toContainText("Sha Fu");
  await expect(page.locator(".experience-plaque-period")).not.toBeEmpty();
  await expect(page.locator(".experience-plaque-heading .experience-curator-note")).toHaveCount(0);
  await expect(page.locator(".experience-rail")).toHaveCount(0);
  await page.screenshot({ path: resolve(evidence, "label-rest-desktop.png") });
  await label.hover();
  await expect.poll(async () => (await label.boundingBox())!.width).toBeGreaterThan(base!.width * 1.3);
  const enlarged = await label.boundingBox();
  expect(enlarged!.x).toBeGreaterThanOrEqual(0); expect(enlarged!.y).toBeGreaterThanOrEqual(0);
  await page.screenshot({ path: resolve(evidence, "label-hover-desktop.png") });
  await page.locator(".experience-plaque-heading").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("Sha Fu");
  await expect(page.getByRole("dialog")).toContainText("媒材");
});

test("gallery backgrounds use scene-specific distributions and real depth-normal relighting", async ({ page }) => {
  test.setTimeout(120_000);
  for (const [url, shape] of [[scroll, "window-wash"], [beach, "linear-wash"], [bedroom, "oval-spots"]] as const) {
    await openRoom(page, url);
    await expect(page.getByTestId("experience-room")).toHaveAttribute("data-light-profile", shape);
    await expect(page.getByTestId("experience-room")).toHaveAttribute("data-relighting-state", "ready", { timeout: 25_000 });
    const canvas = page.locator(".experience-room-lighting");
    await page.mouse.move(80, 450);
    await expect.poll(async () => Number(await canvas.getAttribute("data-light-x"))).toBeLessThan(-.6);
    const left = await page.screenshot({ clip: { x: 150, y: 670, width: 500, height: 100 }, animations: "disabled" });
    await page.mouse.move(1320, 450);
    await expect.poll(async () => Number(await canvas.getAttribute("data-light-x"))).toBeGreaterThan(.6);
    const right = await page.screenshot({ clip: { x: 150, y: 670, width: 500, height: 100 }, animations: "disabled" });
    expect(left.equals(right)).toBe(false);
    await page.screenshot({ path: resolve(evidence, `${shape}-desktop.png`) });
    expect(await page.locator(".experience-atmosphere-beam").evaluate((node) => getComputedStyle(node).clipPath)).toBe("none");
  }
});

test("entering the painting retains its gallery and hides implementation labels", async ({ page }) => {
  await openRoom(page, bedroom);
  await page.locator(".immersive-lightbox-trigger").click();
  const detail = page.getByRole("dialog");
  await expect(detail).toHaveAttribute("data-depth-status", "ready", { timeout: 25_000 });
  await expect(detail).toHaveAttribute("data-gallery-context", "true");
  expect(await page.locator(".immersive-detail-backdrop").getAttribute("src")).toContain("artduo-gallery");
  await expect(detail).not.toContainText("第二阶段");
  await expect(detail).not.toContainText("DEPTH MAP");
  await page.screenshot({ path: resolve(evidence, "gallery-in-artwork.png") });
  await page.keyboard.press("Escape");
  await expect(detail).toBeHidden();
  await expect(page.locator(".immersive-lightbox-trigger")).toBeFocused();
});

test("a lost graphics context, missing light maps and reduced motion retain the original gallery", async ({ page }) => {
  await openRoom(page, bedroom);
  await expect(page.getByTestId("experience-room")).toHaveAttribute("data-relighting-state", "ready", { timeout: 25_000 });
  await page.locator(".experience-room-lighting").evaluate((node) => {
    (node as HTMLCanvasElement).getContext("webgl")?.getExtension("WEBGL_lose_context")?.loseContext();
  });
  await expect(page.getByTestId("experience-room")).toHaveAttribute("data-relighting-state", "fallback");
  await expect(page.locator(".experience-room-lighting")).toHaveCSS("opacity", "0");
  await page.route("**/lighting/v1/*-normal.png", (route) => route.fulfill({ status: 503, body: "test unavailable normal" }));
  await openRoom(page, bedroom);
  await expect(page.getByTestId("experience-room")).toHaveAttribute("data-relighting-state", "fallback", { timeout: 20_000 });
  await expect(page.getByTestId("experience-room")).toHaveAttribute("data-scene-state", "ready");
  await expect(page.locator(".experience-art-lightbox")).toHaveAttribute("data-image-state", "ready");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".experience-room-lighting")).toHaveCount(0);
  await expect(page.locator(".experience-depth-canvas")).toHaveCount(0);
  await page.locator(".experience-plaque-heading").click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test.describe("phone gallery lighting", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("motion is requested by a gesture, calibrated and applied outside the artwork", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { motionRequests: number }).motionRequests = 0;
      Object.defineProperty(DeviceOrientationEvent, "requestPermission", { configurable: true, value: async () => {
        (window as unknown as { motionRequests: number }).motionRequests++;
        return "granted";
      } });
    });
    await openRoom(page, bedroom);
    await expect(page.getByTestId("experience-room")).toHaveAttribute("data-relighting-state", "ready", { timeout: 25_000 });
    expect(await page.evaluate(() => (window as unknown as { motionRequests: number }).motionRequests)).toBe(0);
    const before = await page.locator(".experience-frame-shadow").boundingBox();
    await page.getByRole("button", { name: "开启画廊随设备轻动" }).click();
    await expect(page.getByTestId("experience-room")).toHaveAttribute("data-room-motion-state", "calibrating");
    await page.evaluate(async () => {
      for (let i = 0; i < 7; i++) { dispatchEvent(new DeviceOrientationEvent("deviceorientation", { beta: 0, gamma: 0 })); await new Promise<void>((resolve) => requestAnimationFrame(() => resolve())); }
    });
    await expect(page.getByTestId("experience-room")).toHaveAttribute("data-room-motion-state", "on");
    await page.evaluate(async () => {
      for (let i = 0; i < 22; i++) { dispatchEvent(new DeviceOrientationEvent("deviceorientation", { beta: 4, gamma: 12 })); await new Promise<void>((resolve) => requestAnimationFrame(() => resolve())); }
    });
    await expect.poll(async () => Number(await page.locator(".experience-room-lighting").getAttribute("data-light-x"))).toBeGreaterThan(.5);
    expect(await page.locator(".experience-frame-shadow").boundingBox()).toEqual(before);
    expect(await page.locator(".immersive-preview-image").evaluate((image) => getComputedStyle(image).filter)).toBe("none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await page.screenshot({ path: resolve(evidence, "gallery-motion-390.png") });
    await page.getByRole("button", { name: "关闭画廊随设备轻动" }).click();
    await expect(page.getByTestId("experience-room")).toHaveAttribute("data-room-motion-state", "off");
  });

  test("a denied motion request leaves the gallery readable and navigable", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(DeviceOrientationEvent, "requestPermission", { configurable: true, value: async () => "denied" }));
    await openRoom(page, bedroom);
    await page.getByRole("button", { name: "开启画廊随设备轻动" }).click();
    await expect(page.getByTestId("experience-room")).toHaveAttribute("data-room-motion-state", "denied");
    await expect(page.getByRole("status")).toContainText("可照常观展");
    await page.locator(".experience-plaque-heading").click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
