import { expect, test } from "@playwright/test";

import { gotoApp } from "./helpers";

test("gallery keeps rendering results when browser worker search fails", async ({ page }) => {
  await gotoApp(page, "/gallery?query=I+want+a+quiet+moonlit+room&runtime=worker-fail");

  await expect(page.getByRole("heading", { name: /Gallery/ })).toBeVisible();
  await expect(page.getByTestId("runtime-mode")).toContainText("server-fallback");
  await expect(page.getByTestId("result-card")).toHaveCount(12);
});
