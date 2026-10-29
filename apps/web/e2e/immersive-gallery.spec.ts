import { expect, test } from "@playwright/test";

import { gotoApp } from "./helpers";

test("immersive gallery opens from gallery and preserves the release-backed exhibition", async ({ page }) => {
  await gotoApp(page, "/gallery?view=route&query=I+want+a+quiet+moonlit+room");

  await page.getByRole("link", { name: /进入这场观展/ }).click();

  await expect(page).toHaveURL(/\/gallery\/local\/immersive\?query=I\+want\+a\+quiet\+moonlit\+room/);
  await expect(page.getByTestId("experience-room")).toBeVisible();
  await expect(page.locator(".experience-room-backdrop")).toBeVisible();
  await expect(page.locator(".experience-art-lightbox img")).toBeVisible();
  await expect(page.getByRole("button", { name: "观展设置" })).toBeVisible();
  await expect(page.locator(".experience-room-meta")).toBeVisible();
});

test("immersive gallery can move between scenes and preserve query state", async ({ page }) => {
  await gotoApp(page, "/gallery?view=route&query=I+want+a+quiet+moonlit+room");
  await page.getByRole("link", { name: /进入这场观展/ }).click();

  const firstTitle = await page.locator(".experience-plaque-heading strong").textContent();
  const curationId = new URL(page.url()).searchParams.get("curationId");
  await page.mouse.move(12, 400);
  await page.getByRole("button", { name: "下一件作品" }).click();

  await expect(page).toHaveURL(/query=I\+want\+a\+quiet\+moonlit\+room/);
  await expect(page).toHaveURL(/artworkId=[^&]+/);
  await expect(page.locator(".experience-plaque-heading strong")).not.toHaveText(firstTitle ?? "");
  expect(new URL(page.url()).searchParams.get("curationId")).toBe(curationId);
  await expect(page.getByRole("button", { name: "上一件作品" })).toBeVisible();
});

test("artwork detail reopens the experience at the current artwork", async ({ page }) => {
  await gotoApp(page, "/gallery/local/immersive?query=有点累，撑了很久&view=experience&phase=preface");
  await page.getByRole("button", { name: /进入展厅/ }).click();
  await page.locator(".experience-plaque-heading").click();
  const artworkTitle = await page.locator(".experience-plaque-heading strong").textContent();
  await page.getByRole("button", { name: "进入详细讲解" }).click();

  await expect(page.getByRole("heading", { level: 1, name: artworkTitle ?? "" })).toBeVisible();
  await page.getByRole("link", { name: "沉浸观展" }).click();
  await expect(page).toHaveURL(/\/gallery\/local\/immersive\?.*view=experience.*phase=walk.*artworkId=(?:met|artic)-/);
  await expect(page.locator(".experience-plaque-heading")).toBeVisible();
  await expect(page.locator(".experience-plaque-heading strong")).toHaveText(artworkTitle ?? "");
});

test("the default mobile experience keeps the artwork and progress inside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoApp(page, "/gallery/local/immersive?query=I+want+a+quiet+moonlit+room");

  await expect(page.getByTestId("experience-room")).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBe(false);
  const artwork = await page.locator(".experience-art-lightbox").boundingBox();
  expect(artwork!.x).toBeGreaterThanOrEqual(0);
  expect(artwork!.x + artwork!.width).toBeLessThanOrEqual(390);
  await page.mouse.move(12, 100);
  await expect(page.locator(".experience-room-meta")).toBeVisible();
});

test("zooming an artwork enters the second-stage immersive detail experience", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoApp(page, "/gallery/local/immersive?query=I+want+a+quiet+moonlit+room");

  const galleryUrl = page.url();
  await expect(page.getByRole("button", { name: /播放背景音乐/ })).toBeEnabled();
  await page.getByRole("button", { name: /放大，进入画中：/ }).click();

  const detailStage = page.getByRole("dialog", { name: /沉浸观看/ });
  await expect(detailStage).toBeVisible();
  await expect(detailStage).toHaveAttribute("data-experience-stage", "immersive-detail");
  await expect(detailStage.locator("canvas")).toBeAttached();
  await expect(detailStage.getByText("拖动画面，感受空间层次")).toBeVisible();
  await expect(page).toHaveURL(galleryUrl);

  const firstDetailTitle = await detailStage.locator(".immersive-detail-caption strong").textContent();
  await detailStage.getByRole("button", { name: "下一件作品" }).click();
  await expect(detailStage).toBeVisible();
  await expect(page).toHaveURL(/artworkId=[^&]+/);
  await expect(detailStage.locator(".immersive-detail-caption strong")).not.toHaveText(firstDetailTitle ?? "");

  await detailStage.getByRole("button", { name: "返回展厅" }).click();
  await expect(detailStage).toBeHidden();
  await expect(page.getByTestId("experience-room")).toBeVisible();
});

test("device parallax stays optional and yields to direct touch input", async ({ page }) => {
  await page.addInitScript(() => {
    class ControlledDeviceOrientationEvent extends Event {
      static requestPermission = async () => "granted" as const;
      readonly alpha: number | null;
      readonly beta: number | null;
      readonly gamma: number | null;

      constructor(type: string, init: DeviceOrientationEventInit = {}) {
        super(type);
        this.alpha = init.alpha ?? null;
        this.beta = init.beta ?? null;
        this.gamma = init.gamma ?? null;
      }
    }

    Object.defineProperty(window, "DeviceOrientationEvent", {
      configurable: true,
      value: ControlledDeviceOrientationEvent,
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoApp(page, "/gallery/local/immersive?query=I+want+a+quiet+moonlit+room");
  await expect(page.getByRole("button", { name: "观展设置" })).toBeEnabled();
  await page.getByRole("button", { name: /放大，进入画中：/ }).click();

  const detailStage = page.getByRole("dialog", { name: /沉浸观看/ });
  const motionToggle = detailStage.getByRole("button", { name: /随手机轻动/ });
  const frame = detailStage.locator(".immersive-detail-frame");
  await expect(motionToggle).toBeVisible();
  await expect(motionToggle).toHaveAttribute("aria-pressed", "false");
  await motionToggle.click();
  await expect(detailStage).toHaveAttribute("data-motion-state", "calibrating");

  await page.evaluate(() => {
    window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { beta: 10, gamma: 5 }));
  });
  await expect(detailStage).toHaveAttribute("data-motion-state", "enabled");
  await expect(frame).toHaveAttribute("data-parallax-input", "motion");

  await page.evaluate(() => {
    window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { beta: 18, gamma: 13 }));
  });
  await expect.poll(async () => frame.evaluate((element) => element.style.getPropertyValue("--immersive-tilt-y")))
    .not.toBe("0deg");

  const bounds = await frame.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move((bounds?.x ?? 0) + (bounds?.width ?? 0) * 0.5, (bounds?.y ?? 0) + (bounds?.height ?? 0) * 0.5);
  await page.mouse.down();
  await page.mouse.move((bounds?.x ?? 0) + (bounds?.width ?? 0) * 0.75, (bounds?.y ?? 0) + (bounds?.height ?? 0) * 0.5);
  await expect(frame).toHaveAttribute("data-parallax-input", "touch");
  await page.evaluate(() => {
    window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { beta: 3, gamma: -7 }));
  });
  await expect(frame).toHaveAttribute("data-parallax-input", "touch");
  await page.mouse.up();
  await expect(frame).toHaveAttribute("data-parallax-input", "motion");
});

test("denied device orientation permission keeps touch parallax available", async ({ page }) => {
  test.setTimeout(90_000);
  page.setDefaultNavigationTimeout(60_000);
  await page.addInitScript(() => {
    class DeniedDeviceOrientationEvent extends Event {
      static requestPermission = async () => "denied" as const;
    }

    Object.defineProperty(window, "DeviceOrientationEvent", {
      configurable: true,
      value: DeniedDeviceOrientationEvent,
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoApp(page, "/gallery/local/immersive?query=I+want+a+quiet+moonlit+room");
  await expect(page.getByRole("button", { name: "观展设置" })).toBeEnabled();
  await page.getByRole("button", { name: /放大，进入画中：/ }).click();

  const detailStage = page.getByRole("dialog", { name: /沉浸观看/ });
  const motionToggle = detailStage.getByRole("button", { name: /随手机轻动/ });
  await expect(motionToggle).toBeVisible();
  await motionToggle.click();

  await expect(detailStage).toHaveAttribute("data-motion-state", "denied");
  await expect(detailStage.getByText("未获得运动权限，仍可拖动画面")).toBeVisible();
  await expect(motionToggle).toHaveAttribute("aria-pressed", "false");
});

test("reduced motion keeps the second stage static", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoApp(page, "/gallery/local/immersive?query=I+want+a+quiet+moonlit+room");
  await expect(page.getByRole("button", { name: "观展设置" })).toBeEnabled();
  await page.getByRole("button", { name: /放大，进入画中：/ }).click();

  const detailStage = page.getByRole("dialog", { name: /沉浸观看/ });
  const frame = detailStage.locator(".immersive-detail-frame");
  await expect(detailStage).toHaveAttribute("data-depth-status", "static");
  await expect(frame).toHaveAttribute("data-parallax-input", "rest");

  const bounds = await frame.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move((bounds?.x ?? 0) + (bounds?.width ?? 0) * 0.75, (bounds?.y ?? 0) + (bounds?.height ?? 0) * 0.5);
  await expect(frame).toHaveAttribute("data-parallax-input", "rest");

  await detailStage.getByRole("button", { name: /随手机轻动/ }).click();
  await expect(detailStage).toHaveAttribute("data-motion-state", "unavailable");
  await expect(detailStage.getByText("已按系统设置关闭动态效果")).toBeVisible();
});
