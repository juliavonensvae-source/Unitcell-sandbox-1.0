/* Nearest neighbours and coordination (via the metric tensor over periodic images),
   and derived quantities: packing fraction, Bragg angle, structure factor, density. */
import { dot } from './linalg.js';
import { Lattice } from './lattice.js';
import { countAtoms, formulaUnits } from './basis.js';

/** Every neighbour of basis site `index` over periodic images in ±range cells, nearest first: [{ df, d, el }]. */
function neighbourList(lattice, basis, index, range) {
  const s = basis[index], found = [];
  basis.forEach((t, j) => {
    for (let a = -range; a <= range; a++) for (let b = -range; b <= range; b++) for (let c = -range; c <= range; c++) {
      if (index === j && a === 0 && b === 0 && c === 0) continue;
      const df = [t.f[0] + a - s.f[0], t.f[1] + b - s.f[1], t.f[2] + c - s.f[2]];
      found.push({ df, d: lattice.length(df), el: t.el });
    }
  });
  return found.sort((x, y) => x.d - y.d);
}

/**
 * For each basis site: nearest-neighbour distance, coordination number (neighbours
 * within shellTolerance of the nearest distance), neighbour species and sub-shells.
 * Distances use the metric tensor over periodic images in ±range cells.
 */
export function neighbourAnalysis(lattice, basis, { shellTolerance = 0.02, range = 2 } = {}) {
  const sites = basis.map((s, i) => {
    const found = neighbourList(lattice, basis, i, range);
    const dmin = found[0].d;
    const shell = found.filter(n => n.d <= dmin * (1 + shellTolerance));
    const byElement = {};
    shell.forEach(n => { byElement[n.el] = (byElement[n.el] || 0) + 1; });
    const subshells = [];
    for (const n of shell) {
      const last = subshells[subshells.length - 1];
      if (last && n.d - last.d < 1e-4 * dmin) last.count++;
      else subshells.push({ d: n.d, count: 1 });
    }
    return { el: s.el, index: i, dmin, cn: shell.length, shellMax: shell[shell.length - 1].d, byElement, subshells };
  });

  // Collapse symmetry-equivalent sites (same species, distance and coordination)
  const groups = [];
  for (const s of sites) {
    const key = `${s.el}|${s.dmin.toFixed(4)}|${s.cn}|${JSON.stringify(s.byElement)}`;
    const g = groups.find(x => x.key === key);
    if (g) g.multiplicity++;
    else groups.push({ key, multiplicity: 1, ...s });
  }
  return { dnn: Math.min(...sites.map(s => s.dmin)), sites, groups };
}

/**
 * The first neighbour shell of one basis site as fractional displacement vectors,
 * so the shell can be drawn: [{ df: [dx, dy, dz], d }].
 */
export function neighbourShell(lattice, basis, index = 0, { shellTolerance = 0.02, range = 2 } = {}) {
  const found = neighbourList(lattice, basis, index, range);
  const dmin = found[0].d;
  return found.filter(n => n.d <= dmin * (1 + shellTolerance)).map(({ df, d }) => ({ df, d }));
}

/** Bonds between drawn sites: pairs whose separation lies in the first shell of both points. */
export function bondPairs(lattice, sites, neighbours) {
  const shell = neighbours.sites.map(s => s.shellMax * (1 + 1e-3));
  const pairs = [];
  for (let i = 0; i < sites.length; i++) {
    for (let j = i + 1; j < sites.length; j++) {
      const cut = Math.min(shell[sites[i].basisIndex], shell[sites[j].basisIndex]);
      const d = lattice.distance(sites[i].f, sites[j].f);
      if (d > 1e-6 && d <= cut) pairs.push([i, j]);
    }
  }
  return pairs;
}

/* ---------- derived quantities ---------- */

const AMU_PER_A3_IN_G_PER_CM3 = 1.66053906660; // 1 u / Å³ expressed in g / cm³

/** Density in g/cm³, or null if any species has no mass (bare lattice points). */
export function density(lattice, basis, elements = {}) {
  let mass = 0;
  for (const s of basis) {
    const m = elements[s.el] && elements[s.el].mass;
    if (m == null) return null;
    mass += m;
  }
  return mass * AMU_PER_A3_IN_G_PER_CM3 / lattice.volume;
}

/** Packing fraction for single-species structures, with touching spheres r = d_nn / 2. */
function packingFraction(lattice, basis, dnn) {
  if (new Set(basis.map(s => s.el)).size !== 1) return null;
  const r = dnn / 2;
  return { value: basis.length * (4 / 3) * Math.PI * r ** 3 / lattice.volume, radius: r };
}

/** Bragg angle 2θ in degrees, or null when λ/2d > 1 (no reflection possible). */
export function braggTwoTheta(d, lambda) {
  const s = lambda / (2 * d);
  if (!(s <= 1)) return null;
  return 2 * Math.asin(s) * 180 / Math.PI;
}

/** Structure factor with f ≈ Z (f = 1 for bare lattice points) — enough to reveal systematic absences. */
export function structureFactor(basis, hkl, elements = {}) {
  let re = 0, im = 0, sumZ = 0;
  for (const s of basis) {
    const f = (elements[s.el] && elements[s.el].Z) || 1;
    const phase = 2 * Math.PI * dot(hkl, s.f);
    re += f * Math.cos(phase);
    im += f * Math.sin(phase);
    sumZ += f;
  }
  const F2 = re * re + im * im;
  const relative = F2 / (sumZ * sumZ);
  return { F2, relative, absent: relative < 1e-8 };
}

/** One call: lattice, counts, neighbours, density and packing for a basis. */
export function analyse(params, basis, elements = {}) {
  const lattice = new Lattice(params);
  const counts = countAtoms(basis);
  const neighbours = neighbourAnalysis(lattice, basis);
  return {
    lattice,
    counts,
    formula: formulaUnits(counts.byElement),
    neighbours,
    density: density(lattice, basis, elements),
    packing: packingFraction(lattice, basis, neighbours.dnn),
  };
}
