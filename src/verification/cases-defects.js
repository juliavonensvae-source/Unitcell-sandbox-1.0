/* =====================================================================
   Verification cases for Defects mode (part of buildCases in cases.js):
   textbook numbers for vacancies, the point-defect field, the Burgers
   vector of edge and screw dislocations, and slip by glide.
   ===================================================================== */
import * as M from '../math/index.js';

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
}
