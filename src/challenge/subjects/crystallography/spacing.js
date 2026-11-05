/* =====================================================================
   Topic F: interplanar spacing d_hkl.

   d-cubic        every level   d = a / √(h² + k² + l²)
   d-tetragonal   medium, hard  1/d² = (h² + k²)/a² + l²/c²
   d-hexagonal    hard          1/d² = 4/3 · (h² + hk + k²)/a² + l²/c²
                                (the plane is sometimes given as (hkil))

   Typed answers count when they are within 1 % of the exact value.
   ===================================================================== */
import { tex, tIdxBare, tInt } from '../../../help/tex.js';
import { sig } from '../../../ui/format.js';
import { pick, chance, retry } from '../../random.js';
import { RANGE, randIndices, vkey, plane, dText, len } from './common.js';

const CUBIC = { easy: [3, 4, 5, 6], other: [2.87, 3.16, 3.52, 3.61, 4.05, 4.08, 4.95, 5.43, 5.64] };
const TETRAGONAL = [[3.0, 5.0], [4.0, 6.0], [5.83, 3.18], [4.59, 2.96], [3.25, 4.95], [3.8, 5.2]];
const HEXAGONAL = [[3.21, 5.21], [2.66, 4.95], [2.95, 4.68], [2.51, 4.07], [3.23, 5.15]];

const ANG = String.raw`\,\text{Å}`;
const num = x => sig(x, 3);
/**
 * A formula in display style (full-size fractions) inside a sentence. The {} ends the
 * command name, so the formula can start with a letter: \displaystyle{}d stays
 * "\displaystyle" + "d" and never becomes the unknown command "\displaystyled".
 */
const texBig = src => tex(String.raw`\displaystyle{}` + src);
const sq = x => `${tInt(x)}^2`;

/**
 * Three wrong d values: the candidates first (typical slips), then simple multiples of the
 * right one. Each differs from the right value and from the others by more than 4 %.
 */
function wrongValues(d, candidates) {
  const out = [], seen = [d];
  const add = x => {
    if (out.length >= 3 || !Number.isFinite(x) || x < 0.05 || x > 60) return;
    if (seen.some(y => Math.abs(x - y) / y < 0.04) || seen.some(y => num(x) === num(y))) return;
    seen.push(x); out.push(x);
  };
  candidates.forEach(add);
  [Math.SQRT2, Math.SQRT1_2, 2, 0.5, Math.sqrt(3), 1 / Math.sqrt(3), 1.5, 2 / 3].forEach(f => add(d * f));
  return out;
}

const spacingQuestion = (key, hkl, d, wrong, fields, data) => (wrong.length < 3 ? null : {
  key, fields: { plane: plane(hkl), ...fields },
  correct: dText(d), wrong: wrong.map(dText),
  typed: { kind: 'number', value: d, tol: 0.01, unit: 'Å' },
  data: { hkl, d, wrong, ...data },
});

export const types = {
  'd-cubic': {
    levels: ['easy', 'medium', 'hard'], format: 'either',
    make({ level, rng }) {
      const hkl = randIndices(rng, level), a = pick(rng, level === 'easy' ? CUBIC.easy : CUBIC.other);
      if (!hkl) return null;
      const [h, k, l] = hkl, N = h * h + k * k + l * l, d = a / Math.sqrt(N);
      const wrong = wrongValues(d, [
        a / N,                                   // forgot the square root
        a / (Math.abs(h) + Math.abs(k) + Math.abs(l)), // added the indices instead of their squares
        a * Math.sqrt(N),                        // multiplied instead of divided
        Math.abs(h + k + l) ? a / Math.abs(h + k + l) : NaN,
      ]);
      return spacingQuestion(`d-cubic|${vkey(hkl)}|${a}`, hkl, d, wrong, {
        a: len(a), N,
        calc: texBig(String.raw`d_{${tIdxBare(hkl)}} = \frac{${a.toFixed(2)}}{\sqrt{${sq(h)}+${sq(k)}+${sq(l)}}} = \frac{${a.toFixed(2)}}{\sqrt{${N}}} = ${num(d)}${ANG}`),
      }, { a });
    },
  },

  'd-tetragonal': {
    levels: ['medium', 'hard'], format: 'either',
    make({ level, rng }) {
      const hkl = randIndices(rng, level), [a, c] = pick(rng, TETRAGONAL);
      if (!hkl) return null;
      const [h, k, l] = hkl, hk = h * h + k * k, inv = hk / (a * a) + (l * l) / (c * c), d = 1 / Math.sqrt(inv);
      if (!l || !hk) return null; // both terms present, so swapping a and c is a real mistake
      const wrong = wrongValues(d, [
        1 / Math.sqrt(hk / (c * c) + (l * l) / (a * a)), // a and c swapped
        a / Math.sqrt(hk + l * l),                        // treated as cubic with a
        1 / inv,                                          // forgot the square root
      ]);
      return spacingQuestion(`d-tetragonal|${vkey(hkl)}|${a}|${c}`, hkl, d, wrong, {
        a: len(a), c: len(c),
        calc: texBig(String.raw`\frac{1}{d^2} = \frac{${sq(h)}+${sq(k)}}{${a.toFixed(2)}^2} + \frac{${sq(l)}}{${c.toFixed(2)}^2} = ${sig(inv, 4)}${ANG}^{-2} \;\Rightarrow\; d = ${num(d)}${ANG}`),
      }, { a, c });
    },
  },

  'd-hexagonal': {
    levels: ['hard'], format: 'either',
    make({ level, rng }) {
      const hkl = retry(() => { const v = randIndices(rng, level); return v && Math.abs(v[0] + v[1]) <= RANGE[level].max ? v : null; });
      if (!hkl) return null;
      const [h, k, l] = hkl, [a, c] = pick(rng, HEXAGONAL), Q = h * h + h * k + k * k;
      if (!Q || !l) return null;
      const inv = (4 / 3) * (Q / (a * a)) + (l * l) / (c * c), d = 1 / Math.sqrt(inv);
      const shown = chance(rng, 0.5) ? [h, k, -(h + k) + 0, l] : hkl;
      const wrong = wrongValues(d, [
        1 / Math.sqrt(Q / (a * a) + (l * l) / (c * c)),                      // forgot the 4/3
        1 / Math.sqrt((4 / 3) * ((h * h + k * k) / (a * a)) + (l * l) / (c * c)), // left out the hk term
        1 / Math.sqrt((4 / 3) * ((h * h - h * k + k * k) / (a * a)) + (l * l) / (c * c)), // wrong sign of hk
        a / Math.sqrt(h * h + k * k + l * l),                                 // treated as cubic
      ]);
      return spacingQuestion(`d-hexagonal|${vkey(hkl)}|${a}|${shown.length}`, shown, d, wrong, {
        a: len(a), c: len(c),
        calc: texBig(String.raw`\frac{1}{d^2} = \frac43\cdot\frac{${sq(h)}+${tInt(h)}\cdot${tInt(k)}+${sq(k)}}{${a.toFixed(2)}^2} + \frac{${sq(l)}}{${c.toFixed(2)}^2} = ${sig(inv, 4)}${ANG}^{-2} \;\Rightarrow\; d = ${num(d)}${ANG}`),
      }, { a, c, hkl3: hkl });
    },
  },
};
