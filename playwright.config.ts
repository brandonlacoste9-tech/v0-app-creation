import { defineConfig, devices } from "@playwright/test";

/**
 * E2E against production by default (no local server required).
 * Local: BASE_URL=http://localhost:3000 npm run test:e2e
 */
const baseURL = process.env.BASE_URL?.replace(/\/$/, "") || "https://shipboard.ca";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  timeout: 45_000,
  expect: { timeout: 12_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
