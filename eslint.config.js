import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

const tsBase = {
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      ecmaFeatures: { jsx: true },
    },
  },
  plugins: {
    "@typescript-eslint": tseslint,
  },
  rules: {
    ...tseslint.configs.recommended.rules,
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  },
};

export default [
  {
    ignores: ["dist", "coverage"],
  },
  js.configs.recommended,
  {
    // The client — the only place browser globals and React rules apply.
    files: ["src/app/**/*.{ts,tsx}"],
    ...tsBase,
    languageOptions: { ...tsBase.languageOptions, globals: globals.browser },
    plugins: {
      ...tsBase.plugins,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...tsBase.rules,
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // ADR-003/ADR-004: the client never touches the data seam or the secret seam directly.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@server/*", "*/server/*"], message: "Client code may not import src/server — call the API routes instead (ADR-004)." },
            { group: ["google-auth-library"], message: "The Google Sheets auth client is server-only (ADR-007) — it may not be imported from src/app." },
          ],
        },
      ],
    },
  },
  {
    // The server — API routes + the data seam. Node globals, no React rules.
    files: ["api/**/*.ts", "src/server/**/*.ts"],
    ...tsBase,
    languageOptions: { ...tsBase.languageOptions, globals: globals.node },
    rules: {
      ...tsBase.rules,
      // ADR-007: only leadsRepository.ts may touch the Google Sheets auth client directly.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "google-auth-library",
              message: "Import the Sheets auth client only inside src/server/data/leadsRepository.ts (ADR-007).",
            },
          ],
        },
      ],
    },
  },
  {
    // Shared types/schemas — imported by both sides; no DOM or Node globals assumed.
    files: ["src/shared/**/*.ts"],
    ...tsBase,
  },
  {
    // Tests run under Vitest/jsdom — both global sets, seam rules don't apply to fixtures.
    files: ["**/*.test.{ts,tsx}", "src/test/**/*.ts"],
    ...tsBase,
    languageOptions: { ...tsBase.languageOptions, globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ["src/server/data/leadsRepository.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // Root-level build/tooling config (vite.config.ts, this file itself if ever renamed .ts).
    files: ["*.config.{ts,js}"],
    ...tsBase,
    languageOptions: { ...tsBase.languageOptions, globals: globals.node },
  },
];
