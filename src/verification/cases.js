/* =====================================================================
   Verification cases — known textbook values for the lattice math.

   One list, two runners:
   - `npm test` (Vitest, tests/verification.test.js) runs every case;
   - the app runs them on load (runSelfCheck) and logs PASS/FAIL to the
     console; results are shown under ⋯ → Self-check.
   ===================================================================== */
import * as M from '../math/index.js';
import { CENTRING } from '../data/systems.js';
import { BRAVAIS, findBravais, latticeBasis, defaultSetting, defaultParams } from '../data/bravais.js';
import { countFormula } from '../ui/format.js';
import { Lattice2D, pointCount2D, nearestNeighbour2D } from '../math/lattice2d.js';
import { BRAVAIS_2D, basis2D } from '../data/bravais2d.js';
import { IONIC } from '../data/ionic.js';
import { defectCases } from './cases-defects.js';

const cubic = a => ({ a, b: a, c: a, alpha: 90, beta: 90, gamma: 90 });
const hex = (a, c) => ({ a, b: a, c, alpha: 90, beta: 90, gamma: 120 });
const basisOf = centring => M.expandBasis([{ el: 'LP', f: [0, 0, 0] }], CENTRING[centring]);

/**
 * Textbook closed forms for 1/d² in each crystal system, written out
 * independently of the metric tensor so the two can be compared.
 */
function textbookD(system, p, [h, k, l]) {
  const R = Math.PI / 180, { a, b, c } = p;
  const ca = Math.cos(p.alpha * R), cb = Math.cos(p.beta * R), cg = Math.cos(p.gamma * R);
  const sa = Math.sin(p.alpha * R), sb = Math.sin(p.beta * R), sg = Math.sin(p.gamma * R);
  let inv;
  switch (system) {
    case 'cubic': inv = (h * h + k * k + l * l) / (a * a); break;
    case 'tetragonal': inv = (h * h + k * k) / (a * a) + (l * l) / (c * c); break;
    case 'orthorhombic': inv = (h * h) / (a * a) + (k * k) / (b * b) + (l * l) / (c * c); break;
    case 'hexagonal': inv = (4 / 3) * (h * h + h * k + k * k) / (a * a) + (l * l) / (c * c); break;
    case 'rhombohedral':
      inv = ((h * h + k * k + l * l) * sa * sa + 2 * (h * k + k * l + h * l) * (ca * ca - ca))
        / (a * a * (1 - 3 * ca * ca + 2 * ca * ca * ca));
      break;
    case 'monoclinic':
      inv = (1 / (sb * sb)) * ((h * h) / (a * a) + (k * k * sb * sb) / (b * b) + (l * l) / (c * c) - (2 * h * l * cb) / (a * c));
      break;
    default: { // triclinic
      const V2 = a * a * b * b * c * c * (1 - ca * ca - cb * cb - cg * cg + 2 * ca * cb * cg);
      const S11 = b * b * c * c * sa * sa, S22 = a * a * c * c * sb * sb, S33 = a * a * b * b * sg * sg;
      const S12 = a * b * c * c * (ca * cb - cg), S23 = a * a * b * c * (cb * cg - ca), S13 = a * b * b * c * (cg * ca - cb);
      inv = (S11 * h * h + S22 * k * k + S33 * l * l + 2 * S12 * h * k + 2 * S23 * k * l + 2 * S13 * h * l) / V2;
    }
  }
  return 1 / Math.sqrt(inv);
}

export function buildCases() {
  const cases = [];
  const near = (group, name, got, want, tol, unit = '') =>
    cases.push({ group, name, got, want, tol, unit, pass: got != null && Number.isFinite(got) && Math.abs(got - want) <= tol });
  const truthy = (group, name, cond) => cases.push({ group, name, got: !!cond, want: true, pass: !!cond });

  /* ---------- lattice points per cell ---------- */
  const PTS = 'Lattice points per cell';
  for (const [c, n] of [['P', 1], ['I', 2], ['C', 2], ['F', 4]]) near(PTS, `${c} = ${n}`, M.countAtoms(basisOf(c)).total, n, 1e-9);
  near(PTS, 'R (hexagonal setting) = 3', M.countAtoms(basisOf('R')).total, 3, 1e-9);
  {
    const expected = { P: 1, I: 2, C: 2, F: 4 };
    const wrong = BRAVAIS.filter(b => M.countAtoms(latticeBasis(b, defaultSetting(b))).total !== (expected[b.centring] ?? 1));
    truthy(PTS, 'All 14 lattices match their centring (R on rhombohedral axes = 1)', wrong.length === 0);
  }

  /* ---------- packing fraction, touching spheres ---------- */
  const APF = 'Packing fraction (touching spheres)';
  const apf = c => M.analyse(cubic(1), basisOf(c)).packing.value;
  for (const [c, v] of [['P', '0.524'], ['I', '0.680'], ['F', '0.740']]) near(APF, `Cubic ${c} = ${v}`, apf(c), +v, 0.0005);
  near(APF, 'Independent of a (cubic F, a = 3.615 Å)', M.analyse(cubic(3.615), basisOf('F')).packing.value, Math.PI / (3 * Math.SQRT2), 1e-9);

  /* ---------- interplanar distance and Bragg ---------- */
  const D = 'Interplanar distance & Bragg';
  const cF = new M.Lattice(cubic(3.615));
  near(D, 'Cubic F, a = 3.615 Å: d(111) = 2.087 Å', cF.dSpacing([1, 1, 1]), 2.087, 0.0005, ' Å');
  near(D, 'Cubic F, a = 3.615 Å: 2θ(111) ≈ 43.3° with λ = 1.5406 Å', M.braggTwoTheta(cF.dSpacing([1, 1, 1]), 1.5406), 43.3, 0.05, '°');
  near(D, 'Cubic P, a = 1: d(110) = 0.7071', new M.Lattice(cubic(1)).dSpacing([1, 1, 0]), 0.7071, 0.00005);
  truthy(D, 'No reflection when λ/2d > 1', M.braggTwoTheta(cF.dSpacing([1, 1, 1]), 5) === null);
  truthy(D, 'Cubic F: (100) systematically absent, (111) allowed',
    M.structureFactor(basisOf('F'), [1, 0, 0]).absent && !M.structureFactor(basisOf('F'), [1, 1, 1]).absent);
  truthy(D, 'Cubic I: (100) systematically absent, (110) allowed',
    M.structureFactor(basisOf('I'), [1, 0, 0]).absent && !M.structureFactor(basisOf('I'), [1, 1, 0]).absent);

  /* ---------- cell volume ---------- */
  const V = 'Cell volume';
  for (const [a, c] of [[3.5, 5.6], [3.21, 5.21]]) {
    near(V, `Hexagonal (a = ${a}, c = ${c}): V = (√3/2)·a²·c`, new M.Lattice(hex(a, c)).volume, (Math.sqrt(3) / 2) * a * a * c, 1e-9, ' Å³');
  }
  const tri = new M.Lattice(findBravais('aP').params);
  near(V, 'Triclinic: V = √det G', tri.volume, Math.sqrt(M.det3(tri.G)), 1e-9, ' Å³');
  near(V, 'Triclinic: V = a·(b × c)', tri.volume, M.dot(tri.vectors[0], M.cross(tri.vectors[1], tri.vectors[2])), 1e-9, ' Å³');

  /* ---------- angles ---------- */
  const ANG = 'Angles between directions';
  near(ANG, 'Cubic: [100] ∠ [111] = 54.74°', new M.Lattice(cubic(4)).angle([1, 0, 0], [1, 1, 1]), 54.74, 0.005, '°');
  near(ANG, 'Hexagonal: [100] ∠ [010] = 120°', new M.Lattice(hex(3.5, 5.6)).angle([1, 0, 0], [0, 1, 0]), 120, 0.01, '°');

  /* ---------- angles with planes (metric tensor, no cubic shortcut) ---------- */
  const PL = 'Angles with planes';
  const cub = new M.Lattice(cubic(4));
  near(PL, 'Cubic: (100) ∠ (111) = 54.74°', M.anglePlanes(cub, [1, 0, 0], [1, 1, 1]).angle, 54.74, 0.005, '°');
  near(PL, 'Cubic: (110) ∠ (111) = 35.26°', M.anglePlanes(cub, [1, 1, 0], [1, 1, 1]).angle, 35.26, 0.005, '°');
  {
    const r = M.angleDirectionPlane(cub, [1, 1, 1], [1, 1, 1]);
    near(PL, 'Cubic: [111] makes 0° with the normal of (111)', r.toNormal, 0, 1e-6, '°');
    near(PL, 'Cubic: [111] makes 90° with the plane (111)', r.toPlane, 90, 1e-6, '°');
  }
  {
    const tet = new M.Lattice({ a: 1, b: 1, c: 2, alpha: 90, beta: 90, gamma: 90 });
    const r = M.angleDirectionPlane(tet, [1, 0, 1], [1, 0, 1]);
    near(PL, 'Tetragonal a = 1, c = 2: [101] makes 36.87° with the normal of (101)', r.toNormal, 36.87, 0.005, '°');
    truthy(PL, 'Tetragonal: so [101] is NOT perpendicular to (101)', Math.abs(r.toPlane - 90) > 1);
    near(PL, 'Tetragonal a = 1, c = 2: (001) ∠ (101) = 63.43°', M.anglePlanes(tet, [0, 0, 1], [1, 0, 1]).angle, 63.43, 0.005, '°');
  }
  {
    const hx = new M.Lattice(hex(3.5, 5.6));
    const basal = M.parsePlane('0 0 0 1', true).hkl, prism = M.parsePlane('1 0 -1 0', true).hkl;
    near(PL, 'Hexagonal: (0001) ∠ (1 0 −1 0) = 90°', M.anglePlanes(hx, basal, prism).angle, 90, 1e-6, '°');
  }
  near(PL, 'Plane–plane angles stay between 0° and 90° (cubic (100) ∠ (−100))', M.anglePlanes(cub, [1, 0, 0], [-1, 0, 0]).angle, 0, 1e-6, '°');

  /* ---------- where two planes meet ---------- */
  const ZA = 'Intersection of two planes';
  truthy(ZA, '(100) and (010) meet along [001]', M.zoneAxis([1, 0, 0], [0, 1, 0]).uvw.join() === '0,0,1');
  {
    const z = M.zoneAxis([1, 1, 1], [1, -1, 0]).uvw.join();
    truthy(ZA, '(111) and (1 −1 0) meet along [1 1 −2] (or its opposite)', z === '1,1,-2' || z === '-1,-1,2');
  }
  truthy(ZA, '(111) and (222) are reported as parallel', M.zoneAxis([1, 1, 1], [2, 2, 2]).parallel === true);
  {
    // the zone axis lies in both planes (uh + vk + wl = 0), in any crystal system
    const tri = new M.Lattice(findBravais('aP').params), h1 = [1, 2, -1], h2 = [0, 1, 3];
    const uvw = M.zoneAxis(h1, h2).uvw;
    truthy(ZA, 'Triclinic: the result lies in both planes (90° to both normals)',
      Math.abs(M.angleDirectionPlane(tri, uvw, h1).toPlane) < 1e-9 && Math.abs(M.angleDirectionPlane(tri, uvw, h2).toPlane) < 1e-9);
    const line = M.intersectionLine(h1, 1, h2, 2);
    truthy(ZA, 'The crossing line satisfies both plane equations', Math.abs(M.dot(h1, line.f0) - 1) < 1e-9 && Math.abs(M.dot(h2, line.f0) - 2) < 1e-9);
  }

  /* ---------- coordination ---------- */
  const CN = 'Coordination number';
  for (const [c, n] of [['P', 6], ['I', 8], ['F', 12]]) near(CN, `Cubic ${c} = ${n}`, M.analyse(cubic(4), basisOf(c)).neighbours.sites[0].cn, n, 0);
  near(CN, 'Cubic F: d_nn = a/√2', M.analyse(cubic(4), basisOf('F')).neighbours.dnn, 4 / Math.SQRT2, 1e-9, ' Å');

  /* ---------- metric tensor consistency ---------- */
  const G = 'Metric tensor';
  {
    const [a, b, c] = tri.vectors, Vt = tri.volume;
    const as = M.cross(b, c).map(x => x / Vt), bs = M.cross(c, a).map(x => x / Vt), cs = M.cross(a, b).map(x => x / Vt);
    const h = [1, 2, -3];
    const g = [0, 1, 2].map(i => h[0] * as[i] + h[1] * bs[i] + h[2] * cs[i]);
    near(G, 'Triclinic d(12-3): G* agrees with reciprocal vectors', tri.dSpacing(h), 1 / Math.hypot(...g), 1e-9, ' Å');
  }
  {
    const f = [0.3, -0.7, 1.9];
    const back = tri.toFractional(tri.toCartesian(f));
    near(G, 'Fractional → Cartesian → fractional round trip', Math.hypot(...M.sub(back, f)), 0, 1e-12);
  }

  /* ---------- Miller–Bravais ---------- */
  const MB = 'Miller–Bravais indices';
  {
    const p = M.parseDirection('2 -1 -1 0', true);
    near(MB, '[2-1-10] ∥ [100]', new M.Lattice(hex(3.5, 5.6)).angle(p.uvw, [1, 0, 0]), 0, 1e-6, '°');
    truthy(MB, '[100] → [2-1-10], [110] → [11-20], [001] → [0001]',
      M.directionToFour([1, 0, 0]).join() === '2,-1,-1,0' && M.directionToFour([1, 1, 0]).join() === '1,1,-2,0' && M.directionToFour([0, 0, 1]).join() === '0,0,0,1');
    truthy(MB, '(100) → (10-10)', M.planeToFour([1, 0, 0]).join() === '1,0,-1,0');
    truthy(MB, '[2 -1 -1 0] → [100] and (1 0 -1 0) → (100)',
      M.parseDirection('2 -1 -1 0', true).uvw.join() === '1,0,0' && M.parsePlane('1 0 -1 0', true).hkl.join() === '1,0,0');
    truthy(MB, 'Rejects (hkil) when i ≠ −(h + k)', !!M.parsePlane('1 1 1 0', true).error);
    truthy(MB, 'Rejects [uvtw] when t ≠ −(u + v)', !!M.parseDirection('2 -1 1 0', true).error);
  }

  /* ---------- rhombohedral settings ---------- */
  const R = 'Rhombohedral lattice, two settings';
  {
    const hR = findBravais('hR');
    const pR = defaultParams(hR, 'rhombohedral'), pH = defaultParams(hR, 'hexagonal');
    const LR = new M.Lattice(pR), LH = new M.Lattice(pH);
    near(R, 'Hexagonal cell volume = 3 × rhombohedral volume', LH.volume / LR.volume, 3, 1e-9);
    near(R, 'Same nearest-neighbour distance in both settings',
      M.analyse(pH, latticeBasis(hR, 'hexagonal')).neighbours.dnn, M.analyse(pR, latticeBasis(hR, 'rhombohedral')).neighbours.dnn, 1e-9, ' Å');
    const back = M.hexagonalToRhombohedral(pH);
    near(R, 'Hexagonal → rhombohedral axes recovers α', back.alpha, pR.alpha, 1e-9, '°');
  }

  /* ---------- cut-sphere readout (how the pieces of a single cell add up) ---------- */
  const CUT = 'Cut-sphere readout';
  const readout = (basis, region) => countFormula(M.pointCount(basis, region));
  const box1 = M.boxRegion([1, 1, 1]);
  for (const [c, text] of [['P', '8 × ⅛ = 1'], ['I', '8 × ⅛ + 1 × 1 = 2'], ['C', '8 × ⅛ + 2 × ½ = 2'], ['F', '8 × ⅛ + 6 × ½ = 4'], ['R', '8 × ⅛ + 2 × 1 = 3']]) {
    truthy(CUT, `${c}: ${text}`, readout(basisOf(c), box1) === text);
  }
  truthy(CUT, 'Hexagonal prism: 12 × ⅙ + 2 × ½ = 3', readout(basisOf('P'), M.hexPrismRegion(1)) === '12 × ⅙ + 2 × ½ = 3');
  near(CUT, 'Supercell 2×2×2, cubic F: 4 points per cell × 8 cells', M.pointCount(basisOf('F'), M.boxRegion([2, 2, 2])).total, 32, 1e-9);
  near(CUT, 'Two stacked prisms hold 6 points', M.pointCount(basisOf('P'), M.hexPrismRegion(2)).total, 6, 1e-9);
  {
    // slanted cells: the clip planes must be the cell faces, so every corner point lies exactly on 3 of them
    const L = new M.Lattice(findBravais('aP').params);
    const planes = M.regionPlanes(box1, L);
    const onFaces = f => planes.filter(({ n, d }) => Math.abs(M.dot(n, L.toCartesian(f)) - d) < 1e-9).length;
    truthy(CUT, 'Triclinic: each corner lies on exactly 3 cut planes', [[0, 0, 0], [1, 1, 1], [1, 0, 1]].every(f => onFaces(f) === 3));
  }

  /* ---------- 2D lattices ---------- */
  const TWO = '2D lattices';
  for (const b of BRAVAIS_2D) {
    const want = b.id === 'oc' ? 2 : 1;
    near(TWO, `${b.name}: ${want} point${want > 1 ? 's' : ''} per cell`, pointCount2D(basis2D(b), 1).total, want, 1e-9);
  }
  truthy(TWO, 'Centred rectangular readout: 4 × ¼ + 1 × 1 = 2', countFormula(pointCount2D(basis2D(BRAVAIS_2D.find(b => b.id === 'oc')), 1)) === '4 × ¼ + 1 × 1 = 2');
  near(TWO, 'Hexagonal 2D: cell area = (√3/2)·a²', new Lattice2D({ a: 3.5, b: 3.5, gamma: 120 }).area, (Math.sqrt(3) / 2) * 3.5 * 3.5, 1e-9, ' Å²');
  near(TWO, 'Square: nearest neighbour = a', nearestNeighbour2D(new Lattice2D({ a: 3.5, b: 3.5, gamma: 90 }), [[0, 0]]), 3.5, 1e-9, ' Å');

  /* ---------- Part 2: d_hkl for all 14 lattices (general formula 1/d² = hᵀG*h) ---------- */
  const DH = 'Interplanar distance, all 14 lattices';
  near(DH, 'Cubic P, a = 1: d(110) = 0.7071 (from hᵀG*h)', 1 / Math.sqrt(M.quadForm([1, 1, 0], new M.Lattice(cubic(1)).Gstar, [1, 1, 0])), 0.7071, 0.00005);
  near(DH, 'Cubic F, a = 3.615 Å: d(111) = 2.087 Å (from hᵀG*h)', 1 / Math.sqrt(M.quadForm([1, 1, 1], cF.Gstar, [1, 1, 1])), 2.087, 0.0005, ' Å');
  {
    const HKL = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [1, 0, 1], [1, 1, 1], [2, -1, 3], [-1, 2, 0], [3, 1, -2]];
    for (const b of BRAVAIS) {
      for (const setting of b.id === 'hR' ? ['rhombohedral', 'hexagonal'] : [defaultSetting(b)]) {
        const p = defaultParams(b, setting), L = new M.Lattice(p);
        const sys = setting === 'hexagonal' ? 'hexagonal' : b.system;
        const worst = Math.max(...HKL.map(h => Math.abs(L.dSpacing(h) - textbookD(sys, p, h)) / textbookD(sys, p, h)));
        truthy(DH, `${b.name}${b.id === 'hR' ? ` (${setting} axes)` : ''}: hᵀG*h matches the ${sys} textbook formula`, worst < 1e-10);
      }
    }
  }

  /* ---------- Part 2: planes that really contain lattice points ---------- */
  const LP = 'Lattice planes in centred lattices';
  const step = (c, h) => M.latticePlanes(h, basisOf(c));
  const c1 = new M.Lattice(cubic(1));
  near(LP, 'Cubic I (100): planes with points are a/2 apart (the (200) planes)', M.planeSpacings(c1, [1, 0, 0], basisOf('I')).dLattice, 0.5, 1e-12);
  truthy(LP, 'Cubic I (100) → lattice planes (200)', step('I', [1, 0, 0]).eq.join() === '2,0,0');
  truthy(LP, 'Cubic I (110): every formula plane holds points (step 1)', step('I', [1, 1, 0]).stepValue === 1);
  truthy(LP, 'Cubic I (111) → (222)', step('I', [1, 1, 1]).eq.join() === '2,2,2');
  truthy(LP, 'Cubic F (111): step 1, d = d₁₁₁', step('F', [1, 1, 1]).stepValue === 1);
  truthy(LP, 'Cubic F (100) → (200), (110) → (220)', step('F', [1, 0, 0]).eq.join() === '2,0,0' && step('F', [1, 1, 0]).eq.join() === '2,2,0');
  truthy(LP, 'Cubic P (200): only every second formula plane holds points → (100)', step('P', [2, 0, 0]).eq.join() === '1,0,0');
  truthy(LP, 'Base-centred C (001): step 1; (100) → (200)', step('C', [0, 0, 1]).stepValue === 1 && step('C', [1, 0, 0]).eq.join() === '2,0,0');
  {
    const hR = findBravais('hR'), pH = defaultParams(hR, 'hexagonal');
    near(LP, 'Rhombohedral on hexagonal axes (001): planes c/3 apart', M.planeSpacings(new M.Lattice(pH), [0, 0, 1], latticeBasis(hR, 'hexagonal')).dLattice, pH.c / 3, 1e-9, ' Å');
  }
  truthy(LP, 'Missing planes ⇔ systematic absence (cubic I and F, h, k, l ≤ 2)', ['I', 'F'].every(c => {
    for (let h = -2; h <= 2; h++) for (let k = -2; k <= 2; k++) for (let l = -2; l <= 2; l++) {
      if (!h && !k && !l || M.reduceIndices([h, k, l]).join() !== [h, k, l].join()) continue;
      if ((step(c, [h, k, l]).stepValue < 1) !== M.structureFactor(basisOf(c), [h, k, l]).absent) return false;
    }
    return true;
  }));
  {
    const layers = M.latticePlaneLayers([1, 0, 0], basisOf('I'), M.boxRegion([1, 1, 1]));
    truthy(LP, 'Cubic I (100) in one cell: planes at x = 0, ½, 1; the middle one is extra', layers.map(l => l.level).join() === '0,0.5,1' && layers.map(l => l.formula).join() === 'true,false,true');
  }

  /* ---------- Part 2: intercepts and direction components ---------- */
  const IC = 'Intercepts & components';
  {
    const s = M.interceptSteps([1, 2, 0], 1);
    truthy(IC, '(120): intercepts 1, ½, ∞ → reciprocals 1, 2, 0 → (120)',
      s.intercepts[0].p === 1 && s.intercepts[0].q === 1 && s.intercepts[1].p === 1 && s.intercepts[1].q === 2 && s.intercepts[2] === null && s.cleared.join() === '1,2,0');
    const t = M.interceptSteps([3, 2, 0], 2);
    truthy(IC, '(320), plane n = 2: intercepts ⅔, 1, ∞ → ×2 clears the fractions → (320)', t.intercepts[0].p === 2 && t.intercepts[0].q === 3 && t.factor === 2 && t.cleared.join() === '3,2,0');
    truthy(IC, '(1 −1 0): origin moves to corner (0 1 0), intercepts 1 and −1', M.autoOrigin([1, -1, 0]).join() === '0,1,0'
      && M.interceptPoints([1, -1, 0], 1, [0, 1, 0]).slice(0, 2).map(f => f.join()).join('|') === '1,1,0|0,0,0');
    const four = M.interceptSteps([1, 0, -1, 0], 1);
    truthy(IC, '(1 0 −1 0): a1 at 1, a2 ∞, a3 at −1, c ∞', four.intercepts[0].p === 1 && four.intercepts[1] === null && four.intercepts[2].p === -1 && four.intercepts[3] === null);
    const path = M.componentPath([1, 1, -2], M.AXES_3);
    truthy(IC, '[1 1 −2] path: a, then b, then −2c, ending at (1, 1, −2)', path.length === 3 && path[2].to.join() === '1,1,-2');
    const p4 = M.componentPath(M.directionToFour([1, 0, 0]), M.AXES_4);
    truthy(IC, 'Four-index path [2 −1 −1 0] ends at 3a1 (parallel to [100])', p4[p4.length - 1].to.join() === '3,0,0');
  }

  /* ---------- Part 2.5: the highlighted cell and the origin ---------- */
  const HC = 'Highlighted cell & origin';
  truthy(HC, '5×5×5: cell (1,1,1) has its origin at (0, 0, 0)', M.cellOrigin([1, 1, 1]).join() === '0,0,0');
  truthy(HC, '5×5×5: cell (3,3,3) has its origin at (2, 2, 2)', M.cellOrigin([3, 3, 3]).join() === '2,2,2');
  truthy(HC, 'Cell numbers stay inside the supercell', M.clampCell([7, 0, 3], [5, 5, 5]).join() === '5,1,3');
  {
    const O = M.originOf([3, 3, 3]);
    truthy(HC, 'Origin in cell (3,3,3): [111] runs from (2, 2, 2) to (3, 3, 3)', O.join() === '2,2,2' && M.add(O, [1, 1, 1]).join() === '3,3,3');
    const pts = M.interceptPoints([1, 1, 1], 1, O);
    truthy(HC, 'Origin in cell (3,3,3): (111) cuts the axes at (3,2,2), (2,3,2), (2,2,3)', pts.map(p => p.join()).join('|') === '3,2,2|2,3,2|2,2,3');
    truthy(HC, 'The plane drawn in cell (3,3,3) is the (111) plane one step from the new origin',
      M.representativeLevelFrom([1, 1, 1], M.translateRegion(M.boxRegion([1, 1, 1]), O), O) === 7);
    const region = M.boxRegion([5, 5, 5]);
    truthy(HC, 'A ray straight down c from above picks the top cell of that column', M.cellUnderRay([2.5, 1.5, 9], [0, 0, -1], region).join() === '3,2,5');
    truthy(HC, 'Cutting follows the highlighted cell: cubic F cell (3,3,3) still adds up to 4',
      countFormula(M.pointCount(basisOf('F'), M.translateRegion(M.boxRegion([1, 1, 1]), O))) === '8 × ⅛ + 6 × ½ = 4');
  }

  /* ---------- Part 4: interstitial sites (computed from the geometry, not stored) ---------- */
  const IS = 'Interstitial sites';
  {
    const scene = c => {
      const basis = basisOf(c), analysis = M.analyse(cubic(4), basis);
      return { bravais: { id: `c${c}` }, basis, analysis, lattice: analysis.lattice };
    };
    const site = (c, kind) => M.sceneSites(scene(c)).find(s => s.kind === kind);
    for (const [c, kind, what, v] of [['P', 'cub', 'cubic site', '0.732'], ['F', 'oct', 'octahedral', '0.414'], ['F', 'tet', 'tetrahedral', '0.225'],
      ['I', 'oct', 'octahedral', '0.155'], ['I', 'tet', 'tetrahedral', '0.291']]) {
      near(IS, `Critical radius ratio: cubic ${c} ${what} = ${v}`, site(c, kind).ratio, +v, 0.0005);
    }
    near(IS, 'Cubic F octahedral: r/R = √2 − 1 exactly (a = 2R + 2r, a = 2√2·R)', site('F', 'oct').ratio, Math.SQRT2 - 1, 1e-12);
    truthy(IS, 'Interstitial sites per cell: cubic F 4 octahedral, 8 tetrahedral',
      site('F', 'oct').count.total === 4 && site('F', 'tet').count.total === 8);
    truthy(IS, 'Interstitial sites per cell: cubic I 6 octahedral, 12 tetrahedral',
      Math.abs(site('I', 'oct').count.total - 6) < 1e-9 && Math.abs(site('I', 'tet').count.total - 12) < 1e-9);
    truthy(IS, 'Cubic P: 1 cubic site per cell', site('P', 'cub').count.total === 1);
    truthy(IS, 'Per lattice point: cubic F 1 oct + 2 tet, cubic I 3 oct + 6 tet',
      [site('F', 'oct').perPoint, site('F', 'tet').perPoint, site('I', 'oct').perPoint, site('I', 'tet').perPoint].join() === '1,2,3,6');
    truthy(IS, 'Cubic F octahedral readout: 12 × ¼ + 1 × 1 = 4', countFormula(site('F', 'oct').count) === '12 × ¼ + 1 × 1 = 4');
    truthy(IS, 'Cubic I octahedral readout: 12 × ¼ + 6 × ½ = 6', countFormula(site('I', 'oct').count) === '12 × ¼ + 6 × ½ = 6');
    truthy(IS, 'Neighbours: oct 6, tet 4, cubic 8; cubic I octahedron squashed (2 at a/2, 4 at a/√2)', (() => {
      const cn = (c, k, f) => { const S = scene(c); return M.hostsAround(S.lattice, S.basis, f, { n: M.siteSpec(`c${c}`, k).cn }); };
      const bcc = cn('I', 'oct', [0.5, 0, 0]).map(h => +h.d.toFixed(4));
      return cn('F', 'oct', [0.5, 0.5, 0.5]).length === 6 && cn('F', 'tet', [0.25, 0.25, 0.25]).length === 4 && cn('P', 'cub', [0.5, 0.5, 0.5]).length === 8
        && bcc.join() === [2, 2, 2.8284, 2.8284, 2.8284, 2.8284].join();
    })());
    truthy(IS, 'Not available for the other 11 lattices', BRAVAIS.filter(b => M.interstitialsFor(b.id)).map(b => b.id).join() === 'cP,cI,cF');
  }

  /* ---------- Part 4: atom fit ---------- */
  const AF = 'Atom fit';
  {
    const basis = basisOf('F'), an = M.analyse(cubic(4), basis), L = an.lattice, Rh = an.neighbours.dnn / 2;
    const rMax = (Math.SQRT2 - 1) * Rh;
    truthy(AF, 'Cubic F octahedral: r = r_max fits (green)', M.fitAtom(L, basis, [0.5, 0.5, 0.5], rMax, Rh, 6).fits);
    truthy(AF, 'Cubic F octahedral: r = 1.01 r_max does not fit (red)', !M.fitAtom(L, basis, [0.5, 0.5, 0.5], 1.01 * rMax, Rh, 6).fits);
    {
      const f = M.fitAtom(L, basis, [0.5, 0.5, 0.5], rMax + 0.1, Rh, 6);
      near(AF, 'Too big by 0.1 Å: each of the 6 neighbours moves out 0.1 Å', f.maxMove, 0.1, 1e-9, ' Å');
      truthy(AF, '… and all 6 neighbours move', f.shells.length === 1 && f.shells[0].count === 6);
    }
    const bI = basisOf('I'), aI = M.analyse(cubic(4), bI), RI = aI.neighbours.dnn / 2;
    const g = M.fitAtom(aI.lattice, bI, [0.5, 0, 0], 0.3, RI, 6);
    truthy(AF, 'Cubic I octahedral, slightly too big: only the 2 nearest neighbours must move',
      !g.fits && g.shells[0].count === 2 && g.shells[0].move > 0 && g.shells[1].count === 4 && g.shells[1].move === 0);
    near(AF, 'The critical ratio follows from the hole: (d − R)/R, cubic I tetrahedral', M.fitAtom(aI.lattice, bI, [0.5, 0.25, 0], 0.1, RI, 4).critical, Math.sqrt(5 / 3) - 1, 1e-12);
  }

  /* ---------- Part 4.5: hexagonal prisms side by side ---------- */
  const PF = 'Hexagonal prism fields';
  {
    const hb = basisOf('P');
    const unique = r => { const sites = M.sitesInRegion(hb, M.prismFieldRegion(r)); return [sites.length, new Set(sites.map(x => x.f.map(v => v.toFixed(5)).join())).size]; };
    const [n221, u221] = unique([2, 2, 1]), [n332, u332] = unique([3, 3, 2]);
    truthy(PF, '2 × 2 × 1 prisms: 40 lattice points, none drawn twice', n221 === 40 && u221 === 40);
    truthy(PF, '3 × 3 × 2 prisms: 117 lattice points, none drawn twice', n332 === 117 && u332 === 117);
    truthy(PF, 'Each prism of a field still holds 12 × ⅙ + 2 × ½ = 3', countFormula(M.pointCount(hb, M.translateRegion(M.hexPrismRegion(1), M.prismOrigin([2, 2, 1])))) === '12 × ⅙ + 2 × ½ = 3');
  }

  /* ---------- Part 4.5: ionic structures ---------- */
  const IO = 'Ionic structures';
  for (const S of IONIC) {
    const cen = CENTRING[findBravais(S.lattice).centring];
    const counts = M.ionCounts(S, cen, M.boxRegion([1, 1, 1]));
    const cn = M.coordination(S, cen, M.analyse(cubic(S.a), basisOf('P')).lattice);
    const want = { NaCl: [4, 4, 6, 6, 4], CsCl: [1, 1, 8, 8, 1], ZnS: [4, 4, 4, 4, 4], CaF2: [4, 8, 8, 4, 4] }[S.id];
    const [cat, an] = [S.ions.find(i => i.charge.includes('+')).el, S.ions.find(i => !i.charge.includes('+')).el];
    truthy(IO, `${S.id}: ${want[0]} ${cat} + ${want[1]} ${an} per cell, CN ${want[2]} : ${want[3]}, Z = ${want[4]}`,
      Math.abs(counts[cat].total - want[0]) < 1e-9 && Math.abs(counts[an].total - want[1]) < 1e-9
      && cn[cat].cn === want[2] && cn[an].cn === want[3] && M.formulaUnitsOf(counts).z === want[4]);
  }

  /* ---------- close-packed stacking ---------- */
  const CP = 'Close-packed stacking';
  for (const [seq, view, n, label] of [
    ['AB', 'hex', 6, 'ABAB (HCP): 6 atoms in the hexagonal prism'],
    ['ABC', 'hex', 9, 'ABC on hexagonal axes: 9 atoms in the hexagonal prism'],
    ['ABC', 'cubic', 4, 'ABC in the cube (FCC): 4 atoms per cell'],
  ]) {
    const basis = view === 'cubic' ? basisOf('F') : M.stackingBasis(seq);
    const F = M.stackingFacts(M.stackingParams(seq, view, 1), basis, view);
    near(CP, label, M.pointCount(basis, view === 'cubic' ? M.boxRegion([1, 1, 1]) : M.hexPrismRegion(1)).total, n, 1e-9);
    truthy(CP, `${seq} (${view}): CN 12 = 6 in the layer + 3 above + 3 below`, F.cn === 12 && F.inLayer === 6 && F.above === 3 && F.below === 3);
    near(CP, `${seq} (${view}): packing fraction π/(3√2) = 0.7405`, F.packing, Math.PI / (3 * Math.SQRT2), 1e-9);
    near(CP, `${seq} (${view}): layers 2r·√(2/3) apart (r = 1)`, F.spacing, 2 * Math.sqrt(2 / 3), 1e-9);
  }
  near(CP, 'Ideal HCP c/a = √(8/3) = 1.633', M.IDEAL_CA.AB, 1.633, 0.0005);
  truthy(CP, 'FCC: the (111) layers run A, B, C, A along the body diagonal',
    [[0, 0, 0], [0.5, 0.5, 0], [1, 0.5, 0.5], [1, 1, 1]].map(f => M.layerOf(f, 'cubic', 'ABC').letter).join('') === 'ABCA');

  /* ---------- Part 5: Defects mode ---------- */
  defectCases(near, truthy);

  /* ---------- the 14 lattices themselves ---------- */
  truthy('Bravais data', 'There are exactly 14 lattices, all with valid parameters',
    BRAVAIS.length === 14 && BRAVAIS.every(b => M.validateParams(defaultParams(b, defaultSetting(b))) === null));

  return cases;
}

/** Run every case, log PASS/FAIL lines, and return a report for the UI. */
export function runSelfCheck(out = console) {
  let cases;
  try {
    cases = buildCases();
  } catch (err) {
    cases = [{ group: 'Self-check', name: `Crashed: ${err.message}`, got: false, want: true, pass: false }];
  }
  const fmt = v => (typeof v === 'number' ? +v.toFixed(6) : v);
  for (const c of cases) {
    const line = typeof c.want === 'boolean'
      ? `${c.pass ? 'PASS' : 'FAIL'}  ${c.group}: ${c.name}`
      : `${c.pass ? 'PASS' : 'FAIL'}  ${c.group}: ${c.name} (got ${fmt(c.got)}${c.unit})`;
    (c.pass ? out.log : out.error).call(out, line);
  }
  const passed = cases.filter(c => c.pass).length;
  out.log(`Unit Cell Explorer self-check: ${passed}/${cases.length} passed`);
  return { passed, total: cases.length, cases };
}
