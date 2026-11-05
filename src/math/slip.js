/* =====================================================================
   Slip on the densest planes of cubic P, I and F. Pure maths (no DOM).

   A slip system is a plane and a direction in it: the most densely packed
   planes (they are also the furthest apart) and the most densely packed
   directions in them, whose shortest lattice vector is the Burgers vector:
     cubic P  {100}⟨100⟩  b = a⟨100⟩     3 planes × 2 directions = 6
     cubic I  {110}⟨111⟩  b = a/2⟨111⟩   6 planes × 2 directions = 12
     cubic F  {111}⟨110⟩  b = a/2⟨110⟩   4 planes × 3 directions = 12
   Vectors here are fractional (units of a); in a cubic cell they point the
   same way in Cartesian coordinates.

   A dislocation on the plane is a straight line ξ in it, at X = x along the
   in-plane direction m it glides in, with frame (m, n, ξ) right-handed
   (m × n = ξ). Where the line has passed (X < x) the half above the plane
   (+n) has slipped by b over the half below. Its displacement is the
   Volterra field of dislocations.js (edge part of b along m, screw part
   along ξ), with the slip spread over the core as in the Peierls–Nabarro
   model: an atom a height Y from the plane moves as if it were |Y| + ζ away.
   ===================================================================== */
import { add, sub, scale, dot, cross, norm, normalize, PERMS } from './linalg.js';
import { edgeField, screwField, NU } from './dislocations.js';
import { neighbourShell } from './analysis.js';

/** The slip system of each cubic lattice: plane {hkl}, direction ⟨uvw⟩ and b = k·a⟨uvw⟩. */
export const SLIP_SYSTEMS = {
  cP: { plane: [1, 0, 0], dir: [1, 0, 0], k: 1 },
  cI: { plane: [1, 1, 0], dir: [1, 1, 1], k: 1 / 2 },
  cF: { plane: [1, 1, 1], dir: [1, 1, 0], k: 1 / 2 },
};

/** Of v and −v, the one with fewer minus signs (a tie: the first non-zero index positive). */
function canonical(v) {
  const neg = u => u.filter(x => x < 0).length;
  const w = v.map(x => -x + 0);
  if (neg(v) !== neg(w)) return neg(v) < neg(w) ? v : w;
  return v.find(x => x !== 0) > 0 ? v : w;
}

/** Sorting: by where the non-zero indices are, then by the number and place of the minus signs: (111), (1̄11), (11̄1), (111̄). */
const order = v => [...v.map(x => (x === 0 ? 1 : 0)), v.filter(x => x < 0).length, v.findIndex(x => x < 0)].join(',');

/** The members of a family {hkl} or ⟨uvw⟩, one of each ± pair: {111} → (111), (1̄11), (11̄1), (111̄). */
export function familyMembers(v) {
  const seen = new Map();
  for (const p of PERMS) {
    for (let s = 0; s < 8; s++) {
      const u = canonical(p.map((i, k) => (s & (1 << k) ? -v[i] : v[i]) + 0));
      seen.set(u.join(), u);
    }
  }
  return [...seen.values()].sort((p, q) => (order(p) < order(q) ? -1 : order(p) > order(q) ? 1 : 0));
}

/** The slip planes of a cubic lattice ('cP', 'cI', 'cF'). */
export const slipPlanes = id => familyMembers(SLIP_SYSTEMS[id].plane);

/** The slip directions in one of its planes (one of each ± pair). */
export const slipDirections = (id, hkl) => familyMembers(SLIP_SYSTEMS[id].dir).filter(u => dot(u, hkl) === 0);

/** How many slip systems: planes × directions in each. */
export const slipSystemCount = id => slipPlanes(id).length * slipDirections(id, slipPlanes(id)[0]).length;

/** The Burgers vector of a slip direction (fractional, units of a): k·[uvw]. */
export const burgersOf = (id, uvw) => scale(uvw, SLIP_SYSTEMS[id].k);

/**
 * Lattice-point vectors written as a fraction of a times whole indices: [−½, ½, 0] → { den: 2, uvw: [−1, 1, 0] }, read a/2[1̄10].
 * den is 1, 2, 3 or 6 (the centring fractions); null when none fits.
 */
export function asIndices(v) {
  for (const den of [1, 2, 3, 6]) {
    const w = v.map(x => x * den);
    if (w.every(x => Math.abs(x - Math.round(x)) < 1e-6)) return { den, uvw: w.map(x => Math.round(x) + 0) };
  }
  return null;
}

/**
 * Packing in a plane (hkl): every layer of the set holds n·d/V atoms per area, so the densest planes are those
 * furthest apart. → { d, perArea (atoms per Å²), packing (share of the plane covered by circles of radius r), inPlane (touching neighbours in the plane) }
 */
export function planeFacts(L, basis, hkl, r) {
  const d = L.dSpacing(hkl), perArea = (basis.length * d) / L.volume;
  const shell = neighbourShell(L, basis, 0);
  return { d, perArea, packing: perArea * Math.PI * r * r, inPlane: shell.filter(s => Math.abs(dot(s.df, hkl)) < 1e-9).length };
}

/**
 * The frame of a dislocation with Burgers vector b on the plane with unit normal n (Cartesian):
 * 'edge' — the line is at right angles to b, ξ = b̂ × n, and glides along b;
 * 'screw' — the line runs along b, ξ = b̂, and glides at right angles to it, m = n × b̂.
 * → { m, n, xi }: unit vectors with m × n = ξ.
 */
export function slipFrame(n, b, character) {
  const bh = normalize(b);
  const xi = character === 'screw' ? bh : normalize(cross(bh, n));
  return { m: normalize(cross(n, xi)), n, xi };
}

/**
 * The displacement of a straight dislocation (Cartesian Å): frame { m, n, xi }, a point o on its line, Burgers vector b
 * (Cartesian), zeta the half-width of the core (Peierls–Nabarro), nu Poisson's ratio. → p → u
 */
export function lineShift({ m, n, xi }, o, b, { zeta = 0, nu = NU } = {}) {
  const be = dot(b, m), bs = dot(b, xi);
  return p => {
    const d = sub(p, o), X = dot(d, m), Y0 = dot(d, n), Y = Y0 + Math.sign(Y0) * zeta;
    let u = [0, 0, 0];
    if (Math.abs(be) > 1e-9) {
      const [um, un] = edgeField(X, Y, be, nu);
      u = add(scale(m, um), scale(n, un));
    }
    if (Math.abs(bs) > 1e-9) u = add(u, scale(xi, screwField(X, Y, bs)));
    return u;
  };
}

/**
 * Half the width of the core in the Peierls–Nabarro model, for planes d apart: ζ = d/2 for a screw dislocation,
 * d/2(1 − ν) for an edge one, in between for a mixed one (by the share of b along the line).
 */
export function coreHalfWidth(d, b, xi, nu = NU) {
  const c = Math.abs(dot(normalize(b), xi));
  return (d / 2) * (c * c + (1 - c * c) / (1 - nu));
}

/**
 * Cubic F: b = a/2⟨110⟩ on a {111} plane splits into two Shockley partials a/6⟨112⟩, b = b₁ + b₂, 30° either side of b.
 * The leading one, b₁, moves the atoms just above the plane into the empty hollows of the layer below (C), not on top
 * of its atoms; the trailing one, b₂, takes them on to the next B hollow.
 *   b, hkl   fractional (units of a); hkl points from the layer below to the layer above
 *   upper    a lattice point just above the plane (fractional)
 *   isPoint  f → true for a lattice point
 * → [b1, b2] (fractional)
 */
export function shockleyPartials(b, hkl, upper, isPoint) {
  const h2 = dot(hkl, hkl);
  const w = scale(cross(hkl, b), 1 / (2 * Math.sqrt(3) * Math.sqrt(h2)));
  const down = scale(hkl, -1 / h2); // from the layer above to the one below, along the normal (cubic: d = a/|hkl|)
  const half = scale(b, 0.5);
  for (const s of [1, -1]) {
    const b1 = add(half, scale(w, s)), b2 = sub(half, scale(w, s));
    if (!isPoint(add(add(upper, b1), down))) return [b1, b2];
  }
  return [half, half];
}

/** Is f a lattice point of a lattice with this basis (fractional, one cell)? */
export const isLatticePoint = basis => f => basis.some(s => f.every((x, i) => {
  const y = x - s.f[i];
  return Math.abs(y - Math.round(y)) < 1e-6;
}));

/**
 * Where the dislocation is: t = 0 not in the crystal yet (perfect), t = 1 it has crossed it (slipped by b), and in
 * between the line runs from just before the first atom to just after the last one. With two partials w apart, x is
 * their middle. span = [min, max] of the atoms' X. → { stage: 'before' | 'in' | 'after', x }
 */
export function slipStage(t, span, pad, w = 0) {
  const x0 = span[0] - pad - w / 2, x1 = span[1] + pad + w / 2;
  if (t <= 0) return { stage: 'before', x: x0 };
  if (t >= 1) return { stage: 'after', x: x1 };
  return { stage: 'in', x: x0 + t * (x1 - x0) };
}

/** A convex polygon (Cartesian) cut by the half-space p·q ≤ c (Sutherland–Hodgman); [] when nothing is left. */
export function clipConvex(poly, q, c) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const P = poly[i], Q = poly[(i + 1) % poly.length], sp = dot(P, q) - c, sq = dot(Q, q) - c;
    if (sp <= 0) out.push(P);
    if (sp * sq < 0) out.push(add(P, scale(sub(Q, P), sp / (sp - sq))));
  }
  return out.length >= 3 ? out : [];
}

/** |b|² of a vector in units of a²: the energy of a dislocation grows as b². */
export const b2 = v => dot(v, v);

/** The length of a fractional vector in a cubic cell of edge a. */
export const cubicLength = (v, a) => norm(v) * a;
