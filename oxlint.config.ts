import { defineConfig } from "oxlint";

export default defineConfig({
  ignorePatterns: [
    ".next/**",
    ".pnpm-store/**",
    "coverage/**",
    "dist/**",
    "node_modules/**",
    "*.tsbuildinfo",
  ],
  categories: {
    correctness: "error",
    suspicious: "warn",
  },
  plugins: [
    "typescript",
    "react",
    "jsx-a11y",
    "nextjs",
    "import",
    "promise",
    "unicorn",
    "node",
    "oxc",
  ],
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  settings: {
    next: {
      rootDir: ".",
    },
    react: {
      version: "19.2.6",
    },
  },
  rules: {
    "import/no-cycle": ["error", { maxDepth: 3 }],
    "jsx-a11y/click-events-have-key-events": "warn",
    "nextjs/no-img-element": "error",
    "react/jsx-key": "error",
    "react/jsx-no-useless-fragment": "warn",
    "react/react-in-jsx-scope": "off",
    "react/self-closing-comp": "warn",
  },
  overrides: [
    {
      files: ["next-env.d.ts", "src/app/layout.tsx"],
      rules: {
        "import/no-unassigned-import": "off",
      },
    },
    {
      files: ["src/components/ui/label.tsx"],
      rules: {
        "jsx-a11y/label-has-associated-control": "off",
      },
    },
  ],
});
