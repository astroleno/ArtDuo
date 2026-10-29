import { expect, test } from "@playwright/test";

import { gotoApp } from "./helpers";

test("experience detail returns to the same artwork and loads explanation on request", async ({ page }) => {
  await gotoApp(page, "/gallery/local/immersive?query=有点累，撑了很久&view=experience&phase=preface");
  await page.getByRole("button", { name: /进入展厅/ }).click();
  await page.locator(".experience-plaque-heading").click();
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
  const title = await page.getByRole("heading", { level: 1 }).innerText();
  await page.route("**/api/artworks/*/explanation", async (route) => {
    const input = route.request().postDataJSON();
    const artworkId = new URL(route.request().url()).pathname.split("/").at(-2)!;
    await route.fulfill({ json: { artworkId, releaseVersion: input.releaseVersion, status: "ready", cacheKey: "browser-fixture", updatedAt: "2026-10-20T00:00:00.000Z",
      content: { title, shortText: "根据馆藏资料整理的作品介绍。", detailText: "这段讲解只使用这件作品已有的馆藏资料，保留作品与本次观看方向之间的联系。", generatedAt: "2026-10-20T00:00:00.000Z",
        evidence: { grounding: { userText: input.query, artwork: { id: artworkId, title }, releaseVersion: input.releaseVersion, matchedTokens: input.matchedTokens, retrievalScore: input.retrievalScore,
          sourceVersions: { corpusVersion: input.releaseVersion, backgroundCatalogVersion: input.releaseVersion, contractsVersion: "fixture" } },
          citations: [{ kind: "artwork", sourceId: artworkId, label: title, url: "https://example.test/artwork" }] } } } });
  });
  const explanationRequest = page.waitForResponse((response) => response.url().includes("/api/artworks/") && response.url().endsWith("/explanation") && response.request().method() === "POST");
  await page.getByRole("button", { name: "生成这件作品的讲解" }).click();
  await explanationRequest;
  await expect(page.getByTestId("explanation-slot")).toContainText("这段讲解只使用这件作品已有的馆藏资料");
  await expect(page.getByTestId("explanation-slot")).toContainText("为什么推荐这件作品");
  await page.getByText("资料来源").click();
  await expect(page.locator(".explanation-evidence")).not.toContainText("匹配度：");
  await expect(page.getByRole("list", { name: "讲解来源与引用" })).toContainText("馆藏资料");
  await expect(page.getByTestId("explanation-slot")).not.toContainText("subject:");
  const artworkId = new URL(page.url()).pathname.split("/").at(-1);
  await page.getByRole("link", { name: "返回刚才的位置" }).click();
  await expect(page).toHaveURL(new RegExp(`phase=walk.*artworkId=${artworkId}`));
  await expect(page.locator(".experience-plaque-heading")).toBeVisible();
});
