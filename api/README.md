# API routes

Vercel serverless functions (ADR-002). One file per route, deployed automatically — no router, no
framework. Both routes validate their input with `zod` at the boundary and return `Result<T>`-shaped
JSON; neither ever returns the access code or a Supabase key to the client (ADR-004).

- `verify-code.ts` — `POST /api/verify-code` ([02.4](../backlog/epic-02-gated-flow/02.4.md))
- `leads.ts` — `POST /api/leads` ([02.7](../backlog/epic-02-gated-flow/02.7.md))
