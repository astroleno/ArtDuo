import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.ARTDUO_WEB_E2E_PORT ?? "3211");
const baseURL = `http://127.0.0.1:${port}`;
const galleryReadyURL = `${baseURL}/gallery?query=I+want+a+quiet+moonlit+room`;

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "image-scene-fusion.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "node scripts/playwright-web-server.mjs",
    url: galleryReadyURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
