/* =====================================================================
   Plane intercepts and direction components. Pure mathematics.

   Intercepts: the plane number n of the (hkl) set, measured from an origin O
   (a cell corner), is h·(x − O) = n. It cuts axis i at n / h_i (in units of
   that axis), or never (∞) when h_i = 0. The textbook route back:
     intercepts n/h  →  reciprocals h/n  →  clear fractions (× n)  →  (hkl).
   On hexagonal axes the same works with four axes a1, a2, a3, c and (hkil).
   ===================================================================== */
import { gcd, gcdAll } from './linalg.js';

/** A reduced fraction { p, q } with q > 0. */
export function ratio(p, q) {
  if (q === 0) return null;
  if (q < 0) { p = -p; q = -q; }
  const g = gcd(p, q) || 1;
  return { p: p / g + 0, q: q / g };
}

/** Origin corner that puts the plane n = 1 inside the cell: 1 along every axis with a negative index. */
export const autoOrigin = hkl => hkl.map(x => (x < 0 ? 1 : 0));

/**
 * Steps from intercepts to Miller indices for the plane h·(x − O) = n.
 * indices: 3 (hkl) or 4 (hkil) values; level n ≥ 1.
 * → { intercepts: [ratio | null], reciprocals: [ratio], cleared: [int], factor, indices }
 */
export function interceptSteps(indices, level = 1) {
  const intercepts = indices.map(h => (h === 0 ? null : ratio(level, h)));
  const reciprocals = indices.map(h => ratio(h, level));
  // the factor that clears every fraction: lcm of the denominators
  const factor = reciprocals.reduce((m, r) => (m * r.q) / gcd(m, r.q), 1);
  const cleared = reciprocals.map(r => (r.p * factor) / r.q + 0);
  const g = gcdAll(cleared) || 1;
  return { intercepts, reciprocals, factor, cleared, indices: cleared.map(x => x / g + 0) };
}

/** Where plane n cuts each axis, as fractional coordinates (null when parallel). Box cells only. */
export function interceptPoints(hkl, level, origin) {
  return hkl.map((h, i) => {
    if (h === 0) return null;
    const f = [...origin];
    f[i] += level / h;
    return f;
  });
}

/**
 * The path from the origin to the tip of a direction, one axis at a time:
 * u·a, then v·b, then w·c (or u·a1, v·a2, t·a3, w·c with four indices).
 * axes: the axis vectors in the same order as the components (fractional
 * three-index vectors, e.g. a3 = [−1, −1, 0]).
 * → [{ axis: i, n, from, to }] in fractional coordinates, zero steps left out.
 */
export function componentPath(components, axes) {
  const steps = [];
  let at = [0, 0, 0];
  components.forEach((n, i) => {
    if (!n) return;
    const to = at.map((x, k) => x + n * axes[i][k]);
    steps.push({ axis: i, n, from: at, to });
    at = to;
  });
  return steps;
}

export const AXES_3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
/** a1, a2, a3 = −(a1 + a2), c as three-index vectors. */
export const AXES_4 = [[1, 0, 0], [0, 1, 0], [-1, -1, 0], [0, 0, 1]];
