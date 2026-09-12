# Epic 02 — The Gated Flow

**Goal.** Ship the complete four-scene experience — opening → access gate → lead form → confirmation —
working end to end at **placeholder fidelity**: real layout, real type scale, real motion timing, real
capture, but no brand identity. Every state, transition, and failure path is finished and walkable;
only the *identity* is generic. When this epic closes, the UX is proven and [Epic 03](../epic-03-brand-motion/README.md)
has a working skeleton to dress.

**Value archetype.** Acquisition (the capture path is the asset this project exists to produce) +
Enabler (it's the substrate Epic 03 dresses). Brand perception is deliberately *deferred* to Epic 03 —
this epic proves the choreography, not the identity.

**Depends on.** [Epic 01 — Foundation](../epic-01-foundation/README.md). Specifically 01.2 (somewhere
for leads to land), 01.3 (the shared access code as a secret), and 01.4 (the data-access seam the write
path goes through). 02.1–02.6 can proceed against a stubbed seam; **02.7 cannot close** until 01.2/01.4
are real.

**Reference.** [architecture/](../../architecture/) · [`product/screens-map.md`](../../product/screens-map.md) ·
[`product/decisions.md`](../../product/decisions.md) — this epic establishes PDR-001 through PDR-004.

---

## Surface / UX fit

This epic **introduces the product's first and only surface**, so there is nothing existing to fit
into — it *sets* the conventions rather than honoring them. Four scenes on one route, registered in
[`screens-map.md`](../../product/screens-map.md) as a single surface with four states, not four routes:
the scenes are a state machine, and only scenes 1–2 are reachable by URL.

Flow shape (owner-decided): **scroll drives 1 → 2; acceptance drives 3 → 4 in place.** You cannot
scroll past a locked door, so scroll stops being the verb the moment the gate is cleared.

---

## Prioritization

**Stated constraint:** no deadline. Owner explicitly chose "get the UX right" over shipping speed.

**Inline scoring** (`compass-check` exists but the board is empty, so there's no wider picture for it to
weigh this against yet — its scorecard is applied here directly):

- **Confidence** — high. The requirement is fully shaped, every edge case is resolved, and there is no
  dependency on an unknown third party.
- **Time-to-market** — deliberately traded away by the owner. Noted, not optimized.
- **Reliability** — the one real risk is silent capture failure: a lead that appears to submit but never
  lands is invisible and unrecoverable. 02.7 carries that weight and is the epic's highest-risk story.
- **ROI** — high. This epic is the entire product; Epic 03 is polish on top of it.

**Sequencing note:** 02.1 and 02.2 gate everything else — the state machine and the motion primitives
are what every scene is built from. Doing scenes first and extracting a motion system afterward is the
predictable way this epic goes wrong.

---

## Edge cases — resolved

- **Wrong code.** Full-page glitch, then a button that reloads the whole page back to scene 1. No retry
  in place, no attempt limit, no lockout. *Owner override — see the concern recorded in [02.4](02.4.md)
  and [PDR-001](../../product/decisions.md).*
- **Arriving with no code at all.** Same as wrong code. A lead-recovery fallback ("no code? leave your
  email anyway") was proposed and **rejected** — capturing the uninvited would defeat the gate. Recorded
  so it isn't re-litigated.
- **Return visit / already unlocked.** No client-side memory. The experience replays in full, every
  visit, including re-entering the code. Deliberate ([PDR-002](../../product/decisions.md)).
- **Duplicate submission.** Because there's no client memory, the same person *can* reach the form
  twice. Detection is **server-side on email**; a known email gets its own distinct ending ("you're
  already on the list") rather than a silent no-op or a duplicate row. Two endings, both designed — see
  [02.6](02.6.md).
- **Empty / zero-data state.** Not applicable — this surface renders no collection; it only writes.
- **No permission / not entitled.** This is exactly the gate, not a separate state.
- **Partial / in-progress data.** A visitor who abandons mid-form is simply not captured. No partial
  record, no resume — consistent with the stateless stance.
- **Multi-tenant.** N/a — single-tenant, one brand.
- **Reused terms.** The product has no prior vocabulary. This epic establishes "scene", "the code", and
  "the list" as the canonical terms ([PDR-004](../../product/decisions.md)).
- **Reduced motion.** A product that is ~90% motion needs a real `prefers-reduced-motion` path, not a
  disabled one — the flow must stay completable and still feel intentional. Owned by
  [02.2](02.2.md) ([PDR-003](../../product/decisions.md)).
- **Mobile-first.** Primary target is a phone, since distribution is Instagram. Desktop is supported but
  is not the design reference.

## Edge cases — deferred

- **Consent + privacy for personal data.** Collecting name/email/phone needs a consent affordance and a
  privacy statement, and nobody has decided the wording or whether a policy URL exists yet —
  **[OPEN-QUESTIONS.md Q-01](../../OPEN-QUESTIONS.md)**. Blocks 02.5 from *shipping to real traffic*;
  does not block building it.
- **Rate limiting / abuse of the capture endpoint.** Considered, deferred — an open POST endpoint can be
  scripted to flood the list. Not worth solving before the thing exists, but it's a launch-blocker, not
  a nice-to-have. Revisit in 02.7's `tech-planning` pass.
- **Code rotation.** One shared code is assumed static for the first drop. Considered, deferred — if it
  leaks publicly there's no way to cut it off without a deploy. Acceptable at this stage.
- **Analytics / funnel instrumentation.** Considered, deferred — knowing where people drop out (opening
  vs. gate vs. form) would be genuinely valuable, but it's a separate concern from making the flow work.
  Candidate for `08-adhoc` once there's real traffic.
- **Email verification.** Considered, deferred — addresses are taken as given; no double opt-in in the
  first build.

---

## Stories

| Story | Title |
|---|---|
| [02.1](02.1.md) | Scene engine & flow state machine |
| [02.2](02.2.md) | Motion system & reduced-motion path |
| [02.3](02.3.md) | Scene 1 — opening |
| [02.4](02.4.md) | Scene 2 — the code gate & the glitch |
| [02.5](02.5.md) | Scene 3 — the lead form |
| [02.6](02.6.md) | Scene 4 — confirmation & the already-listed ending |
| [02.7](02.7.md) | Lead capture, storage & duplicate detection |
| [02.8](02.8.md) | Bilingual copy scaffolding (ES/EN) |

---

## Definition of done (epic)

- All four scenes walkable end to end on a phone, at placeholder fidelity, with every transition
  finished — no dead ends, no unstyled states.
- A real submission lands in the store and is retrievable; a repeat email produces the already-listed
  ending instead of a second row.
- The wrong-code glitch path works and returns the visitor to a full replay.
- The flow is completable under `prefers-reduced-motion`.
- Every string renders in both ES and EN with no layout or timing breakage.
- PDR-001 through PDR-004 are recorded, and Q-01 is either answered or explicitly accepted as a
  pre-launch blocker.
