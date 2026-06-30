import { defineConfig, devices } from "@playwright/test";

process.loadEnvFile?.(".env.test");

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

const webServerEnv = {
  ...process.env,
  BETTER_AUTH_URL: baseURL,
  NODE_ENV: "production",
};

export default defineConfig({
  testDir: "./tests/performance",
  testMatch: "**/*.perf.test.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: "list",
  timeout: 180_000,
  use: {
    baseURL,
    trace: "off",
  },
  webServer: {
    command: `bun --env-file=.env.test run build && bun --env-file=.env.test run start -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 300_000,
    env: webServerEnv,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
