# Screens Map

A one-page index of every product surface: what it's *for*, in one line, and where the full reasoning
behind it lives. This file is a **pointer, not a duplicate** — [`decisions.md`](decisions.md)'s PDRs are
the source of truth for *why* a surface exists and how it works; this table exists so a new product idea
can be checked against every surface's job in one read.

**Maintained by the [`product-check`](../.claude/skills/product-check/SKILL.md) skill.** Add or
update a row whenever a requirement ships a new surface/route or changes what an existing one is for.
Status mirrors [`PLAN.md`](../PLAN.md) — that file is the single source for status; don't hand-edit
status here without it.

*(to define: "surface" means whatever this project's product actually has — a screen, a route, a CLI
subcommand, an API-facing capability. Rename the table's "Surface" column header to match if that
reads better for this project; the shape stays the same.)*

---

## Surfaces

The product has **one surface with four states**, not four surfaces. The scenes are a state machine
([PDR-002](decisions.md)): only scenes 1–2 are reachable by URL, and 3–4 exist only as the result of a
cleared gate. They're listed separately below because each has a genuinely distinct job, but a change to
any of them is a change to the same surface.

| Route / Entry point | Surface | Job to be done (one line) | Story | Status |
|---|---|---|---|---|
| `/` — scene 1 | Opening | Assert the brand is worth attention and earn the scroll — no navigation, no explanation. | [S1](../PLAN.md) | `after F` |
| `/` — scene 2 (on scroll) | The code gate | Separate invited visitors from passers-by with one shared code; wrong code ends the run. | [S1](../PLAN.md) | `after F` |
| `/` — scene 3 (gate cleared) | The lead form | Capture name, email, and phone/WhatsApp with as little friction as possible. | [S1](../PLAN.md) | `after F` |
| `/` — scene 4 (submitted) | Confirmation / already-listed | Leave no doubt the visitor is on the list — two endings, new and returning. | [S1](../PLAN.md) | `after F` |

**Not a product surface (infra only, no job of its own):**

- **The capture write path** (built in [S2](../PLAN.md)) — the endpoint behind scene 3's submit and
  scene 4's branch. Produces the project's only durable output, but has no job a visitor perceives.
- **No admin or list-reading surface exists**, deliberately. The owner chose capture-only for the first
  build; the list is retrieved directly from the store. Recorded here so its absence reads as a decision
  rather than an oversight.
