/* =====================================================================
   Help topics of Defects mode: the point defects, how the app moves
   their neighbours (relaxation), the vacancy concentration and the 2D
   slice. The dislocations and the Burgers vector are in dislocations.js.
   Worked examples use the defect whose "?" was pressed, else the first
   of its kind in the scene, else a defect in the middle of the block.
   ===================================================================== */
import * as M from '../../math/index.js';
import { tn, tSci } from '../tex.js';
import { latticeName } from '../context.js';
import { pointDefectDiagram, vacancyGraph } from '../diagrams-defects.js';
import { txt } from '../../text.js';

const R0 = ctx => ctx.analysis.neighbours.dnn / 2;

/** The defect a topic is about: the one pressed, else the first of these types in the scene. */
export const defectOf = (ctx, item, types) => (item && types.includes(item.type) ? item : (ctx.ws.state.items || []).find(i => types.includes(i.type)) || null);

/** The first interstitial site of the lattice on screen, or the cubic F octahedral site of a textbook a = 4 Å crystal. */
function siteFor(ctx, kind) {
  const sites = M.sceneSites(ctx);
  if (sites) return sites.find(s => s.kind === kind) || sites[0];
  return { kind: 'oct', d: 2, R: Math.SQRT2, cn: 6, ratio: Math.SQRT2 - 1 };
}

/** Host radius and nearest-neighbour distance on screen (any lattice). */
const hostOf = ctx => ({ R: R0(ctx), dnn: ctx.analysis.neighbours.dnn });

/** The second shell around a lattice point: its distance and the move u₁ (r₁/r₂)². */
function secondShell(ctx, u1, r1) {
  const hosts = M.hostsAround(ctx.lattice, ctx.basis, [0, 0, 0], { n: 40 });
  const r2 = hosts.find(h => h.d > r1 * 1.01);
  return r2 ? { r2: r2.d, u2: u1 * (r1 / r2.d) ** 2 } : null;
}

const RELAX_FORMULAS = [{ tex: txt('formulaRelax') }, { tex: txt('formulaRelaxDelta') }];
const RELAX_SYMBOLS = [
  [txt('helpRelaxSymU'), txt('helpRelaxSymUText')], [txt('helpRelaxSymR1'), txt('helpRelaxSymR1Text')],
  [txt('helpRelaxSymS'), txt('helpRelaxSymSText')], [txt('helpRelaxSymDelta'), txt('helpRelaxSymDeltaText')],
];

/** A worked example for a defect atom of radius r whose nearest hosts are d away; a vacancy has no atom, and an atom in a site never pulls them in (site). */
function relaxExample(ctx, { title, intro, r, d, strength, vacancy = false, site = false }) {
  const { R } = hostOf(ctx), s = strength / 100;
  const delta = vacancy ? M.VACANCY_MISFIT(R) : M.misfit(r, R, d), u1 = s * (site ? Math.max(0, delta) : delta);
  const shell = secondShell(ctx, u1, d);
  return {
    title, intro,
    steps: [
      { text: txt('helpRelaxEx1'), tex: txt('helpRelaxEx1Tex', { R: tn(R), d: tn(d) }) },
      vacancy
        ? { text: txt('helpRelaxEx2Vac'), tex: txt('helpRelaxEx2VacTex', { R: tn(R), delta: tn(delta, 3) }) }
        : { text: txt('helpRelaxEx2'), tex: txt('helpRelaxEx2Tex', { r: tn(r), R: tn(R), d: tn(d), delta: tn(delta, 3) }) },
      { text: txt('helpRelaxEx3', { s: strength }), tex: txt('helpRelaxEx3Tex', { s: tn(s, 2), delta: tn(delta, 3), u1: tn(u1, 3), pct: tn(100 * Math.abs(u1) / d, 2) }) },
      ...(shell ? [{ text: txt('helpRelaxEx4'), tex: txt('helpRelaxEx4Tex', { u1: tn(u1, 3), r1: tn(d), r2: tn(shell.r2), u2: tn(shell.u2, 3) }) }] : []),
    ],
    result: txt(u1 < 0 ? 'helpRelaxExIn' : Math.abs(u1) < 1e-9 ? 'helpRelaxExNone' : 'helpRelaxExOut'),
  };
}

const POINT_RELATED = ['relaxation', 'vacancy', 'self-interstitial', 'substitutional', 'interstitial', 'frenkel', 'vacancy-conc'];
const related = key => POINT_RELATED.filter(k => k !== key);

export default [
  {
    key: 'vacancy',
    title: txt('pdTitleVacancy'),
    icon: 'void',
    scope: txt('helpScopeDefects'),
    explain: txt('helpVacExplain'),
    formulas: [{ tex: txt('formulaRelax') }, { tex: txt('formulaRelaxVacancy') }],
    symbols: RELAX_SYMBOLS,
    now(ctx, item) {
      const v = defectOf(ctx, item, ['vacancy']);
      return v ? txt('helpVacNow', { name: v.name, u: tn(v.strength / 1000 * R0(ctx), 3) }) : txt('helpVacNowNone');
    },
    more: {
      steps: [
        { text: txt('helpVacStep1') },
        { text: txt('helpVacStep2'), tex: txt('formulaRelaxVacancy') },
        { text: txt('helpVacStep3'), tex: txt('formulaRelax') },
        { text: txt('helpVacStep4') },
        { text: txt('helpVacStep5') },
      ],
      diagram: () => pointDefectDiagram('vacancy'),
      example(ctx, item) {
        const v = defectOf(ctx, item, ['vacancy']), { dnn } = hostOf(ctx);
        return relaxExample(ctx, { title: latticeName(ctx), intro: v ? txt('helpExFor', { name: v.name }) : txt('helpExDefault'), r: 0, d: dnn, strength: v ? v.strength : 50, vacancy: true });
      },
    },
    related: related('vacancy'),
  },
  {
    key: 'self-interstitial',
    title: txt('pdTitleSelf'),
    icon: 'fit',
    scope: txt('helpScopeDefects'),
    explain: txt('helpSelfExplain'),
    formulas: RELAX_FORMULAS,
    symbols: RELAX_SYMBOLS,
    now(ctx, item) {
      const d = defectOf(ctx, item, ['self-interstitial']), s = siteFor(ctx, d ? d.kind : 'oct');
      return txt('helpSelfNow', { lattice: latticeName(ctx), d: tn(s.d), R: tn(R0(ctx)), delta: tn(M.misfit(R0(ctx), R0(ctx), s.d), 3) });
    },
    more: {
      steps: [{ text: txt('helpSelfStep1') }, { text: txt('helpSelfStep2'), tex: txt('helpSelfStep2Tex') }, { text: txt('helpSelfStep3') }, { text: txt('helpSelfStep4') }],
      diagram: () => pointDefectDiagram('self-interstitial'),
      example(ctx, item) {
        const d = defectOf(ctx, item, ['self-interstitial']), s = siteFor(ctx, d ? d.kind : 'oct');
        return relaxExample(ctx, { title: latticeName(ctx), intro: d ? txt('helpExFor', { name: d.name }) : txt('helpExDefault'), r: R0(ctx), d: s.d, strength: d ? d.strength : 50, site: true });
      },
    },
    related: related('self-interstitial'),
  },
  {
    key: 'substitutional',
    title: txt('pdTitleSubstitutional'),
    icon: 'ions',
    scope: txt('helpScopeDefects'),
    explain: txt('helpSubExplain'),
    formulas: [{ tex: txt('formulaRelax') }, { tex: txt('helpSubFormula') }],
    symbols: RELAX_SYMBOLS,
    now(ctx, item) {
      const d = defectOf(ctx, item, ['substitutional']);
      if (!d) return txt('helpSubNowNone');
      const r = (d.size / 100) * R0(ctx);
      return txt(r >= R0(ctx) ? 'helpSubNowLarger' : 'helpSubNowSmaller', { name: d.name, ratio: tn(d.size / 100, 2), u: tn(Math.abs(d.strength / 100 * (r - R0(ctx))), 3) });
    },
    more: {
      steps: [{ text: txt('helpSubStep1') }, { text: txt('helpSubStep2'), tex: txt('helpSubFormula') }, { text: txt('helpSubStep3') }, { text: txt('helpSubStep4') }],
      diagram: () => pointDefectDiagram('substitutional'),
      example(ctx, item) {
        const d = defectOf(ctx, item, ['substitutional']), { R, dnn } = hostOf(ctx);
        return relaxExample(ctx, { title: latticeName(ctx), intro: d ? txt('helpExFor', { name: d.name }) : txt('helpSubExDefault'), r: (d ? d.size / 100 : 1.25) * R, d: dnn, strength: d ? d.strength : 50 });
      },
    },
    related: related('substitutional'),
  },
  {
    key: 'interstitial',
    title: txt('pdTitleInterstitial'),
    icon: 'fit',
    scope: txt('helpScopeDefects'),
    explain: txt('helpIntExplain'),
    formulas: RELAX_FORMULAS,
    symbols: RELAX_SYMBOLS,
    now(ctx, item) {
      const d = defectOf(ctx, item, ['interstitial']), s = siteFor(ctx, d ? d.kind : 'oct');
      return txt('helpIntNow', { lattice: latticeName(ctx), ratio: tn(s.ratio, 3), rmax: tn(s.ratio * R0(ctx)) });
    },
    more: {
      steps: [{ text: txt('helpIntStep1') }, { text: txt('helpIntStep2'), tex: txt('formulaRelaxDelta') }, { text: txt('helpIntStep3') }, { text: txt('helpIntStep4') }],
      diagram: () => pointDefectDiagram('interstitial'),
      example(ctx, item) {
        const d = defectOf(ctx, item, ['interstitial']), s = siteFor(ctx, d ? d.kind : 'oct'), R = R0(ctx);
        const r = (d ? d.size / 100 : 0.55) * R;
        const ex = relaxExample(ctx, { title: latticeName(ctx), intro: d ? txt('helpExFor', { name: d.name }) : txt('helpIntExDefault'), r, d: s.d, strength: d ? d.strength : 50, site: true });
        if (r <= s.d - R) ex.result = txt('helpIntExFits');
        return ex;
      },
    },
    related: [...related('interstitial'), 'interstitials'],
  },
  {
    key: 'frenkel',
    title: txt('pdTitleFrenkel'),
    icon: 'arrow',
    scope: txt('helpScopeDefects'),
    explain: txt('helpFrExplain'),
    formulas: [{ tex: txt('helpFrFormula') }],
    symbols: [[txt('helpFrSymN'), txt('helpFrSymNText')], [txt('helpFrSymV'), txt('helpFrSymVText')]],
    now(ctx, item) {
      const d = defectOf(ctx, item, ['frenkel']);
      return d ? txt('helpFrNow', { name: d.name, jump: tn(M.norm(M.sub(ctx.lattice.toCartesian(d.to), ctx.lattice.toCartesian(d.at)))) }) : txt('helpFrNowNone');
    },
    more: {
      steps: [{ text: txt('helpFrStep1') }, { text: txt('helpFrStep2'), tex: txt('helpFrFormula') }, { text: txt('helpFrStep3') }, { text: txt('helpFrStep4') }],
      diagram: () => pointDefectDiagram('frenkel'),
      example(ctx, item) {
        const d = defectOf(ctx, item, ['frenkel']), s = siteFor(ctx, d ? d.kind : 'oct'), { dnn } = hostOf(ctx);
        const jump = d ? M.norm(M.sub(ctx.lattice.toCartesian(d.to), ctx.lattice.toCartesian(d.at))) : s.d;
        return {
          title: latticeName(ctx),
          intro: d ? txt('helpExFor', { name: d.name }) : txt('helpExDefault'),
          steps: [
            { text: txt('helpFrEx1'), tex: txt('helpFrEx1Tex', { jump: tn(jump), dnn: tn(dnn) }) },
            { text: txt('helpFrEx2'), tex: txt('helpFrEx2Tex', { delta: tn(M.misfit(R0(ctx), R0(ctx), s.d), 3), vac: tn(M.VACANCY_MISFIT(R0(ctx)), 3) }) },
          ],
          result: txt('helpFrExResult'),
        };
      },
    },
    related: related('frenkel'),
  },
  {
    key: 'relaxation',
    title: txt('helpRelaxTitle'),
    icon: 'spheres',
    scope: txt('helpScopeDefects'),
    explain: txt('helpRelaxExplain'),
    formulas: [...RELAX_FORMULAS, { tex: txt('helpRelaxStrainFormula'), tag: txt('helpRelaxStrainTag') }],
    symbols: [...RELAX_SYMBOLS, [txt('helpRelaxSymEps'), txt('helpRelaxSymEpsText')]],
    now: () => txt('helpRelaxNow'),
    more: {
      steps: [
        { text: txt('helpRelaxStep1') },
        { text: txt('helpRelaxStep2'), tex: txt('formulaRelax') },
        { text: txt('helpRelaxStep3'), tex: txt('formulaRelaxDelta') },
        { text: txt('helpRelaxStep4') },
        { text: txt('helpRelaxStep5'), tex: txt('helpRelaxStrainFormula') },
        { text: txt('helpRelaxStep6') },
        { text: txt('helpRelaxStep7') },
      ],
      diagram: () => pointDefectDiagram('substitutional'),
    },
    related: ['vacancy', 'substitutional', 'interstitial', 'edge-dislocation'],
  },
  {
    key: 'vacancy-conc',
    title: txt('vcTitle'),
    icon: 'chart',
    scope: txt('helpScopeAll'),
    explain: txt('helpVcExplain'),
    formulas: [{ tex: txt('formulaVacancyConc') }, { tex: txt('helpVcFormulaN'), tag: txt('helpVcFormulaNTag') }],
    symbols: [
      [txt('helpVcSymNv'), txt('helpVcSymNvText')], [txt('helpVcSymN'), txt('helpVcSymNText')], [txt('helpVcSymQ'), txt('helpVcSymQText')],
      [txt('helpVcSymK'), txt('helpVcSymKText')], [txt('helpVcSymT'), txt('helpVcSymTText')],
    ],
    now(ctx, item) {
      const d = defectOf(ctx, item, ['vacancy-conc']);
      if (!d) return txt('helpVcNowNone');
      return txt('helpVcNow', { name: d.name, T: tn(d.T, 4), frac: tSci(M.vacancyFraction(d.T, d.Q)) });
    },
    more: {
      steps: [
        { text: txt('helpVcStep1') },
        { text: txt('helpVcStep2'), tex: txt('helpVcStep2Tex') },
        { text: txt('helpVcStep3'), tex: txt('helpVcStep3Tex') },
        { text: txt('helpVcStep4'), tex: txt('helpVcStep4Tex') },
        { text: txt('helpVcStep5'), tex: txt('formulaVacancyConc') },
        { text: txt('helpVcStep6'), tex: txt('helpVcStep6Tex') },
        { text: txt('helpVcStep7') },
      ],
      diagram(ctx, item) {
        const d = defectOf(ctx, item, ['vacancy-conc']);
        return vacancyGraph({ T: d ? d.T : 1273, Q: d ? d.Q : 0.9, mode: d ? d.plot : 'T' });
      },
      example(ctx, item) {
        const d = defectOf(ctx, item, ['vacancy-conc']), T = d ? d.T : 1273, Q = d ? d.Q : 0.9;
        const n = ctx.analysis.counts.total, a = ctx.params.a, N = M.atomsPerM3(n, a), frac = M.vacancyFraction(T, Q);
        const cu = M.vacancyFraction(1273, 0.9);
        return {
          title: latticeName(ctx),
          steps: [
            { text: txt('helpVcEx1'), tex: txt('helpVcEx1Tex', { frac: tSci(cu), nv: tSci(8.0e28 * cu, 2) }) },
            { text: txt('helpVcEx2', { lattice: latticeName(ctx) }), tex: txt('helpVcEx2Tex', { n, a: tn(a), N: tSci(N) }) },
            { text: txt('helpVcEx3'), tex: txt('helpVcEx3Tex', { Q: tn(Q, 3), T: tn(T, 4), kT: tn(M.K_EV * T, 4), frac: tSci(frac), Nv: tSci(N * frac) }) },
          ],
          result: txt('helpVcExResult', { one: tSci(1 / frac) }),
        };
      },
    },
    related: ['vacancy', 'frenkel'],
  },
  {
    key: 'defect-slice',
    title: txt('helpSliceTitle'),
    icon: 'layers',
    scope: txt('helpScopeDefects'),
    explain: txt('helpSliceExplain'),
    now: ctx => (ctx.slice ? txt('helpSliceNow', { axis: 'abc'[ctx.slice.axis], k: ctx.slice.index + 1, n: ctx.slice.count }) : txt('helpSliceNowOff')),
    related: ['edge-dislocation', 'burgers', 'vacancy'],
  },
];
