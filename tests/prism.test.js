/* Hexagonal prisms repeated along a1, a2 and c. */
import { describe, it, expect } from 'vitest';
import * as M from '../src/math/index.js';
import { findBravais, latticeBasis } from '../src/data/bravais.js';
import { SceneModel } from '../src/objects/model.js';
import { countFormula } from '../src/ui/format.js';

const hexBasis = () => latticeBasis(findBravais('hP'));
const key = f => f.map(x => (Math.round(x * 1e6) / 1e6 + 0).toFixed(5)).join(',');
/** Lattice points of n1 × n2 × n3 prisms, found prism by prism (14 each) and merged: an independent count. */
function pointsByPrism([n1, n2, n3]) {
  const set = new Set();
  for (let i = 1; i <= n1; i++) for (let j = 1; j <= n2; j++) for (let k = 1; k <= n3; k++) {
    const one = M.translateRegion(M.hexPrismRegion(1), M.prismOrigin([i, j, k]));
    for (const s of M.sitesInRegion(hexBasis(), one)) set.add(key(s.f));
  }
  return set.size;
}

describe('§3 Hexagonal prisms repeated along a1, a2 and c', () => {
  it('2 × 2 × 1 prisms: 40 lattice points, none drawn twice', () => {
    const sites = M.sitesInRegion(hexBasis(), M.prismFieldRegion([2, 2, 1]));
    expect(sites.length).toBe(40);
    expect(new Set(sites.map(s => key(s.f))).size).toBe(40);
    expect(pointsByPrism([2, 2, 1])).toBe(40);
  });
  it('point counts agree with a prism-by-prism count and the honeycomb formula', () => {
    // per layer: hexagon corners of an m × n patch (2mn + 2m + 2n) + one centre per prism
    for (const r of [[2, 1, 1], [1, 3, 2], [3, 3, 2], [2, 2, 3]]) {
      const [m, n, l] = r, perLayer = 2 * m * n + 2 * m + 2 * n + m * n;
      const sites = M.sitesInRegion(hexBasis(), M.prismFieldRegion(r));
      expect(new Set(sites.map(s => key(s.f))).size, r.join('×')).toBe(sites.length);
      expect(sites.length, r.join('×')).toBe(perLayer * (l + 1));
      expect(pointsByPrism(r), r.join('×')).toBe(sites.length);
    }
  });
  it('neighbouring prisms share faces: no edge is drawn twice', () => {
    for (const r of [[2, 2, 1], [3, 2, 2]]) {
      const R = M.prismFieldRegion(r);
      const segKey = ([p, q]) => [key(p), key(q)].sort().join('|');
      expect(new Set(R.edges.map(segKey)).size).toBe(R.edges.length);
      expect(new Set(R.grid.map(segKey)).size).toBe(R.grid.length);
    }
    // 2 × 2 × 1: 14 outline edges at the bottom and at the top, 14 vertical edges (2 corners are inside, shared by 3)
    expect(M.prismFieldRegion([2, 2, 1]).edges.length).toBe(42);
  });
  it('the steps join prisms that share a face, 120° apart like a1 and a2', () => {
    const L = M.analyse(findBravais('hP').params, hexBasis()).lattice;
    const [A, B] = M.PRISM_STEPS.map(t => L.toCartesian(t));
    const a = findBravais('hP').params.a;
    expect(M.norm(A)).toBeCloseTo(Math.sqrt(3) * a, 9);
    expect(M.norm(B)).toBeCloseTo(Math.sqrt(3) * a, 9);
    expect(Math.acos(M.dot(A, B) / (M.norm(A) * M.norm(B))) * 180 / Math.PI).toBeCloseTo(120, 9);
  });
  it('points in the notches between prisms are outside the field', () => {
    const R = M.prismFieldRegion([2, 1, 1]);
    expect(M.inRegion([0, 0, 0.5], R)).toBe(true);
    expect(M.inRegion([2, 1, 0.5], R)).toBe(true);   // centre of prism (2,1)
    expect(M.inRegion([-1, 1, 0.5], R)).toBe(false); // where prism (1,2) would be
  });
  it('the cell picker finds the prism a ray goes into', () => {
    const R = M.prismFieldRegion([2, 2, 2]);
    // straight down through the centre of prism (2,1): enters at the top, layer 2
    expect(M.cellUnderRay([2, 1, 5], [0, 0, -1], R)).toEqual([2, 1, 2]);
    expect(M.cellUnderRay(M.prismOrigin([1, 2, 1]).map((x, i) => (i === 2 ? 5 : x)), [0, 0, -1], R)).toEqual([1, 2, 2]);
    expect(M.cellUnderRay([20, 20, 5], [0, 0, -1], R)).toBeNull();
  });
  it('the highlighted prism, its origin and the cut-sphere readout work in the larger field', () => {
    const m = new SceneModel();
    Object.assign(m.state, { latticeId: 'hP', setting: 'standard', params: { ...findBravais('hP').params }, hexCell: 'prism', repeats: [2, 2, 1], cell: [2, 2, 1] });
    const ctx = m.recompute();
    expect(ctx.sites.length).toBe(40);
    expect(ctx.origin).toEqual([1, 2, 0]); // (2a1 + a2) + (a2 − a1)
    expect(countFormula(M.pointCount(ctx.basis, ctx.unitRegion))).toBe('12 × ⅙ + 2 × ½ = 3');
    expect(ctx.sites.filter(s => s.inOriginal).length).toBe(14);
    // planes are clipped to the (convex) column of the highlighted prism
    expect(ctx.planeRegion.halfspaces).not.toBeNull();
    expect(M.inRegion([1, 2, 0.5], ctx.planeRegion)).toBe(true);
    // the cell number is kept inside the field when it shrinks
    m.state.repeats = [1, 1, 1];
    expect(m.recompute().cell).toEqual([1, 1, 1]);
  });
  it('a plane family in a field of prisms is drawn and stays inside the column', () => {
    const m = new SceneModel();
    Object.assign(m.state, { latticeId: 'hP', setting: 'standard', params: { ...findBravais('hP').params }, hexCell: 'prism', repeats: [2, 2, 2] });
    m.recompute();
    const res = m.runCommand('p1 = (0 0 1)');
    expect(res.error).toBeUndefined();
    const layers = M.latticePlaneLayers([0, 0, 1], m.ctx.basis, m.ctx.planeRegion).filter(l => l.poly);
    expect(layers.length).toBe(3);
  });
});
