/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import verifyCode from "./api/verify-code";
import leads from "./api/leads";

type VercelHandler = (req: VercelRequest, res: VercelResponse) => void | Promise<void>;

// Dev-only stand-in for Vercel's serverless functions. Plain `vite` (npm run
// dev) doesn't serve /api/*, and `vercel dev` needs the CLI logged into an
// account — this shim reuses the real handlers so there's one source of
// truth for the route logic, just adapted onto Node's raw req/res.
function apiDevShim(): Plugin {
  return {
    name: "senya-api-dev-shim",
    configureServer(server: ViteDevServer) {
      const routes: Record<string, VercelHandler> = {
        "/api/verify-code": verifyCode,
        "/api/leads": leads,
      };

      for (const [path, handler] of Object.entries(routes)) {
        server.middlewares.use(path, async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end(JSON.stringify({ ok: false }));
            return;
          }

          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);

          let body: unknown;
          try {
            body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false }));
            return;
          }

          const mockReq = { method: req.method, body } as VercelRequest;
          const mockRes = {
            status(code: number) {
              res.statusCode = code;
              return mockRes;
            },
            json(payload: unknown) {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(payload));
            },
          } as unknown as VercelResponse;

          await handler(mockReq, mockRes);
        });
      }
    },
  };
}

export default defineConfig(({ mode, command }) => {
  if (command === "serve") {
    Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  }

  return {
    plugins: [react(), ...(command === "serve" ? [apiDevShim()] : [])],
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
      include: ["src/**/*.{test,spec}.{ts,tsx}", "api/**/*.{test,spec}.ts"],
    },
  };
});
