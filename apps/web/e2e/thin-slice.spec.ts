import { expect, test } from "@playwright/test";

import { gotoApp } from "./helpers";

test("visitor can turn a sentence into a gallery and open artwork detail", async ({ page }) => {
  await gotoApp(page, "/");

  await expect(page.getByRole("heading", { name: "ArtDuo" })).toBeVisible();
  await page.getByLabel("策展意图").fill("I want a quiet moonlit room");
  await page.getByRole("button", { name: "生成观展路线" }).click();

  await expect(page).toHaveURL(/\/gallery\/local\/immersive\?query=I\+want\+a\+quiet\+moonlit\+room/);
  await expect(page.getByRole("main")).toHaveClass(/immersive-shell/);
  await expect(page.getByTestId("immersive-preface")).toBeVisible();
  await expect(page.getByRole("button", { name: /打开《.+》大图/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "下一幅" })).toBeVisible();

  await gotoApp(page, "/artwork/met-247010?query=I+want+a+quiet+moonlit+room&backgroundSceneId=bg-001&retrievalScore=0.5&matchedTokens=quiet");
  await expect(page).toHaveURL(/\/artwork\/met-247010/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/馆藏 \d{4}-\d{2}-\d{2}/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "返回 Gallery" })).toBeVisible();
});
