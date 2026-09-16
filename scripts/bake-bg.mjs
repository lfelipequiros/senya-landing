// Bakes the opening background photos from `assets from design/bg pics/` into optimized,
// luminance-normalized derivatives under `src/app/assets/bg/`.
//
// Run by hand (`npm run bake:bg`), not in CI — the outputs are committed like any other asset, and
// the sources change roughly never.
//
// The interesting part is step 3. The foreground of the opening is black ink (--senya-ink), so a
// uniform dark scrim over photos that range from a near-black concert shot to a bright multicolor
// product shot would push the dark ones to black-on-black and erase the logo. Instead every photo is
// tone-mapped onto ONE luminance band here, and the runtime scrim (--senya-bg-scrim) then darkens
// that band uniformly. Black ink ends up as legible on every frame as it already is on plain coral.
//
// Side benefit: 3 full-viewport changes per second sits right at the WCAG 2.3.1 flash threshold, but
// once every frame shares a luminance band there is no flash — only a change of content.
//
// TODO: these sources are copyrighted editorial/product photography (Getty, GQ, Daniel Arsham,
// LV/Supreme). They stand in as moodboard placeholders while the brand identity is pending — see
// Q-02 in OPEN-QUESTIONS.md. Swap for owned imagery before launch; the component reads whatever is
// in src/app/assets/bg/, so replacing the sources and re-running this script is the whole job.

import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SOURCE_DIR = "assets from design/bg pics";
const OUT_DIR = "src/app/assets/bg";

// Short-side targets. Two variants feed an srcset; the burst is 333ms a frame under a grain layer,
// so there is nothing to gain from going bigger.
const SHORT_SIDES = [640, 900];

// Never upscale a small source more than this — past it the blur stops reading as grain and starts
// reading as a mistake. Five of the sources are small enough to hit this cap.
const MAX_UPSCALE = 2.5;
const MAX_LONG_SIDE = 1600;

// Contrast compression, applied around PIVOT, so lifting a dark source doesn't blow its highlights
// straight out.
const CONTRAST = 0.82;
const PIVOT = 128;

// Search bounds for the per-image gain. Wide, because the sources genuinely span that much:
// kanye-saint-pablo-design is a near-black concert shot and needs a lot of lift.
const MIN_GAIN = 0.1;
const MAX_GAIN = 12;

// Conditioning for heavily-lifted sources. Multiplying a dark photo by 5x multiplies its sensor
// noise by 5x too, and amplifies whatever colour bias sits in its shadows — untreated, the concert
// shot came out grainy with a green cast, which reads as a broken asset rather than as a mood.
// A little blur kills the noise (at 333ms under a grain layer there is no detail to protect) and a
// little desaturation kills the cast. Both are applied BEFORE the luminance solve, so the solve
// still lands exactly on target.
const CONDITION_ABOVE = 2;
const DENOISE_PER_GAIN = 0.3;
const MAX_DENOISE = 1.2;
// sharp rejects a sigma below this, and a blur that faint would be pointless anyway.
const MIN_DENOISE = 0.3;
const DESATURATE_PER_GAIN = 0.06;
const MIN_SATURATION = 0.75;

const REC709 = [0.2126, 0.7152, 0.0722];

// The runtime scrim (--senya-bg-scrim in index.css) composites black over each frame in sRGB, so
// its effect on a frame's mean is a straight multiply. Kept in sync by hand — if you retune the
// CSS variable, retune this, because it is what the contrast report below is predicated on.
const RUNTIME_SCRIM = 0.18;

// --senya-ink #171717 (the whole foreground) and --senya-opening-bg #db3d4f (the coral it already
// sits on). Frames are held to what the ink achieves on plain coral rather than to a flat WCAG
// number: the honest bar is "no worse than the surface it replaces", and coral itself only manages
// ~4.1:1 — a hair under AA for body copy, which is a pre-existing property of the brand palette and
// not something this change gets to fix.
const INK = [0x17, 0x17, 0x17];
const CORAL = [0xdb, 0x3d, 0x4f];

/** WCAG relative luminance of a single sRGB channel value in 0-1. */
function toLinear(channel) {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

// Linearization is per-channel and nonlinear, so it does NOT commute with averaging. Weighting the
// sRGB channel means and linearizing that single number is a different (and materially darker)
// quantity than the mean of the per-pixel linear luminances, which is what WCAG actually wants.
// Hence the 256-entry LUT and a real pixel walk below rather than sharp's .stats() means.
const LINEAR_LUT = Array.from({ length: 256 }, (_, i) => toLinear(i / 255));
const SCRIMMED_LUT = Array.from({ length: 256 }, (_, i) =>
  toLinear((i / 255) * (1 - RUNTIME_SCRIM)),
);

/**
 * Per-channel 256-bin histograms, from one pixel walk.
 *
 * Mean luminance is a weighted sum of per-channel means, and a per-channel mean depends only on
 * that channel's histogram — so histograms predict the luminance of ANY per-channel tone curve
 * exactly, at 768 operations instead of a fresh walk over half a million pixels. That is what makes
 * solving for the gain below cheap enough to do per image.
 */
async function histograms(input) {
  const { data, info } = await sharp(input)
    .flatten({ background: "#000000" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bins = [new Float64Array(256), new Float64Array(256), new Float64Array(256)];
  const stride = info.channels;
  for (let i = 0; i < data.length; i += stride) {
    bins[0][data[i]] += 1;
    bins[1][data[i + 1]] += 1;
    bins[2][data[i + 2]] += 1;
  }

  const pixels = info.width * info.height;
  return { bins, pixels };
}

/** Mean sRGB level and post-scrim relative luminance after applying `out = a*v + b`. */
function predict({ bins, pixels }, a = 1, b = 0) {
  let srgbSum = 0;
  let linearSum = 0;

  for (let c = 0; c < 3; c += 1) {
    const bin = bins[c];
    for (let v = 0; v < 256; v += 1) {
      const count = bin[v];
      if (count === 0) continue;
      const out = clamp(Math.round(a * v + b), 0, 255);
      srgbSum += REC709[c] * out * count;
      linearSum += REC709[c] * SCRIMMED_LUT[out] * count;
    }
  }

  return { srgbMean: srgbSum / pixels, luminance: linearSum / pixels };
}

/**
 * Bisect for the gain that lands this image's post-scrim luminance on `target`.
 *
 * Equalizing the sRGB mean is not good enough: luminance weights green 10x blue, so two frames with
 * the same sRGB mean but different hues land at visibly different luminance — which is exactly the
 * "one frame flashes brighter than its neighbours" failure. Solving on luminance itself makes the
 * whole set land flat.
 */
function solveGain(hist, target) {
  let lo = MIN_GAIN;
  let hi = MAX_GAIN;

  const luminanceAt = (g) => predict(hist, CONTRAST * g, PIVOT * (1 - CONTRAST)).luminance;

  if (luminanceAt(hi) < target) return { gain: hi, clamped: true };
  if (luminanceAt(lo) > target) return { gain: lo, clamped: true };

  for (let i = 0; i < 48; i += 1) {
    const mid = (lo + hi) / 2;
    if (luminanceAt(mid) < target) lo = mid;
    else hi = mid;
  }

  return { gain: (lo + hi) / 2, clamped: false };
}

/** WCAG relative luminance of a flat sRGB colour. */
function flatLuminance([r, g, b]) {
  return REC709[0] * LINEAR_LUT[r] + REC709[1] * LINEAR_LUT[g] + REC709[2] * LINEAR_LUT[b];
}

const INK_LUMINANCE = flatLuminance(INK);
const CORAL_LUMINANCE = flatLuminance(CORAL);
const CORAL_BASELINE = (CORAL_LUMINANCE + 0.05) / (INK_LUMINANCE + 0.05);

// Every frame is tone-mapped so that AFTER the runtime scrim it sits on exactly the coral's
// luminance. Two things fall out of that. The burst lands dead flat, because no frame is brighter
// or darker than any other or than the coral it cuts between — which is what turns 3 changes per
// second into a change of content rather than a flash. And the black ink reads identically on every
// frame and on the coral, so the feature costs no legibility at all.
//
// Note the coupling this creates: the scrim is compensated for HERE, at bake time. Changing
// --senya-bg-scrim in the CSS without re-running this script re-breaks the parity. Raising the
// scrim makes the baked frames brighter to compensate, so the knob controls how much visible work
// the darkening appears to do, not how legible the result is.
const TARGET_LUMINANCE = CORAL_LUMINANCE;

/** WCAG contrast ratio of --senya-ink against a background of the given relative luminance. */
function inkContrast(luminance) {
  return (luminance + 0.05) / (INK_LUMINANCE + 0.05);
}

function slugify(filename) {
  return path
    .basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** Pixel dimensions for a given short-side target, honouring the upscale cap and long-side cap. */
function dimensionsFor(width, height, shortSide) {
  const scale = Math.min(shortSide / Math.min(width, height), MAX_UPSCALE);
  let w = Math.round(width * scale);
  let h = Math.round(height * scale);

  const longest = Math.max(w, h);
  if (longest > MAX_LONG_SIDE) {
    const correction = MAX_LONG_SIDE / longest;
    w = Math.round(w * correction);
    h = Math.round(h * correction);
  }

  return { width: w, height: h };
}

async function main() {
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const files = (await readdir(SOURCE_DIR)).filter((file) =>
    /\.(jpe?g|png|webp|avif)$/i.test(file),
  );
  files.sort();

  const rows = [];
  const slugs = new Set();
  let bytes = 0;

  for (const file of files) {
    const slug = slugify(file);
    if (slugs.has(slug)) {
      throw new Error(`Slug collision on "${slug}" (from "${file}") — rename the source.`);
    }
    slugs.add(slug);

    const source = path.join(SOURCE_DIR, file);

    // Flatten first: a couple of sources carry alpha, and .linear() on an alpha channel produces
    // nonsense. These are opaque backgrounds either way.
    const before = predict(await histograms(source));

    // Estimate the lift, condition the source for it, then solve exactly on the conditioned image —
    // conditioning perturbs luminance, so measuring before it would put the solve off target.
    const estimate = solveGain(await histograms(source), TARGET_LUMINANCE);
    const excess = Math.max(estimate.gain - CONDITION_ABOVE, 0);
    const denoise = Math.min(DENOISE_PER_GAIN * excess, MAX_DENOISE);
    const saturation = Math.max(1 - DESATURATE_PER_GAIN * excess, MIN_SATURATION);

    let conditioning = sharp(source).rotate().flatten({ background: "#000000" });
    if (denoise >= MIN_DENOISE) conditioning = conditioning.blur(denoise);
    if (saturation < 1) conditioning = conditioning.modulate({ saturation });
    // Read dimensions off the conditioned buffer, not the source: .rotate() has already applied any
    // EXIF orientation by this point, so the source metadata can have width/height the wrong way up.
    const conditioned = await conditioning.toBuffer();
    const metadata = await sharp(conditioned).metadata();

    // Solve for the gain that puts this frame's post-scrim luminance exactly on the coral's, then
    // fold the contrast compression in. One .linear() does both:
    //   out = CONTRAST * (gain * v) + PIVOT * (1 - CONTRAST)
    const hist = await histograms(conditioned);
    const { gain, clamped } = solveGain(hist, TARGET_LUMINANCE);
    const a = gain * CONTRAST;
    const b = PIVOT * (1 - CONTRAST);
    const after = predict(hist, a, b);

    const widths = [];

    for (const shortSide of SHORT_SIDES) {
      const { width, height } = dimensionsFor(metadata.width, metadata.height, shortSide);

      // A heavily-capped small source can resolve to the same size for both targets — emit it once
      // rather than writing the same file twice and putting a duplicate in the srcset.
      if (widths.includes(width)) continue;

      const toned = sharp(conditioned)
        .resize(width, height, { fit: "fill", kernel: "lanczos3" })
        .linear(a, b);

      // Name by ACTUAL width, not the short-side target — the number is the srcset `w` descriptor,
      // and for a landscape source the width is not the short side.
      const avif = await toned.clone().avif({ quality: 50, effort: 6 }).toBuffer();
      const webp = await toned.clone().webp({ quality: 72, effort: 5 }).toBuffer();
      await writeFile(`${OUT_DIR}/${slug}-${width}.avif`, avif);
      await writeFile(`${OUT_DIR}/${slug}-${width}.webp`, webp);

      widths.push(width);
      bytes += avif.length;
    }

    rows.push({ file, slug, before, after, gain, clamped, widths });
  }

  await writeFile(
    `${OUT_DIR}/README.md`,
    [
      "# Opening background frames",
      "",
      "**Generated — do not edit by hand.** Produced by `scripts/bake-bg.mjs` (`npm run bake:bg`)",
      "from `assets from design/bg pics/`.",
      "",
      "Every frame is tone-mapped so that, after the runtime `--senya-bg-scrim` is composited over",
      "it, it sits on exactly the coral's relative luminance (" +
        CORAL_LUMINANCE.toFixed(3) +
        "). So the black foreground ink",
      "reads identically on every frame and on the plain coral (" +
        CORAL_BASELINE.toFixed(2) +
        ":1), and the 3/second burst",
      "lands flat — a change of content rather than a flash.",
      "",
      "Files are named `<slug>-<width>.<ext>`, where `<width>` is the actual pixel width and doubles",
      "as the srcset `w` descriptor.",
      "",
      "See `src/app/scenes/BackgroundCycle.tsx`, which discovers these by glob.",
      "",
    ].join("\n"),
  );

  const contrasts = rows.map((r) => inkContrast(r.after.luminance));
  const worst = Math.min(...contrasts);
  const best = Math.max(...contrasts);

  console.log(`\nBaked ${rows.length} images → ${OUT_DIR}\n`);
  console.log(`  ${"slug".padEnd(44)}  sRGB mean   gain     ink       widths`);
  for (const [i, r] of rows.entries()) {
    console.log(
      `  ${r.slug.slice(0, 43).padEnd(44)}` +
        `${r.before.srgbMean.toFixed(0).padStart(4)}→${r.after.srgbMean.toFixed(0).padEnd(6)}` +
        `${r.gain.toFixed(2).padStart(5)}${r.clamped ? "!" : " "}  ` +
        `${contrasts[i].toFixed(2).padStart(5)}:1   ` +
        `${r.widths.join("/")}w`,
    );
  }

  const stranded = rows.filter((r) => r.clamped);
  console.log(
    `\n  ink contrast across the set: ${worst.toFixed(2)}–${best.toFixed(2)}:1` +
      `  (coral baseline ${CORAL_BASELINE.toFixed(2)}:1, scrim ${RUNTIME_SCRIM})`,
  );
  console.log(
    worst >= CORAL_BASELINE - 0.01
      ? `  ✓ every frame matches plain coral — the burst costs no legibility, and lands flat.`
      : `  ✗ ${stranded.length} frame(s) could not reach the target even at gain ${MAX_GAIN}.`,
  );
  if (stranded.length > 0) {
    console.log(`    stranded: ${stranded.map((r) => r.slug).join(", ")}`);
  }
  console.log(`\n  avif total: ${(bytes / 1024).toFixed(0)}KB across all widths\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
