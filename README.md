# Senya 1st Landing

A gated, animation-led launch experience for the Senya clothing brand that converts pre-launch
curiosity into a contact list. See [`CLAUDE.md` §1](CLAUDE.md) for the full framing and
[`architecture/00-overview.md`](architecture/00-overview.md) for the technical shape.

**Hosted on:** GitHub, deployed on Vercel.

## Running the app

```sh
npm install
npm run dev        # local dev server
npm run typecheck  # strict TS, project-wide
npm run lint
npm run test        # vitest
npm run build       # production build
```

Copy [`.env.example`](.env.example) to `.env` and fill in real values before running anything that
touches the data seam or the code gate. Stack and architecture: [`architecture/00-overview.md`](architecture/00-overview.md).

## Where things live

- **[CLAUDE.md](CLAUDE.md)** — orientation: what we're building, how we decide, how to operate.
- **[PLAN.md](PLAN.md)** — what's left to build, and its status. **Read it first to know where
  things stand.**
- **[architecture/](architecture/)** — the Architecture Specification (the *why*) + the ADR log.
- **[product/](product/)** — the product decisions and screens map (why the product behaves as it
  does).
- **[OPEN-QUESTIONS.md](OPEN-QUESTIONS.md)** — decisions blocked on info someone has to go get.

## How we work

Pick the next story from [PLAN.md](PLAN.md), build it on one branch, check it (a browser look for
motion, an Opus QA subagent for the capture story), then open a PR and tick the box. See
[CLAUDE.md §5](CLAUDE.md) for the full process.
