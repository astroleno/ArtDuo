import { expect, test } from "@playwright/test";

test("visitor can turn a sentence into a gallery and open artwork detail", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "ArtDuo" })).toBeVisible();
  await page.getByLabel("策展意图").fill("I want a quiet moonlit room");
  await page.getByRole("button", { name: "生成展览" }).click();

  await expect(page).toHaveURL(/\/gallery\?query=I\+want\+a\+quiet\+moonlit\+room/);
  await expect(page.getByRole("heading", { name: /Gallery/ })).toBeVisible();
  await expect(page.getByText("Primary work")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Opening" })).toBeVisible();
  await expect(page.getByTestId("result-card")).toHaveCount(12);

  const firstCard = page.getByTestId("result-card").first();
  await expect(firstCard.getByRole("img")).toBeVisible();
  await firstCard.getByRole("link", { name: /打开详情/ }).click();

  await expect(page).toHaveURL(/\/artwork\/met-/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/Release \d{4}-\d{2}-\d{2}/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "返回 Gallery" })).toBeVisible();
});
