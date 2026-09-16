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

const PHOTO_BG_STUB = "\0senya:photo-bg-stub";

// Keeps PHOTO_BG_ON=false builds from carrying imagery they will never show.
//
// Marking the JSX branch dead is not enough on its own. Rollup still resolves and LOADS every
// module it can see a dynamic import for, and BackgroundCycle.tsx holds an eager `import.meta.glob`
// of all 21 baked frames — Vite emits those assets at load time, and tree-shaking the module
// afterwards does not un-emit them. The result is a 4.5MB dist of files nothing references. So when
// the flag is off, resolve the module to a stub instead: it is never loaded, the glob never runs,
// and the assets are never emitted in the first place.
function photoBackgroundStub(enabled: boolean): Plugin {
  return {
    name: "senya-photo-bg-stub",
    enforce: "pre",
    resolveId(source: string) {
      if (enabled || !source.endsWith("/BackgroundCycle")) return null;
      return PHOTO_BG_STUB;
    },
    load(id: string) {
      if (id !== PHOTO_BG_STUB) return null;
      return "export default function BackgroundCycle() { return null; }\n";
    },
  };
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (command === "serve") {
    Object.assign(process.env, env);
  }

  // Must match flags.ts: only the literal "true" turns the background on.
  const photoBgOn = env.PHOTO_BG_ON === "true";

  return {
    plugins: [
      react(),
      photoBackgroundStub(photoBgOn),
      ...(command === "serve" ? [apiDevShim()] : []),
    ],
    // Vite only exposes VITE_-prefixed vars to the client, so PHOTO_BG_ON needs its prefix named
    // here to reach import.meta.env. Deliberately narrow: this widens the client surface to exactly
    // one flag and cannot reach ACCESS_CODE or the GOOGLE_* credentials, which stay server-only
    // (ADR-004, and invariant 1). Anything matched here is PUBLIC in the bundle — never add a
    // prefix that a secret could fall under.
    envPrefix: ["VITE_", "PHOTO_BG_"],
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
