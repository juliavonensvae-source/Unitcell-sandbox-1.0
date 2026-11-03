/* =====================================================================
   Shared explanations for a plane set (hkl): the spacing from the formula,
   d_hkl from 1/d² = hᵀG*h, and the spacing of the planes that really hold
   lattice points (closer together in centred lattices). Used by the plane
   card, the spacing object and the d table.
   ===================================================================== */
import * as M from '../math/index.js';
import { effectiveSystem } from '../data/bravais.js';
import { idx, sig, dSym, fracText } from '../ui/format.js';
import { formulaTex } from '../ui/controls.js';
import { tn, tt, tIdx } from '../help/tex.js';
import { txt } from '../text.js';

const ORDINAL = ['', '', txt('ordinal2'), txt('ordinal3'), txt('ordinal4'), txt('ordinal5'), txt('ordinal6')];
const fracPart = x => {
  const f = x - Math.floor(x);
  return M.ratio(Math.round(f * 6), 6);
};

/** Everything about the spacing of a plane set, for display. */
export function spacingInfo(hkl, ctx) {
  const s = M.planeSpacings(ctx.lattice, hkl, ctx.basis);
  const [p, q] = s.step;
  return { ...s, p, q, same: p === 1 && q === 1, cubic: effectiveSystem(ctx.bravais, ctx.setting) === 'cubic' };
}

/** Formula boxes (KaTeX): 1/d² = hᵀG*h with the numbers filled in, and the cubic shortcut in cubic cells. */
export function formulaLine(hkl, ctx) {
  const L = ctx.lattice, q = M.quadForm(hkl, L.Gstar, hkl);
  const [h, k, l] = hkl, d = `d_{${tIdx(hkl).slice(1, -1)}}`;
  const general = formulaTex(txt('dFormulaGeneral', { d, q: tn(q), value: tn(L.dSpacing(hkl)) }), txt('formulaTagAll'));
  if (effectiveSystem(ctx.bravais, ctx.setting) !== 'cubic') return general;
  return general + formulaTex(txt('dFormulaCubic', { d, aValue: tt(ctx.params.a), sum: h * h + k * k + l * l }), txt('formulaTagCubic'));
}

/** One plain-language paragraph on how the lattice-plane spacing relates to d_hkl (null when they are equal). */
export function spacingExplanation(hkl, ctx, info = spacingInfo(hkl, ctx)) {
  const { p, q, eq, dFormula, dLattice } = info;
  if (p === 1 && q === 1) return null;
  const dEq = `${dSym(eq)} = ${sig(dLattice)} Å`;
  if (p === 1) {
    // centring points sit between the formula planes
    const between = ctx.basis.filter(s => Math.abs(M.dot(hkl, s.f) - Math.round(M.dot(hkl, s.f))) > 1e-6);
    const pts = between.map(s => `(${s.f.map(x => fracText(M.ratio(Math.round(6 * x), 6))).join(', ')})`);
    const levels = [...new Set(between.map(s => fracText(fracPart(M.dot(hkl, s.f)))))];
    const extra = q - 1;
    return [
      txt(pts.length > 1 ? 'spacingCentringMany' : 'spacingCentringOne', { points: pts.join(` ${txt('wordAnd')} `), planes: idx(hkl, 'plane'), levels: levels.join(', ') }),
      extra === 1 ? txt('spacingExtraOne') : txt('spacingExtraMany', { count: extra }),
      txt('spacingHoldDivided', { planes: idx(eq, 'plane'), d: dSym(hkl), q, result: dEq }),
      txt('spacingAbsence', { planes: idx(hkl, 'plane') }),
    ].join(' ');
  }
  if (q === 1) {
    return `${txt('spacingFactor', { p, nth: ORDINAL[p] || txt('ordinalN', { n: p }), planes: idx(hkl, 'plane') })} `
      + txt('spacingFactorPlanes', { planes: idx(eq, 'plane'), p, d: dSym(hkl), result: dEq, value: sig(dFormula) });
  }
  return txt('spacingHoldRatio', { planes: idx(eq, 'plane'), p, q, d: dSym(hkl), result: dEq });
}

/** Short summary text: "d = 2.087 Å", or both values when they differ. */
export function spacingSummary(hkl, ctx, info = spacingInfo(hkl, ctx)) {
  if (info.same) return `${dSym(hkl)} = ${sig(info.dFormula)} Å`;
  return txt('spacingSummaryBoth', { d: dSym(hkl), value: sig(info.dFormula), lattice: sig(info.dLattice) });
}
