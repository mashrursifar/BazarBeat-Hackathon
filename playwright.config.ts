import { defineConfig, devices } from "@playwright/test";

const targetBaseUrl = process.env.BASE_URL || "http://127.0.0.1:5173";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: targetBaseUrl, ...devices["Desktop Chrome"] },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: process.platform === "win32" ? "npm.cmd run dev" : "npm run dev",
        url: "http://127.0.0.1:5173",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
