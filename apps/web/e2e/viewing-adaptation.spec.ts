import { expect, test, type Page } from "@playwright/test";
import type { ViewingSession } from "@artduo/ui";

const url = `/gallery/local/immersive?${new URLSearchParams({ query: "有点累，撑了很久", view: "experience", phase: "walk" })}`;
const currentId = (page: Page) => new URL(page.url()).searchParams.get("artworkId");
async function session(page: Page): Promise<ViewingSession> {
  return page.evaluate(() => {
    const key = Object.keys(sessionStorage).find((key) => key.startsWith("artduo.viewing.v1."));
    return key ? JSON.parse(sessionStorage.getItem(key)!) : null;
  });
}
async function open(page: Page) {
  await page.goto(url);
  await expect(page.locator(".experience-art-lightbox")).toHaveAttribute("data-image-state", "ready");
  await expect.poll(async () => (await session(page))?.observations.length).toBeGreaterThan(0);
}

test("explicit feedback revises only the unseen tail and survives detail, reload and a fresh shared-link context", async ({ page, browser }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await open(page);
  const first = currentId(page);
  const original = (await session(page)).order;
  await page.getByText("本次展览", { exact: true }).click();
  await page.getByRole("button", { name: "换一种题材", exact: true }).click();
  expect(currentId(page)).toBe(first);
  expect((await session(page)).order).toEqual(original);
  await expect(page.locator(".experience-pending")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "下一件作品" }).click();
  await expect.poll(async () => (await session(page)).revisions.length).toBe(1);
  const revised = (await session(page)).order;
  expect(revised[0]).toBe(first);
  expect(revised).not.toEqual(original);
  expect(new Set(revised)).toEqual(new Set(original));
  const second = currentId(page);
  await page.getByRole("button", { name: "上一件作品" }).click();
  await expect.poll(() => currentId(page)).toBe(first);
  await page.getByRole("button", { name: "下一件作品" }).click();
  await expect.poll(() => currentId(page)).toBe(second);
  await page.getByRole("button", { name: "展开完整展签" }).click();
  await page.getByRole("button", { name: "进入详细讲解" }).click();
  await page.getByRole("link", { name: "返回刚才的位置" }).click();
  await expect.poll(() => currentId(page)).toBe(second);
  await expect.poll(async () => (await session(page))?.order).toEqual(revised);
  await page.reload();
  await expect.poll(async () => (await session(page))?.order).toEqual(revised);
  const sharedUrl = page.url();
  const context = await browser.newContext();
  try {
    const shared = await context.newPage();
    await shared.goto(sharedUrl);
    await expect.poll(async () => (await session(shared))?.order).toEqual(revised);
    expect(currentId(shared)).toBe(second);
  } finally { await context.close(); }
  await page.getByText("本次展览", { exact: true }).click();
  await page.getByRole("button", { name: "保持原来的路线", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "下一件作品" }).click();
  await expect.poll(async () => (await session(page)).pending).toBeUndefined();
  expect((await session(page)).order).toEqual([...revised.slice(0, 2), ...original.filter((id) => !revised.slice(0, 2).includes(id))]);
  expect(errors).toEqual([]);
});

test("reading and hidden time are excluded from viewing; users can cancel and clear observations", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "展开完整展签" }).click();
  const before = (await session(page)).observations[0]!.viewingMs;
  await page.waitForTimeout(600);
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await session(page)).observations[0]!.readingMs).toBeGreaterThan(500);
  expect((await session(page)).observations[0]!.viewingMs - before).toBeLessThan(300);
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
  const hiddenStart = (await session(page)).observations[0]!.viewingMs;
  await page.waitForTimeout(600);
  await page.evaluate(() => { Reflect.deleteProperty(document, "visibilityState"); document.dispatchEvent(new Event("visibilitychange")); });
  expect((await session(page)).observations[0]!.viewingMs - hiddenStart).toBeLessThan(150);
  await page.getByText("本次展览", { exact: true }).click();
  await page.getByRole("button", { name: "接下来更安静一些", exact: true }).click();
  await page.getByRole("button", { name: "取消调整", exact: true }).click();
  expect((await session(page)).pending).toBeUndefined();
  await page.getByText("本次观看记录", { exact: true }).click();
  await page.getByRole("button", { name: "清除观看记录", exact: true }).click();
  expect((await session(page)).observations).toEqual([]);
  await page.getByLabel("换画节奏跟随我的观看速度").uncheck();
  await expect(page.getByTestId("experience-shell")).toHaveAttribute("data-viewing-pace", "steady");
});

test("unavailable storage and forged route parameters preserve a usable eligible exhibition", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException("storage unavailable", "SecurityError"); };
  });
  await page.goto(`${url}&route=unknown,unknown`);
  await expect(page.getByTestId("experience-room")).toBeVisible();
  await page.getByText("本次展览", { exact: true }).click();
  await expect(page.locator(".experience-viewing-controls")).toContainText("浏览器无法保存观看记录");
  await page.getByRole("button", { name: "换一种题材", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "下一件作品" }).click();
  await expect(page.locator(".experience-room-meta span").last()).toHaveText("02 / 12");
  expect(new URL(page.url()).searchParams.get("route")).not.toContain("unknown");
});

test("feedback while revisiting waits for the unseen boundary and browser history restores route and position", async ({ page }) => {
  await open(page);
  const original = (await session(page)).order;
  const firstUrl = page.url();
  const originalUrl = new URL(firstUrl);
  originalUrl.searchParams.set("route", original.join(","));
  await page.evaluate((href) => history.replaceState(null, "", href), originalUrl.href);
  await page.getByRole("button", { name: "下一件作品" }).click();
  await expect.poll(() => currentId(page)).toBe(original[1]);
  await page.getByRole("button", { name: "上一件作品" }).click();
  await expect.poll(() => currentId(page)).toBe(original[0]);
  await page.getByText("本次展览", { exact: true }).click();
  await page.getByRole("button", { name: "换一种题材", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "下一件作品" }).click();
  await expect.poll(() => currentId(page)).toBe(original[1]);
  expect((await session(page)).order).toEqual(original);
  expect((await session(page)).pending).toBeDefined();
  await page.getByRole("button", { name: "下一件作品" }).click();
  await expect.poll(async () => (await session(page)).pending).toBeUndefined();
  const revised = (await session(page)).order;
  expect(revised.slice(0, 2)).toEqual(original.slice(0, 2));
  expect(revised).not.toEqual(original);
  const revisedUrl = page.url();
  // Create two same-document history entries, then exercise the real popstate listener.
  await page.evaluate(({ previous, next }) => {
    history.replaceState(null, "", previous);
    history.pushState(null, "", next);
  }, { previous: originalUrl.href, next: revisedUrl });
  await page.goBack();
  await expect.poll(async () => (await session(page)).order).toEqual(original);
  await expect.poll(() => currentId(page)).toBe(original[0]);
  await page.goForward();
  await expect.poll(async () => (await session(page)).order).toEqual(revised);
  await expect.poll(() => currentId(page)).toBe(revised[2]);
});
