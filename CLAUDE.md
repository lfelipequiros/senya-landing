# Senya 1st Landing — Project Instructions

> Orientation document for any Claude instance working in this repo.
> Read this first. It defines what we're building, how we decide, and how to operate.

---

## 0. Nested `CLAUDE.md` Precedence

*(Only relevant once this project has more than one app/package, each with its own `CLAUDE.md` —
skip this section entirely for a single-app project.)*

A nested `CLAUDE.md` (inside an app or package directory) and this root file can disagree, and both
are read. The rule: **the app-level file wins for that app's own internals** (its framework
conventions, its file layout, its local testing quirks); **this root file wins for cross-app
strategy** (the value model, the decision principles, which app owns which seam, the delivery
contract below). Neither silently overrides the other.

- **Conflicts get surfaced, not resolved by guessing.** If a nested file's instruction contradicts
  this one, say so explicitly and ask — don't pick a side quietly. A wrong silent pick compounds
  every time it's followed again.
- **Reusable patterns flow up.** A convention discovered inside one app that turns out to apply
  everywhere belongs here, at the root, not copy-pasted into every app's own file — that's the same
  duplication-is-the-bug principle the rest of this document runs on.

---

## 1. What Senya 1st Landing Is

A gated, animation-led launch experience for the **Senya** clothing brand that converts pre-launch
curiosity into a contact list.

A visitor arrives at a single web experience that opens with a brand animation, reveals an access-code
gate on scroll, and — once the code is accepted — asks for their name, email, and phone/WhatsApp before
closing on a confirmation. The code is a single shared secret distributed through the brand's own
channels, so the gate is what makes the list feel earned rather than harvested. Two audiences: the
**prospective customer** who moves through the experience, and the **brand owner** who receives the
resulting contact list. The experience is deliberately stateless — it replays in full on every visit,
and a wrong code ends the run rather than offering a retry — because the drama of the gate is itself
part of what the brand is saying.

---

## 2. Operating Context

- **Team:** solo developer. Scope and sequencing must respect this bandwidth — prefer fewer,
  higher-leverage builds over broad surface area.
- **Tenancy:** single-tenant. *(If multi-tenant: every data model is tenant-aware from day one, even if
  one tenant is onboarded at a time.)*

---

## 3. Value Model (why we build anything)

Every candidate feature, integration, or stack choice must be justifiable against **at least one**
value archetype. If it can't, it waits.

- **Acquisition** — a captured, reachable contact is the asset this project exists to produce. Anything
  that measurably raises completed signups (or the quality of what's captured) scores here.
- **Brand perception** — the experience *is* a brand statement, not packaging around a form. This is
  what justifies spending on motion, pacing, and a theatrical failure state that a plain form would
  never earn. A change that makes the product feel more like Senya scores here even with no lift in
  signups.
- **Enabler** — no direct value; justified only as the substrate something above depends on
  (Foundation, the seam, CI).

**The tension to hold consciously:** Acquisition and Brand perception pull against each other here by
design — the access gate, the stateless replay, and the no-retry glitch all *cost* signups to *buy*
exclusivity. That trade is deliberate and owner-approved (see [PDR-001](product/decisions.md)); it is
not a defect to optimize away, but it does mean any story claiming both archetypes should say which one
it's actually serving.

Secondary value (better decisions, momentum) is real but should be tied back to an archetype wherever
possible to keep priorities honest.

---

## 4. Decision Principles

**Evaluation axes for any tool / stack / app decision** (the north star):
**Confidence · Time-to-market · Reliability · ROI.** Nothing is dogma — everything can be analyzed and changed if the axes point
elsewhere.

**Integrate before you build.** Default to integrating or improving existing tools. Build a
replacement only when a system is (a) causing real problems, (b) costly, **and** (c) plausibly easy
to replace — judged by the axes above.

**Stage-gated architecture.** Introduce complexity (a warehouse, a queue, streaming, agents) only when
product reality justifies it — when a named trigger fires *(to define: the stage-gating triggers —
list them in `architecture/00-overview.md` during foundation)*. Premature complexity before
product-market fit is a failure mode.

**Plan before code.** Present a plan and receive **explicit approval** before writing or modifying
code. Act as a senior architect/analyst: structured analysis first, recommendations second,
implementation only after approval.

---

## 5. Tech & Architecture

- **Hosting / serverless:** Vercel (static frontend + two serverless API routes).
- **Frontend:** Vite + React + TypeScript (strict), Framer Motion for all motion.
- **Backend:** Two Vercel serverless functions (`/api/verify-code`, `/api/leads`) — no separate backend
  framework.
- **Data store:** Supabase Postgres, one table (`leads`).
- **AI:** none.
- **Data-access seam:** `src/server/data/leadsRepository.ts` — the `LeadsRepository` interface
  (ADR-003).

**Architecture overview:** one Vite app → two serverless API routes → one data seam → one Postgres
table. Full diagram and schema in [`architecture/00-overview.md`](architecture/00-overview.md).

**Seams (ADR-002, ADR-003, ADR-004):**
1. **The data seam** — everything talks to `leads` only through `LeadsRepository`
   (`src/server/data/leadsRepository.ts`); no raw Supabase client or SQL outside that file.
2. **The secret seam** — the access code and the Supabase service key are read only inside the two API
   routes; the client never receives either.

---

## 6. House Engineering Standards

This is a **lessons ledger**, not a wishlist. A standard earns its place here by citing the incident
that bought it — a real defect, a real production surprise, a real "we got burned by this" — not
because it sounded like good hygiene in the abstract. When you add one, say what it replaces or what
it would have prevented; a standard with no incident behind it is a guess wearing a rule's clothes,
and it's fair game to challenge.

- Typed result wrapper `Result<T>` for service-layer returns — every `LeadsRepository` method and both
  API route handlers return `Result<T>`, never throw across that boundary.
- Schema validation (`zod`) at every external boundary — both API routes validate their request body
  before it touches the seam.
- Strict types across the repo (`tsconfig.json` `strict: true`).
- Structured / prefixed logs for readability (`[leads]`, `[verify-code]`) — never log personal data
  (name/email/phone) or the access code, at any log level.
- **No schema change without the corresponding data-access update** in the same change set — a Supabase
  migration ships with its matching `LeadsRepository` change, always.

---

## 7. How Claude Should Operate in This Project

### 7.1 — Senior-architect posture & the four-gate lifecycle

- **Senior architect/analyst posture:** analysis → recommendation → (approval) → implementation.
- **Plan-first discipline & the four-gate lifecycle:** never write/modify code without an approved
  plan, and never let a new product idea reach architecture planning unshaped. Four skills enforce
  one lifecycle:
  - **`product-check`** (originate) — before a new idea becomes a backlog story at all, shapes and
    gatekeeps the *requirement*: checks it against the backlog and the product map for
    duplication/fit, works through prioritization and edge cases, hands off a product-shaped story.
    Stops before architecture — that's `tech-planning`'s job next. Skips itself for work with no
    product-facing requirement (a bug fix, tech-debt paydown, Foundation-style enabler work).
  - **`tech-planning`** (plan) — before any code, turns the task into an approved backlog story
    (architecture-aligned, value archetype named, target → increment → path-to-target explicit),
    and opens the story's one branch on approval (§7.2).
  - **`tech-build`** (build) — implements *only* the approved increment on that same branch, holds
    the invariants, runs a divergence protocol so code never silently drifts from the plan, and
    delivers the story's single PR on green.
  - **`tech-qa`** (prove it's done-done) — the independent pass: compliance review + results
    verification against the story's acceptance criteria. The only gate that merges (§7.2).

### 7.2 — The delivery contract

Stated here, once. Every gate's own `SKILL.md` states only the *procedure* it executes — for the
contract itself, it links back to this section rather than restating it; if you find a gate template
describing the branch/PR/merge mechanics in its own words, that's drift from this section, not a
second source of truth.

- **One branch per story.** A story gets **exactly one** branch (`feat/<story-id>-<slug>`), opened by
  `tech-planning` on approval. `tech-build` continues on that same branch — never opens a second one.
- **One PR per story.** `tech-build` opens it, on green, once the increment is complete — not before,
  and not offered as a menu of options. That single diff carries both the plan commit and the code, so
  its own history shows the *why* next to the *what*.
- **`tech-qa` is the only gate that merges.** On a PASS, `tech-qa` itself merges to `main`, syncs, and
  deletes the branch. No other step in the lifecycle merges anything.
- **The planning-only exception.** When a `tech-planning` pass produces no code to follow (a re-plan,
  a pure decision, Foundation-style sequencing work), it commits straight to `main` instead of opening
  a branch — a branch with no `tech-build` to run on it, and no `tech-qa` to merge it, would strand
  with no owner.

### 7.3 — The canonical wrap-up sequence

One unambiguous chain, stated once:

**`product-check` → `tech-planning` → `tech-build` → PR → `tech-qa` → merge → `record-learnings`.**

`handoff` is **not** on this spine. It's opt-in, on-demand — run it only when a specific
topic/conversation is worth resuming later (or when asked), never as a routine per-story step. If you
do write one, run `record-learnings` first so the handoff can link to what it just filed.

### 7.4 — Supersession & cleanup

When a story supersedes earlier work (a redesigned seam replaces an old one, a rewritten skill retires
a prior version), **the story that supersedes closes the superseded work in the same pass** — not as
a follow-up someone might get to. Two named failure modes to avoid:

- **Closing by assumption** — marking old work superseded without checking whether anything still
  depends on it.
- **Closing by omission** — shipping the replacement and simply never circling back to close the old
  entry, leaving two "current" answers to the same question.

A story that supersedes something carries a `#### 🧹 Cleanup on close` block naming exactly what it
retires (a file, a section, a decision) and why. `tech-qa` walks this block before merging — an
unresolved cleanup item is a review finding, not a nice-to-have.

### 7.5 — The status board

**The status board is the single status surface.** [`PROJECT-STATUS.md`](PROJECT-STATUS.md) owns
status (zero duplication), updated in the same commit as the work. A `.githooks/pre-commit` guard
backstops it.

### 7.6 — Decisions, debt, questions, and the knowledge loop

- **Decisions → ADRs** ([`architecture/01-principles-and-decisions.md`](architecture/01-principles-and-decisions.md));
  **deliberate shortcuts → [`TECH-DEBT.md`](TECH-DEBT.md)** (each with a paydown trigger);
  **external blockers → [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md)**; **sessions → `handoffs/`**.
- **Close the knowledge loop (the learnings sweep).** At the close of a story (§7.3), run
  **`record-learnings`** to sweep the session for durable knowledge the in-flight gates missed and
  route each to its canonical home — see the surface-routing table below. The sweep *links*, never
  duplicates.

### 7.7 — Repo-only memory: the surface-routing table

**Every durable fact lands on a committed, versioned, repo-owned surface — never an external memory
store.** This repo has no memory the team can't see, review, or diff; if a fact doesn't fit any row
below, ask before inventing a new home rather than reaching for one that isn't committed here.

| Kind of fact | Routes to |
|---|---|
| Status (what's active, what shipped) | [`PROJECT-STATUS.md`](PROJECT-STATUS.md) / [`backlog/CLOSED.md`](backlog/CLOSED.md) |
| Plan (scope, sequencing, acceptance criteria) | [`backlog/`](backlog/) — the story/epic files |
| Shortcuts taken on purpose | [`TECH-DEBT.md`](TECH-DEBT.md), with a paydown trigger |
| External blockers | [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) |
| Architecture/technical decisions | [`architecture/01-principles-and-decisions.md`](architecture/01-principles-and-decisions.md) — an ADR |
| Product/UX facts (a surface's job, a naming convention) | [`product/decisions.md`](product/decisions.md) / [`product/screens-map.md`](product/screens-map.md) |
| Operating rules, business/domain facts, cross-session context (who the user is, standing feedback, a project constraint) | this file (`CLAUDE.md`) — always confirmed with the user before editing |
| Session narrative / open threads worth resuming | [`handoffs/`](handoffs/) — via `handoff`, on-demand only (§7.3) |

`record-learnings` is the mechanism that walks this table at the close of a story; this row set is
the same one it uses, kept in the two places deliberately (its own copy carries operational detail —
*which form* the edit takes — this one is the map itself).

### 7.8 — Session-close traceability

Before calling a session done, a later reader (a teammate, or a future Claude instance with none of
this session's context) should be able to reconstruct **why** every change happened from committed
surfaces alone — not from a chat transcript that won't exist for them. Practically: every non-trivial
decision has an ADR or a debt/question row it traces to; the board reflects reality; nothing "obvious
in context right now" was left unwritten because it felt too obvious to note.

### 7.9 — Self-serve before declaring blocked

Most things that feel blocking aren't. Before opening an `OPEN-QUESTIONS.md` row or stopping to ask
the user, check whether the answer is actually derivable — from the code, the docs, git history, or a
reasonable default that can be revised later. **Only a genuine semantics call needs a human** (what
should this mean, which of two valid designs do we want) — a vendor's data shape, an existing
convention, or "what does this function already do" usually doesn't; go look before asking.

### 7.10 — Value lens

**Value lens always on:** when proposing anything, name which value archetype (§3) it serves.

### 7.11 — Token discipline: one stage, one session, right-sized model

The story file, the board, and the trackers are the durable state; the chat transcript is disposable.
Exploit that: run each lifecycle stage in a fresh context (`/clear` between stages) instead of one
marathon session — plan in one session, build in a fresh one bound to the approved story, QA in a
fresh one against the PR diff, and sweep learnings in a fresh one anchored to `git log`/diff. Never let
a working session grow past ~150K context (the cost of every later turn scales with everything
before it). Default models per stage on **Pro**: the plan's cheapest capable model for
tech-build, record-learnings, compass-check, handoff, and ad-hoc work; the plan's top-tier model for
tech-planning judgment and the tech-qa / code-review pass on high-stakes or architecture-heavy
stories; the most expensive/frontier model **only by explicit, named exception** — never a
routine-gate default. Default effort **medium**; raise only for the build/QA of complex increments.
Plan tier: Pro. This makes the cheapest-capable-model default a real cost lever, not a formality —
default to it deliberately for `tech-build`/`record-learnings`/`compass-check`/`handoff`/ad-hoc work,
and reserve the top-tier model for `tech-planning` judgment and QA on architecture-heavy stories, per
the standing exception this session runs under: **every `tech-qa` pass for this project is spun off to
an Opus subagent**, regardless of story stakes, for review independence (a fresh model, not just a
fresh context) — build and planning stay on the plan's default model.

---

## 8. Constraints & Prohibitions

- **No new infrastructure** until its stage-gating trigger fires (named list: `architecture/00-overview.md`).
- **No schema changes** without corresponding data-access updates.
- **No code without an approved plan.**
- **The access code and the Supabase service key never reach the client** — no exceptions, no debug
  bypass left in shipped code (ADR-004).
- **No raw Supabase client or SQL access outside `src/server/data/leadsRepository.ts`** (ADR-003).
- **No personal data (name/email/phone) or the access code in logs, error messages, or client-visible
  output**, at any log level.
