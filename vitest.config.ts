import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
            "server-only": path.resolve(__dirname, "tests/setup/server-only.ts"),
        },
    },
    test: {
        environment: "node",
        globals: true,
        setupFiles: ["./tests/setup/vitest.setup.ts"],
        include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "html"],
            include: ["src/**/*.ts", "src/**/*.tsx"],
            exclude: ["src/**/*.d.ts", "src/db/migrations/**", "src/db/seeds/**"],
        },
    },
});
