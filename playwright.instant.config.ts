import { defineConfig, devices } from "@playwright/test";

process.loadEnvFile?.(".env.test");

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

const webServerEnv = {
  ...process.env,
  BETTER_AUTH_URL: baseURL,
  EXPOSE_TESTING_API: "1",
};

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /instant-nav\.e2e\.test\.ts/,
  timeout: 120_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `bun --env-file=.env.test next build && bun --env-file=.env.test next start --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: webServerEnv,
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "instant-nav",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/super-admin.json",
      },
    },
  ],
});
