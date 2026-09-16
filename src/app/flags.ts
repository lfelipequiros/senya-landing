// Build-time feature flags.
//
// These are baked into the bundle by Vite at build time and are therefore PUBLIC — never put a
// secret here. The access code and the Google credentials are server-side only (ADR-004, and
// invariant 1 in CLAUDE.md); a flag is not a secret and this file is not a back door for one.
//
// Read flags from here rather than reaching for `import.meta.env` in a component, so there is one
// parse site to reason about and one thing for a test to stub.

/**
 * `PHOTO_BG_ON` — the opening's coral/photo background cycle.
 *
 * Off unless explicitly `"true"`, which keeps the heavier path opt-in: when it is off the opening
 * is plain coral and the image assets never reach the bundle at all (see OpeningScene, which
 * imports the component lazily so the flag drops the payload rather than merely hiding it).
 *
 * Exposed under its bare name via `envPrefix` in vite.config.ts.
 */
export const photoBgOn = import.meta.env.PHOTO_BG_ON === "true";
