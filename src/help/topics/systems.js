/* =====================================================================
   Help topics: crystal systems, centring, the 14 Bravais lattices and the
   lattice parameters. The unit cell topics are in cell.js.

   Topic format (see src/help/index.js): text may hold inline maths as
   $…$ (rendered with KaTeX); `tex` fields are display formulas.
   ===================================================================== */
import * as M from '../../math/index.js';
import { SYSTEMS, CENTRING_INFO } from '../../data/systems.js';
import { BRAVAIS, findBravais } from '../../data/bravais.js';
import { SYSTEM_BLURBS } from '../content.js';
import { tn, tt, tVec, tPoint } from '../tex.js';
import { systemOf, centringOf, systemLabel, latticeName, paramsTex, allParamsTex } from '../context.js';
import { systemsGrid, centringGrid, bravaisTable, BRAVAIS_TABLE } from '../diagrams.js';
import { latticeVectors, centringPoints } from '../highlights.js';
import { txt } from '../../text.js';

const R = String.raw;

/** The rule of a crystal system as TeX. */
const RULE_TEX = {
  cubic: txt('helpRuleCubic'),
  tetragonal: txt('helpRuleTetragonal'),
  orthorhombic: txt('helpRuleOrthorhombic'),
  hexagonal: txt('helpRuleHexagonal'),
  rhombohedral: txt('helpRuleRhombohedral'),
  monoclinic: txt('helpRuleMonoclinic'),
  triclinic: txt('helpRuleTriclinic'),
};

export const PARAM_SYMBOLS = [
  [txt('helpParamSymLengthsTex'), txt('helpParamSymLengths')],
  [txt('helpParamSymAnglesTex'), txt('helpParamSymAngles')],
];

export default [
  /* ---------------------------------------------------------------- */
  {
    key: 'crystal-systems',
    title: txt('helpCrystalSystemsTitle'),
    icon: 'cube',
    explain: txt('helpCrystalSystemsExplain'),
    // arg: a crystal system chosen in the lattice picker; otherwise the system on screen
    formulas: (ctx, item, arg) => {
      const sys = RULE_TEX[arg] ? arg : systemOf(ctx);
      return [{ tag: sys === systemOf(ctx) ? txt('helpCrystalSystemsFormula1Tag', { label: SYSTEMS[sys].label }) : SYSTEMS[sys].label, tex: RULE_TEX[sys] }];
    },
    symbols: PARAM_SYMBOLS,
    now: (ctx, item, arg) => { const sys = RULE_TEX[arg] ? arg : systemOf(ctx); return txt('helpCrystalSystemsNow', { label: SYSTEMS[sys].label, sYSTEMBLURBS: SYSTEM_BLURBS[sys] }); },
    more: {
      steps: [
        { text: txt('helpCrystalSystemsStep1'), tex: txt('helpCrystalSystemsStep1Tex') },
        { text: txt('helpCrystalSystemsStep2'), tex: txt('helpCrystalSystemsStep2Tex') },
        { text: txt('helpCrystalSystemsStep3'), tex: txt('helpCrystalSystemsStep3Tex') },
        { text: txt('helpCrystalSystemsStep4'), tex: txt('helpCrystalSystemsStep4Tex') },
        { text: txt('helpCrystalSystemsStep5') },
        { text: txt('helpCrystalSystemsStep6') },
        { text: txt('helpCrystalSystemsStep7') },
      ],
      diagram: systemsGrid,
      example(ctx) {
        const p = ctx.params, sys = systemOf(ctx);
        return {
          title: txt('helpCrystalSystemsExTitle', { lattice: latticeName(ctx) }),
          steps: [
            { text: txt('helpCrystalSystemsEx1'), tex: txt('helpCrystalSystemsEx1Tex', { a: tn(p.a), b: tn(p.b), c: tn(p.c) }) },
            { text: txt('helpCrystalSystemsEx2'), tex: txt('helpCrystalSystemsEx2Tex', { alpha: tn(p.alpha), beta: tn(p.beta), gamma: tn(p.gamma) }) },
            { text: txt('helpCrystalSystemsEx3', { system: SYSTEMS[sys].label.toLowerCase() }), tex: RULE_TEX[sys] },
          ],
          result: txt('helpCrystalSystemsExResult', { label: SYSTEMS[sys].label, sYSTEMBLURBS: SYSTEM_BLURBS[sys] }),
        };
      },
    },
    related: ['centring', 'bravais', 'lattice-params'],
  },

  /* ---------------------------------------------------------------- */
  {
    key: 'centring',
    title: txt('helpCentringTitle'),
    icon: 'points',
    explain: txt('helpCentringExplain'),
    formulas: [
      { tag: txt('helpCentringFormula1Tag'), tex: txt('helpCentringFormula1') },
      { tag: txt('helpCentringFormula2Tag'), tex: txt('helpCentringFormula2') },
    ],
    symbols: [
      [txt('helpCentringSym1'), txt('helpCentringSym1Text')],
      [txt('helpCentringSym2'), txt('helpCentringSym2Text')],
      [txt('helpCentringSym3'), txt('helpCentringSym3Text')],
    ],
    now: ctx => txt(ctx.analysis.counts.total === 1 ? 'helpCentringNowOne' : 'helpCentringNow', { lattice: latticeName(ctx), centring: CENTRING_INFO[centringOf(ctx)].name.toLowerCase(), letter: centringOf(ctx), total: tt(ctx.analysis.counts.total) }),
    more: {
      steps: [
        { text: txt('helpCentringStep1'), tex: txt('helpCentringStep1Tex') },
        { text: txt('helpCentringStep2'), tex: txt('helpCentringStep2Tex') },
        { text: txt('helpCentringStep3'), tex: txt('helpCentringStep3Tex') },
        { text: txt('helpCentringStep4'), tex: txt('helpCentringStep4Tex') },
        { text: txt('helpCentringStep5'), tex: txt('helpCentringStep5Tex') },
        { text: txt('helpCentringStep6'), tex: txt('helpCentringStep6Tex') },
        { text: txt('helpCentringStep7'), tex: txt('helpCentringStep7Tex') },
      ],
      diagram: centringGrid,
      highlight: ctx => centringPoints(ctx),
      example(ctx) {
        const N = ctx.analysis.counts.total, V = ctx.lattice.volume, cen = centringOf(ctx);
        const extra = ctx.basis.filter(s => s.f.some(x => Math.abs(x) > 1e-6));
        return {
          title: latticeName(ctx),
          steps: [
            { text: txt(extra.length ? 'helpCentringEx1' : 'helpCentringEx1None', { cen, name: CENTRING_INFO[cen].name.toLowerCase() }), tex: extra.length ? extra.map(s => `\\mathbf t = ${tPoint(s.f)}`).join(R`,\quad `) : null },
            { text: txt('helpCentringEx2'), tex: txt('helpCentringEx2Tex', { count: extra.length, n: N }) },
            { text: txt('helpCentringEx3'), tex: txt('helpCentringEx3Tex', { volume: tn(V), primitive: tn(V / N) }) },
          ],
        };
      },
    },
    related: ['bravais', 'calc-points', 'crystal-systems'],
  },

  /* ---------------------------------------------------------------- */
  {
    key: 'bravais',
    title: txt('helpBravaisTitle'),
    icon: 'cube',
    explain: txt('helpBravaisExplain'),
    formulas: [{ tex: txt('helpBravaisFormula1') }],
    symbols: [
      [txt('helpBravaisSym1'), txt('helpBravaisSym1Text')],
      [txt('helpBravaisSym2'), txt('helpBravaisSym2Text')],
    ],
    now: ctx => txt('helpBravaisNow', { name: ctx.bravais.name, count: BRAVAIS.filter(b => b.system === ctx.bravais.system).length, system: SYSTEMS[ctx.bravais.system].label.toLowerCase() }),
    more: {
      steps: [
        { text: txt('helpBravaisStep1'), tex: txt('helpBravaisStep1Tex') },
        { text: txt('helpBravaisStep2'), tex: txt('helpBravaisStep2Tex') },
        { text: txt('helpBravaisStep3'), tex: txt('helpBravaisStep3Tex') },
        { text: txt('helpBravaisStep4'), tex: txt('helpBravaisStep4Tex') },
        { text: txt('helpBravaisStep5'), tex: txt('helpBravaisStep5Tex') },
        { text: txt('helpBravaisStep6'), tex: txt('helpBravaisStep6Tex') },
      ],
      diagram: bravaisTable,
      example(ctx) {
        const sys = ctx.bravais.system, row = BRAVAIS_TABLE[sys];
        const steps = ['P', 'C', 'I', 'F'].map(c => {
          const b = findBravais(row[c]);
          return { text: b ? txt(b.id === ctx.bravais.id ? 'helpBravaisEx1Current' : 'helpBravaisEx1', { name: b.name }) : txt('helpBravaisEx1Else', { label: SYSTEMS[sys].label, c, row: row[c] }) };
        });
        return { title: txt('helpBravaisExTitle', { label: SYSTEMS[sys].label }), intro: txt('helpBravaisExIntro', { system: SYSTEMS[sys].label.toLowerCase() }), steps };
      },
    },
    related: ['crystal-systems', 'centring'],
  },

  /* ---------------------------------------------------------------- */
  {
    key: 'lattice-params',
    title: txt('helpLatticeParamsTitle'),
    icon: 'axes',
    explain: txt('helpLatticeParamsExplain'),
    formulas: ctx => [
      { tag: txt('allLattices'), tex: txt('helpLatticeParamsFormula1') },
      { tag: systemLabel(ctx), tex: RULE_TEX[systemOf(ctx)] },
    ],
    symbols: [
      [txt('helpLatticeParamsSym1'), txt('helpLatticeParamsSym1Text')],
      ...PARAM_SYMBOLS,
      [txt('helpLatticeParamsSym3'), txt('helpLatticeParamsSym3Text')],
    ],
    now: ctx => txt('helpLatticeParamsNow', { paramsTex: paramsTex(ctx) }),
    more: {
      steps: [
        { text: txt('helpLatticeParamsStep1'), tex: txt('helpLatticeParamsStep1Tex') },
        { text: txt('helpLatticeParamsStep2'), tex: txt('helpLatticeParamsStep2Tex') },
        { text: txt('helpLatticeParamsStep3'), tex: txt('helpLatticeParamsStep3Tex') },
        { text: txt('helpLatticeParamsStep4'), tex: txt('helpLatticeParamsStep4Tex') },
        { text: txt('helpLatticeParamsStep5'), tex: txt('helpLatticeParamsStep5Tex') },
      ],
      highlight: ctx => latticeVectors(ctx),
      example(ctx) {
        const L = ctx.lattice;
        return {
          title: latticeName(ctx),
          steps: [
            { text: txt('helpLatticeParamsEx1'), tex: allParamsTex(ctx) },
            { text: txt('helpLatticeParamsEx2'), tex: txt('helpLatticeParamsEx2Tex', { aVector: tVec(L.vectors[0]), bVector: tVec(L.vectors[1]), cVector: tVec(L.vectors[2]) }) },
            { text: txt('helpLatticeParamsEx3'), tex: txt('helpLatticeParamsEx3Tex', { x: tn(L.vectors[2][0]), y: tn(L.vectors[2][1]), z: tn(L.vectors[2][2]), norm: tn(M.norm(L.vectors[2])) }) },
          ],
        };
      },
    },
    related: ['crystal-systems', 'calc-metric', 'calc-volume'],
  },
];
