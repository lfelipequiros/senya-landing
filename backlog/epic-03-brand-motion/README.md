# Epic 03 — Brand & Motion Identity

**Goal.** Replace Epic 02's generic styling with the real Senya identity: the actual logo and type, the
real opening animation, final Spanish and English copy in the brand's voice, real imagery, and the motion
polish that turns a working flow into something worth screenshotting. The structure does not change here
— only what it looks and sounds like.

**Value archetype.** Brand perception, almost exclusively. This epic adds no new capability and captures
no additional field; it is justified entirely by the second archetype in [CLAUDE.md §3](../../CLAUDE.md).
If the value model didn't name brand perception, this epic would be indefensible — which is precisely
why it was named.

**Depends on.** [Epic 02 — The Gated Flow](../epic-02-gated-flow/README.md), **fully closed**. Dressing a
flow whose choreography is still moving means doing the work twice. Also depends on the brand identity
existing as deliverable assets — see **[Q-02](../../OPEN-QUESTIONS.md)**, which is the real risk to this
epic's start date.

**Reference.** [architecture/](../../architecture/) · [`product/decisions.md`](../../product/decisions.md)
— this epic **cites** PDR-001 through PDR-004 rather than establishing new ones. If it finds itself
wanting to change one, that is a product decision needing a fresh `product-check` pass, not a styling
call to make mid-build.

---

## Surface / UX fit

Introduces **no new surface** and changes no surface's job. Every row in
[`screens-map.md`](../../product/screens-map.md) stays as Epic 02 left it; this epic changes only the
presentation of states that already exist.

**The constraint that defines this epic:** the flow's *shape* is settled. Scene order, what advances
each transition, the terminal glitch, the two endings, and the stateless replay are all decided and
recorded as PDRs. This epic makes those decisions look like Senya — it does not revisit them.

---

## Prioritization

**Stated constraint:** no deadline; the owner chose UX quality over speed, which is what makes a separate
polish epic affordable at all rather than something compressed into Epic 02.

**Inline scoring:**

- **Confidence** — the lowest in the plan, and not for technical reasons: it depends on a brand identity
  that does not demonstrably exist yet (Q-02). Sequencing it second is what protects the project from
  that uncertainty — Epic 02 delivers a working product regardless of when the identity lands.
- **Time-to-market** — deliberately second. A generic-but-working experience can collect real leads
  today; a beautiful half-flow collects none.
- **Reliability** — low risk. Nothing here touches the capture path.
- **ROI** — real but conditional. High if the drop is actually driven by brand feeling, near-zero if the
  code is distributed to people who were coming anyway.

**The honest reading:** Epic 02 is the product; this epic is the difference between a form people
tolerate and an experience people screenshot. For a clothing brand launch that difference is the whole
point — but it is worth being clear-eyed that it is a *second* priority, not a co-equal one.

---

## Edge cases — resolved

- **Motion polish vs. the reduced-motion path.** Both choreographies get dressed. A reduced-motion
  visitor must receive the real *brand*, just calmer motion —
  [PDR-003](../../product/decisions.md) is not a licence to ship them a plainer identity.
- **Final copy vs. 02.8's scaffolding.** Copy is swapped through the existing scaffolding, never
  hardcoded back into scenes. Both languages land together; shipping polished Spanish against stale
  English placeholder is a visible seam.
- **Text length shifts.** Real brand copy will differ in length from 02.8's placeholders in both
  languages, so layouts and timings get re-validated — the scaffolding makes this cheap, not free.
- **Real assets and load weight.** Real imagery and type are heavier than placeholders. Mobile is the
  primary target and the opening is the highest-bounce moment in the product, so weight is a
  brand-perception concern here, not just a performance one.
- **The glitch.** Gets the real treatment, and stays terminal. Making it beautiful must not make it
  gentler — [PDR-001](../../product/decisions.md) governs.

## Edge cases — deferred

- **Sound design.** Considered, deferred from 02.3 to here, and still deferred — it needs an unmute
  affordance and an autoplay policy of its own. Promote it to a story only if the identity work calls
  for it.
- **Open Graph / share preview imagery.** Considered, deferred — genuinely matters for an
  Instagram-distributed link, and it needs real brand assets, so it belongs in this epic's planning pass
  rather than Epic 02's.

---

## Stories

| Story | Title |
|---|---|

*(none yet — stories get written when this epic is pulled. Deliberately left unsliced: the right slicing
depends on what the brand identity actually turns out to be, and guessing now would produce stories that
have to be rewritten. Expect roughly: identity system · the real opening animation · final ES/EN copy ·
imagery & share preview · motion polish pass.)*

---

## Definition of done (epic)

- The real Senya identity — logo, type, color — is applied across all four scenes and both endings.
- The opening animation is the real one, not a placeholder with real timing.
- Final Spanish and English copy is in place through 02.8's scaffolding, in the brand's voice.
- Real imagery is in place, and the experience still opens fast on a phone.
- Both the standard and reduced-motion choreographies carry the full brand.
- The flow's shape is provably unchanged from Epic 02 — same scenes, same transitions, same endings, same
  PDRs.
