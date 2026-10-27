import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.ARTDUO_WEB_E2E_PORT ?? "3211");
const baseURL = `http://127.0.0.1:${port}`;
const readyURL = `${baseURL}/`;

export default defineConfig({
  testDir: "./e2e",
  globalTeardown: "./e2e/teardown.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  reporter: "list",
  use: {
    baseURL,
    channel: process.env.ARTDUO_E2E_BROWSER_CHANNEL,
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
    url: readyURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
