import { readDevConfig } from "./scripts/dev-config.ts";
import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

if (existsSync(".env")) loadEnvFile(".env");

const dev = readDevConfig();

const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? dev.webOrigin,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: process.env.E2E_EXTERNAL
    ? undefined
    : [
        {
          command: "npm --prefix server run dev",
          env: { ...dev.env, AUTH_RATE_LIMIT_MAX: "100" },
          url: `${dev.apiOrigin}/health/ready`,
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
        },
        {
          command: "npm --prefix client run dev -- --host 127.0.0.1",
          env: dev.env,
          url: dev.webOrigin,
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
        },
      ],
});
