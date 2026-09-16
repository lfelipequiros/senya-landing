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
│  Data seam — src/server/data/leadsRepository.ts (ADR-007)     │
│  ─ LeadsRepository interface: create, findByEmail             │
│  ─ GoogleSheetsLeadsRepository (prod) · InMemoryLeadsRepository│
│    (tests/fixture)                                             │
└───────────────────────────┬───────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Google Sheets, via a service account (ADR-007) — one tab      │
└─────────────────────────────────────────────────────────────┘
```

**The seam** (ADR-007, superseding ADR-003): everything above `leadsRepository.ts` talks to leads only
through the `LeadsRepository` interface — never a raw Sheets-API call outside that one file. Everything
above the two API routes never sees the access code or the Sheets service-account key — both are
server-only. These two boundaries are what the gates protect (tech-planning's alignment checklist,
tech-build's invariants, tech-qa's compliance review all cite them by name).

## Core data model

One sheet tab, one header row. Single-tenant, so no tenant key is needed anywhere in this schema
(ADR-005) — this is a deliberate, named exception to a multi-tenant default, not an oversight.

```
Leads (columns, in order)
  id            text (uuid)     generated server-side (crypto.randomUUID())
  name          text
  email         text            the duplicate-detection key (PDR-002 / 02.7) — checked in application
                                 code, not at the store (ADR-007's named tradeoff vs. ADR-003)
  phone         text
  locale        text            'es' | 'en' — which language they used (PDR-004)
  created_at    text (ISO 8601)
```

`email` uniqueness is enforced by `GoogleSheetsLeadsRepository.create` reading the column before
appending (ADR-007) — a best-effort check, not a database constraint. A genuinely concurrent
double-submit of the same email can both land; accepted as a low-probability risk at this product's
scale (02.7's resolved edge case, re-scoped by ADR-007).

## What this architecture deliberately does *not* include (yet)

- **No admin/read UI** — the owner reads the list directly in the Google Sheet. Trigger to add one:
  the owner needs filtering/export the Sheet's own UI doesn't offer.
- **No queue, cache, or streaming** — one write path, low volume, no fan-out. Trigger: sustained
  traffic that makes a single serverless function invocation per submission insufficient (not expected
  at this product's scale).
- **No monorepo / package workspace** — one Vite app is the whole product. Trigger: a second app
  (e.g. a real admin surface) needs to share the data seam — extract `src/server/data/` into a
  workspace package at that point, not before.
- **No authentication system** — there are no user accounts; the "gate" is a single shared secret
  checked server-side, not an identity system. Trigger: the product needs to recognize a *specific*
  returning person (contradicts PDR-002's statelessness as currently decided).
- **No rate limiting yet** — a named launch-blocker, not silently skipped. Add before launch.
- **No e2e test runner (Playwright) yet** — component/unit tests (Vitest) cover the state machine and
  the API routes first. Trigger: the motion choreography itself needs regression coverage a unit test
  can't give (revisit once S1's scenes are built and something has broken twice).

## Cross-cutting concerns

- **Identity & access.** No user accounts. The only access-control surface is the shared code, verified
  server-side (ADR-004); Sheets access uses a service-account key that never reaches the client.
- **Observability.** Structured, prefixed console logs only (`[leads]`, `[verify-code]`) at this scale
  — Vercel's function logs are the only sink. No dedicated logging service until volume or an incident
  justifies one (stage-gated, CLAUDE.md §4).
- **Security.** Secrets are server-side only (CLAUDE.md §6 / ADR-004). Every external boundary (both API
  routes) validates its input with `zod` before touching the seam. No personal data (name/email/phone)
  is ever logged (02.7's resolved edge case).
- **Privacy.** Consent/privacy-statement copy is [OPEN-QUESTIONS.md Q-01](../OPEN-QUESTIONS.md) —
  blocks launch, not build.
