/* =====================================================================
   Ionic structures as a Bravais lattice plus a basis (Part 4.5). Pure maths.

   A structure is { ions: [{ el, charge, f }] } on a lattice with a given
   centring. Every lattice point carries a copy of the basis, so the ions
   of one kind are that ion's basis position expanded by the centring
   vectors. Counting, coordination and formula units all come from this
   geometry, never from stored textbook numbers.
   ===================================================================== */
import { expandBasis, formulaUnits } from './basis.js';
import { pointCount } from './cells.js';
import { sub, norm } from './linalg.js';
import { txt } from '../text.js';

/** Ions of each kind in one cell, before counting shares: [{ el, charge, basis: [{ el, f }] }]. */
export function ionBases(structure, centring) {
  const kinds = [];
  for (const i of structure.ions) if (!kinds.some(k => k.el === i.el)) kinds.push({ el: i.el, charge: i.charge });
  return kinds.map(k => ({
    ...k,
    basis: expandBasis(structure.ions.filter(i => i.el === k.el).map(i => ({ el: k.el, f: i.f })), centring),
  }));
}

/** Ions of each kind that belong to a region, with shares (corner ⅛, edge ¼, face ½): { el: { groups, total } }. */
export function ionCounts(structure, centring, region) {
  return Object.fromEntries(ionBases(structure, centring).map(k => [k.el, pointCount(k.basis, region)]));
}

/** Formula units per cell from the ion counts: NaCl → { z: 4, formula: { Cl: 1, Na: 1 } }. */
export function formulaUnitsOf(counts) {
  return formulaUnits(Object.fromEntries(Object.entries(counts).map(([el, c]) => [el, c.total])));
}

/**
 * Coordination of each kind of ion: how many ions of another kind are nearest, and
 * how far away. → { el: { cn, d, with: [el] } }. lattice: a Lattice (toCartesian).
 */
export function coordination(structure, centring, lattice) {
  const kinds = ionBases(structure, centring), out = {};
  for (const A of kinds) {
    const c0 = lattice.toCartesian(A.basis[0].f), found = [];
    for (const B of kinds) {
      if (B.el === A.el) continue;
      for (const s of B.basis) {
        for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (let k = -2; k <= 2; k++) {
          found.push({ el: B.el, d: norm(sub(lattice.toCartesian([s.f[0] + i, s.f[1] + j, s.f[2] + k]), c0)) });
        }
      }
    }
    const d = Math.min(...found.map(x => x.d));
    const near = found.filter(x => x.d < d * (1 + 1e-6) + 1e-9);
    out[A.el] = { cn: near.length, d, with: [...new Set(near.map(x => x.el))] };
  }
  return out;
}

/**
 * The radius-ratio rule: the largest coordination whose hole an ion of radius
 * ratio r₊/r₋ still fills (it touches all its neighbours without the anions touching).
 */
const RATIO_RULE = [
  { min: 0.732, cn: 8, poly: txt('polyCube') },
  { min: 0.414, cn: 6, poly: txt('polyOctahedron') },
  { min: 0.225, cn: 4, poly: txt('polyTetrahedron') },
  { min: 0.155, cn: 3, poly: txt('polyTriangle') },
  { min: 0, cn: 2, poly: txt('polyLine') },
];
export const ratioRule = ratio => RATIO_RULE.find(r => ratio >= r.min - 1e-9);
