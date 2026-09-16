# Product Decision Records (PDR)

The product-layer sibling to
[`architecture/01-principles-and-decisions.md`](../architecture/01-principles-and-decisions.md)'s ADR
log. An ADR settles a *technical* architecture question (which database, which seam); a **PDR**
settles a *product/UX* question that should hold across surfaces and stay consistent going forward —
a surface's job boundary, a naming/vocabulary convention, a recurring UX pattern. Where an ADR is
cited to justify a technical choice, a PDR is cited to justify a **product** one — including, most
often, to push back on a new request that would quietly break an existing convention.

**Append-only, numbered sequentially.** Maintained by the
[`product-check`](../.claude/skills/product-check/SKILL.md) skill — a new PDR is added only for a
genuinely new *durable* product call, not for every requirement it processes. Most requirements cite
an existing PDR rather than minting a new one.

**House shape**, matching the ADR log's terseness:

```markdown
### PDR-0NN — <short imperative title>

**Decision.** <the call, in one or two sentences.>

**Context.** <the forces; why this needed deciding.>

**Consequence.** <what this governs going forward; link the epic(s) it came from and lives in.>
```

---

## Owed — decided in principle, not yet minted

A PDR that is *known to be needed* but whose content is not yet determined. Listed here so the
obligation survives the story that raised it; each becomes a numbered PDR above when its content is
settled. Not a backlog — if an entry here stops being owed, delete it and say why.

*(none yet)*

---

## PDRs

### PDR-001 — Failure at the gate is theatrical and terminal; nowhere else is

**Decision.** A wrong or empty access code ends the run: the page glitches out and the only way forward
is a reload back to scene 1. No inline retry, no attempt counter, no lockout, no hint, and no
lead-recovery fallback for visitors without a code. **This treatment is scoped to the gate alone** — the
lead form is deliberately the opposite, and nothing a visitor types there may ever end their run.

**Context.** The gate is a social mechanism, not a security one: one shared code stops nobody determined,
but it makes entry feel earned and makes the list a list of people who were actually invited. The owner
chose a terminal failure because the severity *is* the brand statement. `product-check` raised that this
punishes a phone typo exactly as hard as an uninvited visitor, and offered three softer resolutions (a
skippable replay, reloading to the gate, a "no code?" capture); all three were rejected, so the trade is
visible here if signup numbers later come in low.

**Consequence.** Governs every error state in the product. New error states default to the *forgiving*
side of this line — the gate is the carve-out, not the precedent. Softening the gate during
implementation is a product decision requiring a fresh `product-check` pass, not an implementation call.
Note one bound the decision does not cover: casing, whitespace, and mobile autocorrect artifacts are
normalized before comparison, because glitching on a platform artifact is not a wrong answer.
Built in [S1 — Scene 2](../PLAN.md).

### PDR-002 — The experience is stateless; scenes are states of one surface, not routes

**Decision.** No client-side memory of any kind. Every visit replays the full run from scene 1, including
re-entering the code, and a refresh at any point restarts it. The four scenes are states of a single
surface: only scenes 1–2 are URL-reachable, and 3–4 exist solely as the result of a cleared gate.

**Context.** The owner's position is that the experience is the point and is meant to be watched from the
beginning, every time. The alternative — remembering an unlock so returning visitors skip ahead — was
offered and rejected.

**Consequence.** Two things follow that are easy to miss. First, because there is no client memory, the
same person can legitimately reach the form twice, so **duplicate detection must be server-side on
email** and gets its own visible ending rather than a silent no-op (built in [S2](../PLAN.md)). Second,
the opening animation is paid for on every single visit, which is a hard constraint on its length —
scene 1 must stay short, and must yield immediately to a visitor who scrolls (built in [S1 — Scene
1](../PLAN.md)). Any future proposal to persist state contradicts this PDR directly.

### PDR-003 — Reduced motion gets a real choreography, not a disabled one

**Decision.** `prefers-reduced-motion` selects a second, calmer choreography in which the flow stays
fully completable and still feels authored — transitions become fades and cuts rather than travel. No
state in the product may be communicated by movement alone. Reduced-motion visitors receive the same
outcomes as everyone else, including the terminal glitch; only the rendering differs.

**Context.** On a product that is ~90% motion, the usual "turn the animations off" reading would leave a
visitor on a static page with no signal that anything advanced — an unusable flow rather than an
accessible one. The reduced path is a design deliverable, not a fallback.

**Consequence.** Every scene owns its reduced-motion behavior (built in [S1](../PLAN.md)), and
[S3](../PLAN.md) dresses **both** choreographies — a reduced-motion visitor gets the full brand, just
calmer motion, and this PDR is not a licence to ship them a plainer identity.

### PDR-004 — Bilingual by default, with Spanish as the fallback; and the product's canonical vocabulary

**Decision.** The experience ships in Spanish and English. Language is detected from the browser,
defaults to **Spanish**, and can be overridden manually by a control that is present but subordinate to
the experience — never a navigation element competing with it. Switching mid-run preserves both position
in the flow and anything already typed. The product's canonical terms are **"scene"** (one of the four
states), **"the code"** (the single shared access code — not "password", which implies a per-person
credential it is not), and **"the list"** (the captured contacts).

**Context.** Text here is choreographed, and Spanish runs materially longer than English for the same
message, so language is a structural constraint on layout and motion timing rather than a late
localization concern. The original brief called the gate a "password"; it is a shared invitation code,
and naming it accurately prevents both a wrong mental model for visitors and a wrong data model later.

**Consequence.** The scaffolding is built in [S1](../PLAN.md) and proven against real choreography with
realistic-length placeholder copy in both languages — not lorem ipsum, which would conceal exactly the
wrapping and timing problems it exists to surface. Final wording arrives in [S3](../PLAN.md) through
that same scaffolding, in both languages together. Validation and error messages are localized too.
