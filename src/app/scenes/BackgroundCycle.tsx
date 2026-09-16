import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/**
 * How long any one image gets to arrive and decode before the burst gives up on it.
 *
 * Generous on purpose — the point is to absorb a slow connection, not to race it. A frame that
 * misses the deadline is dropped from the burst exactly like one that errored, and the burst plays
 * with whatever is left rather than holding coral forever on a frame that is never coming.
 */
const PATIENCE_MS = 10_000;

const EMPTY_POSITIONS: number[] = [];
/** Per-burst load results: `ok` is what can be shown, `resolved` counts those plus the skipped. */
const EMPTY_LOADS = { of: EMPTY_POSITIONS, ok: EMPTY_POSITIONS, resolved: 0 };

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
  // The burst after this one, drawn once and then warmed. Held so the warm and the swap use the
  // same draw — drawing separately would consume the sequencer twice per cycle, which both doubles
  // the fetching and breaks the guarantee that every image shows once per pass.
  const nextRef = useRef<number[] | null>(null);

  // This burst's load results, by position rather than by element, so a frame that reports twice —
  // a cached image is already `complete` when the ref lands and then fires `load` anyway — counts
  // once. `resolved` is every position that has finished one way or the other; `ok` is the subset
  // that decoded and can actually be shown.
  const resolvedRef = useRef<Set<number>>(new Set());
  const okRef = useRef<Set<number>>(new Set());
  // Bumped per burst, and part of every frame's key. Two consecutive bursts can hold the same image
  // at the same position, and without this they would share a key — React would then keep the one
  // <img> with an unchanged src, which fires no `load`, so the burst could never report ready and
  // the cycle stalled on its first frame. (Unreachable for the first three bursts: 21 images taken
  // 7 at a time is one clean pass, so the earliest repeat is the fourth.)
  const passRef = useRef(0);
  const trackedRef = useRef(burst);
  if (trackedRef.current !== burst) {
    trackedRef.current = burst;
    passRef.current += 1;
    resolvedRef.current = new Set();
    okRef.current = new Set();
  }
  const pass = passRef.current;

  // Tagged with the burst they belong to, so a new burst starts unloaded by construction rather
  // than via an effect that would land after its frames had already reported.
  const [loads, setLoads] = useState(EMPTY_LOADS);
  const mine = loads.of === burst;
  /** Positions that decoded, in order — the only frames the burst will show. */
  const playable = mine ? loads.ok : EMPTY_POSITIONS;
  const resolved = mine ? loads.resolved : 0;

  const publish = useCallback((of: number[]) => {
    setLoads({
      of,
      ok: [...okRef.current].sort((a, b) => a - b),
      resolved: resolvedRef.current.size,
    });
  }, []);

  /** Record one frame's outcome. `usable: false` drops it from the burst rather than blanking it. */
  const resolve = useCallback(
    (position: number, usable: boolean) => {
      // A decode from a burst that has already been swapped out resolves against a DOM node nobody
      // is showing; letting it through would credit this burst for a frame it does not have.
      if (trackedRef.current !== burst) return;
      if (resolvedRef.current.has(position)) return;
      resolvedRef.current.add(position);
      if (usable) okRef.current.add(position);
      publish(burst);
    },
    [burst, publish],
  );

  const resolveAfterDecode = useCallback(
    (img: HTMLImageElement, position: number) => {
      // `load` only promises the bytes arrived; decoding still happens on first paint and would
      // hitch mid-burst. decode() moves that work here, into the coral hold — and a frame that will
      // not decode is dropped, since showing it would paint a blank slot mid-burst.
      img.decode().then(
        () => resolve(position, true),
        () => resolve(position, false),
      );
    },
    [resolve],
  );

  // Every frame in a burst mounts at the same moment, so one sweep at the deadline is per-image:
  // anything still pending has had the full PATIENCE_MS to itself. Those are dropped exactly like
  // an error, and the burst runs on what is left — a short burst is still the choreography, where a
  // permanent coral hold reads as a broken page. If nothing survived, `playable` is empty, the
  // surface stays coral for this whole cycle (the PHOTO_BG_ON=off experience) and the next burst
  // gets its own try, so a passing network blip heals itself.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      let dropped = false;
      for (let position = 0; position < burst.length; position += 1) {
        if (resolvedRef.current.has(position)) continue;
        resolvedRef.current.add(position);
        dropped = true;
      }
      if (dropped) publish(burst);
    }, PATIENCE_MS);
    return () => window.clearTimeout(timer);
  }, [burst, publish]);

  // Ready once every frame has resolved — decoded or given up on. Not "once `ok` is full": a burst
  // that lost a frame would then hold the lead forever, which is the stall this gate exists to
  // prevent.
  const ready = resolved >= burst.length;
  readyRef.current = ready;

  useAnimationFrame((time) => {
    if (!active || burst.length === 0) return;

    if (startRef.current === null) startRef.current = time;
    const total = cycleLength(reduced);
    const lead = burstStart(reduced);
    let elapsed = time - startRef.current;

    // Never start a burst half-loaded: hold the last moment of the coral lead until this burst's
    // images have decoded. A burst that flashes empty frames reads as a broken page, and the lead
    // exists precisely to cover this.
    const holding = elapsed >= lead && !readyRef.current;
    if (holding) {
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

    // While holding, show coral rather than what the schedule says. `frameAt(lead)` is the burst's
    // first image, so reading the schedule here would park a still photograph on screen for the
    // whole wait instead of the hold the wait exists to extend.
    let next: number | null = null;
    if (!holding) {
      const phase = frameAt(elapsed, reduced);
      // Walk the frames that actually decoded, wrapping so every slot the schedule emits lands on a
      // real one. The schedule always emits BURST_FRAMES slots, but the burst can be shorter — a
      // library smaller than a burst, sources the bake rejected, or frames a slow connection has
      // not delivered — and without the wrap those slots would flash blank mid-burst.
      if (phase.phase === "image" && playable.length > 0) {
        next = playable[phase.slot % playable.length] ?? null;
      }
    }

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
            key={`${pass}-${position}`}
            className="bg-frame"
            data-shown={slot === position ? "" : undefined}
          >
            <picture>
              {frame.avif && <source type="image/avif" srcSet={frame.avif} sizes="100vw" />}
              <img
                // A warmed image can already be complete by the time the ref lands, in which case
                // `load` fired before React attached the handler and will never fire again. Without
                // this the tail's own prefetch — which exists to make exactly that happen — would
                // be what stalls the next burst.
                ref={(img) => {
                  if (!img?.complete) return;
                  // naturalWidth 0 on a complete image means it failed before React could attach
                  // the error handler — resolved, but not usable.
                  if (img.naturalWidth === 0) resolve(position, false);
                  else resolveAfterDecode(img, position);
                }}
                src={frame.fallback}
                srcSet={frame.webp}
                sizes="100vw"
                alt=""
                decoding="async"
                onLoad={(event) => resolveAfterDecode(event.currentTarget, position)}
                onError={() => resolve(position, false)}
              />
            </picture>
          </div>
        );
      })}
    </div>
  );
}

export default BackgroundCycle;
