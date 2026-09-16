# Plan

The whole plan and the whole status board, in one file. Four stories. When a story is done, tick its
box and move its row to **Shipped**.

**Status:** building · **Now:** F — Foundation · **Blocked on you:** [Q-03](OPEN-QUESTIONS.md) (the access code)

| # | Story | State |
|---|---|---|
| — | 01.1 Repo & app structure | ✅ shipped (PR #1) |
| **F** | Foundation — table, secrets, seam, CI | next |
| **S1** | The flow — four scenes, placeholder fidelity, stubbed submit | after F |
| **S2** | Capture — the real write path | after S1 |
| **S3** | Dress it — the Senya identity | blocked ([Q-02](OPEN-QUESTIONS.md)) |

**The spec for *what to build* is [`product/decisions.md`](product/decisions.md) (PDR-001–004) and
[`product/screens-map.md`](product/screens-map.md).** Read those, not this file, for why the product
behaves the way it does. This file is only *what's left to do*.

---

## F — Foundation

One sheet, two secrets, one repository file, one CI workflow. An afternoon.

- [ ] The `Leads` sheet tab exists with its header row: id, name, email, phone, locale, created_at.
      Uniqueness on **normalized** email (lowercased, trimmed) is enforced in
      `GoogleSheetsLeadsRepository` — a best-effort application-level check, not a store constraint
      (ADR-007's named tradeoff for dropping Supabase).
- [ ] The service account exists, the Sheets API is enabled, and the sheet is shared with the service
      account's email (Editor access) — documented as setup steps in `.env.example`.
- [ ] `src/server/data/leadsRepository.ts` is the only file that calls the Google Sheets API. Every
      method returns `Result<T>` and never throws across that boundary.
- [ ] The access code and the Google service-account credentials are read from env, server-side only.
      Neither appears in client source or in any bundle.
- [ ] CI runs typecheck, lint, test, and build on push.

**Note.** Q-03 blocks the real access code. Wire the env var correctly with a placeholder value and
swap it at launch — that unblocks F and S1 today.

---

## S1 — The flow

All four scenes at placeholder fidelity, against a **stubbed** submit. No brand identity — real
layout, real type scale, real motion timing, generic looks.

This is one story and not six because the scenes share one state machine and one motion vocabulary.
Building them separately means building the seams between them six times.

### The state machine
- [ ] Scroll carries scene 1 → 2. Acceptance drives 3 and 4 **in place**, with no page change.
- [ ] A visitor cannot scroll past the gate.
- [ ] No URL reaches scene 3 or 4. Attempting it starts the run at scene 1.
- [ ] A refresh at any point restarts the full run from scene 1. No client memory of any kind.

### Motion (define once, use everywhere)
- [ ] One documented set of durations, easings, and entrance/exit primitives. Scenes use it rather
      than ad-hoc values.
- [ ] The glitch treatment is specified once and reused.
- [ ] Under `prefers-reduced-motion`, the entire flow is completable and still feels authored —
      fades and cuts rather than travel. **Not** "animations off."
- [ ] No state in the product is communicated by movement alone.
- [ ] Steady frame rate on a mid-range phone. Mobile is the design reference; desktop must not break.

### Scene 1 — opening
- [ ] Plays on load with placeholder marks and finished timing.
- [ ] A visible cue communicates that scrolling continues the experience. Not optional polish — a
      visitor who does not realize scrolling is the verb is a total loss.
- [ ] Scrolling during the animation advances immediately. The scroll wins; never trap someone who
      is already convinced.
- [ ] Stays short. It is paid for on every single visit ([PDR-002](product/decisions.md)).

### Scene 2 — the gate
- [ ] The correct code advances to the form in place.
- [ ] A wrong **or empty** code produces the full glitch and a single reload control that restarts
      from scene 1. No inline retry, no attempt counter, no lockout, no hint ([PDR-001](product/decisions.md)).
- [ ] Casing, surrounding whitespace, and mobile autocorrect artifacts are normalized before
      comparison. Glitching on a platform artifact is not a wrong answer.
- [ ] The code is read from configuration and appears nowhere in client source.
- [ ] Under reduced motion the glitch still happens and is still terminal — a different rendering,
      never a different outcome.

### Scene 3 — the form (UI only; submit is stubbed until S2)
- [ ] Appears in place after the gate clears, asking name, email, phone/WhatsApp.
- [ ] Each field brings up the right mobile keyboard.
- [ ] Invalid input is corrected inline, in place, non-destructively. **No input a visitor can type
      ever ends their run** — the terminal treatment is scoped to the gate alone.
- [ ] International phone numbers accepted with country context.
- [ ] Double-tap on submit cannot produce two submissions.
- [ ] Completable one-handed on a phone.
- [ ] Nothing is captured on abandonment. No partial record, no resume.

### Scene 4 — the two endings
- [ ] A new signup lands on a confirmation that leaves no doubt the visitor is on the list.
- [ ] A repeat email lands on a visibly different already-listed ending — warm reassurance, not error.
- [ ] Neither ending resembles the gate's glitch.
- [ ] Neither ending offers onward navigation. The run is over.
- [ ] Both are clearly distinguishable from each other under reduced motion.

### Bilingual (ES/EN)
- [ ] Every visitor-facing string exists in both languages, including validation and error messages.
- [ ] Detected from the browser, defaults to **Spanish**, manually overridable by a control that is
      present but subordinate to the experience ([PDR-004](product/decisions.md)).
- [ ] Switching mid-run preserves position in the flow and anything already typed.
- [ ] No scene breaks its layout or its motion timing in either language. Validate against the
      longer language.
- [ ] Placeholder copy is realistic sentences of realistic length in both languages — **not lorem
      ipsum**, which hides exactly the wrapping and timing problems this exists to surface.

**How to check S1:** open it in a browser, on a phone, in both languages, with reduced motion on and
off. Looking at it is faster and more reliable than any agent review.

---

## S2 — Capture

Replace S1's stubbed submit with the real write path.

**This is the only story that gets an Opus QA subagent.** Silent capture failure is the one thing
that kills this project invisibly — a lead that appears to submit but never lands is unrecoverable
and unnoticeable.

- [ ] A completed form produces exactly one retrievable entry with name, email, and phone.
- [ ] The same email again produces no second entry and reports "already listed" to the flow, which
      plays scene 4's already-listed ending.
- [ ] Casing and whitespace differences in an email do not create a duplicate.
- [ ] Two simultaneous submissions of the same email are checked against the sheet before either
      writes (best-effort — ADR-007 accepted that a true concurrent race can still both land, since a
      spreadsheet has no store-level uniqueness constraint; a real race being observed in the sheet is
      the trigger to revisit that ADR, not to add locking here).
- [ ] A failed write is reported to the visitor and **their typed values survive** so they can retry.
      Losing someone's input after they cleared a gate would be the worst failure in the product.
- [ ] No personal data in logs or error output, at any level.
- [ ] The owner can retrieve and export the full list directly from the store. "Captured" is not the
      same as "reachable" — verify this by actually doing it once.

---

## S3 — Dress it

The real Senya identity over the same flow: brand marks, type, color, imagery, the real opening
animation, final ES/EN wording through S1's scaffolding.

**Blocked on [Q-02](OPEN-QUESTIONS.md)** — the brand assets do not exist yet. This is the least
certain input in the whole plan, which is exactly why S1 ships a working, lead-collecting product
before it.

**The constraint that defines this story: the flow's shape is settled.** Scene order, what advances
each transition, the terminal glitch, the two endings, and the stateless replay are decided and
recorded as PDRs. This story makes those decisions *look like Senya* — it does not revisit them.
Wanting to change one is a product decision, not a styling call to make mid-build.

Deliberately left unsliced until the identity actually exists — guessing the slices now produces work
that has to be rewritten. Expect roughly: identity system · the real opening animation · final ES/EN
copy · imagery and share preview · a motion polish pass.

- [ ] Real logo, type, and color across all four scenes and both endings.
- [ ] The opening animation is the real one, not a placeholder with real timing.
- [ ] Final ES/EN copy in the brand's voice, swapped **through S1's scaffolding**, never hardcoded
      back into scenes. Both languages land together — polished Spanish against stale English
      placeholder is a visible seam.
- [ ] Layouts and motion timings re-validated: real copy differs in length from the placeholders in
      both languages. The scaffolding makes this cheap, not free.
- [ ] Real imagery in place and the opening still loads fast on a phone. Real assets are heavier than
      placeholders, and the opening is the highest-bounce moment in the product — weight is a
      brand-perception concern here, not just a performance one.
- [ ] Both choreographies are dressed. A reduced-motion visitor gets the full brand, just calmer
      motion — [PDR-003](product/decisions.md) is not a licence to ship them a plainer identity.
- [ ] The glitch gets the real treatment and **stays terminal**. Making it beautiful must not make it
      gentler ([PDR-001](product/decisions.md)).
- [ ] The flow's shape is provably unchanged: same scenes, same transitions, same endings, same PDRs.

**Deferred, on purpose.** Sound design (needs an unmute affordance and an autoplay policy of its
own). Open Graph / share preview imagery — genuinely matters for an Instagram-distributed link, and
needs real brand assets, so it belongs here rather than earlier.

---

## Shipped

| Story | Date | PR |
|---|---|---|
| 01.1 — Repository & app structure | 2026-09-15 | #1 |
