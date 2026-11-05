/* =====================================================================
   Verification cases for Defects mode (part of buildCases in cases.js):
   textbook numbers for vacancies, the point-defect field, the Burgers
   vector of edge and screw dislocations, slip by glide, and the slip
   systems of cubic P, I and F on their close-packed planes.
   ===================================================================== */
import * as M from '../math/index.js';
import { Lattice } from '../math/lattice.js';

/** Cubic P, I and F with a = 1: lattice and lattice points of one cell. */
const CUBIC = {
  cP: [[0, 0, 0]],
  cI: [[0, 0, 0], [0.5, 0.5, 0.5]],
  cF: [[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5]],
};
const cubic = id => ({ L: new Lattice({ a: 1, b: 1, c: 1, alpha: 90, beta: 90, gamma: 90 }), basis: CUBIC[id].map(f => ({ el: 'LP', f })) });

/** The atoms of a cubic P block (a = 1) with one dislocation, or none. */
function block(repeats, d = null) {
  const hosts = M.sitesInRegion([{ el: 'LP', f: [0, 0, 0] }], M.boxRegion(repeats)).map(s => ({ f: s.f, p: s.f }));
  return M.buildCrystal({ hosts, defects: d ? [{ id: 1, shift: M.dislocationShift(d, 1) }] : [], R: 0.5, dnn: 1 });
}

/** S → F of an n × n circuit about a line along c, starting at (x, y, 1). */
function closure(C, line, [x, y, z], n = 4) {
  const start = C.atoms.findIndex(a => a.f.join() === [x, y, z].join());
  const w = M.walkCircuit(C.atoms, start, M.FRAMES[line], M.circuitSteps(n), 1);
  return w.out ? null : M.closureOf(C.atoms, w.path).join(',');
}

export function defectCases(near, truthy) {
  const VC = 'Vacancy concentration';
  near(VC, 'Copper, 1273 K, Q_v = 0.9 eV: N_v/N = 2.74 × 10⁻⁴', M.vacancyFraction(1273, 0.9) * 1e4, 2.735, 0.002, ' × 10⁻⁴');
  near(VC, 'Copper, N = 8.0 × 10²⁸ m⁻³: N_v = 2.2 × 10²⁵ m⁻³ (Callister)', 8.0e28 * M.vacancyFraction(1273, 0.9) / 1e25, 2.19, 0.01, ' × 10²⁵ m⁻³');
  near(VC, 'Cubic F, a = 4 Å: N = 6.25 × 10²⁸ atoms per m³', M.atomsPerM3(4, 4) / 1e28, 6.25, 1e-9, ' × 10²⁸ m⁻³');

  const PD = 'Point defects';
  const u = r => M.norm(M.pointDisplacement([r, 0, 0], [0, 0, 0], 1, 0.1));
  near(PD, 'The field falls off as 1/r²: at √2 r₁ a neighbour moves half as far', u(Math.SQRT2) / u(1), 0.5, 1e-12);
  near(PD, 'Touching spheres: an atom 1.2R on a lattice point overlaps its neighbours by 0.2R', M.misfit(1.2, 1, 2), 0.2, 1e-12, ' R');
  near(PD, 'Cubic F octahedral self-interstitial: δ = (2 − √2) R', M.misfit(1, 1, Math.SQRT2), 2 - Math.SQRT2, 1e-12, ' R');

  const DS = 'Dislocations';
  const edge = (at, b = 1) => ({ kind: 'edge', line: 2, at, b, nu: M.NU });
  truthy(DS, 'Burgers circuit around an edge dislocation: S → F = a[100] = b', closure(block([9, 9, 2], edge([4.5, 4.5])), 2, [2, 2, 1]) === '1,0,0');
  truthy(DS, 'The opposite extra half-plane gives −b', closure(block([9, 9, 2], edge([4.5, 4.5], -1)), 2, [2, 2, 1]) === '-1,0,0');
  truthy(DS, 'Burgers circuit around a screw dislocation: S → F = a[001], along the line', closure(block([9, 9, 3], { kind: 'screw', line: 2, at: [4.5, 4.5], b: 1 }), 2, [2, 2, 1]) === '0,0,1');
  truthy(DS, 'A circuit that does not go around the line closes', closure(block([9, 9, 2], edge([4.5, 4.5])), 2, [5, 5, 1], 2) === '0,0,0');
  truthy(DS, 'A perfect crystal: every circuit closes', closure(block([9, 9, 2]), 2, [2, 2, 1]) === '0,0,0');
  {
    const shift = M.dislocationShift(edge([1e6, 4.5]), 1);
    near(DS, 'Glided right through: the top half has slipped by b over the bottom half', shift([4, 6, 0])[0] - shift([4, 3, 0])[0], 1, 1e-5, ' a');
    const C = block([9, 9, 2], edge([4.5, 4.5]));
    const mean = list => list.reduce((s, a) => s + a.strain, 0) / list.length;
    const near4 = C.atoms.filter(a => Math.abs(a.f[0] - 4.5) < 2 && Math.abs(a.f[1] - 4.5) < 2);
    truthy(DS, 'Edge dislocation: squeezed on the side of the extra half-plane, stretched on the other',
      mean(near4.filter(a => a.f[1] > 4.5)) < 0 && mean(near4.filter(a => a.f[1] < 4.5)) > 0);
  }

  slipCases(near, truthy);
}

/** Slip systems on the close-packed planes of cubic P, I and F (Callister, Hull & Bacon). */
function slipCases(near, truthy) {
  const SL = 'Slip on close-packed planes';
  for (const [id, n, name] of [['cF', 12, 'FCC {111}⟨110⟩: 4 planes × 3 directions'], ['cI', 12, 'BCC {110}⟨111⟩: 6 planes × 2 directions'], ['cP', 6, 'SC {100}⟨100⟩: 3 planes × 2 directions']]) {
    near(SL, `${name} = ${n} slip systems`, M.slipSystemCount(id), n, 0);
  }
  const facts = id => { const { L, basis } = cubic(id); return M.planeFacts(L, basis, M.slipPlanes(id)[0], M.neighbourShell(L, basis, 0)[0].d / 2); };
  near(SL, 'FCC (111): planar packing π/(2√3) = 0.907, each atom touching 6', facts('cF').packing, 0.9069, 1e-4);
  near(SL, 'BCC (110): planar packing 3π/(8√2) = 0.833, each atom touching 4', facts('cI').packing, 0.8330, 1e-4);
  near(SL, 'SC (100): planar packing π/4 = 0.785, each atom touching 4', facts('cP').packing, 0.7854, 1e-4);
  truthy(SL, 'Touching neighbours in the slip plane: 6 (FCC), 4 (BCC), 4 (SC)', [facts('cF').inPlane, facts('cI').inPlane, facts('cP').inPlane].join() === '6,4,4');
  near(SL, 'FCC: b = a/2⟨110⟩, |b| = a/√2 = the nearest-neighbour distance', M.norm(M.burgersOf('cF', [1, -1, 0])), 1 / Math.SQRT2, 1e-12, ' a');
  near(SL, 'BCC: b = a/2⟨111⟩, |b| = a√3/2', M.norm(M.burgersOf('cI', [1, -1, 1])), Math.sqrt(3) / 2, 1e-12, ' a');
  {
    const b = M.burgersOf('cF', [-1, 1, 0]);
    const [b1, b2] = M.shockleyPartials(b, [1, 1, 1], [0.5, 0.5, 0], M.isLatticePoint(cubic('cF').basis));
    near(SL, 'Shockley partials: |b₁| = |b₂| = a/√6', M.norm(b1), 1 / Math.sqrt(6), 1e-12, ' a');
    truthy(SL, 'b₁ + b₂ = b, both in the (111) plane', M.norm(M.sub(M.add(b1, b2), b)) < 1e-12 && Math.abs(M.dot(b1, [1, 1, 1])) < 1e-12 && Math.abs(M.dot(b2, [1, 1, 1])) < 1e-12);
    near(SL, "Frank's rule: b² = a²/2 splits into b₁² + b₂² = a²/3", M.b2(b1) + M.b2(b2), 1 / 3, 1e-12, ' a²');
  }
  // the field of a dislocation on (111): far behind the line the half above has slipped by b, far ahead not at all
  for (const character of ['edge', 'screw']) {
    const { L } = cubic('cF'), hkl = [1, 1, 1], b = L.toCartesian(M.burgersOf('cF', [1, -1, 0])), n = L.planeNormal(hkl), d = L.dSpacing(hkl);
    const frame = M.slipFrame(n, b, character), u = M.lineShift(frame, [0, 0, 0], b, { zeta: M.coreHalfWidth(d, b, frame.xi) });
    const across = X => M.sub(u(M.add(M.scale(frame.m, X), M.scale(n, d / 2))), u(M.add(M.scale(frame.m, X), M.scale(n, -d / 2))));
    near(SL, `${character} on (111): behind the line the layer above has slipped by b`, M.norm(M.sub(across(-1e5), b)), 0, 1e-4, ' a');
    near(SL, `${character} on (111): ahead of the line it has not slipped`, M.norm(across(1e5)), 0, 1e-4, ' a');
  }
}
