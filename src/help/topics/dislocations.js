/* =====================================================================
   Help topics of Defects mode: edge and screw dislocations, the Burgers
   circuit and vector, and glide. Each SEE MORE ends with the
   approximations the drawing makes (isotropic elasticity, no core, no
   free surfaces, simple cubic).
   ===================================================================== */
import * as M from '../../math/index.js';
import { tn } from '../tex.js';
import { latticeName } from '../context.js';
import { edgeDiagram, screwDiagram, burgersDiagram, glideDiagram } from '../diagrams-defects.js';
import { defectOf } from './defects.js';
import { getType } from '../../objects/registry.js';
import { txt } from '../../text.js';

/** |b| for the lattice on screen (b = a⟨100⟩ in cubic P) and the dislocation's own ν. */
const bOf = (ctx, D) => ({ b: ctx.params.a * (D ? D.mag / 100 : 1), nu: D ? D.nu : M.NU });

const APPROX = () => [{ text: txt('helpDislApprox1') }, { text: txt('helpDislApprox2') }, { text: txt('helpDislApprox3') }];

/** The circuit of a Burgers circuit item (the type works it out; see objects/burgers.js). */
const circuitOf = (item, ctx) => getType('burgers').circuit(item, ctx);

const ignoreCubic = ctx => (ctx.bravais.id === 'cP' ? '' : txt('helpDislNotCP', { lattice: latticeName(ctx) }));

export default [
  {
    key: 'edge-dislocation',
    title: txt('dislEdgeTitle'),
    icon: 'edge',
    scope: txt('helpScopeDisl'),
    explain: txt('helpEdgeExplain'),
    formulas: [{ tex: txt('formulaEdgeUx') }, { tex: txt('formulaEdgeUy') }, { tex: txt('helpEdgeDilatation'), tag: txt('helpEdgeDilatationTag') }],
    symbols: [
      [txt('helpDislSymB'), txt('helpDislSymBText')], [txt('helpDislSymXY'), txt('helpEdgeSymXYText')], [txt('helpDislSymTheta'), txt('helpDislSymThetaText')],
      [txt('helpDislSymNu'), txt('helpDislSymNuText')], [txt('helpEdgeSymDelta'), txt('helpEdgeSymDeltaText')],
    ],
    now(ctx, item) {
      const D = defectOf(ctx, item, ['edge']);
      return D ? txt('helpEdgeNow', { name: D.name, b: tn(bOf(ctx, D).b) }) : txt('helpEdgeNowNone');
    },
    more: {
      steps: [
        { text: txt('helpEdgeStep1') },
        { text: txt('helpEdgeStep2') },
        { text: txt('helpEdgeStep3'), tex: txt('formulaEdgeUx') },
        { text: txt('helpEdgeStep4'), tex: txt('helpEdgeDilatation') },
        { text: txt('helpEdgeStep5'), tex: txt('helpDislEnergy') },
        ...APPROX(),
      ],
      diagram: () => edgeDiagram(),
      example(ctx, item) {
        const D = defectOf(ctx, item, ['edge']), { b, nu } = bOf(ctx, D);
        const squeeze = r => (b / (2 * Math.PI)) * ((1 - 2 * nu) / (1 - nu)) / r;
        return {
          title: latticeName(ctx),
          intro: [D ? txt('helpExFor', { name: D.name }) : txt('helpDislExDefault'), ignoreCubic(ctx)].filter(Boolean).join(' '),
          steps: [
            { text: txt('helpEdgeEx1'), tex: txt('helpEdgeEx1Tex', { b: tn(b), nu: tn(nu, 2) }) },
            { text: txt('helpEdgeEx2'), tex: txt('helpEdgeEx2Tex', { r: tn(2 * b), d: tn(100 * squeeze(2 * b), 2) }) },
            { text: txt('helpEdgeEx3'), tex: txt('helpEdgeEx2Tex', { r: tn(5 * b), d: tn(100 * squeeze(5 * b), 2) }) },
            { text: txt('helpEdgeEx4'), tex: txt('helpEdgeEx4Tex', { b2: tn(b * b, 3) }) },
          ],
          result: txt('helpEdgeExResult'),
        };
      },
    },
    related: ['burgers', 'glide', 'screw-dislocation', 'relaxation'],
  },
  {
    key: 'screw-dislocation',
    title: txt('dislScrewTitle'),
    icon: 'screw',
    scope: txt('helpScopeDisl'),
    explain: txt('helpScrewExplain'),
    formulas: [{ tex: txt('formulaScrew') }, { tex: txt('helpScrewStrain') }],
    symbols: [
      [txt('helpDislSymB'), txt('helpDislSymBText')], [txt('helpDislSymTheta'), txt('helpDislSymThetaText')],
      [txt('helpScrewSymR'), txt('helpScrewSymRText')], [txt('helpScrewSymGamma'), txt('helpScrewSymGammaText')],
    ],
    now(ctx, item) {
      const D = defectOf(ctx, item, ['screw']);
      return D ? txt('helpScrewNow', { name: D.name, b: tn(bOf(ctx, D).b) }) : txt('helpScrewNowNone');
    },
    more: {
      steps: [
        { text: txt('helpScrewStep1') },
        { text: txt('helpScrewStep2'), tex: txt('formulaScrew') },
        { text: txt('helpScrewStep3'), tex: txt('helpScrewStrain') },
        { text: txt('helpScrewStep4') },
        ...APPROX(),
      ],
      diagram: () => screwDiagram(),
      example(ctx, item) {
        const D = defectOf(ctx, item, ['screw']), { b } = bOf(ctx, D);
        return {
          title: latticeName(ctx),
          intro: [D ? txt('helpExFor', { name: D.name }) : txt('helpDislExDefault'), ignoreCubic(ctx)].filter(Boolean).join(' '),
          steps: [
            { text: txt('helpScrewEx1'), tex: txt('helpScrewEx1Tex', { b: tn(b), q: tn(b / 4) }) },
            { text: txt('helpScrewEx2'), tex: txt('helpScrewEx2Tex', { r: tn(2 * b), g: tn(100 / (4 * Math.PI), 2) }) },
          ],
          result: txt('helpScrewExResult'),
        };
      },
    },
    related: ['burgers', 'glide', 'edge-dislocation'],
  },
  {
    key: 'burgers',
    title: txt('helpBcTitle'),
    icon: 'circuit',
    scope: txt('helpScopeDisl'),
    explain: txt('helpBcExplain'),
    formulas: [{ tex: txt('formulaBurgers') }, { tex: txt('helpBcFormulaKind') }],
    symbols: [[txt('helpBcSymSF'), txt('helpBcSymSFText')], [txt('helpDislSymB'), txt('helpDislSymBText')], [txt('helpBcSymXi'), txt('helpBcSymXiText')]],
    now(ctx, item) {
      const c = defectOf(ctx, item, ['burgers']);
      if (!c) return txt('helpBcNowNone');
      const K = circuitOf(c, ctx);
      if (K.error || K.walk.out) return K.error || txt('bcRanOutShort');
      if (K.closure.every(v => Math.abs(v) < 1e-6)) return txt('helpBcNowCloses', { name: c.name });
      return txt('helpBcNowFails', { name: c.name, b: K.closure.map(v => Math.round(v)).join(' ') });
    },
    more: {
      steps: [
        { text: txt('helpBcStep1') },
        { text: txt('helpBcStep2') },
        { text: txt('helpBcStep3'), tex: txt('formulaBurgers') },
        { text: txt('helpBcStep4'), tex: txt('helpBcFormulaKind') },
        { text: txt('helpBcStep5') },
        { text: txt('helpBcStep6') },
      ],
      diagram: () => burgersDiagram(),
      example(ctx, item) {
        const c = defectOf(ctx, item, ['burgers']), K = c ? circuitOf(c, ctx) : null;
        if (!K || K.error || K.walk.out) {
          return {
            title: latticeName(ctx), intro: K && K.error ? K.error : txt('helpBcExDefault'),
            steps: [{ text: txt('helpBcEx1'), tex: txt('helpBcEx1Tex', { a: tn(ctx.params.a) }) }],
          };
        }
        const len = M.norm(K.closure) * ctx.params.a, screw = Math.abs(K.closure[K.frame[2]]) > 1e-6;
        return {
          title: latticeName(ctx),
          intro: txt('helpExFor', { name: c.name }),
          steps: [
            { text: txt('helpBcEx2', { n: c.size, total: K.steps.length }) },
            { text: txt('helpBcEx3'), tex: txt('helpBcEx3Tex', { b: K.closure.map(v => Math.round(v)).join('\\,'), len: tn(len) }) },
            { text: txt(len < 1e-9 ? 'helpBcEx4None' : screw ? 'helpBcEx4Screw' : 'helpBcEx4Edge') },
          ],
          result: txt('helpBcExResult'),
        };
      },
    },
    related: ['edge-dislocation', 'screw-dislocation', 'glide'],
  },
  {
    key: 'glide',
    title: txt('helpGlideTitle'),
    icon: 'play',
    scope: txt('helpScopeDisl'),
    explain: txt('helpGlideExplain'),
    formulas: [{ tex: txt('helpGlideFormula'), tag: txt('helpGlideFormulaTag') }],
    symbols: [[txt('helpGlideSymTau'), txt('helpGlideSymTauText')], [txt('helpGlideSymG'), txt('helpGlideSymGText')]],
    now: (ctx, item) => (defectOf(ctx, item, ['edge', 'screw']) ? txt('helpGlideNow') : txt('helpEdgeNowNone')),
    more: {
      steps: [
        { text: txt('helpGlideStep1') },
        { text: txt('helpGlideStep2'), tex: txt('helpGlideFormula') },
        { text: txt('helpGlideStep3') },
        { text: txt('helpGlideStep4') },
        { text: txt('helpGlideStep5') },
      ],
      diagram: () => glideDiagram(),
      example(ctx, item) {
        const D = defectOf(ctx, item, ['edge', 'screw']), { b } = bOf(ctx, D);
        return {
          title: latticeName(ctx),
          steps: [
            { text: txt('helpGlideEx1'), tex: txt('helpGlideEx1Tex', { b: tn(b) }) },
            { text: txt('helpGlideEx2'), tex: txt('helpGlideEx2Tex') },
          ],
          result: txt('helpGlideExResult'),
        };
      },
    },
    related: ['edge-dislocation', 'screw-dislocation', 'burgers'],
  },
];
