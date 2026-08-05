import { defineConfig, devices } from "@playwright/test";

process.loadEnvFile?.(".env.test");

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

const webServerEnv = {
  ...process.env,
  BETTER_AUTH_URL: baseURL,
  // Production start avoids Turbopack/watchpack EMFILE on constrained macOS maxfiles.
  NODE_ENV: "production",
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
    command: `bash -lc 'ulimit -n 65536; bun --env-file=.env.test next build && bun --env-file=.env.test next start --hostname 127.0.0.1 --port ${port}'`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 300_000,
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
      // instant-nav needs EXPOSE_TESTING_API + playwright.instant.config.ts
      // money-loop is a dedicated multi-role project below
      testIgnore: [
        /admin-flows\.e2e\.test\.ts/,
        /.*\.setup\.ts/,
        /instant-nav\.e2e\.test\.ts/,
        /money-loop\.e2e\.test\.ts/,
      ],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Multi-role COD loop (create → deliver → handover → settlement → payout).
      // Runs with the default suite; needs working R2 uploads in `.env.test`.
      name: "chromium-money-loop",
      testMatch: /money-loop\.e2e\.test\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
