/* =====================================================================
   Topic C: planes in cubic crystals.

   intercepts-to-hkl         intercepts → Miller indices (reciprocals, clear fractions)
   plane-family-member       which plane belongs to {hkl}
   plane-family-not-member   which plane does not belong to {hkl}
   plane-family-count        how many planes {hkl} has ((hkl) and (h̄k̄l̄) count once)
   ===================================================================== */
import { interceptSteps, ratio } from '../../../math/intercepts.js';
import { fracText } from '../../../ui/format.js';
import { txt } from '../../../text.js';
import { chance, pick, shuffle, retry } from '../../random.js';
import {
  RANGE, randIndices, reduce, neg, same, vkey, nonNeg, allZero, sortedAbs,
  planeFamily, sameCubicFamily, flipOne, swapTwo, nudge, wrongOptions, plausible, plane, family, listText,
} from './common.js';

/** Intercepts as fractions → the integers you get by clearing them (∞ read as 0), reduced. */
function clearIntercepts(intercepts) {
  const rs = intercepts.map(r => r || ratio(0, 1));
  const lcm = rs.reduce((m, r) => (m * r.q) / gcd(m, r.q), 1);
  const v = rs.map(r => (r.p * lcm) / r.q + 0);
  return allZero(v) ? null : reduce(v);
}
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };

/** A family base for a level whose members (of the right sign, on easy) number at least `need`. */
function familyBase(rng, level, need) {
  return retry(() => {
    const v = randIndices(rng, level);
    if (!v) return null;
    const members = levelMembers(v, level);
    return members.length >= need ? v : null;
  });
}

/** The members of {hkl} written as on this level: on easy only those without minus signs. */
function levelMembers(v, level) {
  return planeFamily(v).map(m => (nonNeg(neg(m)) && !nonNeg(m) ? neg(m) : m)).filter(m => RANGE[level].neg || nonNeg(m));
}

/** A plane that looks like it could be in {hkl} but is not: one index changed by one. */
const nonMember = (rng, base, level) => () => {
  const v = nudge(rng, pick(rng, levelMembers(base, level)));
  return sameCubicFamily(v, base) ? null : v;
};

/** How the family symbol is written: on medium and hard sometimes with minus signs, {1̄23}. */
const familySymbol = (rng, base, level) => (level !== 'easy' && chance(rng, 0.5) ? pick(rng, planeFamily(base)) : base);

export const types = {
  'intercepts-to-hkl': {
    levels: ['easy', 'medium', 'hard'], format: 'either', words: ['clear', 'no-clear'],
    make({ level, rng, word }) {
      const hkl = randIndices(rng, level);
      if (!hkl) return null;
      // hard: sometimes the plane n = 2, with intercepts such as 2/3 (but never 2/5)
      const n = level === 'hard' && chance(rng, 0.5) && hkl.every(h => Math.abs(h) !== 5) && hkl.some(h => h % 2) ? 2 : 1;
      const st = interceptSteps(hkl, n);
      if (!same(st.indices, hkl)) return null;
      const [x, y, z] = st.intercepts.map(fracText);
      const wrong = wrongOptions(hkl, [
        clearIntercepts(st.intercepts), // forgot to take the reciprocals
        flipOne(rng, hkl), swapTwo(rng, hkl),
        hkl.map(h => (h === 0 ? 1 : h)), // read ∞ as 1
        swapTwo(rng, hkl), flipOne(rng, hkl),
      ], { ok: plausible(level, 6), exclude: [neg(hkl)], fallback: () => nudge(rng, hkl) });
      if (!wrong) return null;
      const recip = `(${st.reciprocals.map(fracText).join(', ')})`;
      return {
        key: `intercepts-to-hkl|${vkey(hkl)}|${n}`,
        fields: {
          x, y, z, recip,
          clear: st.factor > 1 ? word('clear', { factor: st.factor, cleared: `(${st.cleared.join(', ')})` }) : word('no-clear'),
        },
        correct: plane(hkl), wrong: wrong.map(plane),
        typed: { kind: 'indices', values: hkl, negativeOk: false, bracket: 'plane' },
        data: { hkl, intercepts: st.intercepts, level: n, options: [hkl, ...wrong] },
      };
    },
  },

  'plane-family-member': {
    levels: ['easy', 'medium', 'hard'], format: 'mc',
    make({ level, rng }) {
      const base = familyBase(rng, level, 2);
      if (!base) return null;
      const shown = familySymbol(rng, base, level);
      const choices = levelMembers(base, level).filter(m => !same(m, shown) && !same(m, neg(shown)));
      if (!choices.length) return null;
      const correct = pick(rng, choices);
      const wrong = wrongOptions(correct, [], { ok: v => plausible(level, 6)(v) && !sameCubicFamily(v, base), fallback: nonMember(rng, base, level) });
      if (!wrong) return null;
      return {
        key: `plane-family-member|${sortedAbs(base)}|${vkey(correct)}`,
        fields: { family: family(shown) },
        correct: plane(correct), wrong: wrong.map(plane),
        data: { base, correct, options: [correct, ...wrong] },
      };
    },
  },

  'plane-family-not-member': {
    levels: ['easy', 'medium', 'hard'], format: 'mc',
    make({ level, rng }) {
      const base = familyBase(rng, level, 3);
      if (!base) return null;
      const shown = familySymbol(rng, base, level);
      const members = shuffle(rng, levelMembers(base, level)).slice(0, 3);
      const odd = retry(() => { const v = nonMember(rng, base, level)(); return v && plausible(level, 6)(v) ? v : null; });
      if (!odd || members.length < 3) return null;
      return {
        key: `plane-family-not-member|${sortedAbs(base)}|${vkey(odd)}`,
        fields: { family: family(shown) },
        correct: plane(odd), wrong: members.map(plane),
        data: { base, correct: odd, options: [odd, ...members] },
      };
    },
  },

  'plane-family-count': {
    levels: ['easy', 'medium', 'hard'], format: 'either',
    make({ level, rng }) {
      const base = randIndices(rng, level, { interesting: level !== 'easy' });
      if (!base) return null;
      const members = planeFamily(base), count = members.length;
      const nums = [...new Set([2 * count, count / 2, 3, 4, 6, 8, 12, 24, 48])].filter(x => Number.isInteger(x) && x !== count);
      const wrong = [nums[0], ...shuffle(rng, nums.slice(1)).sort((p, q) => Math.abs(p - count) - Math.abs(q - count))].slice(0, 3);
      return {
        key: `plane-family-count|${sortedAbs(base)}`,
        fields: { family: family(familySymbol(rng, base, level)), members: listText(members.map(plane), txt('wordAnd')), count },
        correct: String(count), wrong: wrong.map(String),
        typed: { kind: 'number', value: count, tol: 0 },
        data: { base, count },
      };
    },
  },
};

// used by the tests
export const _test = { clearIntercepts, levelMembers };
