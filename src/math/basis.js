/* Basis handling: expanding a motif with centring translations and
   counting points per cell. Pure mathematics. */
import { EPS, add, gcdAll } from './linalg.js';

/** Wrap a fractional coordinate into [0, 1), snapping values within EPS of an edge to 0. */
export function wrap01(x) {
  let y = x - Math.floor(x);
  if (y > 1 - EPS || y < EPS) y = 0;
  return y;
}
const siteKey = (el, f) => `${el}:${f.map(x => x.toFixed(5)).join(',')}`;

/** Motif × centring translations → unique basis with every site wrapped into [0, 1). */
export function expandBasis(motif, centring = [[0, 0, 0]]) {
  const out = [], seen = new Set();
  for (const t of centring) {
    for (const m of motif) {
      const f = add(m.f, t).map(wrap01);
      const key = siteKey(m.el, f);
      if (!seen.has(key)) { seen.add(key); out.push({ el: m.el, f }); }
    }
  }
  return out;
}

/**
 * Counts points per cell the way it is taught: a site with k coordinates on a cell
 * boundary is drawn 2^k times (corner k=3, edge k=2, face k=1, interior k=0) and each
 * drawn image contributes 1/2^k.
 */
export function countAtoms(basis) {
  const KIND = ['interior', 'face', 'edge', 'corner'];
  const images = { corner: 0, edge: 0, face: 0, interior: 0 };
  const byElement = {};
  let total = 0;
  for (const s of basis) {
    const k = s.f.filter(x => Math.abs(x) < EPS).length;
    const n = 2 ** k, w = 1 / n;
    images[KIND[k]] += n;
    total += n * w;
    byElement[s.el] = (byElement[s.el] || 0) + n * w;
  }
  return { total, byElement, images };
}

/** Formula units per cell: divide element counts by their greatest common divisor. */
export function formulaUnits(byElement) {
  const els = Object.keys(byElement);
  const counts = els.map(e => Math.round(byElement[e]));
  const z = gcdAll(counts) || 1;
  return { z, formula: Object.fromEntries(els.map((e, i) => [e, counts[i] / z])) };
}
