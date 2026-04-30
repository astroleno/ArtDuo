import { expect, test } from "@playwright/test";

test("detail page renders explanation slot as non-blocking pending state", async ({ page }) => {
  await page.goto("/gallery?query=I+want+a+quiet+moonlit+room");
  await page.getByTestId("result-card").first().getByRole("link", { name: /打开详情/ }).click();

  await expect(page).toHaveURL(/\/artwork\/met-/);
  await expect(page.getByTestId("explanation-slot")).toContainText("Explanation pending");
});
