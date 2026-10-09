import { expect, test } from "@playwright/test";

const fixtureUrl = `/e2e-experience?${new URLSearchParams({ query: "有点累，撑了很久", releaseVersion: "2026-04-25-curation-b", artworkId: "met-662131", recipeVersion: "experience-v1", phase: "walk", depth: "valid", lifecycle: "1" })}`;

test("twenty moves, lightbox, backgrounding and three remounts release renderer resources", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const programs = new Set<WebGLProgram>();
    const textures = new Set<WebGLTexture>();
    const frames = new Set<number>();
    let peakPrograms = 0;
    let draws = 0;
    const prototype = WebGLRenderingContext.prototype;
    const createProgram = prototype.createProgram;
    const deleteProgram = prototype.deleteProgram;
    const createTexture = prototype.createTexture;
    const deleteTexture = prototype.deleteTexture;
    const drawArrays = prototype.drawArrays;
    prototype.createProgram = function () { const value = createProgram.call(this); if (value) programs.add(value); peakPrograms = Math.max(peakPrograms, programs.size); return value; };
    prototype.deleteProgram = function (value) { if (value) programs.delete(value); deleteProgram.call(this, value); };
    prototype.createTexture = function () { const value = createTexture.call(this); if (value) textures.add(value); return value; };
    prototype.deleteTexture = function (value) { if (value) textures.delete(value); deleteTexture.call(this, value); };
    prototype.drawArrays = function (...args) { draws += 1; drawArrays.apply(this, args); };
    const request = window.requestAnimationFrame.bind(window);
    const cancel = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      const id = request((time) => { frames.delete(id); callback(time); });
      frames.add(id);
      return id;
    };
    window.cancelAnimationFrame = (id) => { frames.delete(id); cancel(id); };
    Object.assign(window, { experienceResources: () => ({ programs: programs.size, textures: textures.size, frames: frames.size, peakPrograms, draws }) });
  });
  const resources = () => page.evaluate(() => (window as unknown as { experienceResources: () => { programs: number; textures: number; frames: number; peakPrograms: number; draws: number } }).experienceResources());
  await page.goto(fixtureUrl);
  await expect(page.locator(".experience-depth-canvas")).toHaveAttribute("data-depth-state", "ready");
  for (let move = 0; move < 20; move += 1) {
    await page.getByRole("button", { name: move % 2 === 0 ? "下一件作品" : "上一件作品" }).click();
    await expect(page.locator(".experience-room-meta span").last()).toHaveText(move % 2 === 0 ? "02 / 12" : "01 / 12");
    await expect(page.locator(".experience-depth-canvas")).toHaveAttribute("data-depth-state", "ready");
    await expect.poll(async () => (await resources()).programs).toBe(1);
  }
  await page.getByRole("button", { name: /放大.+并进入沉浸体验/ }).click();
  await expect(page.getByRole("dialog")).toHaveAttribute("data-depth-status", "ready");
  await expect(page.locator(".experience-depth-canvas")).toHaveCount(0);
  await expect.poll(async () => (await resources()).programs).toBe(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".experience-depth-canvas")).toHaveAttribute("data-depth-state", "ready");

  // Inject the browser visibility signal; actual mobile backgrounding remains a device gate.
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.locator(".experience-depth-canvas")).toHaveCount(0);
  await expect.poll(async () => (await resources()).programs).toBe(0);
  await page.evaluate(() => { Reflect.deleteProperty(document, "visibilityState"); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.locator(".experience-depth-canvas")).toHaveAttribute("data-depth-state", "ready");

  for (let cycle = 0; cycle < 3; cycle += 1) {
    await page.mouse.move(800, 400);
    await page.getByTestId("fixture-mount").click();
    await expect(page.getByTestId("experience-shell")).toHaveCount(0);
    await expect.poll(async () => (await resources()).programs).toBe(0);
    await expect.poll(async () => (await resources()).textures).toBe(0);
    await expect.poll(async () => (await resources()).frames).toBe(0);
    await page.getByTestId("fixture-mount").click();
    await expect(page.locator(".experience-depth-canvas")).toHaveAttribute("data-depth-state", "ready");
  }
  expect((await resources()).peakPrograms).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("audio recovers from play rejection and stops on mute, hidden page and unmount", async ({ page }) => {
  await page.addInitScript(() => {
    const media: HTMLAudioElement[] = [];
    const failures: string[] = [];
    const OriginalAudio = window.Audio;
    window.Audio = new Proxy(OriginalAudio, { construct(Target, args) {
      const audio = new Target(args[0]);
      audio.addEventListener("error", () => failures.push(`media error ${audio.error?.code}: ${audio.error?.message}`));
      media.push(audio);
      return audio;
    } });
    let failOnce = true;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (failOnce) { failOnce = false; return Promise.reject(new DOMException("Injected play denial", "NotAllowedError")); }
      return play.call(this).catch((error: Error) => { failures.push(`${error.name}: ${error.message}`); throw error; });
    };
    Object.assign(window, { experienceAudio: () => ({ playing: media.filter((audio) => !audio.paused).length, loaded: media.filter((audio) => audio.hasAttribute("src")).length, progressed: media.some((audio) => audio.currentTime > 0), volume: media.find((audio) => !audio.paused)?.volume, rate: media.find((audio) => !audio.paused)?.playbackRate, failures }) });
  });
  const audio = () => page.evaluate(() => (window as unknown as { experienceAudio: () => { playing: number; loaded: number; progressed: boolean; volume?: number; rate?: number } }).experienceAudio());
  await page.request.get("/ambient-audio/Awakening.mp3");
  await page.goto(fixtureUrl.replace("&depth=valid", ""));
  expect((await audio()).loaded).toBe(0);
  await page.getByRole("button", { name: "开启环境音" }).click();
  await expect(page.getByRole("button", { name: "重试环境音" })).toBeVisible();
  await page.getByRole("button", { name: "重试环境音" }).click();
  await expect.poll(audio, { timeout: 15_000 }).toMatchObject({ progressed: true, failures: [] });
  await expect(page.getByRole("button", { name: "关闭环境音" })).toBeVisible();
  await expect.poll(async () => (await audio()).progressed).toBe(true);
  expect((await audio()).playing).toBe(1);
  await page.getByRole("button", { name: "展开完整展签" }).click();
  await expect.poll(async () => (await audio()).volume).toBeCloseTo(0.064, 3);
  expect((await audio()).rate).toBe(1);
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await audio()).volume).toBeCloseTo(0.16, 3);
  await page.getByRole("button", { name: "下一件作品" }).click();
  expect((await audio()).playing).toBe(1);
  await page.getByRole("button", { name: "关闭环境音" }).click();
  await expect.poll(async () => (await audio()).loaded).toBe(0);
  await page.getByRole("button", { name: "开启环境音" }).click();
  await expect(page.getByRole("button", { name: "关闭环境音" })).toBeVisible();
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.getByRole("button", { name: "开启环境音" })).toBeVisible();
  expect((await audio()).playing).toBe(0);
  await page.evaluate(() => { Reflect.deleteProperty(document, "visibilityState"); document.dispatchEvent(new Event("visibilitychange")); });
  await page.getByRole("button", { name: "开启环境音" }).click();
  await expect(page.getByRole("button", { name: "关闭环境音" })).toBeVisible();
  await page.getByTestId("fixture-mount").click();
  await expect.poll(async () => (await audio()).loaded).toBe(0);
  expect((await audio()).playing).toBe(0);
});
