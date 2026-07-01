import { defineConfig, devices } from "@playwright/test";

process.loadEnvFile?.(".env.test");

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

const webServerEnv = {
  ...process.env,
  BETTER_AUTH_URL: baseURL,
};

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `bun --env-file=.env.test run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: webServerEnv,
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "chromium-admin",
      dependencies: ["setup"],
      testMatch: /admin-flows\.e2e\.test\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/super-admin.json",
      },
    },
    {
      name: "chromium",
      testIgnore: [/admin-flows\.e2e\.test\.ts/, /.*\.setup\.ts/],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
