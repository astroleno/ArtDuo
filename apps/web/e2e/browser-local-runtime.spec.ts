import { expect, test } from "@playwright/test";

import { gotoApp } from "./helpers";

test("gallery keeps rendering results when browser worker search fails", async ({ page }) => {
  await gotoApp(page, "/gallery?query=I+want+a+quiet+moonlit+room&runtime=worker-fail&view=route");

  await expect(page.getByRole("heading", { name: "导览画廊" })).toBeVisible();
  await expect(page.getByTestId("runtime-mode")).toContainText("server-fallback");
  await expect(page.getByTestId("gallery-route-stop")).toHaveCount(3);
});
