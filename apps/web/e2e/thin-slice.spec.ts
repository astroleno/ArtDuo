import { expect, test } from "@playwright/test";
import { gotoApp } from "./helpers";

test("the default entrance opens the experience and returns to the selected artwork", async ({ page }) => {
  await gotoApp(page, "/");
  await expect(page.locator(".experience-threshold")).toBeVisible();
  await page.getByLabel("写下一句此刻的心情或观看愿望").fill("I want a quiet moonlit room");
  await page.getByRole("button", { name: "开始观展", exact: true }).click();
  await expect(page.locator(".experience-preface")).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: "进入展厅" }).click();
  await expect(page.getByTestId("experience-room")).toBeVisible();
  const location = new URL(page.url());
  expect(location.searchParams.get("view")).toBe("experience");
  const artworkId = location.searchParams.get("artworkId");
  const curationId = location.searchParams.get("curationId");
  await page.locator(".experience-plaque-heading").click();
  await page.getByRole("button", { name: "进入详细讲解" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "返回刚才的位置" }).click();
  await expect(page.getByTestId("experience-room")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("artworkId")).toBe(artworkId);
  expect(new URL(page.url()).searchParams.get("curationId")).toBe(curationId);
});
