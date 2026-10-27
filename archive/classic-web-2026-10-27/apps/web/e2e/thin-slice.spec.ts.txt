import { expect, test } from "@playwright/test";

import { gotoApp } from "./helpers";

test("visitor can enter the classic gallery and return to the route preview", async ({ page }) => {
  await gotoApp(page, "/");

  await expect(page.getByRole("heading", { name: "ArtDuo" })).toBeVisible();
  await page.getByLabel("策展意图").fill("I want a quiet moonlit room");
  await page.getByRole("button", { name: /生成观展路线/ }).click();

  await expect(page).toHaveURL(/\/gallery\/local\/immersive\?view=classic&query=I\+want\+a\+quiet\+moonlit\+room/);
  await expect(page.getByRole("main")).toHaveClass(/immersive-shell/);
  await page.getByRole("link", { name: "换一句愿望" }).click();
  await expect(page).toHaveURL(/\/gallery\?view=route/);
  await expect(page.getByRole("heading", { name: "导览画廊" })).toBeVisible();
  await expect(page.getByTestId("gallery-route")).toBeVisible();
  await expect(page.getByTestId("gallery-route-stop")).toHaveCount(3);
  await expect(page.getByTestId("curation-preface")).toBeVisible();
  await expect(page.getByTestId("curation-closing")).toBeVisible();
  await page.getByTestId("gallery-route-stop").first().click();
  await expect(page.getByRole("main")).toHaveClass(/immersive-shell/);
  await expect(page.getByRole("img")).toBeVisible();
});
