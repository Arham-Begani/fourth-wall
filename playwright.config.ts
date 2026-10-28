import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60000,
  expect: { timeout: 12000 },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/browser-results.json" }],
  ],
  use: {
    baseURL: process.env.FW_TEST_URL || "http://localhost:5173",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1100 },
      },
    },
  ],
  webServer: process.env.FW_TEST_URL
    ? undefined
    : {
        command: "npm run dev -- --port 5173",
        url: "http://localhost:5173",
        reuseExistingServer: true,
      },
});
