/* =====================================================================
   Lattice geometry — pure mathematics, no DOM and no Three.js.

   Conventions
   - Lattice parameters p = { a, b, c } in Å and { alpha, beta, gamma } in degrees.
   - Fractional coordinates f = [x, y, z]. Directions [u v w] are components on
     the direct basis (a, b, c); plane indices (h k l) are components on the
     reciprocal basis.
   - Cartesian setting: a ∥ x, b in the xy-plane, c completes a right-handed set.
   - Every length, angle and d-spacing goes through the metric tensor
     G (Gij = ai·aj) or the reciprocal metric tensor G* = G⁻¹, so the same code
     serves cubic and triclinic cells alike.
   ===================================================================== */
import { DEG, acosDeg, inv3, quadForm, sub, cross, scale, dot, normalize } from './linalg.js';
import { txt } from '../text.js';

/** 1 − cos²α − cos²β − cos²γ + 2 cosα cosβ cosγ; the cell volume is abc·√(this). */
function shapeFactor(p) {
  const ca = Math.cos(p.alpha * DEG), cb = Math.cos(p.beta * DEG), cg = Math.cos(p.gamma * DEG);
  return 1 - ca * ca - cb * cb - cg * cg + 2 * ca * cb * cg;
}

/** Returns a human-readable problem with the parameters, or null when they describe a real cell. */
export function validateParams(p) {
  const names = { a: 'a', b: 'b', c: 'c', alpha: 'α', beta: 'β', gamma: 'γ' };
  for (const k of ['a', 'b', 'c']) {
    if (!(p[k] > 0)) return txt('msgParamLength', { name: names[k] });
  }
  for (const k of ['alpha', 'beta', 'gamma']) {
    if (!(p[k] > 0 && p[k] < 180)) return txt('msgParamAngle', { name: names[k] });
  }
  const { alpha: A, beta: B, gamma: C } = p;
  if (A + B + C >= 360 || A + B <= C || B + C <= A || A + C <= B) {
    return txt('msgAnglesClose');
  }
  if (shapeFactor(p) <= 1e-9) return txt('msgZeroVolume');
  return null;
}

export class Lattice {
  constructor(p) {
    const problem = validateParams(p);
    if (problem) throw new Error(problem);
    this.params = { ...p };
    const { a, b, c } = p;
    const ca = Math.cos(p.alpha * DEG), cb = Math.cos(p.beta * DEG);
    const cg = Math.cos(p.gamma * DEG), sg = Math.sin(p.gamma * DEG);

    // Metric tensor straight from the parameters: Gij = ai · aj
    this.G = [
      [a * a,      a * b * cg, a * c * cb],
      [a * b * cg, b * b,      b * c * ca],
      [a * c * cb, b * c * ca, c * c     ],
    ];
    this.Gstar = inv3(this.G);

    // General (triclinic) volume formula
    this.volume = a * b * c * Math.sqrt(shapeFactor(p));

    // Lattice vectors in the standard Cartesian setting (rows: a, b, c)
    this.vectors = [
      [a, 0, 0],
      [b * cg, b * sg, 0],
      [c * cb, c * (ca - cb * cg) / sg, this.volume / (a * b * sg)],
    ];

    // Reciprocal vectors (no 2π): a* = (b × c) / V, …  so that ai* · aj = δij
    const [A, B, C] = this.vectors, V = this.volume;
    this.reciprocal = [scale(cross(B, C), 1 / V), scale(cross(C, A), 1 / V), scale(cross(A, B), 1 / V)];
  }

  /** Fractional (or direction) components → Cartesian Å: r = x·a + y·b + z·c */
  toCartesian(f) {
    const [A, B, C] = this.vectors;
    return [
      f[0] * A[0] + f[1] * B[0] + f[2] * C[0],
      f[0] * A[1] + f[1] * B[1] + f[2] * C[1],
      f[0] * A[2] + f[1] * B[2] + f[2] * C[2],
    ];
  }

  /** Cartesian Å → fractional coordinates: x = a*·r, … */
  toFractional(r) { return this.reciprocal.map(g => dot(g, r)); }

  /** Length of a direct-lattice vector [uvw] (or a fractional displacement): √(uᵀGu) */
  length(uvw) { return Math.sqrt(quadForm(uvw, this.G, uvw)); }

  /** Distance between two fractional positions */
  distance(f1, f2) { return this.length(sub(f2, f1)); }

  /** Angle between two directions in degrees: cos φ = uᵀGv / (|u||v|) */
  angle(u, v) {
    const c = quadForm(u, this.G, v) / (this.length(u) * this.length(v));
    return acosDeg(c);
  }

  /** Interplanar spacing: 1/d² = hᵀG*h */
  dSpacing(hkl) { return 1 / Math.sqrt(quadForm(hkl, this.Gstar, hkl)); }

  /** Unit normal of the (hkl) planes in Cartesian coordinates: ∝ h a* + k b* + l c* */
  planeNormal(hkl) {
    const [A, B, C] = this.reciprocal;
    return normalize([0, 1, 2].map(i => hkl[0] * A[i] + hkl[1] * B[i] + hkl[2] * C[i]));
  }
}

/* ---------- rhombohedral lattice: two settings of the same points ---------- */

/**
 * Rhombohedral axes (a_R, α) → the equivalent hexagonal axes (obverse setting):
 *   a_H = 2 a_R sin(α/2),   c_H = a_R √(3 (1 + 2 cos α)).
 * The hexagonal cell is three times larger and R-centred.
 */
export function rhombohedralToHexagonal({ a, alpha }) {
  const ca = Math.cos(alpha * DEG);
  const aH = 2 * a * Math.sin(alpha * DEG / 2);
  return { a: aH, b: aH, c: a * Math.sqrt(3 * (1 + 2 * ca)), alpha: 90, beta: 90, gamma: 120 };
}

/** Hexagonal axes (a_H, c_H) of an R lattice → rhombohedral axes (a_R, α). */
export function hexagonalToRhombohedral({ a, c }) {
  const aR = Math.sqrt(a * a / 3 + c * c / 9);
  const cosA = (c * c / 9 - a * a / 6) / (aR * aR);
  const alpha = acosDeg(cosA);
  return { a: aR, b: aR, c: aR, alpha, beta: alpha, gamma: alpha };
}

/* ---------- angles between directions and planes, for any of the 14 lattices ----------
   Always the general metric-tensor method — never the cubic shortcut
   "[hkl] ⟂ (hkl)", which is only true in cubic lattices.
     directions:        cos θ = u₁ᵀ G u₂ / (|u₁| |u₂|),   |u| = √(uᵀ G u)
     plane normals:     cos θ = h₁ᵀ G* h₂ / (|g₁| |g₂|),  |g| = √(hᵀ G* h) = 1/d
     direction–normal:  cos ψ = (uh + vk + wl) / (|u| |g|)
   Indices are three-index; convert Miller–Bravais input first. */

/** Angle between two directions, 0°–180°. */
export function angleDirections(L, u, v) {
  const dotG = quadForm(u, L.G, v), lu = L.length(u), lv = L.length(v);
  return { angle: acosDeg(dotG / (lu * lv)), dotG, lu, lv };
}

/** Angle between two planes = angle between their normals, folded into 0°–90°. */
export function anglePlanes(L, h1, h2) {
  const dotG = quadForm(h1, L.Gstar, h2);
  const g1 = Math.sqrt(quadForm(h1, L.Gstar, h1)), g2 = Math.sqrt(quadForm(h2, L.Gstar, h2));
  const cos = dotG / (g1 * g2);
  return { angle: acosDeg(Math.abs(cos)), normals: acosDeg(cos), dotG, g1, g2 };
}

/**
 * Direction [uvw] and plane (hkl): ψ = angle to the plane normal (0°–90°) and
 * the angle to the plane itself, 90° − ψ.
 */
export function angleDirectionPlane(L, uvw, hkl) {
  const uh = dot(uvw, hkl), lu = L.length(uvw), g = Math.sqrt(quadForm(hkl, L.Gstar, hkl));
  const toNormal = acosDeg(Math.abs(uh / (lu * g)));
  return { toNormal, toPlane: 90 - toNormal, uh, lu, g };
}
