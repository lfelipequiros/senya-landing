# 00 — Roadmap & Epic Map

The plan of action: the sequenced epics, why they're in this order, and the record of how decisions
were made. The [architecture/](../architecture/) ASD is the reference for *what is correct*; this
backlog is *what we build next*. Each epic links to its own file with stories and acceptance criteria.

> **Status:** Backlog defined, not started. No code is written until an epic is pulled and its stories
> approved (plan-first — `tech-planning`). For the board shape — open work here, closed work in an
> append-only index — see [`PROJECT-STATUS.md`](../PROJECT-STATUS.md), documented once, there.

## Epic map

| # | Epic | Outcome | Value archetype | Depends on |
|---|---|---|---|---|
| 01 | [**Foundation**](epic-01-foundation/README.md) | The skeleton everything hangs on: repo structure, data layer, the seam(s), secrets, CI. | Enabler (gates all later value) | — |
| 02 | [**The Gated Flow**](epic-02-gated-flow/README.md) | The whole four-scene experience working end to end at placeholder fidelity — opening, code gate, lead form, both endings, real capture. | Acquisition + Enabler | 01 |
| 03 | [**Brand & Motion Identity**](epic-03-brand-motion/README.md) | The real Senya identity, the real opening animation, final ES/EN copy, imagery, motion polish. Same flow, dressed. | Brand perception | 02 |

## Sequencing logic

**01 → 02.** Foundation is pure enabler and stays lean: the leads captured in 02.7 need somewhere real to
land (01.2), the shared access code needs to be a secret rather than a literal (01.3), and the write path
needs the seam (01.4). Stories 02.1–02.6 can be built against a stub, but 02.7 cannot close until
Foundation is real — which is the dependency that actually sequences these two.

**02 → 03.** The split is deliberately along the *structure vs. identity* line, not along a
scenes-then-polish line. Epic 02 settles everything that is hard to change later — the scene state
machine, what advances each transition, the motion vocabulary, the terminal glitch, the two endings, the
bilingual scaffolding — and proves it with real capture at generic fidelity. Epic 03 then changes only
what things look and sound like. Ordering it this way means a working, lead-collecting product exists
before the brand identity does, which matters because the identity is the least certain input in the
whole plan ([Q-02](../OPEN-QUESTIONS.md)): if it slips, Epic 02 still shipped something that works.

**Why bilingual copy sits in 02, not 03.** Text is choreographed here — it animates in on timings tuned
to its length, and Spanish runs materially longer than English. Retrofitting a second language into
finished motion is the expensive path, so 02.8 builds the scaffolding and proves both languages against
the real choreography; only the final *wording* waits for the brand voice in Epic 03.

**What is deliberately absent.** No admin/read surface — the owner chose capture-only for the first
build, so the list is retrieved straight from the store (02.7). No analytics, no referral mechanic, no
email verification: all considered during `product-check` and recorded as deferred in the epic READMEs so
they aren't rediscovered as ideas later.

## How to use this backlog

1. Pull one epic. Read its file.
2. Confirm its stories and acceptance criteria still hold (and resolve any "confirm in this epic"
   unknowns).
3. Get explicit approval (plan-first) before writing code — run `tech-planning`.
4. Build story by story (`tech-build`); each story's acceptance criteria are its definition of done;
   prove it with `tech-qa`.
