import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { gotoApp } from "./helpers";

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`the default and retired entry URLs share the current interface at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const address of ["/", "/?view=experience", "/?view=classic&query=quiet%20%26%20blue"]) {
      await gotoApp(page, address);
      await expect(page.locator(".experience-threshold")).toBeVisible();
      await expect(page.locator(".home-shell")).toHaveCount(0);
      await expect(page.getByRole("link", { name: "ArtDuo，返回入口" })).toHaveAttribute("href", "/");
      await expect(page.getByRole("link", { name: /经典入口/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "开始观展", exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    }
    await expect(page.getByLabel("写下一句此刻的心情或观看愿望")).toHaveValue("quiet & blue");
    const evidence = process.env.ARTDUO_EVIDENCE_DIR ?? "/tmp/artduo-default-entry";
    mkdirSync(evidence, { recursive: true });
    await page.screenshot({ path: resolve(evidence, `default-entry-${viewport.width}.png`), fullPage: true });
  });
}
