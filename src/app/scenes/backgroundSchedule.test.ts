import { describe, expect, it } from "vitest";
import {
  BURST_FRAMES,
  FULL,
  REDUCED,
  createSequencer,
  cycleLength,
  frameAt,
  shuffle,
} from "./backgroundSchedule";

describe("cycleLength", () => {
  it("is 2s coral + seven images at ~3/second + 3s coral", () => {
    expect(cycleLength(false)).toBe(2000 + 333 * 7 + 3000);
    expect(cycleLength(false)).toBe(7331);
  });

  it("is a whole number of milliseconds, so wrapping the cycle cannot lose a frame", () => {
    expect(Number.isInteger(cycleLength(false))).toBe(true);
    expect(Number.isInteger(cycleLength(true))).toBe(true);
  });

  it("gives reduced motion a longer cycle for the same seven images", () => {
    expect(cycleLength(true)).toBe(2000 + 1200 * 7 + 3000);
    expect(cycleLength(true)).toBeGreaterThan(cycleLength(false));
  });
});

describe("frameAt", () => {
  it("holds on coral through the lead", () => {
    expect(frameAt(0)).toEqual({ phase: "coral" });
    expect(frameAt(1999)).toEqual({ phase: "coral" });
  });

  it("starts the burst exactly at the lead boundary", () => {
    expect(frameAt(2000)).toEqual({ phase: "image", slot: 0 });
  });

  it("advances one slot every 333ms", () => {
    expect(frameAt(2000 + 0)).toEqual({ phase: "image", slot: 0 });
    expect(frameAt(2000 + 332)).toEqual({ phase: "image", slot: 0 });
    expect(frameAt(2000 + 333)).toEqual({ phase: "image", slot: 1 });
    expect(frameAt(2000 + 666)).toEqual({ phase: "image", slot: 2 });
    expect(frameAt(2000 + 333 * 6)).toEqual({ phase: "image", slot: 6 });
  });

  it("shows every slot exactly once per cycle", () => {
    const seen = new Set<number>();
    for (let t = 0; t < cycleLength(false); t += 1) {
      const phase = frameAt(t);
      if (phase.phase === "image") seen.add(phase.slot);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("never returns a slot past the end of the burst", () => {
    const lastMoment = 2000 + 333 * BURST_FRAMES - 0.0001;
    expect(frameAt(lastMoment)).toEqual({ phase: "image", slot: BURST_FRAMES - 1 });
  });

  it("returns to coral for the tail", () => {
    const burstEnd = FULL.lead + FULL.frame * BURST_FRAMES;
    expect(frameAt(burstEnd)).toEqual({ phase: "coral" });
    expect(frameAt(burstEnd + 2999)).toEqual({ phase: "coral" });
  });

  it("wraps at the end of the cycle", () => {
    const total = cycleLength(false);
    expect(frameAt(total)).toEqual(frameAt(0));
    expect(frameAt(total + 2000)).toEqual(frameAt(2000));
    expect(frameAt(total * 4 + 2500)).toEqual(frameAt(2500));
  });

  it("treats a backwards clock as the equivalent point in the cycle", () => {
    const total = cycleLength(false);
    expect(frameAt(-1)).toEqual(frameAt(total - 1));
    expect(frameAt(-total - 500)).toEqual(frameAt(total - 500));
  });

  it("runs the same phases on a slower clock under reduced motion", () => {
    expect(frameAt(1999, true)).toEqual({ phase: "coral" });
    expect(frameAt(2000, true)).toEqual({ phase: "image", slot: 0 });
    expect(frameAt(2000 + 1200, true)).toEqual({ phase: "image", slot: 1 });
    expect(frameAt(REDUCED.lead + REDUCED.frame * BURST_FRAMES, true)).toEqual({ phase: "coral" });
  });

  it("still shows all seven images under reduced motion — calmer, not fewer (PDR-003)", () => {
    const seen = new Set<number>();
    for (let t = 0; t < cycleLength(true); t += 10) {
      const phase = frameAt(t, true);
      if (phase.phase === "image") seen.add(phase.slot);
    }
    expect(seen.size).toBe(BURST_FRAMES);
  });
});

describe("shuffle", () => {
  it("keeps every item", () => {
    const items = [0, 1, 2, 3, 4];
    expect([...shuffle(items)].sort()).toEqual(items);
  });

  it("does not mutate its input", () => {
    const items = [0, 1, 2, 3, 4];
    shuffle(items, () => 0);
    expect(items).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("createSequencer", () => {
  it("draws distinct images within one burst", () => {
    const draw = createSequencer(21);
    for (let i = 0; i < 20; i += 1) {
      const drawn = draw();
      expect(drawn).toHaveLength(BURST_FRAMES);
      expect(new Set(drawn).size).toBe(BURST_FRAMES);
    }
  });

  it("covers the whole library every three cycles, with no repeat", () => {
    const draw = createSequencer(21);
    const drawn = [...draw(), ...draw(), ...draw()];
    expect(drawn).toHaveLength(21);
    expect([...new Set(drawn)].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 21 }, (_, i) => i),
    );
  });

  it("keeps covering the library on later passes", () => {
    const draw = createSequencer(21);
    for (let pass = 0; pass < 5; pass += 1) {
      const drawn = [...draw(), ...draw(), ...draw()];
      expect(new Set(drawn).size).toBe(21);
    }
  });

  it("reshuffles between passes rather than repeating an order", () => {
    const draw = createSequencer(21);
    const first = [...draw(), ...draw(), ...draw()];
    const second = [...draw(), ...draw(), ...draw()];
    expect(second).not.toEqual(first);
  });

  it("never repeats inside a burst when the library does not divide evenly", () => {
    // 10 images and 7 a burst forces a draw to straddle a refill — the case the bag has to guard.
    const draw = createSequencer(10, 7);
    for (let i = 0; i < 50; i += 1) {
      const drawn = draw();
      expect(new Set(drawn).size).toBe(7);
    }
  });

  it("asks for no more than the library holds", () => {
    const draw = createSequencer(3, 7);
    expect(draw()).toHaveLength(3);
  });

  it("copes with an empty library rather than spinning", () => {
    expect(createSequencer(0)()).toEqual([]);
  });
});
