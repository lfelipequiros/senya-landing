# Senya 1st Landing — Project Instructions

Read this first. It is the whole method. If it is not in this file, it is not a rule.

---

## 1. What this is

A gated, animation-led launch experience for the **Senya** clothing brand that converts pre-launch
curiosity into a contact list.

A visitor arrives at one page that opens with a brand animation, reveals an access-code gate on
scroll, and — once the code is accepted — asks for name, email, and phone/WhatsApp before closing on
a confirmation. The code is a single shared secret distributed through the brand's own channels, so
the gate is what makes the list feel *earned* rather than harvested. The experience is deliberately
stateless: it replays in full on every visit, and a wrong code ends the run rather than offering a
retry.

**Solo developer. Single tenant. No deadline — the owner chose "get the UX right" over shipping speed.**

**The motion is the product.** Roughly 90% of this experience is choreography, pacing, and a
theatrical failure state. That is not decoration wrapped around a form — it is the brand statement
itself, and it is what justifies spending real effort on timing and feel. A competent plain gated
form would be a failure of this project, not a lean version of it.

---

## 2. What we are trading

Two things pull against each other here **by design**: the access gate, the stateless replay, and the
no-retry glitch all *cost* signups to *buy* exclusivity. That trade is deliberate and owner-approved
([PDR-001](product/decisions.md)). It is not a defect to optimize away.

So: a change either wins more/better captured contacts, or it makes the thing feel more like Senya.
Anything that does neither waits.

---

## 3. Stack

- **Hosting:** Vercel — static frontend plus two serverless API routes.
- **Frontend:** Vite + React + TypeScript (strict), Framer Motion for all motion.
- **Backend:** two serverless functions — `/api/verify-code`, `/api/leads`. No backend framework.
- **Data:** Google Sheets, one tab (`Leads`), written via a Google service account (ADR-007).
- **AI:** none.

Diagram and schema: [`architecture/00-overview.md`](architecture/00-overview.md). Decisions already
taken: [`architecture/01-principles-and-decisions.md`](architecture/01-principles-and-decisions.md)
(ADR-002–005).

---

## 4. The five invariants

Non-negotiable. Everything else is a judgment call you can make yourself.

1. **The access code and the Google service-account credentials never reach the client.** No debug
   bypass in shipped code.
2. **No raw Google Sheets API client outside `src/server/data/leadsRepository.ts`.**
3. **No name, email, phone, or access code in logs or error messages**, at any level.
4. **`zod` validates both API request bodies** before anything touches the seam.
5. **A failed capture fails loudly** — never a success screen over a lost lead, and never a silent
   drop.

Invariants 1–3 are already enforced mechanically by the `no-restricted-imports` ESLint rules and the
client/server `tsconfig` split. Do not weaken them to make something compile.

---

## 5. How we work

1. Pick the next story from [`PLAN.md`](PLAN.md). Write ~5 lines at the top of it: what, why, done-when.
2. Build it on one branch. Commit when green — `npm run typecheck && npm run lint && npm run test`.
3. Check it:
   - **S2 (capture) gets an Opus QA subagent.** It is the one place failure is invisible.
   - **Everything else: open it in a browser and look at it.** For a motion-led product that is
     faster and more reliable than any agent review.
4. Open a PR, merge it, tick the boxes in `PLAN.md` in the same commit.

That is the entire process. No gate skills, no approval ceremony, no per-story architecture pass.

**Plan before code still applies to anything that changes a shape** — the schema, a seam, an API
contract. Say what you intend and get a yes first. For a scene, a component, a style, or a copy
string, just build it.

---

## 6. Where things live

| What | Where |
|---|---|
| What is left to build, and status | [`PLAN.md`](PLAN.md) |
| **Why the product behaves as it does** — the real spec | [`product/decisions.md`](product/decisions.md) (PDR-001–004), [`product/screens-map.md`](product/screens-map.md) |
| Architecture and decisions already taken | [`architecture/`](architecture/) |
| Blocked on an answer only the owner has | [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) |

**Read `product/decisions.md` before building any scene.** PDR-001–004 settle the terminal gate, the
stateless replay, the reduced-motion choreography, and the bilingual rules. They were expensive to
work out and they are not re-litigated during a build — if one is wrong, say so and change the PDR
deliberately, rather than quietly building something else.

A deliberate shortcut goes in a `TODO:` comment next to the code, with the reason. A decision worth
keeping goes in `architecture/01-principles-and-decisions.md` as an ADR, or in `product/decisions.md`
as a PDR. Nothing else needs a file.

---

## 7. Known traps in this project

- **Over-building.** This is four stories and a few thousand lines. It had 2,500 lines of process
  governing 100 lines of code once already — do not rebuild that.
- **Under-building the motion.** The opposite failure, and the more expensive one. See §1.
- **Extracting the motion system late.** Four scenes that each invented their own timing are painful
  to unify. The vocabulary is defined once, in S1, before the scenes.
- **Lorem ipsum in a bilingual layout.** It hides the exact wrapping and timing problems the
  bilingual work exists to surface. Placeholder copy is realistic sentences of realistic length.
- **Losing typed input on a failed submit.** Someone who cleared the gate and then lost their form
  is the worst outcome in the product.
