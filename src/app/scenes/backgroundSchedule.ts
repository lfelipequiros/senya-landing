// The opening background's schedule and image sequencing, as pure functions.
//
// Kept out of the component on purpose: the timing is the part worth testing, and testing it here
// means arithmetic instead of fake timers, rAF stubs and flake.

/** How many images one burst shows before settling back to coral. */
export const BURST_FRAMES = 7;

export interface CycleShape {
  /** Coral, before the burst. */
  lead: number;
  /** How long each image holds. */
  frame: number;
  /** Cross-dissolve between images. Zero in full motion — the burst cuts. */
  crossfade: number;
  /** Coral, after the burst. Doubles as the window for fetching the next set. */
  tail: number;
}

/**
 * Full motion: 2s coral, seven images at ~3/second, 3s coral. 7331ms.
 *
 * The burst cuts rather than dissolves. Every frame is baked to the coral's exact luminance
 * (scripts/bake-bg.mjs), so a cut at this rate reads as a change of content, not as a flash.
 *
 * 333ms rather than an exact 1000/3: every duration here is a whole number of milliseconds, which
 * keeps the cycle length exactly representable. With 1000/3 the cycle runs 7333.333… and
 * `(total + 2000) % total` comes back as 1999.9999999999991 — i.e. the modulo that wraps the cycle
 * can drop the first frame of a burst. 0.1% off the nominal rate is not perceptible; an
 * intermittently missing frame would be.
 */
export const FULL: CycleShape = {
  lead: 2000,
  frame: 333,
  crossfade: 0,
  tail: 3000,
};

/**
 * Reduced motion: the same seven images and the same coral holds, each image dissolving over 400ms
 * and holding 1.2s. 13400ms.
 *
 * PDR-003 — a second choreography, not this one disabled. Same content, same outcome, calmer
 * rendering. A visitor who prefers reduced motion still gets the imagery.
 */
export const REDUCED: CycleShape = {
  lead: 2000,
  frame: 1200,
  crossfade: 400,
  tail: 3000,
};

export function shapeFor(reduced: boolean): CycleShape {
  return reduced ? REDUCED : FULL;
}

/** Total length of one cycle, in ms. */
export function cycleLength(reduced: boolean): number {
  const shape = shapeFor(reduced);
  return shape.lead + shape.frame * BURST_FRAMES + shape.tail;
}

/** When the burst starts, in ms from the top of the cycle. */
export function burstStart(reduced: boolean): number {
  return shapeFor(reduced).lead;
}

export type CyclePhase = { phase: "coral" } | { phase: "image"; slot: number };

const CORAL: CyclePhase = { phase: "coral" };

/**
 * What the background should be showing `elapsedMs` into the cycle.
 *
 * `slot` indexes the current burst's images (0..BURST_FRAMES-1), not the full library — which
 * image sits in a slot is the sequencer's business, below.
 */
export function frameAt(elapsedMs: number, reduced = false): CyclePhase {
  const shape = shapeFor(reduced);
  const total = cycleLength(reduced);

  // JS `%` keeps the sign, so a negative elapsed (a clock that stepped backwards, or a caller
  // offsetting into the past) has to be folded forward.
  let t = elapsedMs % total;
  if (t < 0) t += total;

  if (t < shape.lead) return CORAL;

  const into = t - shape.lead;
  const burst = shape.frame * BURST_FRAMES;
  if (into >= burst) return CORAL;

  // Clamp rather than trust the division: floating-point frame lengths (1000/3) can land exactly on
  // the boundary and produce slot === BURST_FRAMES.
  const slot = Math.min(Math.floor(into / shape.frame), BURST_FRAMES - 1);
  return { phase: "image", slot };
}

/** Fisher-Yates, with the randomness injected so tests can be deterministic. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    // Long-hand rather than a destructured swap: under noUncheckedIndexedAccess both sides of
    // `[a[i], a[j]] = [a[j], a[i]]` widen to `T | undefined`, and both indices are in range here.
    const held = out[i] as T;
    out[i] = out[j] as T;
    out[j] = held;
  }
  return out;
}

/**
 * Draws `take` distinct indices per call, from a bag that refills only once exhausted.
 *
 * A bag rather than `take` independent random picks: independent picks cluster and drop images, so
 * a visitor would see the same photo twice in one burst while others never appeared. This way every
 * image in the library shows exactly once before any repeats — with 21 images and 7 a burst, that
 * is complete coverage every three cycles, reshuffled after each pass.
 */
export function createSequencer(
  total: number,
  take: number = BURST_FRAMES,
  random: () => number = Math.random,
): () => number[] {
  if (total <= 0) return () => [];

  const size = Math.min(take, total);
  let bag: number[] = [];

  return function draw(): number[] {
    const drawn: number[] = [];

    while (drawn.length < size) {
      if (bag.length === 0) {
        bag = shuffle(
          Array.from({ length: total }, (_, i) => i),
          random,
        );
      }

      const candidate = bag.pop() as number;
      // Only reachable when a draw straddles a refill and the fresh bag re-offers something already
      // in this batch. Send it to the bottom rather than dropping it, so it is not skipped entirely.
      if (drawn.includes(candidate)) bag.unshift(candidate);
      else drawn.push(candidate);
    }

    return drawn;
  };
}
