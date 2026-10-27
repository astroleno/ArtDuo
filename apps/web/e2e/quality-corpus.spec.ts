import { mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";

const version = "2026-10-13-quality";
const evidence = process.env.ARTDUO_EVIDENCE_DIR ?? "/tmp/artduo-existing-quality/browser";
const corpus = JSON.parse(readFileSync(resolve("../../data/curation/existing-quality", version, "corpus.json"), "utf8"));

test("measured frames remain stable through image decoding and keep narrow and wide works complete", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(evidence, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const id of ["artic-16568", "artic-80607", "met-55233", "met-737790"]) {
      const record = corpus.find((row: { id: string }) => row.id === id);
      let unblock!: () => void;
      const blocked = new Promise<void>((resolve) => { unblock = resolve; });
      const pattern = `**/artduo-artwork/${id}?**`;
      await page.route(pattern, async (route) => {
        if (new URL(route.request().url()).searchParams.get("variant") === "preview") await blocked;
        await route.continue();
      });
      try {
        await page.goto(`/gallery/local/immersive?${new URLSearchParams({ query: record.metadata.title, view: "experience", recipeVersion: "experience-v1", phase: "walk", artworkId: id, releaseVersion: version })}`, { waitUntil: "domcontentloaded" });
        await expect(page).toHaveTitle(/ArtDuo/);
        await expect(page.getByTestId("experience-room")).toHaveAttribute("data-scene-state", "ready", { timeout: 15_000 });
        await expect(page.locator(".immersive-preview-image")).toHaveAttribute("src", new RegExp(id));
        const frame = page.locator(".experience-frame-shadow");
        await expect(frame).toBeVisible();
        const expected = record.media.visualPresentation.contentAspectRatio;
        const imageArea = page.locator(".experience-art-lightbox .immersive-artwork-frame");
        await expect.poll(async () => { const b = await imageArea.boundingBox(); return b ? Math.abs(b.width / b.height / expected - 1) : 1; }).toBeLessThan(0.002);
        const before = await frame.boundingBox();
        unblock();
        await expect(page.locator(".experience-art-lightbox")).toHaveAttribute("data-image-state", "ready", { timeout: 15_000 });
        const after = await frame.boundingBox();
        expect(Math.abs(after!.width - before!.width)).toBeLessThan(1);
        expect(Math.abs(after!.height - before!.height)).toBeLessThan(1);
        const displayedImage = await imageArea.boundingBox();
        expect(Math.abs(displayedImage!.width / displayedImage!.height / expected - 1)).toBeLessThan(0.002);
        await expect(page.locator(".immersive-preview-image")).toHaveCSS("object-fit", "contain");
        await page.mouse.move(0, 0);
        await page.screenshot({ path: join(evidence, `${id}-${viewport.width}-room.png`) });
        await page.getByRole("button", { name: "展开完整展签" }).click();
        const reading = page.getByRole("dialog", { name: record.metadata.title });
        await expect(reading).toContainText("馆方尺寸");
        await expect(reading).toContainText(record.metadata.dimensions.replace(/\s+/g, " "));
        await page.keyboard.press("Escape");
        await page.locator(".immersive-lightbox-trigger").click();
        const detailFrame = page.locator(".immersive-detail-frame");
        await expect(detailFrame).toBeVisible();
        await expect.poll(async () => page.locator(".immersive-detail-fallback").evaluate((image: HTMLImageElement) => {
          const parent = image.parentElement!.getBoundingClientRect();
          return image.naturalWidth ? Math.abs(parent.width / parent.height / (image.naturalWidth / image.naturalHeight) - 1) : 1;
        })).toBeLessThan(0.005);
        const bounds = await detailFrame.boundingBox();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.y).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1);
        await page.screenshot({ path: join(evidence, `${id}-${viewport.width}.png`) });
        await page.keyboard.press("Escape");
      } finally { unblock(); await page.unroute(pattern); }
    }
  }
  expect(errors).toEqual([]);
});

test("detail pages distinguish museum dimensions from responsive presentation", async ({ page }) => {
  await page.goto(`/artwork/artic-16568?releaseVersion=${version}`);
  await expect(page.locator(".facts")).toContainText("89.9 × 94.1 cm");
  await expect(page.locator(".facts")).toContainText("Framed:");
  await expect(page.locator(".facts")).toContainText("不代表原作实际尺寸");
  await page.goto(`/artwork/met-366377?releaseVersion=${version}`);
  await expect(page.locator(".facts")).toContainText("尺寸尚待核实");
});
