/* Random helpers for Challenge mode. Every function takes the random source `rng`
   (a function returning a number in [0, 1), Math.random by default), so the tests
   can use a seeded one and get the same questions every run. */

/** A seeded random source (mulberry32): seeded(42)() is always the same number. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A whole number from lo to hi, both included. */
export const int = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

/** One element of a list. */
export const pick = (rng, list) => list[Math.floor(rng() * list.length)];

/** true with probability p. */
export const chance = (rng, p) => rng() < p;

/** A shuffled copy of a list. */
export function shuffle(rng, list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A number from lo to hi rounded to `step` (e.g. 0.01). */
export const real = (rng, lo, hi, step = 0.01) => Math.round((lo + rng() * (hi - lo)) / step) * step;

/**
 * Keep calling make() until it returns something (not null / undefined), at most `tries` times.
 * Generators use this for "pick random numbers until they fit the rules".
 */
export function retry(make, tries = 400) {
  for (let i = 0; i < tries; i++) {
    const v = make(i);
    if (v != null) return v;
  }
  return null;
}
