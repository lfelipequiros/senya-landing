/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * `"true"` turns on the opening's coral/photo background cycle. Anything else, including unset,
   * leaves the opening on plain coral.
   *
   * Public — baked into the bundle at build time. Read it through `src/app/flags.ts`, not directly.
   * Reaches the client via `envPrefix` in vite.config.ts.
   */
  readonly PHOTO_BG_ON?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
