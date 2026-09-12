/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@app": path.resolve(__dirname, "src/app"),
      "@server": path.resolve(__dirname, "src/server"),
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    // Scoped to this app's own tests — scripts/board-check.test.mjs is a node:test file
    // belonging to the framework scaffold and must not be silently swept up here (it would
    // report as a 0-assertion pass under Vitest regardless of its own real result).
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
