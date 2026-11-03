/* =====================================================================
   Planes in a displayed region, and where two planes meet.

   A plane of a family h·f = n is cut to the region (planePolygonIn); the
   textbook plane of a family is the nearest level that cuts it.

   Lattice planes that really contain lattice points: the formula
   1/d² = hᵀG*h gives the spacing of the planes h·x = 0, 1, 2, … In a centred
   lattice the extra points t can sit between them, at h·t = ½: then the
   planes that hold points are closer together than d_hkl. All values h·x
   over the lattice points form step·ℤ (step = gcd of h, k, l and every h·t),
   so the lattice planes are the formula planes of hkl/step, e.g. (100) in
   cubic I → (200).

   Zone axis: the direction common to (h₁k₁l₁) and (h₂k₂l₂) is the cross product of the
   Miller indices, [uvw] = h₁ × h₂ — valid in every crystal system, because
   a direction lies in a plane exactly when uh + vk + wl = 0 (no metric needed).
   ===================================================================== */
import { gcd, gcdAll, dot, sub, add, scale, cross, centroid, sortAround, PERMS } from './linalg.js';
import { reduceIndices } from './indices.js';
import { translateRegion } from './cells.js';

/** Range of h·f over the region. */
export function levelRange(hkl, region) {
  const vals = region.vertices.map(v => dot(hkl, v));
  return { min: Math.min(...vals), max: Math.max(...vals) };
}

/** Polygon where the plane h·f = level cuts the region (fractional, ordered), or null. */
export function planePolygonIn(hkl, level, region) {
  const pts = [];
  const push = p => { if (!pts.some(q => Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) + Math.abs(q[2] - p[2]) < 1e-7)) pts.push(p); };
  for (const [A, B] of region.edges) {
    const s0 = dot(hkl, A) - level, s1 = dot(hkl, B) - level;
    if (Math.abs(s0) < 1e-9) push(A);
    if (Math.abs(s1) < 1e-9) push(B);
    if (s0 * s1 < 0) push(add(A, scale(sub(B, A), s0 / (s0 - s1))));
  }
  if (pts.length < 3) return null;
  const ax = hkl.map(Math.abs);
  const e = ax[0] <= ax[1] && ax[0] <= ax[2] ? [1, 0, 0] : ax[1] <= ax[2] ? [0, 1, 0] : [0, 0, 1];
  return sortAround(pts, centroid(pts), hkl, cross(hkl, e));
}

/** The textbook plane of a family in a region: the nearest level that actually cuts through it. */
function representativeLevelIn(hkl, region) {
  const { min, max } = levelRange(hkl, region);
  const inside = [];
  for (let n = Math.ceil(min); n <= Math.floor(max); n++) if (n > min + 1e-9 && n < max - 1e-9) inside.push(n);
  const positive = inside.filter(n => n > 0);
  if (positive.length) return positive[0];
  if (inside.includes(0)) return 0;
  if (inside.length) return inside[inside.length - 1];
  return max > 0 ? max : min;
}

/**
 * The textbook plane of a set seen from an origin O: the representative level of
 * h·(x − O) in the region, returned as the absolute level h·x.
 */
export function representativeLevelFrom(hkl, region, origin = [0, 0, 0]) {
  const shift = dot(hkl, origin);
  return representativeLevelIn(hkl, translateRegion(region, scale(origin, -1))) + shift;
}

/** Every integer level whose plane cuts the region. */
export function familyLevelsIn(hkl, region) {
  const { min, max } = levelRange(hkl, region), out = [];
  for (let n = Math.ceil(min - 1e-9) + 0; n <= Math.floor(max + 1e-9); n++) if (planePolygonIn(hkl, n, region)) out.push(n);
  return out;
}

/** Centring fractions are multiples of ½ or ⅓, so ×6 makes every h·t a whole number. */
const DEN = 6;

/**
 * Which planes of the (hkl) set contain lattice points.
 * basis = the lattice points of one conventional cell (fractional, in [0, 1)).
 * → { step: [p, q] (levels n·p/q), stepValue, eq: indices of the lattice planes (hkl·q/p) }
 */
export function latticePlanes(hkl, basis) {
  const ints = [...hkl.map(x => DEN * x), ...basis.map(s => Math.round(DEN * dot(hkl, s.f)))];
  const g = gcdAll(ints) || DEN;
  // step = g / DEN, reduced to p / q
  const r = gcd(g, DEN), p = g / r, q = DEN / r;
  return { step: [p, q], stepValue: p / q, eq: hkl.map(x => (x * q) / p + 0) };
}

/** Spacing of the planes that contain lattice points, and of the formula planes. */
export function planeSpacings(L, hkl, basis) {
  const lp = latticePlanes(hkl, basis);
  const dFormula = L.dSpacing(hkl);
  return { ...lp, dFormula, dLattice: dFormula * lp.stepValue };
}

/**
 * The lattice planes of a set inside a region, as levels in units of the formula:
 * [{ k, level, formula, poly }] with level = k·step (so h·x = level), formula = true
 * when the plane is also one of the formula planes (level is a whole number).
 */
export function latticePlaneLayers(hkl, basis, region) {
  const { eq, step: [p, q] } = latticePlanes(hkl, basis);
  return familyLevelsIn(eq, region).map(k => ({
    k, level: (k * p) / q, formula: (k * p) % q === 0, poly: planePolygonIn(eq, k, region),
  }));
}

/**
 * Formula planes h·x = n that hold no lattice points (only for indices that share a
 * factor, e.g. (200) in a primitive lattice: the planes at x = ½, 1½, …).
 */
export function emptyFormulaLevels(hkl, basis, region) {
  const { step: [p, q] } = latticePlanes(hkl, basis);
  if (q === 1 && p === 1) return [];
  return familyLevelsIn(hkl, region).filter(n => (n * q) % p !== 0);
}

/**
 * The plane sets equivalent to (hkl) by the symmetry of the lattice, {hkl}: the
 * orderings and sign changes of the indices (of h, k, i on hexagonal axes, with ±l)
 * whose planes keep both spacings, d_hkl and the spacing of the planes that hold
 * points. In the standard settings the lattice's symmetry only reorders and flips
 * indices, and it keeps every spacing, so this is the family. (hkl) and (h̄k̄l̄)
 * are the same set: each set appears once, (hkl) first.
 */
export function equivalentPlanes(L, hkl, basis, hexAxes = false) {
  const ref = planeSpacings(L, hkl, basis), out = [], seen = new Set();
  const same = (x, y) => Math.abs(x - y) < 1e-6 * y;
  const base = hexAxes ? [hkl[0], hkl[1], -hkl[0] - hkl[1]] : hkl;
  for (const p of PERMS) for (let s = 0; s < (hexAxes ? 16 : 8); s++) {
    const v = p.map((j, i) => ((s >> i) & 1 ? -1 : 1) * base[j]);
    if (hexAxes && v[0] + v[1] + v[2] !== 0) continue;
    const m = (hexAxes ? [v[0], v[1], (s & 8 ? -1 : 1) * hkl[2]] : v).map(x => x + 0);
    if (seen.has(m.join()) || seen.has(m.map(x => -x + 0).join())) continue;
    const sp = planeSpacings(L, m, basis);
    if (!same(sp.dFormula, ref.dFormula) || !same(sp.dLattice, ref.dLattice)) continue;
    seen.add(m.join());
    out.push(m);
  }
  return out;
}

/**
 * The region's half-spaces as Cartesian planes n·r ≤ d (n = h1 a* + h2 b* + h3 c*),
 * ready to be used as clipping planes.
 */
export function regionPlanes(region, lattice) {
  if (!region.halfspaces) return null; // a field of prisms: cut each column on its own (see the workspace)
  const [A, B, C] = lattice.reciprocal;
  return region.halfspaces.map(({ h, d }) => ({ n: [0, 1, 2].map(i => h[0] * A[i] + h[1] * B[i] + h[2] * C[i]), d }));
}

/* ---------- where two planes meet ---------- */

/** { uvw } reduced to the smallest whole numbers, or { parallel: true }. */
export function zoneAxis(h1, h2) {
  const c = cross(h1, h2);
  if (c.every(x => x === 0)) return { parallel: true };
  return { uvw: reduceIndices(c), raw: c };
}

/**
 * The line where the planes h₁·f = n₁ and h₂·f = n₂ cross, as a point f0 and a
 * direction d (fractional coordinates), or null if the planes are parallel.
 * f0 = λ₁h₁ + λ₂h₂ solves both plane equations.
 */
export function intersectionLine(h1, n1, h2, n2) {
  const d = cross(h1, h2);
  if (d.every(x => x === 0)) return null;
  const a = dot(h1, h1), b = dot(h1, h2), c = dot(h2, h2), det = a * c - b * b;
  const l1 = (n1 * c - n2 * b) / det, l2 = (n2 * a - n1 * b) / det;
  return { f0: add(scale(h1, l1), scale(h2, l2)), d };
}

/**
 * The shortest lattice direction lying in the plane (uh + vk + wl = 0), to look at
 * the planes edge-on. Small integer search; returns [u, v, w].
 */
export function inPlaneDirection(L, hkl) {
  let best = null, bestLen = Infinity;
  for (let u = -3; u <= 3; u++) for (let v = -3; v <= 3; v++) for (let w = -3; w <= 3; w++) {
    if (!u && !v && !w) continue;
    if (u * hkl[0] + v * hkl[1] + w * hkl[2] !== 0) continue;
    if (gcdAll([u, v, w]) !== 1) continue;
    const len = L.length([u, v, w]) * (1 + 1e-9 * (Math.abs(u) + Math.abs(v) + Math.abs(w)));
    // prefer the positive-looking one of ±uvw
    const first = [u, v, w].find(x => x !== 0);
    if (first < 0) continue;
    if (len < bestLen - 1e-9) { best = [u, v, w]; bestLen = len; }
  }
  return best || cross(hkl, [0, 0, 1]);
}
