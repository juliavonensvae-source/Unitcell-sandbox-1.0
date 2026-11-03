/* =====================================================================
   Dislocations, pure maths (no DOM). Drawn in cubic P, where b = a⟨100⟩
   is the shortest lattice vector.

   Each dislocation has a frame of cube axes (g, n, l): l along the line,
   g the glide direction (along b for an edge dislocation) and n the
   normal of the slip plane, right-handed (g × n = l). The fields are the
   isotropic linear-elastic (Volterra) solutions, with the cut on the slip
   plane behind the line (X < 0), so a line that glides right through the
   block leaves the top half slipped by b over the bottom half.
   ===================================================================== */
import { sub } from './linalg.js';
import { nearestAtomFinder } from './defects.js';

/** Line axis → [glide g, normal n, line l]; cyclic, so every frame is right-handed. */
export const FRAMES = { 0: [1, 2, 0], 1: [2, 0, 1], 2: [0, 1, 2] };

/** Poisson's ratio used unless one is chosen (a typical metal). */
export const NU = 0.3;

/**
 * Edge dislocation: displacement [u_g, u_n] of a point (X, Y) from the line, b along g (signed), Poisson's ratio ν.
 *   u_g =  b/2π [θ + XY / 2(1−ν)r²]
 *   u_n = −b/2π [(1−2ν)/4(1−ν) ln(r²/b²) + (X² − Y²) / 4(1−ν)r²]
 * With b > 0 the extra half-plane is on the +n side (squeezed there, stretched below).
 */
export function edgeField(X, Y, b, nu = NU) {
  const r2 = X * X + Y * Y;
  if (r2 < 1e-12 || !b) return [0, 0];
  const th = Math.atan2(Y, X), k = b / (2 * Math.PI), m = 4 * (1 - nu);
  return [
    k * (th + (2 * X * Y) / (m * r2)),
    -k * (((1 - 2 * nu) / m) * Math.log(r2 / (b * b)) + (X * X - Y * Y) / (m * r2)),
  ];
}

/** Screw dislocation: displacement along the line, u_l = bθ/2π (b signed: + is a right-handed screw). */
export function screwField(X, Y, b) {
  if (X * X + Y * Y < 1e-12 || !b) return 0;
  return (b * Math.atan2(Y, X)) / (2 * Math.PI);
}

/**
 * The displacement field of one dislocation in Cartesian Å (cubic, edge a):
 * d = { kind: 'edge' | 'screw', line (axis), at: [x, y] (the line, in units of a along g and n), b (signed, Å), nu }.
 * → p → [ux, uy, uz]
 */
export function dislocationShift(d, a) {
  const [g, n, l] = FRAMES[d.line];
  return p => {
    const X = p[g] - d.at[0] * a, Y = p[n] - d.at[1] * a, u = [0, 0, 0];
    if (d.kind === 'edge') {
      const [ug, un] = edgeField(X, Y, d.b, d.nu);
      u[g] = ug; u[n] = un;
    } else u[l] = screwField(X, Y, d.b);
    return u;
  };
}

/** The steps of a right-handed circuit about the line, `size` atoms on each side: +g, +n, −g, −n (unit lattice steps as [dg, dn]). */
export function circuitSteps(size) {
  const out = [];
  for (const s of [[1, 0], [0, 1], [-1, 0], [0, -1]]) for (let i = 0; i < size; i++) out.push(s);
  return out;
}

/**
 * Walk a Burgers circuit atom to atom: each step goes to the atom nearest to
 * (this atom + one lattice step), as you would by eye in the real crystal.
 *   atoms   [{ f, pos }] (true positions), start index, frame [g, n, l], steps [[dg, dn]], a
 * → { path: [atom index], done (steps taken), out: true when the circuit ran out of the block }
 */
export function walkCircuit(atoms, start, frame, steps, a) {
  const find = nearestAtomFinder(atoms, a);
  const [g, n] = frame, path = [start];
  for (const [dg, dn] of steps) {
    const here = atoms[path[path.length - 1]].pos.slice();
    here[g] += dg * a;
    here[n] += dn * a;
    const next = find(here, 0.5 * a);
    if (next < 0) return { path, done: path.length - 1, out: true };
    path.push(next);
  }
  return { path, done: steps.length, out: false };
}

/** S → F of a walked circuit as a lattice vector in units of a (from the perfect positions of its first and last atoms). */
export function closureOf(atoms, path) {
  const S = atoms[path[0]], F = atoms[path[path.length - 1]];
  return sub(F.f, S.f).map(x => Math.round(x * 1e4) / 1e4 + 0);
}

/**
 * The ramp a lattice plane becomes around a screw dislocation: the plane at height z0
 * (along the line) rises by b·θ/2π as you go once round the line. Triangles (flat list of
 * Cartesian corners) inside the block's cross-section [0, wg] × [0, wn] (units of a).
 * → [] when the line is outside the block.
 */
export function screwRamp(d, a, z0, [wg, wn], { turns = 72, rings = 7, rMin = 0.18 } = {}) {
  const [g, n, l] = FRAMES[d.line], [xc, yc] = d.at;
  if (xc <= 0 || xc >= wg || yc <= 0 || yc >= wn) return [];
  // distance from the line to the edge of the cross-section along angle t
  const reach = t => {
    const c = Math.cos(t), s = Math.sin(t), hits = [];
    if (c > 1e-9) hits.push((wg - xc) / c);
    if (c < -1e-9) hits.push(-xc / c);
    if (s > 1e-9) hits.push((wn - yc) / s);
    if (s < -1e-9) hits.push(-yc / s);
    return Math.min(...hits);
  };
  const point = (t, frac) => {
    const r = rMin + (reach(t) - rMin) * frac, p = [0, 0, 0];
    p[g] = (xc + r * Math.cos(t)) * a;
    p[n] = (yc + r * Math.sin(t)) * a;
    p[l] = z0 * a + screwField(Math.cos(t), Math.sin(t), d.b);
    return p;
  };
  const tri = [];
  for (let i = 0; i < turns; i++) {
    // just inside (−π, π): the ramp stops at the cut, where it meets the next plane
    const t0 = -Math.PI + (2 * Math.PI * i) / turns + 1e-4, t1 = -Math.PI + (2 * Math.PI * (i + 1)) / turns - 1e-4;
    for (let j = 0; j < rings; j++) {
      const p00 = point(t0, j / rings), p01 = point(t0, (j + 1) / rings), p10 = point(t1, j / rings), p11 = point(t1, (j + 1) / rings);
      tri.push(...p00, ...p10, ...p11, ...p00, ...p11, ...p01);
    }
  }
  return tri;
}

/** The point on a dislocation's line at the middle of the block, and the line's two ends (Cartesian). */
export function lineEnds(d, a, repeats) {
  const [g, n, l] = FRAMES[d.line];
  const p = t => { const q = [0, 0, 0]; q[g] = d.at[0] * a; q[n] = d.at[1] * a; q[l] = t * a; return q; };
  return [p(0), p(repeats[l])];
}
