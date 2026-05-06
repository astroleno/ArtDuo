import { expect, test } from "@playwright/test";

import { gotoApp } from "./helpers";

test("detail page renders explanation slot with generated ready content", async ({ page }) => {
  await gotoApp(page, "/gallery?query=I+want+a+quiet+moonlit+room");
  await page.getByTestId("result-card").first().getByRole("link", { name: /打开详情/ }).click();

  await expect(page).toHaveURL(/\/artwork\/met-/);
  await expect(page.getByTestId("explanation-slot")).toContainText("Curation note:");
});
