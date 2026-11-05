/* Shared helpers for the crystallography questions: index ranges per difficulty,
   families, Miller–Bravais conversion, plausible wrong answers and formatting. */
import { gcdAll, PERMS } from '../../../math/linalg.js';
import { familyMembers } from '../../../math/slip.js';
import { idx, sig } from '../../../ui/format.js';
import { int, pick, shuffle, retry } from '../../random.js';

/**
 * The difficulty rules for indices and direction components:
 * easy 0…2 with no minus signs, medium −3…3, hard −5…5.
 */
export const RANGE = { easy: { max: 2, neg: false }, medium: { max: 3, neg: true }, hard: { max: 5, neg: true } };
/** No index anywhere (question, answer or option) is bigger than this. */
export const MAX_INDEX = 5;

export const reduce = v => { const g = gcdAll(v) || 1; return v.map(x => x / g + 0); };
export const isReduced = v => gcdAll(v) === 1;
export const neg = v => v.map(x => -x + 0);
export const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
export const vkey = v => v.join(',');
export const maxAbs = v => Math.max(...v.map(Math.abs));
export const inRange = (v, max = MAX_INDEX) => v.every(x => Math.abs(x) <= max);
export const nonNeg = v => v.every(x => x >= 0);
export const allZero = v => v.every(x => x === 0);
export const dot3 = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
export const cross3 = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]].map(x => x + 0);
export const sortedAbs = v => v.map(Math.abs).sort((a, b) => a - b).join(',');

/** Fits the level: within its range, and without minus signs on easy. */
export const fitsLevel = (v, level) => inRange(v, RANGE[level].max) && (RANGE[level].neg || nonNeg(v));

/** Harder levels should look harder: medium has a minus sign or a 2 or 3; hard has a 3, 4 or 5. */
export function isInteresting(v, level) {
  if (level === 'medium') return v.some(x => x < 0) || maxAbs(v) >= 2;
  if (level === 'hard') return maxAbs(v) >= 3;
  return true;
}

/** A random reduced index vector for a level (len 3 by default; at least `nonzero` indices not 0). */
export function randIndices(rng, level, { len = 3, max = RANGE[level].max, interesting = true, nonzero = 1 } = {}) {
  const negOk = RANGE[level].neg;
  return retry(() => {
    const v = Array.from({ length: len }, () => (negOk ? int(rng, -max, max) : int(rng, 0, max)) + 0);
    if (v.filter(x => x !== 0).length < nonzero || !isReduced(v)) return null;
    if (interesting && !isInteresting(v, level)) return null;
    return v;
  });
}

/** Every reduced 3-vector with components in the level's range (for searching). */
export function allIndices(level) {
  const { max, neg: negOk } = RANGE[level], lo = negOk ? -max : 0, out = [];
  for (let a = lo; a <= max; a++) for (let b = lo; b <= max; b++) for (let c = lo; c <= max; c++) {
    const v = [a, b, c].map(x => x + 0);
    if (!allZero(v) && isReduced(v)) out.push(v);
  }
  return out;
}

/* ---------- families ---------- */

/** Every ordering and sign change of v, each once. */
export function signedPerms(v) {
  const seen = new Map();
  for (const p of PERMS) for (let s = 0; s < 8; s++) {
    const u = p.map((j, i) => ((s >> i) & 1 ? -v[j] : v[j]) + 0);
    seen.set(vkey(u), u);
  }
  return [...seen.values()];
}

/** The planes of a cubic family {hkl}, (hkl) and (h̄k̄l̄) counted once: {100} → 3, {111} → 4. */
export const planeFamily = v => familyMembers(v);

/** The directions of a cubic family ⟨uvw⟩, [uvw] and [ūv̄w̄] counted separately: ⟨100⟩ → 6, ⟨111⟩ → 8. */
export const dirFamily = v => signedPerms(v);

/** Same cubic family (planes or directions): the same numbers, ignoring order and signs. */
export const sameCubicFamily = (a, b) => sortedAbs(a) === sortedAbs(b);

/** Hexagonal family ⟨uvtw⟩: orderings of u, v, t, a sign change of all three, and ±w. Each member once. */
export function hexDirFamily([u, v, t, w]) {
  const seen = new Map(), triple = [u, v, t];
  for (const p of PERMS) for (const s of [1, -1]) for (const sw of [1, -1]) {
    const m = [...p.map(j => s * triple[j] + 0), sw * w + 0];
    seen.set(vkey(m), m);
  }
  return [...seen.values()];
}

/* ---------- Miller–Bravais ---------- */

/** [UVW] → [uvtw] = [2U − V, 2V − U, −(U + V), 3W], reduced. */
export const dirTo4 = ([U, V, W]) => reduce([2 * U - V, 2 * V - U, -(U + V), 3 * W]);
/** [uvtw] → [UVW] = [u − t, v − t, w], reduced. */
export const dirTo3 = ([u, v, t, w]) => reduce([u - t, v - t, w]);
/** Valid four-index set: the first three add up to 0. */
export const validFour = v => v[0] + v[1] + v[2] === 0;

/* ---------- wrong options ---------- */

/** Change the sign of one index that is not 0. */
export function flipOne(rng, v) {
  const at = v.map((x, i) => i).filter(i => v[i] !== 0);
  if (!at.length) return null;
  const i = pick(rng, at);
  return v.map((x, j) => (j === i ? -x + 0 : x));
}

/** Swap two indices that differ. */
export function swapTwo(rng, v) {
  const pairs = [];
  for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) if (v[i] !== v[j]) pairs.push([i, j]);
  if (!pairs.length) return null;
  const [i, j] = pick(rng, pairs), u = [...v];
  [u[i], u[j]] = [u[j], u[i]];
  return u;
}

/** Change one index by ±1. */
export function nudge(rng, v) {
  const i = int(rng, 0, v.length - 1), u = [...v];
  u[i] += rng() < 0.5 ? 1 : -1;
  return u.map(x => x + 0);
}

/**
 * Three wrong answers: the candidates in order (null ones are skipped), then fallback()
 * until there are three. Each must pass ok(v) and differ (by key) from the right
 * answer, from `exclude` and from each other. → [v, v, v] or null.
 */
export function wrongOptions(correct, candidates, { key = vkey, ok = () => true, fallback = null, exclude = [] } = {}) {
  const seen = new Set([key(correct), ...exclude.map(key)]), out = [];
  const add = v => {
    if (v == null || out.length >= 3 || !ok(v)) return;
    const k = key(v);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(v);
  };
  candidates.forEach(add);
  for (let i = 0; i < 400 && out.length < 3 && fallback; i++) add(fallback());
  return out.length === 3 ? out : null;
}

/** Wrong index options that look like real answers: reduced, not all 0, small, and (easy) without minus signs. */
export const plausible = (level, max = MAX_INDEX) => v => !allZero(v) && isReduced(v) && inRange(v, max) && (RANGE[level].neg || nonNeg(v));

/* ---------- formatting ---------- */

export const plane = v => idx(v, 'plane');
export const dir = v => idx(v, 'dir');
export const family = v => idx(v, 'family');
export const dirFam = v => idx(v, 'dirFamily');
export const ANG = ' Å';
/** A length with two decimals: 4.05 Å */
export const len = x => `${x.toFixed(2)}${ANG}`;
/** A computed length with three significant figures: 2.34 Å */
export const dText = x => `${sig(x, 3)}${ANG}`;
/** Plain-text list: "a, b and c" (word = the localised "and"). */
export function listText(items, word = 'and') {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${word} ${items[items.length - 1]}`;
}
/** A number in a formula: negative numbers in brackets. */
export const paren = x => (x < 0 ? `(${x})` : `${x}`);

export { pick, shuffle };
