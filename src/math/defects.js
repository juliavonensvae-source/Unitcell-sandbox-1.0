/* =====================================================================
   Defects mode, pure maths (no DOM): the atoms of a block with point
   defects and dislocations, how far each atom moves, how much its bonds
   stretch, the 2D slice and the vacancy concentration.

   Two kinds of displacement are kept apart:
   - relaxation round a point defect (small; the drawing may exaggerate it)
   - the displacement of a dislocation (a whole Burgers vector; never
     exaggerated, see dislocations.js)
   ===================================================================== */
import { add, sub, scale, norm } from './linalg.js';

/** Boltzmann's constant in eV/K. */
export const K_EV = 8.617333262e-5;

/** Lattice points (or sites) are the same when their coordinates agree to this. */
const key = f => f.map(x => (Math.round(x * 1e4) / 1e4 + 0).toFixed(4)).join(',');

/* ---------- the 2D slice ---------- */

/** The atomic layers of a block across a cube axis: the distinct coordinates of its lattice points along it. */
export function sliceLayers(basis, repeats, axis) {
  const vals = new Set();
  for (const s of basis) {
    for (let k = 0; k <= repeats[axis]; k++) {
      const v = s.f[axis] + k;
      if (v <= repeats[axis] + 1e-9) vals.add(+v.toFixed(6));
    }
  }
  return [...vals].sort((a, b) => a - b);
}

/**
 * The slice shown in 2D: { axis, index, count, level, half } — the atoms with
 * |f[axis] − level| < half belong to it (half = half the layer spacing). null while the slice is off.
 */
export function sliceOf(basis, repeats, slice) {
  if (!slice || !slice.on) return null;
  const layers = sliceLayers(basis, repeats, slice.axis);
  const middle = Math.floor((layers.length - 1) / 2);
  const index = slice.layer == null ? middle : Math.max(0, Math.min(layers.length - 1, slice.layer));
  return { axis: slice.axis, index, count: layers.length, level: layers[index], half: (layers[1] - layers[0]) / 2 };
}

/** Is a position (fractional) in the slice? Layers are half-open, so a point halfway between two layers belongs to the upper one. */
export const inSlice = (f, slice) => !slice || (f[slice.axis] >= slice.level - slice.half - 1e-6 && f[slice.axis] < slice.level + slice.half - 1e-6);

/* ---------- point defects ---------- */

/**
 * How a point defect pushes its neighbours: the first shell (at r₁) moves by u₁,
 * the rest by u₁ (r₁ / r)², along the line from the defect (outward for u₁ > 0).
 * This is the elastic field of a point defect in an isotropic crystal; it falls off as 1/r².
 */
export function pointDisplacement(p, c, r1, u1) {
  const d = sub(p, c), r = norm(d);
  if (r < 1e-9 || !u1) return [0, 0, 0];
  return scale(d, (u1 * (r1 / Math.max(r, r1)) ** 2) / r);
}

/**
 * How far the first shell would move to just touch a defect atom of radius r
 * whose nearest host atoms (radius R) are d away: δ = r + R − d (negative = they move in).
 * A vacancy has no atom: its neighbours relax inward by R/10 at full strength.
 */
export const misfit = (r, R, d) => r + R - d;
export const VACANCY_MISFIT = R => -R / 10;

/* ---------- the crystal ---------- */

/**
 * The atoms of a block with defects.
 *   hosts    [{ f, p }]: the lattice points of the block (fractional, Cartesian Å)
 *   defects  [{ id, remove: [f], atoms: [{ f, p, r, kind }], relax: [{ c, r1, u1 }],
 *               shift(p) → u (a dislocation; Cartesian), mark(f) → true for atoms it highlights }]
 *   R        radius of the host atoms (touching: d_nn / 2), dnn the nearest-neighbour distance,
 *   reach    bonds are host atoms closer than this (halfway between the first and second neighbours)
 * → { atoms: [{ f, ref, ud, ur, pos, r, kind: 'host' | defect kind, id, mark, moved, strain }],
 *     vacancies: [{ f, ref, ud, pos, id }], maxMoved, maxStrain, conflicts: Set of defect ids that clash }
 * pos is the true position ref + ud + ur; drawings may scale ur (exaggerate).
 */
export function buildCrystal({ hosts, defects, R, dnn, reach = 1.2 * dnn }) {
  const taken = new Map(), conflicts = new Set();
  // a lattice point or site can hold one defect: later ones that clash are left out (and reported)
  const claim = (f, id) => {
    const k = key(f);
    if (taken.has(k) && taken.get(k) !== id) { conflicts.add(id); return false; }
    taken.set(k, id);
    return true;
  };
  const used = defects.filter(d => [...(d.remove || []), ...(d.atoms || []).map(a => a.f)].every(f => claim(f, d.id)));
  const removed = new Set(used.flatMap(d => (d.remove || []).map(key)));

  const atoms = hosts.filter(h => !removed.has(key(h.f))).map(h => ({ f: h.f, ref: h.p, r: R, kind: 'host', id: null }));
  for (const d of used) for (const a of d.atoms || []) atoms.push({ f: a.f, ref: a.p, r: a.r, kind: a.kind, id: d.id });
  const vacancies = used.flatMap(d => (d.remove || [])
    .filter(f => !(d.atoms || []).some(a => key(a.f) === key(f))) // a substitution replaces the atom: no vacancy
    .map(f => ({ f, ref: hosts.find(h => key(h.f) === key(f)).p, id: d.id })));

  const relax = used.flatMap(d => (d.relax || []).map(x => ({ ...x, id: d.id })));
  const shifts = used.filter(d => d.shift);
  const displace = (p, self) => {
    let ud = [0, 0, 0], ur = [0, 0, 0];
    for (const d of shifts) ud = add(ud, d.shift(p));
    for (const x of relax) if (x.id !== self) ur = add(ur, pointDisplacement(p, x.c, x.r1, x.u1));
    return { ud, ur };
  };
  let maxMoved = 0;
  for (const a of atoms) {
    Object.assign(a, displace(a.ref, a.id));
    a.pos = add(a.ref, add(a.ud, a.ur));
    a.moved = norm(add(a.ud, a.ur));
    a.mark = used.find(d => d.mark && a.kind === 'host' && d.mark(a.f));
    a.mark = a.mark ? a.mark.id : null;
    maxMoved = Math.max(maxMoved, a.moved);
  }
  for (const v of vacancies) {
    v.ud = displace(v.ref, v.id).ud;
    v.pos = add(v.ref, v.ud);
  }
  const maxStrain = bondStrain(atoms, dnn, reach);
  return { atoms, vacancies, maxMoved, maxStrain, conflicts };
}

/**
 * How much each host atom's bonds to its nearest neighbours changed in length, on average
 * (negative: squeezed, positive: stretched). The bonds are those of the crystal as it is now:
 * to the host atoms within `reach`, compared with d_nn. So atoms that swapped partners across
 * a slip plane are not stretched, and a missing neighbour (vacancy) just leaves a bond out.
 * Sets atom.strain; returns the largest |strain|.
 */
function bondStrain(atoms, dnn, reach = 1.2 * dnn) {
  const grid = new Map();
  const cellOf = p => p.map(x => Math.floor(x / reach));
  atoms.forEach((a, i) => {
    if (a.kind !== 'host') return;
    const k = cellOf(a.pos).join();
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  });
  const sum = new Float64Array(atoms.length), n = new Uint16Array(atoms.length);
  atoms.forEach((a, i) => {
    if (a.kind !== 'host') return;
    const [cx, cy, cz] = cellOf(a.pos);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      for (const j of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) || []) {
        if (j <= i) continue;
        const d = norm(sub(a.pos, atoms[j].pos));
        if (d >= reach) continue;
        const e = d / dnn - 1;
        sum[i] += e; n[i]++; sum[j] += e; n[j]++;
      }
    }
  });
  let max = 0;
  atoms.forEach((a, i) => {
    a.strain = n[i] ? sum[i] / n[i] : 0;
    max = Math.max(max, Math.abs(a.strain));
  });
  return max;
}

/** The atom whose (true) position is nearest to p, within `within` Å; → index or −1. Uses a grid built once per call list. */
export function nearestAtomFinder(atoms, cell) {
  const grid = new Map(), cellOf = p => p.map(x => Math.floor(x / cell));
  atoms.forEach((a, i) => {
    const k = cellOf(a.pos).join();
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  });
  return (p, within) => {
    const [cx, cy, cz] = cellOf(p);
    let best = -1, bestD = within;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      for (const i of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) || []) {
        const d = norm(sub(atoms[i].pos, p));
        if (d < bestD) { bestD = d; best = i; }
      }
    }
    return best;
  };
}

/* ---------- vacancy concentration ---------- */

/** N_v / N = exp(−Q_v / kT), Q_v in eV per vacancy, T in K. */
export const vacancyFraction = (T, Q) => Math.exp(-Q / (K_EV * T));

/** Atoms per m³ of a cubic lattice with n atoms per cell and edge a (Å). */
export const atomsPerM3 = (n, a) => n / (a * 1e-10) ** 3;
