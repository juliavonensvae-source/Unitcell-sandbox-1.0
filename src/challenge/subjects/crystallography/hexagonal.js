/* =====================================================================
   Topic G: Miller–Bravais (four-index) notation for hexagonal crystals.

   hkil-valid-plane      which (hkil) is valid (i = −(h + k))
   uvtw-valid-dir        which [uvtw] is valid (t = −(u + v))
   four-index-not-valid  which of four sets is not valid
   dir-3-to-4            [UVW] → [uvtw]: u = (2U − V)/3, v = (2V − U)/3, t = −(u + v), w = W
   ===================================================================== */
import { ratio } from '../../../math/intercepts.js';
import { tex, tFrac } from '../../../help/tex.js';
import { int, pick, shuffle, chance, retry } from '../../random.js';
import {
  RANGE, MAX_INDEX, randIndices, reduce, same, vkey, inRange, isReduced, allZero, validFour, dirTo4, flipOne, swapTwo,
  wrongOptions, plane, dir,
} from './common.js';

/** A valid four-index set for the level. On easy only i (or t) is negative, because it has to be. */
function validSet(rng, level) {
  const { max, neg } = RANGE[level];
  return retry(() => {
    const r = () => (neg ? int(rng, -max, max) : int(rng, 0, max)) + 0;
    const h = r(), k = r(), l = r(), v = [h, k, -(h + k) + 0, l];
    if ((!h && !k) || !isReduced(v) || !inRange(v, MAX_INDEX)) return null;
    return v;
  });
}

/** Invalid sets that look right: the sign of i wrong, i and l in the wrong places, i off by one. */
function invalidSets(rng, [h, k, i, l]) {
  return [
    [h, k, h + k, l], [h, k, l, i], [h, k, i + 1, l], [h, k, i - 1, l], [h, k, k - h, l], [h, l, i, k],
  ].map(v => v.map(x => x + 0));
}
const looksValid = v => !allZero(v) && isReduced(v) && inRange(v, MAX_INDEX);

function whichValid(kind, level, rng) {
  const v = validSet(rng, level);
  if (!v) return null;
  const wrong = wrongOptions(v, shuffle(rng, invalidSets(rng, v)), {
    ok: u => looksValid(u) && !validFour(u),
    fallback: () => { const s = validSet(rng, level); return s ? pick(rng, invalidSets(rng, s)) : null; },
  });
  if (!wrong) return null;
  const show = kind === 'plane' ? plane : dir;
  return {
    key: `${vkey(v)}`, fields: { sum: `${v[0]} + ${v[1]} + ${v[2]} = 0`.replace(/-/g, '−').replace(/\+ −/g, '− ') },
    correct: show(v), wrong: wrong.map(show), data: { correct: v, options: [v, ...wrong] },
  };
}

export const types = {
  'hkil-valid-plane': {
    levels: ['easy', 'medium', 'hard'], format: 'mc',
    make({ level, rng }) {
      const r = whichValid('plane', level, rng);
      return r && { ...r, key: `hkil-valid-plane|${r.key}` };
    },
  },

  'uvtw-valid-dir': {
    levels: ['easy', 'medium', 'hard'], format: 'mc',
    make({ level, rng }) {
      const r = whichValid('dir', level, rng);
      return r && { ...r, key: `uvtw-valid-dir|${r.key}` };
    },
  },

  'four-index-not-valid': {
    levels: ['easy', 'medium', 'hard'], format: 'mc', words: ['kind-plane', 'kind-dir'],
    make({ level, rng, word }) {
      const kind = chance(rng, 0.5) ? 'plane' : 'dir', show = kind === 'plane' ? plane : dir;
      const valid = [];
      for (let i = 0; i < 60 && valid.length < 3; i++) {
        const v = validSet(rng, level);
        if (v && !valid.some(u => same(u, v))) valid.push(v);
      }
      const base = valid[0];
      const odd = base && retry(() => {
        const s = validSet(rng, level), u = s && pick(rng, invalidSets(rng, s));
        return u && looksValid(u) && !validFour(u) ? u : null;
      });
      if (valid.length < 3 || !odd) return null;
      return {
        key: `four-index-not-valid|${kind}|${vkey(odd)}`,
        fields: { kind: word(`kind-${kind}`), sum: `${odd[0]} + ${odd[1]} + ${odd[2]} = ${odd[0] + odd[1] + odd[2]}`.replace(/-/g, '−').replace(/\+ −/g, '− ') },
        correct: show(odd), wrong: valid.map(show), data: { correct: odd, options: [odd, ...valid] },
      };
    },
  },

  'dir-3-to-4': {
    levels: ['easy', 'medium', 'hard'], format: 'either',
    make({ level, rng }) {
      const UVW = retry(() => {
        const v = randIndices(rng, level);
        if (!v || (!v[0] && !v[1])) return null;
        if (level === 'hard' && !v.some(x => x < 0)) return null; // hard: with minus signs
        return inRange(dirTo4(v)) ? v : null;
      });
      if (!UVW) return null;
      const [U, V, W] = UVW, raw = [2 * U - V, 2 * V - U, -(U + V), 3 * W].map(x => x + 0), four = reduce(raw);
      const wrong = wrongOptions(four, [
        reduce([U, V, -(U + V), W]),               // used the plane rule i = −(h + k)
        reduce([2 * U - V, 2 * V - U, -(U + V), W]), // forgot to multiply w by 3
        reduce([2 * U - V, 2 * V - U, U + V, 3 * W]), // wrong sign of t
        reduce([2 * V - U, 2 * U - V, -(U + V), 3 * W]), // u and v swapped
        flipOne(rng, four), swapTwo(rng, four),
      ], { ok: v => !allZero(v) && isReduced(v) && inRange(v, 6) });
      if (!wrong) return null;
      const fr = p => tFrac(ratio(p, 3));
      const working = tex(String.raw`u = \tfrac{2U-V}{3} = ${fr(raw[0])},\quad v = \tfrac{2V-U}{3} = ${fr(raw[1])},\quad t = -(u+v) = ${fr(raw[2])},\quad w = W = ${W}`);
      const steps = same(raw, four) ? dir(raw) : `${dir(raw)} → ${dir(four)}`;
      return {
        key: `dir-3-to-4|${vkey(UVW)}`, fields: { three: dir(UVW), working, steps },
        correct: dir(four), wrong: wrong.map(dir),
        typed: { kind: 'indices', values: four, negativeOk: false, bracket: 'dir' },
        data: { UVW, four, options: [four, ...wrong] },
      };
    },
  },
};
