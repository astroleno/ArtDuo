import { expect, test } from "@playwright/test";

import { gotoApp } from "./helpers";

test("detail page renders explanation slot with generated ready content", async ({ page }) => {
  await gotoApp(page, "/gallery?query=I+want+a+quiet+moonlit+room");
  await page.getByTestId("result-card").first().getByRole("link", { name: /打开详情/ }).click();

  await expect(page).toHaveURL(/\/artwork\/met-/);
  await expect(page).toHaveURL(/backgroundSceneId=/);
  await expect(page).toHaveURL(/retrievalScore=/);
  await expect(page).toHaveURL(/matchedTokens=/);
  await expect(page.getByTestId("explanation-slot")).toContainText("Curation note:");
  await expect(page.getByTestId("explanation-slot")).toContainText("为什么推荐这件作品");
  await page.getByText("检索依据").click();
  await expect(page.getByTestId("explanation-evidence")).toContainText("匹配度：");
  await expect(page.getByLabel("Explanation citations")).toContainText("retrieval");
});
