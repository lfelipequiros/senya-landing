# 00 — Architecture Overview

The Architecture Specification Document (ASD) for Senya 1st Landing: the reference for *what is
correct*. Settle design questions here before building. Decisions are recorded as ADRs in
[`01-principles-and-decisions.md`](01-principles-and-decisions.md); this overview is the map.

**Deliberately simple.** This is a single-page, single-tenant, no-admin-surface product built by one
person (CLAUDE.md §2). The ASD stays proportional to that — one app, one seam, one data table — rather
than pre-building structure a project this size doesn't need.

## What we're building

A single client-side web experience (four scenes: opening → code gate → lead form → confirmation) that
writes one thing — a lead — through one narrow server boundary into one table. See
[`CLAUDE.md` §1](../CLAUDE.md) for the product framing; this file covers only the technical shape.

## The system at a glance

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (Vite + React + TypeScript, deployed static)        │
│  ─ scene state machine (ADR-002)                              │
│  ─ motion layer: Framer Motion (ADR-002)                      │
│  ─ the gate check runs SERVER-SIDE — the code never ships     │
│    to the client (ADR-004)                                    │
└───────────────┬─────────────────────────────┬─────────────────┘
                │ POST /api/verify-code        │ POST /api/leads
                ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Vercel Serverless Functions (ADR-002)                        │
│  ─ validates the request at the boundary (zod)                │
│  ─ verify-code: compares against the server-only secret       │
│  ─ leads: the ONLY caller of the data seam                    │
└───────────────────────────┬───────────────────────────────────┘
                             │  Result<T>  (ADR-003 seam contract)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Data seam — src/server/data/leadsRepository.ts (ADR-003)     │
│  ─ LeadsRepository interface: create, findByEmail             │
│  ─ SupabaseLeadsRepository (prod) · InMemoryLeadsRepository    │
│    (tests/fixture)                                             │
└───────────────────────────┬───────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Supabase Postgres (ADR-003) — one table: `leads`              │
└─────────────────────────────────────────────────────────────┘
```

**The seam** (ADR-003): everything above `leadsRepository.ts` talks to leads only through the
`LeadsRepository` interface — never a raw Supabase client, never a raw SQL string outside that one
file. Everything above the two API routes never sees the access code or the Supabase service key —
both are server-only. These two boundaries are what the gates protect (tech-planning's alignment
checklist, tech-build's invariants, tech-qa's compliance review all cite them by name).

## Core data model

One table. Single-tenant, so no tenant key is needed anywhere in this schema (ADR-005) — this is a
deliberate, named exception to a multi-tenant default, not an oversight.

```
leads
  id            uuid            primary key, default gen_random_uuid()
  name          text            not null
  email         text            not null, unique  -- the duplicate-detection key (PDR-002 / 02.7)
  phone         text            not null
  locale        text            not null          -- 'es' | 'en' — which language they used (PDR-004)
  created_at    timestamptz     not null, default now()
```

`email` carries the uniqueness constraint at the database level (ADR-003) — the duplicate check must
hold even under a concurrent double-submit, not only in application code (02.7's resolved edge case).

## What this architecture deliberately does *not* include (yet)

- **No admin/read UI** — the owner reads the list directly in Supabase's own table editor. Trigger to
  add one: the owner needs to act on the list from a phone with no laptop access, or needs filtering/
  export Supabase's UI doesn't offer.
- **No queue, cache, or streaming** — one write path, low volume, no fan-out. Trigger: sustained
  traffic that makes a single serverless function invocation per submission insufficient (not expected
  at this product's scale).
- **No monorepo / package workspace** — one Vite app is the whole product. Trigger: a second app
  (e.g. a real admin surface) needs to share the data seam — extract `src/server/data/` into a
  workspace package at that point, not before.
- **No authentication system** — there are no user accounts; the "gate" is a single shared secret
  checked server-side, not an identity system. Trigger: the product needs to recognize a *specific*
  returning person (contradicts PDR-002's statelessness as currently decided).
- **No rate limiting yet** — tracked as a named launch-blocker in `TECH-DEBT.md`, not silently skipped.
- **No e2e test runner (Playwright) yet** — component/unit tests (Vitest) cover the state machine and
  the API routes first. Trigger: the motion choreography itself needs regression coverage a unit test
  can't give (revisit once Epic 02's scene stories are built and something has broken twice).

## Cross-cutting concerns

- **Identity & access.** No user accounts. The only access-control surface is the shared code, verified
  server-side (ADR-004); Supabase access uses a service-role key that never reaches the client.
- **Observability.** Structured, prefixed console logs only (`[leads]`, `[verify-code]`) at this scale
  — Vercel's function logs are the only sink. No dedicated logging service until volume or an incident
  justifies one (stage-gated, CLAUDE.md §4).
- **Security.** Secrets are server-side only (CLAUDE.md §6 / ADR-004). Every external boundary (both API
  routes) validates its input with `zod` before touching the seam. No personal data (name/email/phone)
  is ever logged (02.7's resolved edge case).
- **Privacy.** Consent/privacy-statement copy is [OPEN-QUESTIONS.md Q-01](../OPEN-QUESTIONS.md) —
  blocks launch, not build.
