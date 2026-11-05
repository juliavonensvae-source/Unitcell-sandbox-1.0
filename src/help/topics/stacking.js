/* =====================================================================
   Help topic: close-packed stacking, ABAB… (HCP) and ABCABC… (FCC).
   The worked example uses the sphere radius of the lattice on screen
   (r = a/2 on hexagonal P, r = a/(2√2) on cubic F), else copper's.
   ===================================================================== */
import * as M from '../../math/index.js';
import { SPHERE_R } from '../../data/stacking.js';
import { tn } from '../tex.js';
import { txt } from '../../text.js';

const shown = (ctx, id) => !!(ctx && ctx.bravais && ctx.bravais.id === id && !ctx.flat);

/** The sphere radius for the example: from the a on screen when it is hexagonal P or cubic F. */
function radiusFor(ctx) {
  if (shown(ctx, 'hP')) return { r: ctx.params.a / 2, mine: true };
  if (shown(ctx, 'cF')) return { r: ctx.params.a / (2 * Math.SQRT2), mine: true };
  return { r: SPHERE_R, mine: false };
}

const apf = (n, r, V) => n * (4 / 3) * Math.PI * r ** 3 / V;

export default [
  {
    key: 'stacking',
    title: txt('helpStackTitle'),
    icon: 'layers',
    scope: txt('helpStackScope'),
    explain: txt('helpStackExplain'),
    formulas: [
      { tag: txt('helpStackFormula1Tag'), tex: txt('helpStackFormula1') },
      { tag: txt('helpStackFormula2Tag'), tex: txt('helpStackFormula2') },
      { tag: txt('helpStackFormula3Tag'), tex: txt('helpStackFormula3') },
      { tex: txt('helpStackFormula4') },
    ],
    symbols: [
      [txt('helpStackSym1'), txt('helpStackSym1Text')],
      [txt('helpStackSym2'), txt('helpStackSym2Text')],
      [txt('helpStackSym3'), txt('helpStackSym3Text')],
      [txt('helpStackSym4'), txt('helpStackSym4Text')],
      [txt('helpStackSym5'), txt('helpStackSym5Text')],
      [txt('helpStackSym6'), txt('helpStackSym6Text')],
    ],
    now(ctx) {
      if (shown(ctx, 'hP')) return txt('helpStackNowHex', { ca: tn(ctx.params.c / ctx.params.a) });
      if (shown(ctx, 'cF')) return txt('helpStackNowCubic', { d: tn(ctx.params.a / Math.sqrt(3)) });
      return txt('helpStackNowOther');
    },
    more: {
      steps: [
        { text: txt('helpStackStep1') },
        { text: txt('helpStackStep2'), tex: txt('helpStackStep2Tex') },
        { text: txt('helpStackStep3') },
        { text: txt('helpStackStep4'), tex: txt('helpStackStep4Tex') },
        { text: txt('helpStackStep5'), tex: txt('helpStackStep5Tex') },
        { text: txt('helpStackStep6'), tex: txt('helpStackStep6Tex') },
        { text: txt('helpStackStep7') },
      ],
      example(ctx) {
        const { r, mine } = radiusFor(ctx);
        const h = 2 * r * M.LAYER_RISE, a = 2 * r, c = 2 * h, ac = 2 * Math.SQRT2 * r;
        const apfHex = apf(2, r, (Math.sqrt(3) / 2) * a * a * c), apfCubic = apf(4, r, ac ** 3);
        return {
          title: txt('helpStackExTitle', { r: tn(r) }),
          intro: txt(mine ? 'helpStackExIntroShown' : 'helpStackExIntro', { r: tn(r) }),
          steps: [
            { text: txt('helpStackEx1'), tex: txt('helpStackEx1Tex', { r: tn(r), h: tn(h) }) },
            { text: txt('helpStackEx2'), tex: txt('helpStackEx2Tex', { a: tn(a), c: tn(c), apfHex: tn(apfHex) }) },
            { text: txt('helpStackEx3'), tex: txt('helpStackEx3Tex', { ac: tn(ac), d: tn(ac / Math.sqrt(3)), apfCubic: tn(apfCubic) }) },
          ],
          result: txt('helpStackExResult', { h: tn(h), apf: tn(apfHex) }),
        };
      },
    },
    related: ['calc-packing', 'calc-nn', 'miller-bravais', 'interstitials'],
  },
];
