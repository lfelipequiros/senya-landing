# 01 — Principles & Decisions (ADR log)

The architecture decision record. **New architecture is recorded here as a new ADR** — not in a
changelog and not in the status board. Each ADR is short: the decision, why, and the consequence.
This is how the project stays *traceable*: a future reader can see not just what the architecture is,
but why it became that.

## Format

```markdown
### ADR-NNN — <title>
**Status:** accepted | superseded by ADR-MMM | proposed
**Context.** <the forces at play; what made this a decision>
**Decision.** <what we chose>
**Consequence.** <what follows — the trade we accepted, what it enables/forecloses>
```

## Decisions

### ADR-001 — Plan-first, three-gate lifecycle
**Status:** accepted
**Context.** A small team can't afford code that silently drifts from intent; "temporary" shortcuts
become permanent when they're invisible.
**Decision.** All application code flows through `tech-planning` → `tech-build` → `tech-qa`, with a
single status board (`PROJECT-STATUS.md`), an ADR log (this file), a debt log with paydown triggers,
and a session journal (`handoffs/`).
**Consequence.** A little ceremony per increment, bought back many times over in traceability and the
absence of drift. The gates stay lightweight so they're never worth skipping.

### ADR-002 — Vite + React + TypeScript on Vercel, Framer Motion for choreography
**Status:** accepted
**Context.** Solo developer (CLAUDE.md §2), one animation-heavy page, no deadline but real UX-quality
bar (owner's stated priority). Options weighed: (a) Next.js — more structure than one route needs,
meaningful build/runtime complexity for a single-page product; (b) a plain static site + vanilla JS —
maximum control, but the state machine (four scenes, conditional transitions) and reduced-motion
handling would be reinvented by hand; (c) **Vite + React + TypeScript**, deployed to Vercel, with
**Framer Motion** for the motion layer. Scored: **Confidence** high (mainstream, well-documented stack
a solo dev can move fast in) · **Time-to-market** best of the three (no framework ceremony, Vercel's
zero-config static+function deploy) · **Reliability** high (React's state model is a natural fit for a
scene state machine; Framer Motion's `AnimatePresence` directly matches "in-place transitions") · **ROI**
best — the cheapest path to the actual hard part (choreography), not the routing Next.js would add
unused.
**Decision.** Vite + React + TypeScript (strict) for the frontend; Framer Motion for all motion (scene
transitions, the glitch, reduced-motion variants); Vercel for hosting and the two serverless API
routes; Vitest + React Testing Library for tests; ESLint + Prettier for lint/format.
**Consequence.** No server-rendering, no routing library — the product doesn't need either (only
scenes 1–2 are URL-reachable per PDR-002, and there's exactly one route). Governs
[`architecture/00-overview.md`](00-overview.md)'s system diagram. If a second real route/app is ever
needed, that's a fresh decision, not an extension of this one.

### ADR-003 — Supabase Postgres as the data store; a single `LeadsRepository` seam
**Status:** accepted
**Context.** One entity (`leads`), one write path, one dedupe rule (unique email), and the owner
explicitly chose no admin surface (02.7) — reading the list has to happen *somewhere* without building
one. Options weighed: (a) a bespoke Postgres instance + a hand-rolled admin view — most control, most
build cost, directly contradicts the "capture only" scope; (b) a spreadsheet-backed service (e.g.
Google Sheets as a "database") — zero infra, but no real uniqueness constraint and a painful upgrade
path the moment this project grows; (c) **Supabase Postgres**, written through a single typed seam.
Scored: **Confidence** high (managed Postgres, a JS client, no ops) · **Time-to-market** best (a table
+ a `NOT NULL, UNIQUE` constraint is the entire setup) · **Reliability** high (a real DB enforces the
uniqueness invariant 02.7 depends on, even under a concurrent double-submit — a spreadsheet cannot) ·
**ROI** best — Supabase's own table editor **is** the "retrieve and export the list without an admin
surface" capability 02.7 asks for, at zero build cost.
**Decision.** One Postgres table (`leads`, schema in [`00-overview.md`](00-overview.md)) via Supabase.
All access goes through a `LeadsRepository` interface (`create`, `findByEmail`, both returning
`Result<T>`) at `src/server/data/leadsRepository.ts` — **the seam**. Two implementations:
`SupabaseLeadsRepository` (prod) and `InMemoryLeadsRepository` (tests/fixture, per 01.4's "trivial
fixture implementation" requirement). **Nothing outside this file may import the Supabase client or
write raw SQL/table access** — that is the seam invariant every later gate checks against.
**Consequence.** A schema change is only safe in the same change set as a `LeadsRepository` update
(CLAUDE.md §6, §8 — already a house standard, now concrete). Swapping the store later means writing one
new class, not touching call sites. Email uniqueness is enforced at the database level, not only in
application code, closing the concurrency gap 02.7 names as a resolved edge case.

### ADR-004 — The access code is verified server-side; it never ships to the client
**Status:** accepted
**Context.** PDR-001 requires the code check to actually gate — a client-side comparison (`if (input
=== "SENYA2026")`) would ship the secret in the JS bundle, inspectable by anyone, which defeats the
entire premise of "the list feels earned." Options: (a) client-side check against a build-time
constant — fastest, but the secret is trivially readable in devtools; (b) **a server-side check via a
dedicated API route**, the code held only in a Vercel environment variable. Scored: **Confidence**
high · **Time-to-market** trivial cost over option (a) — one serverless function · **Reliability**
high · **ROI** decisive — this is the one place a security shortcut would visibly contradict the
product's own premise, so the "cheap" option isn't actually cheap.
**Decision.** `POST /api/verify-code` receives the entered code, compares it server-side against an
environment variable (`ACCESS_CODE`, documented in `.env.example` per 01.3), and returns only a
boolean — never the code itself, never a token that encodes it. The client holds no copy of the secret
at any point.
**Consequence.** Governs [02.4](../backlog/epic-02-gated-flow/02.4.md)'s implementation directly — the
gate's normalization (casing/whitespace) happens server-side, in the one place that sees the real
value. No client-side fallback path may be added without superseding this ADR.

### ADR-005 — Single-tenant: no tenant key anywhere in this schema
**Status:** accepted
**Context.** CLAUDE.md §2 states single-tenant. The alignment checklist (tech-planning, tech-build,
tech-qa) defaults to expecting a tenant key on every scoped row/read — this ADR is the named exception
that satisfies that checklist rather than silently ignoring it.
**Decision.** No `tenant_id` (or equivalent) on `leads` or anywhere else in this schema. There is
exactly one brand, one drop, one list.
**Consequence.** If a second brand or a second drop-with-its-own-list is ever needed, that is a new
architectural decision (a real multi-tenancy retrofit, not a column you can add casually to a live
`leads` table with a `UNIQUE(email)` constraint) — flag it as a *decision*-lane finding the moment it
comes up, don't extend this schema ad hoc.
