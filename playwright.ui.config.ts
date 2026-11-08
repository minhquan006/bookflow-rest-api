import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Keep the visual matrix on a separate managed API/request budget.
export default defineConfig(base, {
  testDir: "./tests/ui",
  retries: 0,
  outputDir: ".cache/ui-regression",
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report/ui", open: "never" }],
  ],
});
