import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

// Run against `next start`, after building, with no concurrent development server.
const baseURL = process.env.ARTDUO_PERFORMANCE_URL ?? "http://127.0.0.1:3220";
const outputPath = resolve(process.env.ARTDUO_PERFORMANCE_OUTPUT ?? "../../docs/assets/experience-integration-acceptance/performance.json");
const query = "有点累，撑了很久";
const releaseVersion = process.env.ARTDUO_PERFORMANCE_RELEASE ?? "2026-10-06-paintings";
const browser = await chromium.launch();
const runs = [];

try {
  // Warm server code/data for every mode, while retaining a cold browser cache per measured run.
  for (const view of ["classic", "experience"]) {
    const page = await browser.newPage();
    await page.goto(`${baseURL}/gallery/local/immersive?${new URLSearchParams({ query, releaseVersion, view, recipeVersion: "experience-v1", phase: "walk" })}`);
    await expect(page.locator("figure.immersive-lightbox").first()).toHaveAttribute("data-image-state", "ready", { timeout: 30_000 });
    await page.close();
  }
  for (let round = 1; round <= 5; round += 1) {
    for (const mode of ["classic", "experience-direct"]) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
      try {
        await context.addInitScript(() => {
          document.addEventListener("submit", () => {
            sessionStorage.setItem("artduo.qa.submit", String(performance.timeOrigin + performance.now()));
          }, true);
          const measurements = {};
          Object.assign(window, { artduoPerformanceQA: measurements });
          const inspect = () => {
            const start = Number(sessionStorage.getItem("artduo.qa.submit"));
            const figure = document.querySelector('figure.immersive-lightbox[data-image-state="ready"]');
            const img = figure?.querySelector("img.immersive-preview-image");
            const rect = img?.getBoundingClientRect();
            if (start && img?.complete && img.naturalWidth > 0 && rect?.width > 0 && rect.height > 0) {
              let current = img;
              let settled = true;
              while (current && current !== document.body) {
                const style = getComputedStyle(current);
                if (Number(style.opacity) < 0.99 || style.visibility === "hidden") settled = false;
                if (current.getAnimations().some((animation) => animation.playState === "running" && animation.effect?.getTiming().iterations !== Infinity)) settled = false;
                current = current.parentElement;
              }
              const elapsed = performance.timeOrigin + performance.now() - start;
              if (settled && measurements.visibleMs === undefined) measurements.visibleMs = elapsed;
              const next = [...document.querySelectorAll("button")].find((button) => /下一件|下一幅/.test(button.getAttribute("aria-label") ?? button.textContent ?? ""));
              const bounds = next?.getBoundingClientRect();
              const hit = bounds ? document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2) : null;
              if (settled && next && !next.disabled && hit && next.contains(hit) && !document.querySelector(".experience-walk.is-transitioning")) {
                measurements.actionableMs = elapsed;
                return;
              }
            }
            requestAnimationFrame(inspect);
          };
          requestAnimationFrame(inspect);
        });
        const page = await context.newPage();
        const view = mode === "classic" ? "classic" : "experience";
        await page.goto(`${baseURL}/?view=${view}`, { waitUntil: "networkidle" });
        const input = mode === "classic" ? page.getByLabel("策展意图") : page.getByLabel("写下一句此刻的心情或观看愿望");
        await input.fill(query);
        await page.getByRole("button", { name: mode === "classic" ? /生成观展路线/ : "开始观展" }).click();
        if (mode !== "classic") await expect(page.locator(".experience-preface")).toHaveCount(0);
        await page.waitForFunction(() => typeof window.artduoPerformanceQA?.actionableMs === "number", undefined, { timeout: 30_000 });
        const result = await page.evaluate(() => window.artduoPerformanceQA);
        const imageSrc = await page.locator("img.immersive-preview-image").first().getAttribute("src");
        if (!imageSrc?.includes(`releaseVersion=${releaseVersion}`)) throw new Error(`Unexpected release in ${imageSrc}`);
        runs.push({ round, mode, ...result });
        console.log(JSON.stringify(runs.at(-1)));
      } finally { await context.close(); }
    }
  }
} finally { await browser.close(); }

const summary = Object.fromEntries(["classic", "experience-direct"].map((mode) => {
  const selected = runs.filter((run) => run.mode === mode);
  const metric = (name) => { const sorted = selected.map((run) => run[name]).sort((a, b) => a - b); return { median: Math.round(sorted[2]), worst: Math.round(sorted.at(-1)) }; };
  return [mode, { visibleMs: metric("visibleMs"), actionableMs: metric("actionableMs") }];
}));
const additionalActionableMs = summary["experience-direct"].actionableMs.median - summary.classic.actionableMs.median;
const report = { measuredAt: new Date().toISOString(), runtime: "Next production server", browser: "Chromium", viewport: { width: 1440, height: 900 }, cache: "Fresh browser context per run; warmed server code and data", releaseVersion, query, prefacePolicy: "Entry opens the first artwork directly; exhibition notes are optional", budgetMs: 500, additionalActionableMs, passesBudget: additionalActionableMs <= 500, summary, runs };
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ summary, additionalActionableMs, outputPath }, null, 2));
if (!report.passesBudget) process.exitCode = 1;
