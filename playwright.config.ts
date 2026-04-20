import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.PLAYWRIGHT_TEST_PORT ?? "3407");

export default defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: false,
    timeout: 30000,
    use: {
        baseURL: `http://127.0.0.1:${PORT}`,
        trace: "on-first-retry",
        headless: true,
    },
    webServer: {
        command: `bun --bun next dev --port ${PORT}`,
        url: `http://127.0.0.1:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
        env: {
            AUTH_E2E_STUB_MODE: process.env.AUTH_E2E_STUB_MODE ?? "1",
            NEXT_PUBLIC_SUPABASE_URL:
                process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co",
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
                process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "test-publishable-key",
        },
    },
});
