/* =====================================================================
   Close-packed stacking: ABAB… (HCP) and ABCABC… (FCC). Pure maths.

   A close-packed layer is a triangular net of touching spheres of radius r,
   so a = 2r on hexagonal axes. The next layer sits in one of the two sets
   of hollows, so every layer is at one of three positions in the plane:
   A (0, 0), B (⅔, ⅓) or C (⅓, ⅔). Neighbouring layers are h = 2r·√(2/3) apart.

   Two views:
   'hex'    hexagonal axes with c along the stacking direction and one atom
            per layer in each cell: ABAB… c = 2h (HCP), ABC… c = 3h (the
            R-centred hexagonal cell).
   'cubic'  ABC… only: the same atoms are the cubic F lattice. The layers are
            the (111) planes x + y + z = n, and layer n has letter n mod 3.
   Counts, coordination and packing are worked out from the geometry.
   ===================================================================== */
import { sitesInRegion, shareOf, groupShares } from './cells.js';
import { neighbourShell } from './analysis.js';
import { Lattice } from './lattice.js';
import { dot, norm, scale } from './linalg.js';

/** Height of one layer above the next, as a multiple of the sphere diameter 2r. */
export const LAYER_RISE = Math.sqrt(2 / 3);

/** Ideal c/a on hexagonal axes: 2 layers per cell (HCP, √(8/3) = 1.633) or 3 (ABC, √6 = 2.449). */
export const IDEAL_CA = { AB: 2 * LAYER_RISE, ABC: 3 * LAYER_RISE };

const POS = { A: [0, 0], B: [2 / 3, 1 / 3], C: [1 / 3, 2 / 3] };

/** The atoms of one hexagonal cell for the sequence 'AB' or 'ABC': [{ el: letter, f }]. */
export function stackingBasis(seq) {
  return [...seq].map((L, k) => ({ el: L, f: [...POS[L], k / seq.length] }));
}

/** Lattice parameters for touching spheres of radius r. */
export function stackingParams(seq, view, r) {
  if (view === 'cubic') {
    const a = 2 * Math.SQRT2 * r;
    return { a, b: a, c: a, alpha: 90, beta: 90, gamma: 90 };
  }
  const a = 2 * r;
  return { a, b: a, c: a * IDEAL_CA[seq], alpha: 90, beta: 90, gamma: 120 };
}

/** The stacking direction in fractional coordinates: c on hexagonal axes, [111] in the cube. */
export const stackingNormal = view => (view === 'cubic' ? [1, 1, 1] : [0, 0, 1]);

/** The layer of an atom at f, counted from the origin o: { n, letter }. */
export function layerOf(f, view, seq, o = [0, 0, 0]) {
  const d = [0, 1, 2].map(i => f[i] - o[i]);
  const n = Math.round(view === 'cubic' ? d[0] + d[1] + d[2] : d[2] * seq.length);
  const letters = view === 'cubic' ? 'ABC' : seq;
  return { n, letter: letters[((n % letters.length) + letters.length) % letters.length] };
}

/**
 * Neighbours and packing of the stacking: { r, dnn, cn, inLayer, above, below, packing, spacing }.
 * basis: the atoms of one cell; r is half the nearest-neighbour distance (touching spheres).
 */
export function stackingFacts(params, basis, view) {
  const L = new Lattice(params);
  const one = basis.map(s => ({ el: 'X', f: s.f }));
  const shell = neighbourShell(L, one, 0);
  const dnn = shell[0].d, r = dnn / 2;
  const nc = L.toCartesian(stackingNormal(view)), up = scale(nc, 1 / norm(nc));
  let inLayer = 0, above = 0, below = 0;
  for (const { df } of shell) {
    const z = dot(L.toCartesian(df), up);
    if (Math.abs(z) < 1e-6 * dnn) inLayer++;
    else if (z > 0) above++;
    else below++;
  }
  const spacing = view === 'cubic' ? L.dSpacing([1, 1, 1]) : params.c / basis.length;
  return { lattice: L, r, dnn, cn: shell.length, inLayer, above, below, spacing, packing: one.length * (4 / 3) * Math.PI * r ** 3 / L.volume };
}

/** Atoms of each layer letter that belong to a region, with shares: { A: { groups, total }, … }. */
export function layerCounts(basis, region, letterOf) {
  const byLetter = {};
  for (const s of sitesInRegion(basis, region)) (byLetter[letterOf(s.f)] ||= []).push(s);
  return Object.fromEntries(Object.keys(byLetter).sort().map(k => [k, groupShares(byLetter[k], f => shareOf(f, region))]));
}
