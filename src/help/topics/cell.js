/* =====================================================================
   Help topics: the unit cell (volume, points per cell, metric tensor), how
   the lattice is drawn, the supercell and origin, hexagonal prism and
   rhombohedral axes. Crystal systems and Bravais lattices are in systems.js.

   Topic format (see src/help/index.js): text may hold inline maths as
   $…$ (rendered with KaTeX); `tex` fields are display formulas.
   ===================================================================== */
import * as M from '../../math/index.js';
import { findBravais } from '../../data/bravais.js';
import { tn, tt, tMat, tCoord } from '../tex.js';
import { cosd, systemOf, systemLabel, latticeName, allParamsTex } from '../context.js';
import { cellVolume, pointShares } from '../highlights.js';
import { PARAM_SYMBOLS } from './systems.js';
import { txt } from '../../text.js';

const R = String.raw;

/** A point count as TeX, e.g. "8\times \tfrac18 + 6\times \tfrac12" (c from M.pointCount). */
const countTex = c => c.groups.map(g => R`${g.count}\times ${tCoord(g.share)}`).join(' + ');

export default [
  /* ---------------------------------------------------------------- */
  {
    key: 'lattice-points',
    title: txt('latticePointsTitle'),
    icon: 'points',
    explain: txt('helpLatticePointsExplain'),
    formulas: [
      { tex: txt('helpLatticePointsFormula1') },
      { tex: txt('helpLatticePointsFormula2') },
    ],
    symbols: [
      [txt('helpLatticePointsSym1'), txt('helpLatticePointsSym1Text')],
      [txt('helpLatticePointsSym2'), txt('helpLatticePointsSym2Text')],
    ],
    now: ctx => txt('helpLatticePointsNow', { drawn: ctx.sites.length, total: tt(ctx.analysis.counts.total) }),
    related: ['centring', 'calc-points', 'display-mode'],
  },

  {
    key: 'display-mode',
    title: txt('helpDisplayModeTitle'),
    icon: 'spheres',
    explain: txt('helpDisplayModeExplain'),
    formulas: [{ tex: txt('helpDisplayModeFormula1') }],
    symbols: [
      [txt('helpDisplayModeSym1'), txt('helpDisplayModeSym1Text')],
      [txt('helpDisplayModeSym2'), txt('helpDisplayModeSym2Text')],
    ],
    now: ctx => txt('helpDisplayModeNow', { dnn: tn(ctx.analysis.neighbours.dnn), radius: tn(ctx.analysis.neighbours.dnn / 2) }),
    related: ['calc-nn', 'calc-packing', 'interstitials'],
  },

  {
    key: 'cut-spheres',
    title: txt('helpCutSpheresTitle'),
    icon: 'spheres',
    explain: txt('helpCutSpheresExplain'),
    formulas: [{ tex: txt('formulaPoints') }],
    symbols: [[txt('helpCutSpheresSym1'), txt('helpCutSpheresSym1Text')], [txt('helpCutSpheresSym2'), txt('helpCutSpheresSym2Text')]],
    now: ctx => {
      const c = M.pointCount(ctx.basis, ctx.unitRegion);
      return txt('helpCutSpheresNow', { count: countTex(c), total: tt(c.total) });
    },
    related: ['calc-points'],
  },

  {
    key: 'cell-edges',
    title: txt('helpCellEdgesTitle'),
    icon: 'cube',
    explain: txt('helpCellEdgesExplain'),
    formulas: [{ tex: txt('helpCellEdgesFormula1') }],
    symbols: [[txt('helpCellEdgesSym1'), txt('helpCellEdgesSym1Text')], [txt('helpCellEdgesSym2'), txt('helpCellEdgesSym2Text')]],
    now: ctx => txt('helpCellEdgesNow', { volume: tn(ctx.lattice.volume) }),
    related: ['calc-volume', 'supercell', 'lattice-params'],
  },

  {
    key: 'supercell',
    title: txt('cellsSupercell'),
    icon: 'supercell',
    explain: txt('helpSupercellExplain'),
    formulas: [
      { tex: txt('helpSupercellFormula1') },
      { tag: txt('helpSupercellFormula2Tag'), tex: txt('helpSupercellFormula2') },
      { tag: txt('helpSupercellFormula3Tag'), tex: txt('helpSupercellFormula3') },
    ],
    symbols: [[txt('helpSupercellSym1'), txt('helpSupercellSym1Text')], [txt('helpSupercellSym2'), txt('helpSupercellSym2Text')]],
    now: ctx => (ctx.isPrism
      ? txt('helpSupercellNow', { repeats: ctx.repeats.join(' × '), drawn: ctx.sites.length })
      : txt('helpSupercellNowElse', { repeats: ctx.repeats.join(' × '), drawn: ctx.sites.length })),
    related: ['origin', 'cell-edges'],
  },

  {
    key: 'origin',
    title: txt('cellsHighlightedCell'),
    icon: 'target',
    explain: txt('helpOriginExplain'),
    formulas: [
      { tex: txt('helpOriginFormula1') },
      { tag: txt('cellsPrism'), tex: txt('helpOriginFormula2') },
    ],
    symbols: [[txt('helpOriginSym1'), txt('helpOriginSym1Text')], [txt('helpOriginSym2'), txt('helpOriginSym2Text')], [txt('helpOriginSym3'), txt('helpOriginSym3Text')]],
    now: ctx => (ctx.isPrism ? txt('helpOriginNow', { cell: ctx.cell.join(",") }) : txt('helpOriginNowElse', { cell: ctx.cell.join(','), origin: ctx.origin.join(', ') })),
    related: ['direction', 'plane', 'intercepts'],
  },

  /* ---------------------------------------------------------------- */
  {
    key: 'calc-volume',
    title: txt('calcVolume'),
    icon: 'volume',
    scope: txt('helpVolumeScope'),
    explain: txt('helpVolumeExplain'),
    formulas: ctx => [
      { tag: txt('allLattices'), tex: txt('formulaVolGeneral') },
      VOLUME_TEX[systemOf(ctx)] ? { tag: txt('helpVolumeFormula2Tag', { system: systemLabel(ctx) }), tex: VOLUME_TEX[systemOf(ctx)] } : null,
    ],
    symbols: [...PARAM_SYMBOLS, [txt('helpVolumeSym2'), txt('helpVolumeSym2Text')]],
    now: ctx => txt('helpVolumeNow', { volume: tn(ctx.lattice.volume) }),
    more: {
      steps: [
        { text: txt('helpVolumeStep1'), tex: txt('helpVolumeStep1Tex') },
        { text: txt('helpVolumeStep2'), tex: txt('helpVolumeStep2Tex') },
        { text: txt('helpVolumeStep3'), tex: txt('helpVolumeStep3Tex') },
        { text: txt('helpVolumeStep4'), tex: txt('helpVolumeStep4Tex') },
        { text: txt('helpVolumeStep5'), tex: txt('helpVolumeStep5Tex') },
        { text: txt('helpVolumeStep6'), tex: txt('formulaVolRhombohedral') },
      ],
      highlight: ctx => cellVolume(ctx),
      example(ctx) {
        const p = ctx.params, [ca, cb, cg] = [p.alpha, p.beta, p.gamma].map(cosd);
        const root = 1 - ca * ca - cb * cb - cg * cg + 2 * ca * cb * cg;
        const steps = [
          { text: txt('helpVolumeEx1'), tex: allParamsTex(ctx) },
          { text: txt('helpVolumeEx2'), tex: txt('helpVolumeEx2Tex', { ca: tn(ca), cb: tn(cb), cg: tn(cg) }) },
          { text: txt('helpVolumeEx3'), tex: txt('helpVolumeEx3Tex', { ca: tn(ca), cb: tn(cb), cg: tn(cg), root: tn(root) }) },
          { text: txt('helpVolumeEx4'), tex: txt('helpVolumeEx4Tex', { a: tn(p.a), b: tn(p.b), c: tn(p.c), root: tn(root), volume: tn(ctx.lattice.volume) }) },
        ];
        if (ctx.isPrism) steps.push({ text: txt('helpVolumeEx5'), tex: txt('helpVolumeEx5Tex', { prism: tn(3 * ctx.lattice.volume) }) });
        return { title: latticeName(ctx), steps };
      },
    },
    related: ['calc-metric', 'lattice-params', 'calc-packing'],
  },

  /* ---------------------------------------------------------------- */
  {
    key: 'calc-points',
    title: txt('helpPointsTitle'),
    icon: 'count',
    explain: txt('helpPointsExplain'),
    formulas: [
      { tag: txt('formulaTagParallelepiped'), tex: txt('helpPointsFormula1') },
      { tag: txt('cellsPrism'), tex: txt('helpPointsFormula2') },
    ],
    symbols: [
      [txt('helpPointsSym1'), txt('helpPointsSym1Text')],
      [txt('helpPointsSym2'), txt('helpPointsSym2Text')],
    ],
    now: ctx => {
      const c = M.pointCount(ctx.basis, ctx.unitRegion);
      return txt('helpPointsNow', { count: countTex(c), total: tt(c.total) });
    },
    more: {
      steps: [
        { text: txt('helpPointsStep1'), tex: txt('helpPointsStep1Tex') },
        { text: txt('helpPointsStep2'), tex: txt('formulaPoints') },
        { text: txt('helpPointsStep3'), tex: txt('helpPointsStep3Tex') },
        { text: txt('helpPointsStep4') },
        { text: txt('helpPointsStep5'), tex: txt('helpPointsStep5Tex') },
        { text: txt('helpPointsStep6'), tex: txt('helpPointsStep6Tex') },
      ],
      highlight: ctx => pointShares(ctx),
      example(ctx) {
        const c = M.pointCount(ctx.basis, ctx.unitRegion);
        const where = s => (Math.abs(s - 1) < 1e-6 ? txt('helpPointsInside')
          : Math.abs(s - 1 / 6) < 1e-6 ? txt('helpPointsPrismCorners')
            : txt('helpPointsShare', {
              place: { 0.125: txt('helpPointsOnCorners'), 0.25: txt('helpPointsOnEdges'), 0.5: txt('helpPointsOnFaces') }[Math.round(s * 1000) / 1000] || txt('helpPointsOnBoundary'),
              share: s === 0.5 ? '½' : s === 0.25 ? '¼' : s === 0.125 ? '⅛' : tt(s, 3),
            }));
        return {
          title: ctx.isPrism ? txt('helpPointsExTitlePrism', { lattice: latticeName(ctx) }) : latticeName(ctx),
          steps: [
            ...c.groups.map(g => ({ text: txt(g.count === 1 ? 'helpPointsEx1One' : 'helpPointsEx1', { count: g.count, where: where(g.share) }), tex: txt('helpPointsEx1Tex', { count: g.count, share: tCoord(g.share), result: tt(g.count * g.share, 3) }) })),
            { text: txt('helpPointsEx2'), tex: txt('helpPointsEx2Tex', { count: countTex(c), total: tt(c.total, 3) }) },
          ],
          result: txt('helpPointsExResult'),
        };
      },
    },
    related: ['centring', 'cut-spheres', 'calc-packing'],
  },

  /* ---------------------------------------------------------------- */
  {
    key: 'calc-metric',
    title: txt('calcMetricMenu'),
    icon: 'matrix',
    explain: txt('helpMetricExplain'),
    formulas: [
      { tex: txt('helpMetricFormula1') },
      { tex: txt('helpMetricFormula2') },
    ],
    symbols: [
      [txt('helpMetricSym1'), txt('helpMetricSym1Text')],
      [txt('helpMetricSym2'), txt('helpMetricSym2Text')],
      [txt('helpMetricSym3'), txt('helpMetricSym3Text')],
    ],
    more: {
      steps: [
        { text: txt('helpMetricStep1'), tex: txt('helpMetricStep1Tex') },
        { text: txt('helpMetricStep2'), tex: txt('helpMetricStep2Tex') },
        { text: txt('helpMetricStep3'), tex: txt('helpMetricStep3Tex') },
        { text: txt('helpMetricStep4'), tex: txt('helpMetricStep4Tex') },
        { text: txt('helpMetricStep5'), tex: txt('helpMetricStep5Tex') },
      ],
      example(ctx) {
        const L = ctx.lattice, u = [1, 1, 0];
        return {
          title: latticeName(ctx),
          steps: [
            { text: txt('helpMetricEx1'), tex: txt('helpMetricEx1Tex', { matrix: tMat(L.G) }) },
            { text: txt('helpMetricEx2'), tex: txt('helpMetricEx2Tex', { matrix: tMat(L.Gstar) }) },
            { text: txt('helpMetricEx3'), tex: txt('helpMetricEx3Tex', { detG: tn(L.volume ** 2), volume: tn(L.volume) }) },
            { text: txt('helpMetricEx4'), tex: txt('helpMetricEx4Tex', { g11: tn(L.G[0][0]), g12: tn(L.G[0][1]), g22: tn(L.G[1][1]), length: tn(L.length(u)) }) },
          ],
        };
      },
    },
    related: ['calc-angle', 'calc-dspacing', 'calc-volume'],
  },

  /* ---------------------------------------------------------------- */
  {
    key: 'hex-prism',
    title: txt('cellsPrism'),
    icon: 'cube',
    scope: txt('helpHexPrismScope'),
    explain: txt('helpHexPrismExplain'),
    formulas: [
      { tex: txt('helpHexPrismFormula1') },
      { tex: txt('helpHexPrismFormula2') },
    ],
    symbols: [[txt('helpHexPrismSym1'), txt('helpHexPrismSym1Text')], [txt('helpHexPrismSym2'), txt('helpHexPrismSym2Text')]],
    more: {
      steps: [
        { text: txt('helpHexPrismStep1'), tex: txt('helpHexPrismStep1Tex') },
        { text: txt('helpHexPrismStep2'), tex: txt('helpHexPrismStep2Tex') },
        { text: txt('helpHexPrismStep3'), tex: txt('helpHexPrismStep3Tex') },
        { text: txt('helpHexPrismStep4'), tex: txt('helpHexPrismStep4Tex') },
        { text: txt('helpHexPrismStep5'), tex: txt('helpHexPrismStep5Tex') },
      ],
      highlight: ctx => (ctx.isPrism ? pointShares(ctx) : { unavailable: txt('helpHexPrismHighlight') }),
      example(ctx) {
        const p = ctx.hexAxes ? ctx.params : findBravais('hP').params;
        const V = Math.sqrt(3) / 2 * p.a * p.a * p.c;
        return {
          title: ctx.hexAxes ? latticeName(ctx) : txt('helpHexPrismExTitleElse', { a: tt(p.a), c: tt(p.c) }),
          intro: ctx.hexAxes ? '' : txt('helpHexPrismExIntroElse'),
          steps: [
            { text: txt('helpHexPrismEx1'), tex: txt('helpHexPrismEx1Tex', { a: tn(p.a), c: tn(p.c), volume: tn(V) }) },
            { text: txt('helpHexPrismEx2'), tex: txt('helpHexPrismEx2Tex', { vPrism: tn(3 * V) }) },
            { text: txt('helpHexPrismEx3'), tex: txt('helpHexPrismEx3Tex') },
          ],
        };
      },
    },
    related: ['miller-bravais', 'calc-points'],
  },

  {
    key: 'rhombohedral-setting',
    title: txt('helpRhombohedralSettingTitle'),
    icon: 'cube',
    scope: txt('helpRhombohedralSettingScope'),
    explain: txt('helpRhombohedralSettingExplain'),
    formulas: [
      { tex: txt('helpRhombohedralSettingFormula1') },
      { tex: txt('helpRhombohedralSettingFormula2') },
    ],
    symbols: [[txt('helpRhombohedralSettingSym1'), txt('helpRhombohedralSettingSym1Text')], [txt('helpRhombohedralSettingSym2'), txt('helpRhombohedralSettingSym2Text')]],
    more: {
      steps: [
        { text: txt('helpRhombohedralSettingStep1'), tex: txt('helpRhombohedralSettingStep1Tex') },
        { text: txt('helpRhombohedralSettingStep2'), tex: txt('helpRhombohedralSettingStep2Tex') },
        { text: txt('helpRhombohedralSettingStep3'), tex: txt('helpRhombohedralSettingStep3Tex') },
        { text: txt('helpRhombohedralSettingStep4'), tex: txt('helpRhombohedralSettingStep4Tex') },
      ],
      example(ctx) {
        const hR = ctx.bravais.id === 'hR';
        const rp = hR ? (ctx.setting === 'hexagonal' ? M.hexagonalToRhombohedral(ctx.params) : ctx.params) : findBravais('hR').params;
        const hp = M.rhombohedralToHexagonal(rp);
        const VR = new M.Lattice(rp).volume;
        return {
          title: txt('helpRhombohedralSettingExTitle', { a: tt(rp.a), alpha: tt(rp.alpha, 2) }),
          intro: hR ? '' : txt('helpRhombohedralSettingExIntroElse'),
          steps: [
            { tex: txt('helpRhombohedralSettingEx1Tex', { a: tn(rp.a), alpha: tn(rp.alpha / 2), aH: tn(hp.a) }) },
            { tex: txt('helpRhombohedralSettingEx2Tex', { a: tn(rp.a), alpha: tn(rp.alpha), c: tn(hp.c) }) },
            { text: txt('helpRhombohedralSettingEx3'), tex: txt('helpRhombohedralSettingEx3Tex', { vR: tn(VR), vH: tn(Math.sqrt(3) / 2 * hp.a * hp.a * hp.c) }) },
          ],
        };
      },
    },
    related: ['centring', 'hex-prism'],
  },
];

/** Volume in the special form of each system (TeX). */
const VOLUME_TEX = {
  cubic: txt('formulaVolCubic'),
  tetragonal: txt('formulaVolTetragonal'),
  orthorhombic: txt('formulaVolOrthorhombic'),
  hexagonal: txt('helpVolumeHexagonal'),
  rhombohedral: txt('formulaVolRhombohedral'),
  monoclinic: txt('formulaVolMonoclinic'),
  triclinic: null,
};
