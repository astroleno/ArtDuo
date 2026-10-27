import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const evidence = process.env.ARTDUO_EVIDENCE_DIR ?? join(tmpdir(), "artduo-scene-matching");
const url = `/gallery/local/immersive?${new URLSearchParams({ query: "有点累，撑了很久", view: "experience", phase: "walk" })}`;
async function ready(page: Page) {
  await expect(page.getByTestId("experience-room")).toHaveAttribute("data-scene-state", "ready", { timeout: 15_000 });
  await expect(page.locator(".experience-art-lightbox")).toHaveAttribute("data-image-state", "ready", { timeout: 15_000 });
  await expect(page.locator(".experience-walk")).not.toHaveClass(/is-transitioning/);
  await page.locator("img.experience-room-backdrop").last().evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });
}

test("decoded rooms, complete paintings and compact labels remain visible across viewport sizes", async ({ page }) => {
  mkdirSync(evidence, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url);
  await expect(page).toHaveTitle(/ArtDuo/);
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await ready(page);
    const frame = await page.locator(".experience-frame-shadow").boundingBox();
    const plaque = await page.locator(".experience-plaque-position").boundingBox();
    expect(frame!.x).toBeGreaterThanOrEqual(0);
    expect(frame!.x + frame!.width).toBeLessThanOrEqual(viewport.width);
    expect(frame!.y + frame!.height).toBeLessThanOrEqual(viewport.height - 70);
    if (viewport.width < 768) {
      expect(plaque!.width).toBeLessThanOrEqual(210);
      expect(plaque!.y).toBeGreaterThan(frame!.y + frame!.height);
    }
    await expect(page.locator(".immersive-preview-image")).toHaveCSS("object-fit", "contain");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    await page.screenshot({ path: join(evidence, `matched-room-${viewport.width}.png`) });
  }
  expect(errors).toEqual([]);
});

test("adaptive order freezes the current room and replays every new scene through refresh and a shared URL", async ({ page, browser }) => {
  await page.goto(url);
  await ready(page);
  const firstId = new URL(page.url()).searchParams.get("artworkId");
  const firstScene = await page.getByTestId("experience-room").getAttribute("data-scene-id");
  await page.getByText("本次展览", { exact: true }).click();
  await page.getByRole("button", { name: "换一种题材", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("experience-room")).toHaveAttribute("data-scene-id", firstScene!);
  await page.getByRole("button", { name: "下一件作品" }).click();
  await ready(page);
  const nextUrl = page.url();
  const nextScene = await page.getByTestId("experience-room").getAttribute("data-scene-id");
  await page.getByRole("button", { name: "上一件作品" }).click();
  await ready(page);
  expect(new URL(page.url()).searchParams.get("artworkId")).toBe(firstId);
  await expect(page.getByTestId("experience-room")).toHaveAttribute("data-scene-id", firstScene!);
  await page.goto(nextUrl);
  await ready(page);
  await expect(page.getByTestId("experience-room")).toHaveAttribute("data-scene-id", nextScene!);
  await page.reload();
  await ready(page);
  await expect(page.getByTestId("experience-room")).toHaveAttribute("data-scene-id", nextScene!);
  const context = await browser.newContext();
  try {
    const shared = await context.newPage();
    await shared.goto(nextUrl);
    await ready(shared);
    await expect(shared.getByTestId("experience-room")).toHaveAttribute("data-scene-id", nextScene!);
  } finally { await context.close(); }
});
