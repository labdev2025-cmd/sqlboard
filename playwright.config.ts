import { defineConfig, devices } from "@playwright/test"

import { E2E_ENV, E2E_PORT } from "./tests/e2e/support/env"

/**
 * End-to-end tests run against the production build (`pnpm build` first)
 * with an isolated metadata database recreated by the global setup.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/support/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    locale: "pt-BR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  },
  projects: [
    { name: "setup", testMatch: /setup\.e2e\.ts/ },
    {
      name: "desktop",
      dependencies: ["setup"],
      testMatch: /.*\.e2e\.ts/,
      testIgnore: /setup\.e2e\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `node scripts/start.mjs -p ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: E2E_ENV,
  },
})
