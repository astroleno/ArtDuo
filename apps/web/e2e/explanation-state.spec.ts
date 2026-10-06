import { expect, test } from "@playwright/test";

import { gotoApp } from "./helpers";

test("experience detail returns to the same artwork and loads explanation on request", async ({ page }) => {
  await gotoApp(page, "/gallery/local/immersive?query=有点累，撑了很久&view=experience&phase=preface");
  await page.getByRole("button", { name: /跳过前言/ }).click();
  await page.getByRole("button", { name: "展开完整展签" }).click();
  await page.getByRole("button", { name: "进入详细讲解" }).click();

  await expect(page).toHaveURL(/\/artwork\/(?:met|artic)-/);
  await expect(page).toHaveURL(/backgroundSceneId=/);
  await expect(page).toHaveURL(/retrievalScore=/);
  await expect(page).toHaveURL(/matchedTokens=/);
  await expect(page.getByTestId("explanation-slot")).toContainText("按需讲解");
  const explanationRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/artworks/") && request.url().endsWith("/explanation")) explanationRequests.push(request.url());
  });
  await expect.poll(() => explanationRequests).toHaveLength(0);
  const explanationRequest = page.waitForResponse((response) => response.url().includes("/api/artworks/") && response.url().endsWith("/explanation") && response.request().method() === "POST");
  await page.getByRole("button", { name: "生成这件作品的讲解" }).click();
  await explanationRequest;
  await expect(page.getByTestId("explanation-slot")).toContainText("is explained from the release-grounded artwork metadata");
  await expect(page.getByTestId("explanation-slot")).toContainText("为什么推荐这件作品");
  await page.getByText("检索依据").click();
  await expect(page.locator(".explanation-evidence")).toContainText("匹配度：");
  await expect(page.getByRole("list", { name: "讲解来源与引用" })).toContainText("retrieval");
  const artworkId = new URL(page.url()).pathname.split("/").at(-1);
  await page.getByRole("link", { name: "返回刚才的位置" }).click();
  await expect(page).toHaveURL(new RegExp(`phase=walk.*artworkId=${artworkId}`));
  await expect(page.getByRole("button", { name: "展开完整展签" })).toBeVisible();
});
