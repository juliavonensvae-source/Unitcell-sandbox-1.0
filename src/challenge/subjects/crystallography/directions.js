/* =====================================================================
   Topic D: directions in cubic and hexagonal crystals.

   dir-between-points-cubic   [uvw] from point A to point B (cubic cell)
   dir-between-points-hex     the same on hexagonal axes a1, a2, c → [UVW]
   dir-between-points-hex4    (hard) the same, answered in four indices [uvtw]
   dir-family-member-cubic    which direction belongs to ⟨uvw⟩
   dir-family-not-member-cubic
   dir-family-count-cubic     how many directions ⟨uvw⟩ has ([uvw] and [ūv̄w̄] count separately)
   dir-family-member-hex      which direction belongs to ⟨uvtw⟩ (four indices)
   dir-family-count-hex

   Agreed: hexagonal points are given in units of a1, a2, c and answered in
   three indices; hexagonal families use four indices.
   ===================================================================== */
import { posText } from '../../../ui/format.js';
import { txt } from '../../../text.js';
import { int, pick, shuffle, chance, retry } from '../../random.js';
import {
  RANGE, MAX_INDEX, randIndices, reduce, neg, same, vkey, maxAbs, inRange, nonNeg, isReduced, allZero, sortedAbs,
  dirFamily, sameCubicFamily, hexDirFamily, dirTo4, validFour, flipOne, swapTwo, nudge, wrongOptions, plausible,
  dir, dirFam, listText,
} from './common.js';

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const lcm = (a, b) => (a * b) / gcd(a, b);

/**
 * Two points A → B in the cell whose difference is uvw/q (q = 1, 2, 3 or 4, so the
 * coordinates are halves, thirds or quarters), every coordinate between 0 and 1.
 */
function pointsFor(rng, uvw, level) {
  const m = maxAbs(uvw), dens = { easy: [1, 2], medium: [1, 2, 3], hard: [2, 3, 4] }[level].filter(q => q >= m);
  if (!dens.length) return null;
  const q = pick(rng, dens), delta = uvw.map(u => u / q);
  const g = level === 'hard' ? lcm(q, pick(rng, [1, 2])) : q;
  const atOrigin = level === 'easy' && chance(rng, 0.5);
  const tail = delta.map(d => {
    if (atOrigin && d >= 0) return 0;
    const ks = [];
    for (let k = 0; k <= g; k++) { const t = k / g; if (t + d >= -1e-9 && t + d <= 1 + 1e-9) ks.push(t); }
    return pick(rng, ks);
  });
  const head = tail.map((t, i) => t + delta[i]);
  return { tail, head, delta, q };
}

/** Wrong directions for "from A to B": reversed (A − B), B alone, A + B, a sign or an order mistake. */
function pointWrongs(rng, uvw, P, level) {
  const scaled = v => { const w = v.map(x => Math.round(x * P.q * 12) / 12); return w.every(Number.isInteger) && !allZero(w) ? reduce(w) : null; };
  return wrongOptions(uvw, [
    neg(uvw), scaled(P.head), scaled(P.head.map((x, i) => x + P.tail[i])), flipOne(rng, uvw), swapTwo(rng, uvw), flipOne(rng, uvw),
  ], { ok: plausible(level, 6), fallback: () => nudge(rng, uvw) });
}

function betweenPoints(rng, level, word, { four = false } = {}) {
  const uvw = randIndices(rng, level, { max: Math.min(RANGE[level].max, 4) });
  if (!uvw) return null;
  const P = pointsFor(rng, uvw, level);
  if (!P) return null;
  let wrong = pointWrongs(rng, uvw, P, level);
  if (!wrong) return null;
  const clear = P.q > 1 ? word('clear', { factor: P.q }) : word('no-clear');
  const fields = { A: posText(P.tail), B: posText(P.head), diff: posText(P.delta), clear };
  if (!four) {
    return {
      key: `${vkey(uvw)}|${vkey(P.tail)}|${vkey(P.head)}`, fields, correct: dir(uvw), wrong: wrong.map(dir),
      typed: { kind: 'indices', values: uvw, negativeOk: false, bracket: 'dir' },
      data: { uvw, tail: P.tail, head: P.head, options: [uvw, ...wrong] },
    };
  }
  const answer = dirTo4(uvw);
  if (!inRange(answer)) return null;
  const naive = reduce([uvw[0], uvw[1], -(uvw[0] + uvw[1]), uvw[2]]);
  wrong = wrongOptions(answer, [naive, ...wrong.map(dirTo4)], { ok: v => isReduced(v) && inRange(v, 6), fallback: () => dirTo4(nudge(rng, uvw)) });
  if (!wrong) return null;
  return {
    key: `${vkey(uvw)}|${vkey(P.tail)}|${vkey(P.head)}|4`, fields: { ...fields, three: dir(uvw) }, correct: dir(answer), wrong: wrong.map(dir),
    typed: { kind: 'indices', values: answer, negativeOk: false, bracket: 'dir' },
    data: { uvw, four: answer, tail: P.tail, head: P.head, options: [answer, ...wrong] },
  };
}

/** A cubic family base with at least `need` members (on easy: members without minus signs). */
function cubicBase(rng, level, need) {
  return retry(() => {
    const v = randIndices(rng, level);
    return v && cubicMembers(v, level).length >= need ? v : null;
  });
}
const cubicMembers = (v, level) => dirFamily(v).filter(m => RANGE[level].neg || nonNeg(m));
const cubicSymbol = (rng, base, level) => (level !== 'easy' && chance(rng, 0.5) ? pick(rng, dirFamily(base)) : base);

/** A random reduced four-index direction for medium (|x| ≤ 3) or hard (|x| ≤ 5). */
function hexBase(rng, level) {
  const max = RANGE[level].max;
  return retry(() => {
    const u = int(rng, -max, max), v = int(rng, -max, max), w = int(rng, -max, max);
    const d = [u, v, -(u + v), w].map(x => x + 0);
    if (allZero(d) || !isReduced(d) || !inRange(d, max)) return null;
    return d;
  });
}
const sameHexFamily = (a, b) => hexDirFamily(a).some(m => same(m, b));

/** A valid four-index direction that is not in the family: two of u, v, t moved by one, or w changed. */
const hexNonMember = (rng, base) => () => {
  const m = pick(rng, hexDirFamily(base));
  let v;
  if (chance(rng, 0.35)) v = [m[0], m[1], m[2], m[3] + (chance(rng, 0.5) ? 1 : -1)];
  else {
    const [i, j] = shuffle(rng, [0, 1, 2]).slice(0, 2);
    v = [...m]; v[i] += 1; v[j] -= 1;
  }
  v = v.map(x => x + 0);
  return allZero(v) || !isReduced(v) || !validFour(v) || sameHexFamily(base, v) ? null : v;
};

export const types = {
  'dir-between-points-cubic': {
    levels: ['easy', 'medium', 'hard'], format: 'either', words: ['clear', 'no-clear'],
    make({ level, rng, word }) {
      const r = betweenPoints(rng, level, word);
      return r && { ...r, key: `dir-between-points-cubic|${r.key}` };
    },
  },

  'dir-between-points-hex': {
    levels: ['easy', 'medium', 'hard'], format: 'either', words: ['clear', 'no-clear'],
    make({ level, rng, word }) {
      const r = betweenPoints(rng, level, word);
      return r && { ...r, key: `dir-between-points-hex|${r.key}` };
    },
  },

  'dir-between-points-hex4': {
    levels: ['hard'], format: 'either', words: ['clear', 'no-clear'],
    make({ level, rng, word }) {
      const r = betweenPoints(rng, level, word, { four: true });
      return r && { ...r, key: `dir-between-points-hex4|${r.key}` };
    },
  },

  'dir-family-member-cubic': {
    levels: ['easy', 'medium', 'hard'], format: 'mc',
    make({ level, rng }) {
      const base = cubicBase(rng, level, 2);
      if (!base) return null;
      const shown = cubicSymbol(rng, base, level);
      const choices = cubicMembers(base, level).filter(m => !same(m, shown) && !same(m, neg(shown)));
      if (!choices.length) return null;
      const correct = pick(rng, choices);
      const wrong = wrongOptions(correct, [], {
        ok: v => plausible(level, 6)(v) && !sameCubicFamily(v, base),
        fallback: () => nudge(rng, pick(rng, cubicMembers(base, level))),
      });
      if (!wrong) return null;
      return {
        key: `dir-family-member-cubic|${sortedAbs(base)}|${vkey(correct)}`, fields: { family: dirFam(shown) },
        correct: dir(correct), wrong: wrong.map(dir), data: { base, correct, options: [correct, ...wrong] },
      };
    },
  },

  'dir-family-not-member-cubic': {
    levels: ['easy', 'medium', 'hard'], format: 'mc',
    make({ level, rng }) {
      const base = cubicBase(rng, level, 3);
      if (!base) return null;
      const members = shuffle(rng, cubicMembers(base, level)).slice(0, 3);
      const odd = retry(() => {
        const v = nudge(rng, pick(rng, cubicMembers(base, level)));
        return plausible(level, 6)(v) && !sameCubicFamily(v, base) ? v : null;
      });
      if (!odd) return null;
      return {
        key: `dir-family-not-member-cubic|${sortedAbs(base)}|${vkey(odd)}`, fields: { family: dirFam(cubicSymbol(rng, base, level)) },
        correct: dir(odd), wrong: members.map(dir), data: { base, correct: odd, options: [odd, ...members] },
      };
    },
  },

  'dir-family-count-cubic': {
    levels: ['easy', 'medium', 'hard'], format: 'either',
    make({ level, rng }) {
      const base = randIndices(rng, level, { interesting: level !== 'easy' });
      if (!base) return null;
      const members = dirFamily(base), count = members.length;
      const nums = [...new Set([count / 2, 3, 4, 6, 8, 12, 24, 48])].filter(x => Number.isInteger(x) && x !== count);
      const wrong = [nums[0], ...nums.slice(1).sort((p, q) => Math.abs(p - count) - Math.abs(q - count))].slice(0, 3);
      return {
        key: `dir-family-count-cubic|${sortedAbs(base)}`,
        fields: { family: dirFam(cubicSymbol(rng, base, level)), members: listText(members.map(dir), txt('wordAnd')), count },
        correct: String(count), wrong: shuffle(rng, wrong).map(String),
        typed: { kind: 'number', value: count, tol: 0 },
        data: { base, count },
      };
    },
  },

  'dir-family-member-hex': {
    levels: ['medium', 'hard'], format: 'mc',
    make({ level, rng }) {
      const base = hexBase(rng, level);
      if (!base) return null;
      const choices = hexDirFamily(base).filter(m => !same(m, base) && !same(m, neg(base)));
      if (!choices.length) return null;
      const correct = pick(rng, choices);
      const wrong = wrongOptions(correct, [], { ok: v => inRange(v, MAX_INDEX), fallback: hexNonMember(rng, base) });
      if (!wrong) return null;
      return {
        key: `dir-family-member-hex|${vkey(base)}|${vkey(correct)}`, fields: { family: dirFam(base) },
        correct: dir(correct), wrong: wrong.map(dir), data: { base, correct, options: [correct, ...wrong] },
      };
    },
  },

  'dir-family-count-hex': {
    levels: ['medium', 'hard'], format: 'either',
    make({ level, rng }) {
      const base = hexBase(rng, level);
      if (!base) return null;
      const members = hexDirFamily(base), count = members.length;
      const nums = [...new Set([count * 2, count / 2, 2, 6, 12, 24])].filter(x => Number.isInteger(x) && x !== count && x > 0);
      const wrong = shuffle(rng, nums).sort((p, q) => Math.abs(p - count) - Math.abs(q - count)).slice(0, 3);
      return {
        key: `dir-family-count-hex|${hexDirFamily(base).map(vkey).sort()[0]}`,
        fields: { family: dirFam(base), members: listText(members.map(dir), txt('wordAnd')), count },
        correct: String(count), wrong: shuffle(rng, wrong).map(String),
        typed: { kind: 'number', value: count, tol: 0 },
        data: { base, count },
      };
    },
  },
};
