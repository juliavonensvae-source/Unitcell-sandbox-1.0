/* =====================================================================
   Help topics of Defects mode: close-packed planes and slip systems
   (cubic P, I, F, and HCP in the text), and the Shockley partials of
   cubic F. The worked examples use the cubic lattice on screen, or
   copper (cubic F, a = 3.615 Å) when another lattice is shown.
   ===================================================================== */
import * as M from '../../math/index.js';
import { Lattice } from '../../math/lattice.js';
import { findBravais, latticeBasis } from '../../data/bravais.js';
import { tn, tIdx } from '../tex.js';
import { latticeName } from '../context.js';
import { slipPlanesDiagram, partialsDiagram } from '../diagrams-slip.js';
import { txt } from '../../text.js';

const CU_A = 3.615;
/** Copper, for the size of the partials: shear modulus (Pa), stacking-fault energy (J/m²), Poisson's ratio. */
const CU = { G: 48e9, gamma: 0.045, nu: 0.3 };
/** The next-shortest lattice vector after b (units of a): what a dislocation would cost with it instead. */
const NEXT = { cP: [1, 1, 0], cI: [1, 0, 0], cF: [1, 0, 0] };

const cubicWithSlip = ctx => !!(ctx && ctx.bravais && M.SLIP_SYSTEMS[ctx.bravais.id] && !ctx.flat);

/** The lattice for the example: the one on screen when it is cubic P, I or F, else copper. → { id, L, basis, a, mine } */
function sceneLattice(ctx, want = null) {
  if (cubicWithSlip(ctx) && (!want || ctx.bravais.id === want)) return { id: ctx.bravais.id, L: ctx.lattice, basis: ctx.basis, a: ctx.params.a, mine: true };
  const id = want || 'cF';
  return { id, L: new Lattice({ a: CU_A, b: CU_A, c: CU_A, alpha: 90, beta: 90, gamma: 90 }), basis: latticeBasis(findBravais(id)), a: CU_A, mine: false };
}

/**
 * The plane and direction of the slip item whose "?" was pressed (or the first one in the scene), else the first of
 * the family. With search = false only the item itself counts (an example that falls back to copper).
 */
function chosen(ctx, item, id, search = true) {
  const S = item && item.type === 'slip' ? item : search ? ((ctx.ws && ctx.ws.state.items) || []).find(i => i.type === 'slip') : null;
  const planes = M.slipPlanes(id), hkl = planes[S ? Math.min(S.plane, planes.length - 1) : 0];
  const dirs = M.slipDirections(id, hkl), uvw = dirs[S ? Math.min(S.dir, dirs.length - 1) : 0];
  return { S, hkl, uvw };
}

/** a/2[1̄10] in TeX. */
function bTex(v) {
  const r = M.asIndices(v);
  return r.den === 1 ? `a\\,${tIdx(r.uvw)}` : `\\tfrac{a}{${r.den}}${tIdx(r.uvw)}`;
}

export default [
  {
    key: 'slip-system',
    title: txt('helpSlipTitle'),
    icon: 'layers',
    scope: txt('helpSlipScope'),
    explain: txt('helpSlipExplain'),
    formulas: [
      { tag: txt('helpSlipFormula1Tag'), tex: txt('helpSlipFormula1') },
      { tag: txt('helpSlipFormula2Tag'), tex: txt('helpSlipFormula2') },
      { tag: txt('helpSlipFormula3Tag'), tex: txt('helpSlipFormula3') },
    ],
    symbols: [
      [txt('helpSlipSymN'), txt('helpSlipSymNText')],
      [txt('helpSlipSymD'), txt('helpSlipSymDText')],
      [txt('helpSlipSymPPF'), txt('helpSlipSymPPFText')],
      [txt('helpSlipSymTau'), txt('helpSlipSymTauText')],
      [txt('helpSlipSymAngles'), txt('helpSlipSymAnglesText')],
    ],
    now(ctx, item) {
      if (!cubicWithSlip(ctx)) return txt('helpSlipNowOther');
      const id = ctx.bravais.id, S = M.SLIP_SYSTEMS[id], { hkl, uvw } = chosen(ctx, item, id);
      const b = M.norm(M.burgersOf(id, uvw)) * ctx.params.a;
      return txt('helpSlipNow', {
        lattice: latticeName(ctx), family: `$${tIdx(S.plane, 'family')}${tIdx(S.dir, 'dirFamily')}$`, count: M.slipSystemCount(id),
        plane: `$${tIdx(hkl, 'plane')}$`, dd: tn(ctx.lattice.dSpacing(hkl)), blen: tn(b),
      });
    },
    more: {
      steps: [
        { text: txt('helpSlipStep1'), tex: txt('helpSlipStep1Tex') },
        { text: txt('helpSlipStep2'), tex: txt('helpDislEnergy') },
        { text: txt('helpSlipStep3') },
        { text: txt('helpSlipStep4') },
        { text: txt('helpSlipStep5') },
        { text: txt('helpSlipStep6') },
        { text: txt('helpSlipStep7'), tex: txt('helpSlipFormula3') },
        { text: txt('helpSlipStep8') },
      ],
      diagram: ctx => slipPlanesDiagram(ctx && ctx.bravais ? ctx.bravais.id : null),
      example(ctx, item) {
        const { id, L, basis, a, mine } = sceneLattice(ctx);
        const { S, hkl, uvw } = chosen(ctx, mine ? item : null, id, mine);
        const r = M.neighbourShell(L, basis, 0)[0].d / 2, P = M.planeFacts(L, basis, hkl, r);
        const bF = M.burgersOf(id, uvw), b = M.norm(bF) * a, next = M.norm(NEXT[id]) * a;
        const planes = M.slipPlanes(id).length, dirs = M.slipDirections(id, hkl).length;
        const N = hkl.reduce((s, x) => s + x * x, 0);
        return {
          title: mine ? latticeName(ctx) : txt('helpSlipExCopper'),
          intro: mine ? (S ? txt('helpExFor', { name: S.name }) : txt('helpSlipExIntro', { aa: tn(a) })) : txt('helpSlipExIntroCopper'),
          steps: [
            { text: txt('helpSlipEx1'), tex: txt('helpSlipEx1Tex', { plane: tIdx(hkl, 'plane'), sum: N, aa: tn(a), dd: tn(P.d) }) },
            { text: txt('helpSlipEx2', { rr: tn(r) }), tex: txt('helpSlipEx2Tex', { nn: basis.length, dd: tn(P.d), vv: tn(L.volume), rho: tn(P.perArea, 3), rr: tn(r), ppf: tn(P.packing, 3) }) },
            { text: txt('helpSlipEx3'), tex: txt('helpSlipEx3Tex', { bvec: bTex(bF), blen: tn(b), rr2: tn(2 * r) }) },
            { text: txt('helpSlipEx4', { next: `$${bTex(NEXT[id])}$` }), tex: txt('helpSlipEx4Tex', { nlen: tn(next), blen: tn(b), ratio: tn((next / b) ** 2, 3) }) },
            { text: txt('helpSlipEx5'), tex: txt('helpSlipEx5Tex', { planes, dirs, count: planes * dirs }) },
          ],
          result: txt('helpSlipExResult', { inPlane: P.inPlane, ppf: tn(P.packing, 3) }),
        };
      },
    },
    related: ['shockley', 'glide', 'stacking', 'edge-dislocation', 'calc-packing'],
  },
  {
    key: 'shockley',
    title: txt('helpShockleyTitle'),
    icon: 'layers',
    scope: txt('helpShockleyScope'),
    explain: txt('helpShockleyExplain'),
    formulas: [
      { tag: txt('helpShockleyFormula1Tag'), tex: txt('helpShockleyFormula1') },
      { tag: txt('helpShockleyFormula2Tag'), tex: txt('helpShockleyFormula2') },
      { tag: txt('helpShockleyFormula3Tag'), tex: txt('helpShockleyFormula3') },
    ],
    symbols: [
      [txt('helpShockleySymBp'), txt('helpShockleySymBpText')],
      [txt('helpShockleySymGamma'), txt('helpShockleySymGammaText')],
      [txt('helpShockleySymG'), txt('helpShockleySymGText')],
      [txt('helpShockleySymBeta'), txt('helpShockleySymBetaText')],
      [txt('helpDislSymNu'), txt('helpDislSymNuText')],
    ],
    now(ctx) {
      if (!(cubicWithSlip(ctx) && ctx.bravais.id === 'cF')) return txt('helpShockleyNowOther');
      const a = ctx.params.a;
      return txt('helpShockleyNow', { blen: tn(a / Math.SQRT2), bp: tn(a / Math.sqrt(6)) });
    },
    more: {
      steps: [
        { text: txt('helpShockleyStep1') },
        { text: txt('helpShockleyStep2') },
        { text: txt('helpShockleyStep3'), tex: txt('helpShockleyFormula1') },
        { text: txt('helpShockleyStep4'), tex: txt('helpShockleyFormula2') },
        { text: txt('helpShockleyStep5') },
        { text: txt('helpShockleyStep6'), tex: txt('helpShockleyFormula3') },
        { text: txt('helpShockleyStep7') },
        { text: txt('helpShockleyStep8') },
      ],
      diagram: () => partialsDiagram(),
      example(ctx) {
        const { a, mine } = sceneLattice(ctx, 'cF');
        const b = a / Math.SQRT2, bp = a / Math.sqrt(6), { G, gamma, nu } = CU;
        const width = factor => (G * (bp * 1e-10) ** 2 / (8 * Math.PI * gamma)) * factor * 1e9; // nm
        const edge = width((2 + nu) / (1 - nu)), screw = width((2 - 3 * nu) / (1 - nu));
        return {
          title: mine ? latticeName(ctx) : txt('helpSlipExCopper'),
          intro: mine ? txt('helpShockleyExIntro', { aa: tn(a) }) : txt('helpSlipExIntroCopper'),
          steps: [
            { text: txt('helpShockleyEx1'), tex: txt('helpShockleyEx1Tex', { blen: tn(b), bp: tn(bp) }) },
            { text: txt('helpShockleyEx2'), tex: txt('helpShockleyEx2Tex', { b2: tn(b * b), bp2: tn(2 * bp * bp) }) },
            { text: txt('helpShockleyEx3'), tex: txt('helpShockleyEx3Tex', { width: tn(edge, 2), nb: tn((edge * 10) / b, 2) }) },
            { text: txt('helpShockleyEx4'), tex: txt('helpShockleyEx4Tex', { width: tn(screw, 2), nb: tn((screw * 10) / b, 2) }) },
          ],
          result: txt('helpShockleyExResult'),
        };
      },
    },
    related: ['slip-system', 'stacking', 'glide', 'burgers'],
  },
];
