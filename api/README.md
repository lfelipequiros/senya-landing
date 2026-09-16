# API routes

Vercel serverless functions (ADR-002). One file per route, deployed automatically — no router, no
framework. Both routes validate their input with `zod` at the boundary and return `Result<T>`-shaped
JSON; neither ever returns the access code or a Google service-account key to the client (ADR-004).

- `verify-code.ts` — `POST /api/verify-code` (built in [S1](../PLAN.md))
- `leads.ts` — `POST /api/leads` (built in [S2](../PLAN.md))
