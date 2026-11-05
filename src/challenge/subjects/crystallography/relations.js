/* =====================================================================
   Topic E: how planes and directions relate (cubic indices). All of it
   rests on one rule: [uvw] lies in (hkl) exactly when hu + kv + lw = 0.

   dir-in-plane         which direction lies in (hkl)
   plane-contains-dir   which plane contains [uvw]
   zone-axis            (medium, hard) the direction where two planes meet: h₁ × h₂
   plane-from-two-dirs  (medium, hard) the plane holding two directions: u₁ × u₂
   coplanar-three       (medium, hard) which three directions lie in one plane
   ===================================================================== */
import { det3 } from '../../../math/linalg.js';
import { pick, shuffle, retry } from '../../random.js';
import {
  randIndices, allIndices, reduce, neg, same, vkey, dot3, cross3, inRange, isReduced, allZero,
  flipOne, swapTwo, nudge, wrongOptions, plausible, plane, dir, paren,
} from './common.js';

const parallel = (a, b) => allZero(cross3(a, b));
const cache = new Map();
/** Every reduced vector of the level's range (computed once per level). */
const pool = level => { if (!cache.has(level)) cache.set(level, allIndices(level)); return cache.get(level); };
/** The vectors of the level that are perpendicular to v (directions in a plane, or planes holding a direction). */
const perpendicular = (v, level) => pool(level).filter(u => dot3(u, v) === 0);

/** "1·1 + 1·(−1) + 0·0 = 0" */
const dotText = (a, b) => `${a.map((x, i) => `${paren(x)}·${paren(b[i])}`).join(' + ')} = ${dot3(a, b)}`.replace(/-/g, '−');
/** The cross product written out, then reduced: "[1·0 − 0·1, …] = [−1, 1, 0]" */
function crossText(a, b, bracket) {
  const [o, c] = bracket === 'plane' ? ['(', ')'] : ['[', ']'];
  const raw = cross3(a, b), red = reduce(raw);
  const terms = [[1, 2], [2, 0], [0, 1]].map(([i, j]) => `${paren(a[i])}·${paren(b[j])} − ${paren(a[j])}·${paren(b[i])}`);
  const head = `${o}${terms.join(', ')}${c} = ${o}${raw.join(', ')}${c}`;
  return { text: (same(raw, red) ? head : `${head} → ${o}${red.join(' ')}${c}`).replace(/-/g, '−'), raw, red };
}

/** A vector v and three that fail the rule with it, for "which of these … lies in / contains". */
function oneThatFits(rng, level, given) {
  const fits = perpendicular(given, level);
  if (!fits.length) return null;
  const correct = pick(rng, fits);
  const ok = u => plausible(level, 6)(u) && dot3(u, given) !== 0;
  const wrong = wrongOptions(correct, [
    given, // the normal: [hkl] is perpendicular to (hkl), so it never lies in it
    flipOne(rng, correct), swapTwo(rng, correct), flipOne(rng, correct), swapTwo(rng, correct),
  ], { ok, fallback: () => (rng() < 0.5 ? nudge(rng, correct) : pick(rng, pool(level))) });
  return wrong && { correct, wrong };
}

/** Two non-parallel vectors of the level perpendicular to `answer` (so their cross product is ±answer). */
function twoAround(rng, answer, level) {
  const fits = shuffle(rng, perpendicular(answer, level));
  for (let i = 0; i < fits.length; i++) for (let j = i + 1; j < fits.length; j++) {
    if (!parallel(fits[i], fits[j])) return [fits[i], fits[j]];
  }
  return null;
}

/** Wrong answers for a cross product: the middle sign forgotten, the sum, the difference, swaps. */
function crossWrongs(rng, a, b, answer, level) {
  const raw = cross3(a, b);
  return wrongOptions(answer, [
    reduce([raw[0], -raw[1], raw[2]]),       // forgot the minus of the middle term
    allZero(a.map((x, i) => x + b[i])) ? null : reduce(a.map((x, i) => x + b[i])),
    allZero(a.map((x, i) => x - b[i])) ? null : reduce(a.map((x, i) => x - b[i])),
    swapTwo(rng, answer), flipOne(rng, answer),
  ], { ok: v => !allZero(v) && isReduced(v) && inRange(v, 6), exclude: [neg(answer)], fallback: () => nudge(rng, answer) });
}

export const types = {
  'dir-in-plane': {
    levels: ['easy', 'medium', 'hard'], format: 'mc',
    make({ level, rng }) {
      const hkl = randIndices(rng, level);
      const r = hkl && oneThatFits(rng, level, hkl);
      if (!r) return null;
      return {
        key: `dir-in-plane|${vkey(hkl)}|${vkey(r.correct)}`,
        fields: { plane: plane(hkl), check: dotText(hkl, r.correct) },
        correct: dir(r.correct), wrong: r.wrong.map(dir), data: { hkl, correct: r.correct, options: [r.correct, ...r.wrong] },
      };
    },
  },

  'plane-contains-dir': {
    levels: ['easy', 'medium', 'hard'], format: 'mc',
    make({ level, rng }) {
      const uvw = randIndices(rng, level);
      const r = uvw && oneThatFits(rng, level, uvw);
      if (!r) return null;
      return {
        key: `plane-contains-dir|${vkey(uvw)}|${vkey(r.correct)}`,
        fields: { direction: dir(uvw), check: dotText(r.correct, uvw) },
        correct: plane(r.correct), wrong: r.wrong.map(plane), data: { uvw, correct: r.correct, options: [r.correct, ...r.wrong] },
      };
    },
  },

  'zone-axis': {
    levels: ['medium', 'hard'], format: 'either',
    make({ level, rng }) {
      const target = randIndices(rng, level);
      const pair = target && twoAround(rng, target, level);
      if (!pair) return null;
      const [p1, p2] = pair, cx = crossText(p1, p2, 'dir'), answer = cx.red;
      const wrong = crossWrongs(rng, p1, p2, answer, level);
      if (!wrong) return null;
      return {
        key: `zone-axis|${[vkey(p1), vkey(p2)].sort().join('|')}`,
        fields: { p1: plane(p1), p2: plane(p2), cross: cx.text },
        correct: dir(answer), wrong: wrong.map(dir),
        typed: { kind: 'indices', values: answer, negativeOk: true, bracket: 'dir' },
        data: { p1, p2, answer, options: [answer, ...wrong] },
      };
    },
  },

  'plane-from-two-dirs': {
    levels: ['medium', 'hard'], format: 'either',
    make({ level, rng }) {
      const target = randIndices(rng, level);
      const pair = target && twoAround(rng, target, level);
      if (!pair) return null;
      const [d1, d2] = pair, cx = crossText(d1, d2, 'plane'), answer = cx.red;
      const wrong = crossWrongs(rng, d1, d2, answer, level);
      if (!wrong) return null;
      return {
        key: `plane-from-two-dirs|${[vkey(d1), vkey(d2)].sort().join('|')}`,
        fields: { d1: dir(d1), d2: dir(d2), cross: cx.text },
        correct: plane(answer), wrong: wrong.map(plane),
        typed: { kind: 'indices', values: answer, negativeOk: true, bracket: 'plane' },
        data: { d1, d2, answer, options: [answer, ...wrong] },
      };
    },
  },

  'coplanar-three': {
    levels: ['medium', 'hard'], format: 'mc',
    make({ level, rng }) {
      /** Three pairwise non-parallel directions in one plane of the level. */
      const coplanar = () => retry(() => {
        const h = randIndices(rng, level, { interesting: false });
        const fits = h && shuffle(rng, perpendicular(h, level));
        if (!fits || fits.length < 3) return null;
        const set = [fits[0]];
        for (const u of fits) if (set.length < 3 && set.every(s => !parallel(s, u))) set.push(u);
        return set.length === 3 ? { h: reduce(h), set } : null;
      }, 60);
      const good = coplanar();
      if (!good) return null;
      // wrong sets: a coplanar set with one direction nudged out of its plane
      const wrongSets = [];
      for (let i = 0; i < 60 && wrongSets.length < 3; i++) {
        const c = i % 2 ? coplanar() : good;
        if (!c) continue;
        const set = [...c.set], k = Math.floor(rng() * 3);
        set[k] = nudge(rng, set[k]);
        if (!plausible(level, 6)(set[k]) || det3(set) === 0) continue;
        const key = set.map(vkey).sort().join('|');
        if (wrongSets.some(w => w.map(vkey).sort().join('|') === key)) continue;
        wrongSets.push(set);
      }
      if (wrongSets.length < 3) return null;
      const show = set => set.map(dir).join(', ');
      return {
        key: `coplanar-three|${good.set.map(vkey).sort().join('|')}`,
        fields: { plane: plane(good.h), checks: good.set.map(u => dotText(good.h, u)).join('; ') },
        correct: show(good.set), wrong: wrongSets.map(show),
        data: { correct: good.set, options: [good.set, ...wrongSets] },
      };
    },
  },
};
