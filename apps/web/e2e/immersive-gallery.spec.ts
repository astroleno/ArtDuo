import { expect, test } from "@playwright/test";

test("immersive gallery opens from gallery and preserves the release-backed exhibition", async ({ page }) => {
  await page.goto("/gallery?query=I+want+a+quiet+moonlit+room");

  await page.getByRole("link", { name: /沉浸观展/ }).click();

  await expect(page).toHaveURL(/\/gallery\/local\/immersive\?query=I\+want\+a\+quiet\+moonlit\+room/);
  await expect(page.getByRole("main")).toHaveClass(/immersive-shell/);
  await expect(page.getByRole("img")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Gallery" })).toBeVisible();
  await expect(page.getByLabel("Immersive gallery progress")).toBeVisible();
});

test("artwork detail can enter immersive gallery at the current artwork", async ({ page }) => {
  await page.goto("/gallery?query=I+want+a+quiet+moonlit+room");
  await page.getByTestId("result-card").first().getByRole("link", { name: /打开详情/ }).click();
  const heading = await page.getByRole("heading", { level: 1 }).textContent();

  await page.getByRole("link", { name: /沉浸观展/ }).click();

  await expect(page).toHaveURL(/\/gallery\/local\/immersive/);
  await expect(page.getByRole("heading", { name: heading ?? "" })).toBeVisible();
});
