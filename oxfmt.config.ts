import { defineConfig } from "oxfmt";

export default defineConfig({
  ignorePatterns: [
    ".next/**",
    ".pnpm-store/**",
    "coverage/**",
    "dist/**",
    "docs/**",
    // The Expo app has its own format config and CI job.
    "mobile/**",
    "node_modules/**",
    "DESIGN.md",
    "README.md",
    "bun.lock",
    "pnpm-lock.yaml",
  ],
  printWidth: 100,
  sortTailwindcss: {
    stylesheet: "./src/app/globals.css",
    functions: ["cn", "cva", "clsx", "twMerge"],
  },
});
