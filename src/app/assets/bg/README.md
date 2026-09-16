# Opening background frames

**Generated — do not edit by hand.** Produced by `scripts/bake-bg.mjs` (`npm run bake:bg`)
from `assets from design/bg pics/`.

Every frame is tone-mapped so that, after the runtime `--senya-bg-scrim` is composited over
it, it sits on exactly the coral's relative luminance (0.190). So the black foreground ink
reads identically on every frame and on the plain coral (4.09:1), and the 3/second burst
lands flat — a change of content rather than a flash.

Files are named `<slug>-<width>.<ext>`, where `<width>` is the actual pixel width and doubles
as the srcset `w` descriptor.

See `src/app/scenes/BackgroundCycle.tsx`, which discovers these by glob.
