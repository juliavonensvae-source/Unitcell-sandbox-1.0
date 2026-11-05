/* =====================================================================
   Topic B: the five 2D Bravais lattices, from a picture of the points.

   Difficulty (agreed): easy = one unit cell outlined, a along x, clear
   shapes; medium = points only; hard = points only, the picture rotated,
   lengths and angles nearer the special values (γ = 96°, b/a = 1.15).

   Every generated lattice is checked with classify2D, so a random
   "oblique" lattice can never secretly be centred rectangular.
   ===================================================================== */
import { BRAVAIS_2D } from '../../../data/bravais2d.js';
import { chance, pick, real, retry, shuffle } from '../../random.js';

const IDS = ['mp', 'op', 'oc', 'tp', 'hp'];
const nameOf = id => BRAVAIS_2D.find(b => b.id === id).name;
const DEG = Math.PI / 180;

const dot2 = (u, v) => u[0] * v[0] + u[1] * v[1];
const add2 = (u, v) => [u[0] + v[0], u[1] + v[1]];
const scale2 = (u, s) => [u[0] * s, u[1] * s];

/**
 * Which 2D Bravais lattice two primitive vectors make. Lengths and angles within `tol`
 * (relative) of a special value count as special, so with a large tol a lattice that is
 * only nearly special is classified as the special one.
 */
export function classify2D(v1, v2, tol = 1e-6) {
  let a = v1, b = v2;
  // Gauss reduction: the shortest basis, with |a| ≤ |b| and |a·b| ≤ |a|²/2
  for (let i = 0; i < 50; i++) {
    if (dot2(a, a) > dot2(b, b)) [a, b] = [b, a];
    const m = Math.round(dot2(a, b) / dot2(a, a));
    if (m === 0) break;
    b = add2(b, scale2(a, -m));
  }
  if (dot2(a, a) > dot2(b, b)) [a, b] = [b, a];
  const A = dot2(a, a), B = dot2(b, b), C = Math.abs(dot2(a, b));
  const equal = Math.abs(B - A) / A < tol, right = C / A < tol, sixty = Math.abs(C / A - 0.5) < tol;
  if (equal && right) return 'tp';
  if (equal && sixty) return 'hp';
  if (right) return 'op';
  if (equal || sixty) return 'oc'; // a rhombic primitive cell, or one whose short diagonal equals a side
  return 'mp';
}

/** One lattice of type id: primitive vectors v1, v2 (a along x) and a conventional cell to outline. */
function makeLattice(id, level, rng) {
  const hard = level === 'hard';
  switch (id) {
    case 'tp': return { v1: [1, 0], v2: [0, 1], cell: [[0, 0], [1, 0], [1, 1], [0, 1]] };
    case 'hp': { const v2 = [Math.cos(120 * DEG), Math.sin(120 * DEG)]; return { v1: [1, 0], v2, cell: [[0, 0], [1, 0], add2([1, 0], v2), v2] }; }
    case 'op': { const r = hard ? real(rng, 1.12, 1.25) : real(rng, 1.35, 1.8); return { v1: [1, 0], v2: [0, r], cell: [[0, 0], [1, 0], [1, r], [0, r]], r }; }
    case 'oc': {
      // conventional rectangle 1 × r with a point in the middle; r keeps clear of 1 (square) and √3 (hexagonal)
      const r = hard ? (chance(rng, 0.5) ? real(rng, 1.15, 1.25) : real(rng, 1.88, 2.0)) : (chance(rng, 0.5) ? real(rng, 1.3, 1.5) : real(rng, 2.1, 2.4));
      return { v1: [1, 0], v2: [0.5, r / 2], cell: [[0, 0], [1, 0], [1, r], [0, r]], centre: [0.5, r / 2], r };
    }
    default: {
      const r = hard ? real(rng, 1.12, 1.3) : real(rng, 1.25, 1.6), g = hard ? real(rng, 94, 100, 1) : real(rng, 100, 112, 1);
      const v2 = [r * Math.cos(g * DEG), r * Math.sin(g * DEG)];
      return { v1: [1, 0], v2, cell: [[0, 0], [1, 0], add2([1, 0], v2), v2], r, gamma: g };
    }
  }
}

/**
 * The picture: lattice points filling a 360 × 240 frame, the spacing ≈ 46 px.
 * outline: draw the conventional cell; rot: turn the whole picture (degrees).
 */
export function latticeSvg({ v1, v2, cell, centre }, { outline = false, rot = 0, label = '' } = {}) {
  const W = 360, H = 240, pad = 10;
  const shortest = Math.min(Math.hypot(...v1), Math.hypot(...v2), Math.hypot(...add2(v1, scale2(v2, -1))), Math.hypot(...add2(v1, v2)));
  const s = 46 / shortest, c = Math.cos(rot * DEG), si = Math.sin(rot * DEG);
  const mid = scale2(cell.reduce((m, p) => add2(m, p), [0, 0]), 1 / cell.length);
  const map = p => {
    const x = (p[0] - mid[0]) * s, y = (p[1] - mid[1]) * s;
    return [W / 2 + x * c - y * si, H / 2 - (x * si + y * c)];
  };
  const fmt = x => x.toFixed(1);
  const dots = [];
  for (let i = -16; i <= 16; i++) for (let j = -16; j <= 16; j++) {
    const [x, y] = map(add2(scale2(v1, i), scale2(v2, j)));
    if (x >= pad && x <= W - pad && y >= pad && y <= H - pad) dots.push(`<circle cx="${fmt(x)}" cy="${fmt(y)}" r="4.5"/>`);
  }
  let cellSvg = '';
  if (outline) {
    cellSvg = `<polygon class="ch-cell" points="${cell.map(p => map(p).map(fmt).join(',')).join(' ')}"/>`;
    if (centre) { const [x, y] = map(centre); cellSvg += `<circle class="ch-cell-centre" cx="${fmt(x)}" cy="${fmt(y)}" r="7.5"/>`; }
  }
  return `<svg class="ch-lattice" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">${cellSvg}<g class="ch-points">${dots.join('')}</g></svg>`;
}

export const types = {
  'identify-2d': {
    levels: ['easy', 'medium', 'hard'], format: 'mc', words: ['picture', 'why-mp', 'why-op', 'why-oc', 'why-tp', 'why-hp'],
    make({ level, rng, word }) {
      const id = pick(rng, IDS);
      const L = retry(() => {
        const l = makeLattice(id, level, rng);
        // must be this lattice, and not within the margin of a more symmetric one
        const margin = level === 'hard' ? 0.035 : 0.07;
        return classify2D(l.v1, l.v2) === id && classify2D(l.v1, l.v2, margin) === id ? l : null;
      });
      if (!L) return null;
      const rot = level === 'hard' ? real(rng, 12, 78, 1) * (chance(rng, 0.5) ? 1 : -1) : 0;
      return {
        key: `identify-2d|${id}|${(L.r || 1).toFixed(2)}|${L.gamma || 0}|${rot}`,
        fields: { why: word(`why-${id}`) },
        correct: nameOf(id),
        wrong: shuffle(rng, IDS.filter(x => x !== id)).slice(0, 3).map(nameOf),
        figure: latticeSvg(L, { outline: level === 'easy', rot, label: word('picture') }),
        data: { lattice: id, v1: L.v1, v2: L.v2 },
      };
    },
  },
};
