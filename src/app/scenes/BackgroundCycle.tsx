import { useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent } from "react";
import { useAnimationFrame, useReducedMotion } from "framer-motion";
import {
  BURST_FRAMES,
  burstStart,
  createSequencer,
  cycleLength,
  frameAt,
  shapeFor,
} from "./backgroundSchedule";

// Every baked frame, discovered by glob rather than by a generated manifest — 21 images across two
// widths and two formats is 84 imports nobody should maintain by hand. Vite resolves these to
// hashed URLs at build time, and because this module is only ever reached through a lazy import
// behind PHOTO_BG_ON, an off build never pulls any of them into the bundle.
const assets = import.meta.glob("../assets/bg/*.{avif,webp}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

interface Frame {
  slug: string;
  avif: string;
  webp: string;
  /** Smallest webp, for the plain `src` a browser falls back to. */
  fallback: string;
}

interface Variant {
  url: string;
  width: number;
}

/**
 * Group `<slug>-<width>.<ext>` files into one srcset per format per image.
 *
 * The width in the filename is the real pixel width, so it doubles as the `w` descriptor.
 */
function collectFrames(): Frame[] {
  const byslug = new Map<string, { avif: Variant[]; webp: Variant[] }>();

  for (const [file, url] of Object.entries(assets)) {
    const name = file.slice(file.lastIndexOf("/") + 1);
    const dot = name.lastIndexOf(".");
    const ext = name.slice(dot + 1);
    const dash = name.lastIndexOf("-", dot);
    if (dash < 0 || (ext !== "avif" && ext !== "webp")) continue;

    const slug = name.slice(0, dash);
    const width = Number(name.slice(dash + 1, dot));
    if (!Number.isFinite(width)) continue;

    const entry = byslug.get(slug) ?? { avif: [], webp: [] };
    entry[ext].push({ url, width });
    byslug.set(slug, entry);
  }

  const byWidth = (variants: Variant[]) => [...variants].sort((a, b) => a.width - b.width);
  const srcset = (variants: Variant[]) =>
    byWidth(variants)
      .map((v) => `${v.url} ${v.width}w`)
      .join(", ");

  const frames: Frame[] = [];
  // Sorted so the set is stable across builds; the shuffle provides the randomness.
  for (const [slug, { avif, webp }] of [...byslug.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const smallest = byWidth(webp)[0];
    // A slug with no webp at all has nothing to fall back to, so it is not a usable frame.
    if (!smallest) continue;
    frames.push({ slug, avif: srcset(avif), webp: srcset(webp), fallback: smallest.url });
  }

  return frames;
}

const FRAMES = collectFrames();

interface BackgroundCycleProps {
  /**
   * Whether the cycle is running. Goes false at the capture form and stays false — the surface
   * rests on plain coral rather than strobing behind someone typing three fields one-handed.
   */
  active: boolean;
}

/**
 * The opening's background: a hold on coral, a burst of full-bleed photographs, a longer hold, on
 * a loop. The photographs carry the brand; the coral is what the whole surface is built on.
 *
 * Renders only the current burst's images, never the whole library — 21 full-viewport textures is
 * real GPU memory on the mid-range phone this is designed against.
 */
export function BackgroundCycle({ active }: BackgroundCycleProps) {
  const reduced = useReducedMotion() ?? false;

  const draw = useMemo(() => createSequencer(FRAMES.length, BURST_FRAMES), []);
  const [burst, setBurst] = useState<number[]>(() => draw());
  const [slot, setSlot] = useState<number | null>(null);

  // Refs, not state: these are read inside the animation frame and must not re-run it.
  const startRef = useRef<number | null>(null);
  const slotRef = useRef<number | null>(null);
  const readyRef = useRef(false);
  const loadedRef = useRef(0);
  // The burst after this one, drawn once and then warmed. Held so the warm and the swap use the
  // same draw — drawing separately would consume the sequencer twice per cycle, which both doubles
  // the fetching and breaks the guarantee that every image shows once per pass.
  const nextRef = useRef<number[] | null>(null);

  const [ready, setReady] = useState(false);
  readyRef.current = ready;

  // A fresh burst is unloaded until its images say otherwise.
  useEffect(() => {
    loadedRef.current = 0;
    setReady(false);
  }, [burst]);

  const settle = useCallback(() => {
    loadedRef.current += 1;
    if (loadedRef.current >= burst.length) setReady(true);
  }, [burst.length]);

  const onFrameLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      // `load` only promises the bytes arrived; decoding still happens on first paint and would
      // hitch mid-burst. decode() moves that work here, into the coral hold. Settle on rejection
      // too — a frame that will not decode should cost one blank slot, not freeze the cycle.
      event.currentTarget.decode().then(settle, settle);
    },
    [settle],
  );

  useAnimationFrame((time) => {
    if (!active || burst.length === 0) return;

    if (startRef.current === null) startRef.current = time;
    const total = cycleLength(reduced);
    const lead = burstStart(reduced);
    let elapsed = time - startRef.current;

    // Never start a burst half-loaded: hold the last moment of the coral lead until every image in
    // this burst has decoded. A burst that flashes empty frames reads as a broken page, and the
    // lead exists precisely to cover this.
    if (elapsed >= lead && !readyRef.current) {
      startRef.current = time - lead;
      elapsed = lead;
    }

    if (elapsed >= total) {
      startRef.current = time;
      elapsed = 0;
      const upcoming = nextRef.current ?? draw();
      nextRef.current = null;
      setBurst(upcoming);
    }

    const phase = frameAt(elapsed, reduced);
    const next = phase.phase === "image" ? phase.slot : null;
    // The frame loop runs at 60fps; the background changes 3 times a second. Only re-render when
    // the visible frame actually changes.
    if (next !== slotRef.current) {
      slotRef.current = next;
      setSlot(next);
    }
  });

  // Warm the next burst during the tail hold, so its images are already in cache when they mount
  // and the decode gate above has nothing left to wait for. The tail exists for exactly this.
  useEffect(() => {
    if (!active || !ready) return;
    const shape = shapeFor(reduced);
    const timer = window.setTimeout(
      () => {
        const upcoming = nextRef.current ?? draw();
        nextRef.current = upcoming;
        for (const index of upcoming) {
          const frame = FRAMES[index];
          if (!frame) continue;
          const warm = new Image();
          warm.sizes = "100vw";
          warm.srcset = frame.webp;
        }
      },
      shape.lead + shape.frame * BURST_FRAMES,
    );
    return () => window.clearTimeout(timer);
  }, [active, ready, reduced, draw]);

  if (FRAMES.length === 0) return null;

  return (
    <div className="bg-cycle" aria-hidden="true">
      {burst.map((index, position) => {
        const frame = FRAMES[index];
        if (!frame) return null;
        return (
          <div
            key={`${frame.slug}-${position}`}
            className="bg-frame"
            data-shown={slot === position ? "" : undefined}
          >
            <picture>
              {frame.avif && <source type="image/avif" srcSet={frame.avif} sizes="100vw" />}
              <img
                src={frame.fallback}
                srcSet={frame.webp}
                sizes="100vw"
                alt=""
                decoding="async"
                onLoad={onFrameLoad}
                onError={settle}
              />
            </picture>
          </div>
        );
      })}
    </div>
  );
}

export default BackgroundCycle;
