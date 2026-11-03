/* =====================================================================
   Two-dimensional lattices — pure mathematics, no DOM.

   Parameters { a, b, gamma } (Å, degrees). a lies along x; b makes the
   angle γ with a. Fractional coordinates f = [x, y].
   ===================================================================== */
import { DEG, EPS } from './linalg.js';
import { groupShares } from './cells.js';
import { txt } from '../text.js';

export function validateParams2D(p) {
  if (!(p.a > 0)) return txt('msgParamLength', { name: 'a' });
  if (!(p.b > 0)) return txt('msgParamLength', { name: 'b' });
  if (!(p.gamma > 0 && p.gamma < 180)) return txt('msgParamAngle', { name: 'γ' });
  return null;
}

export class Lattice2D {
  constructor(p) {
    const problem = validateParams2D(p);
    if (problem) throw new Error(problem);
    this.params = { ...p };
    const { a, b } = p, cg = Math.cos(p.gamma * DEG), sg = Math.sin(p.gamma * DEG);
    this.vectors = [[a, 0], [b * cg, b * sg]];
    this.G = [[a * a, a * b * cg], [a * b * cg, b * b]];
    this.area = a * b * sg;
  }

  toCartesian([x, y]) {
    const [A, B] = this.vectors;
    return [x * A[0] + y * B[0], x * A[1] + y * B[1]];
  }

  /** √(fᵀ G f) */
  length([x, y]) {
    const G = this.G;
    return Math.sqrt(x * x * G[0][0] + 2 * x * y * G[0][1] + y * y * G[1][1]);
  }
}

/** p: corners only · c: plus one point in the middle of the cell. */
export const CENTRING_2D = { p: [[0, 0]], c: [[0, 0], [0.5, 0.5]] };

/** All lattice points in an n × n block of cells, including the far edges; inOriginal = in the highlighted cell at o. */
export function sitesInCell2D(basis, n, o = [0, 0]) {
  const out = [];
  for (const s of basis) {
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
      const f = [s[0] + i, s[1] + j];
      if (f[0] > n + EPS || f[1] > n + EPS) continue;
      out.push({ f, inOriginal: f.every((x, k) => x >= o[k] - EPS && x <= o[k] + 1 + EPS) });
    }
  }
  return out;
}

/** Share of a point that belongs to the n × n block: a corner is shared by 4 blocks, an edge point by 2. */
function share2D(f, n) {
  const k = f.filter(x => Math.abs(x) < EPS || Math.abs(x - n) < EPS).length;
  return 1 / 2 ** k;
}

/** How the points of an n × n block add up: { groups: [{ share, count }], total }. */
export const pointCount2D = (basis, n = 1) => groupShares(sitesInCell2D(basis, n), f => share2D(f, n));

/** Nearest-neighbour distance between lattice points. */
export function nearestNeighbour2D(lattice, basis) {
  let best = Infinity;
  for (const s of basis) for (const t of basis) {
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      const d = lattice.length([t[0] + i - s[0], t[1] + j - s[1]]);
      if (d > 1e-9) best = Math.min(best, d);
    }
  }
  return best;
}

/* ---------- Part 2.5: directions, vectors and lines in 2D ---------- */

/** Fractional coordinates of a Cartesian point (inverse of toCartesian). */
Lattice2D.prototype.toFractional = function toFractional([x, y]) {
  const [A, B] = this.vectors;
  const fy = y / B[1];
  return [(x - fy * B[0]) / A[0], fy];
};

/** Reciprocal metric G* = G⁻¹ (2 × 2). */
Lattice2D.prototype.reciprocalMetric = function reciprocalMetric() {
  const [[a, b], [c, d]] = this.G, det = a * d - b * c;
  return [[d / det, -b / det], [-c / det, a / det]];
};

/** Spacing of the lines (hk): 1/d² = hᵀ G* h, with the 2D metric (γ included). */
Lattice2D.prototype.dSpacing = function dSpacing([h, k]) {
  const S = this.reciprocalMetric();
  return 1 / Math.sqrt(h * h * S[0][0] + 2 * h * k * S[0][1] + k * k * S[1][1]);
};

/** Two whole numbers, e.g. "1 2", "12", "[1 -2]" → { values } or { error }. */
export function parseIndices2D(text, kind = 'dir') {
  const s = String(text).replace(/[−–]/g, '-').replace(/[[\](){}<>]/g, ' ').trim();
  const ex = kind === 'dir' ? '[1 2]' : '(1 2)';
  if (!s) return { error: txt('msgIdx2DType', { example: ex }) };
  const tokens = /[\s,;]/.test(s) ? s.split(/[\s,;]+/).filter(Boolean) : s.match(/-?\d/g) || [s];
  const values = tokens.map(Number);
  if (values.some(v => !Number.isInteger(v))) return { error: txt('msgIdx2DWhole', { example: ex }) };
  if (values.length !== 2) return { error: txt(kind === 'dir' ? 'msgIdx2DDirTwo' : 'msgIdx2DLineTwo', { example: ex }) };
  if (values.every(v => v === 0)) return { error: txt('msgIdxNonZero') };
  return { values };
}

/** A point typed as "(x, y)" or "x y" in units of a and b; fractions like 1/2 are fine. */
export function parsePoint2D(text) {
  const s = String(text).replace(/[−–]/g, '-').replace(/[()[\]]/g, ' ').trim();
  const parts = s.split(/[\s,;]+/).filter(Boolean);
  const num = t => {
    const m = t.match(/^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
    return m ? +m[1] / +m[2] : Number(t);
  };
  const v = parts.map(num);
  if (v.length !== 2 || v.some(x => !Number.isFinite(x))) return { error: txt('msgNotAPoint', { text: String(text).trim() }) };
  return { point: v };
}

/** Where the line h·x + k·y = level cuts the axes (in units of a and b); null = parallel. */
export function lineIntercepts2D([h, k], level = 1) {
  return { a: h === 0 ? null : level / h, b: k === 0 ? null : level / k };
}

/** The part of the line h·x + k·y = level inside the box lo ≤ x ≤ hi (fractional), or null. */
export function clipLine2D([h, k], level, lo = [0, 0], hi = [1, 1]) {
  const pts = [];
  const add = p => { if (!pts.some(q => Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) < 1e-9)) pts.push(p); };
  if (k !== 0) for (const x of [lo[0], hi[0]]) { const y = (level - h * x) / k; if (y >= lo[1] - 1e-9 && y <= hi[1] + 1e-9) add([x, y]); }
  if (h !== 0) for (const y of [lo[1], hi[1]]) { const x = (level - k * y) / h; if (x >= lo[0] - 1e-9 && x <= hi[0] + 1e-9) add([x, y]); }
  return pts.length >= 2 ? [pts[0], pts[1]] : null;
}

/** The cell (numbered from 1) of an n × n block that holds the fractional point f, or null outside the block. */
export const cellAt2D = (f, n) => (f.every(x => x >= 0 && x <= n) ? f.map(x => Math.min(n, Math.floor(x) + 1)) : null);

/** Points the mouse snaps to: lattice points, cell centres and edge midpoints of an n × n block (plus a margin). */
export function snapTargets2D(basis, n, margin = 1) {
  const out = [], seen = new Set();
  const push = f => { const key = f.map(x => x.toFixed(4)).join(); if (!seen.has(key)) { seen.add(key); out.push(f); } };
  for (let i = -margin; i <= n + margin; i++) for (let j = -margin; j <= n + margin; j++) {
    for (const s of basis) push([s[0] + i, s[1] + j]);
    push([i + 0.5, j + 0.5]);
    push([i + 0.5, j]);
    push([i, j + 0.5]);
  }
  return out;
}
