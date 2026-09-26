import { defineConfig, devices } from "@playwright/test";

/**
 * E2E against production by default (no local server required).
 * Local: BASE_URL=http://localhost:3000 npm run test:e2e
 */
const baseURL = process.env.BASE_URL?.replace(/\/$/, "") || "https://shipboard.ca";

/**
 * Egress proxy for sandboxed runners (Playwright does not read proxy env
 * vars on its own). Set E2E_PROXY_SERVER=http://host:port to route the
 * browser through it. Unset = direct, as before.
 */
const proxyServer = process.env.E2E_PROXY_SERVER;

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
    ...(proxyServer ? { proxy: { server: proxyServer } } : {}),
    ...devices["Desktop Chrome"],
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
