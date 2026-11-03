/* =====================================================================
   Help topics: packing fraction, nearest neighbours, interplanar
   distance, angles and Bragg's law.
   ===================================================================== */
import * as M from '../../math/index.js';
import { tn, tt, tIdxBare, tMat, tCol, DEG } from '../tex.js';
import { isCubic, systemOf, centringOf, latticeName, pickPlane, pickAnglePair, planeExample, planeNow } from '../context.js';
import { braggDiagram, spacingDiagram, angleDiagram } from '../diagrams.js';
import { touchingLine, neighbourBonds, spacingPair, angleObjects } from '../highlights.js';
import { idx } from '../../ui/format.js';
import { txt } from '../../text.js';

const col = v => tCol(v.map(x => `${x}`));

/** Special forms of 1/d² by crystal system (TeX). */
const DSPACING_TEX = {
  cubic: txt('helpSpacingTexCubic'),
  tetragonal: txt('helpSpacingTexTetragonal'),
  orthorhombic: txt('helpSpacingTexOrthorhombic'),
  hexagonal: txt('helpSpacingTexHexagonal'),
};

const SPACING = {
  icon: 'spacing',
  scope: txt('helpSpacingScope'),
  formulas: [
    { tag: txt('cubicOnly'), tex: txt('helpSpacingFormula1') },
    { tag: txt('allLattices'), tex: txt('helpSpacingFormula2') },
  ],
  symbols: [
    [txt('helpSpacingSym1'), txt('helpSpacingSym1Text')],
    [txt('helpSpacingSym2'), txt('helpSpacingSym2Text')],
    [txt('helpSpacingSym3'), txt('helpSpacingSym3Text')],
    [txt('helpSpacingSym4'), txt('helpSpacingSym4Text')],
  ],
  now: planeNow,
  more: {
    steps: [
      { text: txt('helpSpacingStep1'), tex: txt('helpSpacingStep1Tex') },
      { text: txt('helpSpacingStep2'), tex: txt('helpSpacingStep2Tex') },
      { text: txt('helpSpacingStep3'), tex: txt('helpSpacingStep3Tex') },
      { text: txt('helpSpacingStep4'), tex: txt('helpSpacingStep4Tex') },
      { text: txt('helpSpacingStep5'), tex: txt('helpSpacingStep5Tex') },
      { text: txt('helpSpacingStep6'), tex: txt('helpSpacingStep6Tex') },
      { text: txt('helpSpacingStep7'), tex: txt('helpSpacingStep7Tex') },
      { text: txt('helpSpacingStep8'), tex: txt('helpSpacingStep8Tex') },
      { text: txt('helpSpacingStep9') },
    ],
    diagram: spacingDiagram,
    highlight: (ctx, item) => spacingPair(ctx, pickPlane(ctx, item).hkl),
    example(ctx, item) {
      const p = pickPlane(ctx, item), hkl = p.hkl, L = ctx.lattice, [h, k, l] = hkl;
      const q = M.quadForm(hkl, L.Gstar, hkl), d = L.dSpacing(hkl);
      const steps = [];
      if (isCubic(ctx)) {
        steps.push({ text: txt('helpSpacingEx1'), tex: txt('helpSpacingEx1Tex', { hkl: tIdxBare(hkl), a: tn(ctx.params.a), h: h * h, k: k * k, l: l * l, h2: h * h + k * k + l * l, d: tn(d) }) });
        steps.push({ text: txt('helpSpacingEx2'), tex: txt('helpSpacingEx2Tex', { q: tn(q) }) });
      } else {
        steps.push({ text: txt('helpSpacingEx3'), tex: txt('helpSpacingEx3Tex', { matrix: tMat(L.Gstar) }) });
        steps.push({ text: txt('helpSpacingEx4'), tex: txt('helpSpacingEx4Tex', { hkl: hkl.join(' & '), column: col(hkl), q: tn(q) }) });
        steps.push({ tex: txt('helpSpacingEx5Tex', { hkl: tIdxBare(hkl), q: tn(q), d: tn(d) }) });
        if (DSPACING_TEX[systemOf(ctx)]) steps.push({ text: txt('helpSpacingEx6', { system: systemOf(ctx) }), tex: DSPACING_TEX[systemOf(ctx)] });
        steps.push({ text: txt('helpSpacingEx7') });
      }
      const sp = M.planeSpacings(L, hkl, ctx.basis);
      if (Math.abs(sp.dLattice - sp.dFormula) > 1e-9) steps.push({ text: txt('helpSpacingEx8', { centring: centringOf(ctx), eq: idx(sp.eq, 'plane') }), tex: txt('helpSpacingEx8Tex', { dLattice: tn(sp.dLattice) }) });
      return { ...planeExample(ctx, p), steps };
    },
  },
  related: ['plane', 'calc-metric', 'calc-bragg'],
};

export default [
  /* ---------------------------------------------------------------- */
  {
    key: 'calc-packing',
    title: txt('calcPacking'),
    icon: 'packing',
    scope: txt('helpPackingScope'),
    explain: txt('helpPackingExplain'),
    formulas: [
      { tag: txt('allLattices'), tex: txt('helpPackingFormula1') },
      { tag: txt('cubicOnly'), tex: txt('helpPackingFormula2') },
    ],
    symbols: [
      [txt('helpPackingSym1'), txt('helpPackingSym1Text')],
      [txt('helpPackingSym2'), txt('helpPackingSym2Text')],
      [txt('helpPackingSym3'), txt('helpPackingSym3Text')],
      [txt('helpPackingSym4'), txt('helpPackingSym4Text')],
    ],
    now: ctx => txt('helpPackingNow', { apf: tn(ctx.analysis.packing.value), percent: (100 * ctx.analysis.packing.value).toFixed(1) }),
    more: {
      steps: [
        { text: txt('helpPackingStep1'), tex: txt('helpPackingStep1Tex') },
        { text: txt('helpPackingStep2'), tex: txt('helpPackingStep2Tex') },
        { text: txt('helpPackingStep3'), tex: txt('helpPackingStep3Tex') },
        { text: txt('helpPackingStep4'), tex: txt('helpPackingStep4Tex') },
        { text: txt('helpPackingStep5'), tex: txt('helpPackingStep5Tex') },
        { text: txt('helpPackingStep6') },
      ],
      highlight: ctx => touchingLine(ctx),
      example(ctx) {
        const a = ctx.analysis, N = a.counts.total, r = a.packing.radius, V = ctx.lattice.volume;
        const steps = [
          { text: txt('helpPackingEx1'), tex: txt('helpPackingEx1Tex', { dnn: tn(a.neighbours.dnn), r: tn(r) }) },
        ];
        const line = touchingLine(ctx);
        if (line) steps.push({ text: txt('helpPackingEx2', { replace: line.relation.replace(/<\/?i>/g, '') }) });
        steps.push(
          { text: txt('helpPackingEx3'), tex: txt('helpPackingEx3Tex', { n: tt(N), r: tn(r), spheres: tn(N * 4 / 3 * Math.PI * r ** 3) }) },
          { text: txt('helpPackingEx4'), tex: txt('helpPackingEx4Tex', { spheres: tn(N * 4 / 3 * Math.PI * r ** 3), volume: tn(V), apf: tn(a.packing.value) }) },
        );
        return { title: latticeName(ctx), steps, result: txt('helpPackingExResult', { percent: (100 * a.packing.value).toFixed(1) }) };
      },
    },
    related: ['calc-nn', 'calc-points', 'calc-volume'],
  },

  /* ---------------------------------------------------------------- */
  {
    key: 'calc-nn',
    title: txt('helpNnTitle'),
    icon: 'neighbours',
    explain: txt('helpNnExplain'),
    formulas: [
      { tag: txt('allLattices'), tex: txt('formulaNN') },
      { tag: txt('cubicOnly'), tex: txt('helpNnFormula2') },
    ],
    symbols: [
      [txt('helpNnSym1'), txt('helpNnSym1Text')],
      [txt('helpNnSym2'), txt('helpNnSym2Text')],
      [txt('helpNnSym3'), txt('helpNnSym3Text')],
    ],
    now: ctx => txt('helpNnNow', { dnn: tn(ctx.analysis.neighbours.dnn), cn: ctx.analysis.neighbours.sites[0].cn }),
    more: {
      steps: [
        { text: txt('helpNnStep1'), tex: txt('helpNnStep1Tex') },
        { text: txt('helpNnStep2'), tex: txt('helpNnStep2Tex') },
        { text: txt('helpNnStep3') },
        { text: txt('helpNnStep4'), tex: txt('helpNnStep4Tex') },
        { text: txt('helpNnStep5'), tex: txt('helpNnStep5Tex') },
        { text: txt('helpNnStep6'), tex: txt('helpNnStep6Tex') },
        { text: txt('helpNnStep7') },
      ],
      highlight: ctx => neighbourBonds(ctx),
      example(ctx) {
        const L = ctx.lattice, shell = M.neighbourShell(L, ctx.basis, 0), nn = ctx.analysis.neighbours;
        const df = shell[0].df;
        return {
          title: latticeName(ctx),
          steps: [
            { text: txt('helpNnEx1'), tex: txt('helpNnEx1Tex', { df: df.map(x => tt(x, 3)).join(',\\ ') }) },
            { text: txt('helpNnEx2'), tex: txt('helpNnEx2Tex', { dnn: tn(nn.dnn) }) },
            { text: txt('helpNnEx3'), tex: txt('helpNnEx3Tex', { cn: shell.length }) },
            ...(nn.sites[0].subshells.length > 1 ? [{ text: txt('helpNnEx4', { shells: nn.sites[0].subshells.map(s => txt('countAtDistance', { count: s.count, d: tn(s.d) })).join(', ') }) }] : []),
          ],
        };
      },
    },
    related: ['display-mode', 'calc-packing', 'calc-metric'],
  },

  /* ---------------------------------------------------------------- */
  { key: 'calc-dspacing', title: txt('calcDSpacingMenu'), explain: txt('helpDspacingExplain'), ...SPACING },
  { key: 'spacing', title: txt('helpSpacingTitle'), explain: txt('helpSpacingExplain'), ...SPACING },

  /* ---------------------------------------------------------------- */
  {
    key: 'calc-angle',
    title: txt('helpAngleTitle'),
    icon: 'angle',
    scope: txt('helpAngleScope'),
    explain: txt('helpAngleExplain'),
    formulas: [
      { tag: txt('helpAngleFormula1Tag'), tex: txt('helpAngleFormula1') },
      { tag: txt('helpAngleFormula2Tag'), tex: txt('helpAngleFormula2') },
      { tag: txt('helpAngleFormula3Tag'), tex: txt('helpAngleFormula3') },
    ],
    symbols: [
      [txt('helpAngleSym1'), txt('helpAngleSym1Text')],
      [txt('helpAngleSym2'), txt('helpAngleSym2Text')],
      [txt('helpAngleSym3'), txt('helpAngleSym3Text')],
      [txt('helpAngleSym4'), txt('helpAngleSym4Text')],
    ],
    more: {
      steps: [
        { text: txt('helpAngleStep1'), tex: txt('helpAngleStep1Tex') },
        { text: txt('helpAngleStep2'), tex: txt('helpAngleStep2Tex') },
        { text: txt('helpAngleStep3'), tex: txt('helpAngleStep3Tex') },
        { text: txt('helpAngleStep4'), tex: txt('helpAngleStep4Tex') },
        { text: txt('helpAngleStep5'), tex: txt('helpAngleStep5Tex') },
        { text: txt('helpAngleStep6'), tex: txt('helpAngleStep6Tex') },
      ],
      diagram: angleDiagram,
      highlight: (ctx, item) => angleObjects(ctx, pickAnglePair(ctx, item)),
      example(ctx, item) {
        const p = pickAnglePair(ctx, item), L = ctx.lattice, A = p.A, B = p.B;
        const intro = p.from === 'item'
          ? txt('helpUsingAnglePair', { a: p.names[0], b: p.names[1] })
          : txt('helpUsingAngleExample', { a: idx(A, 'dir'), b: idx(B, 'dir') });
        let steps;
        if (p.mode === 'dd') {
          const r = M.angleDirections(L, A, B);
          steps = [
            { text: txt('helpAngleEx1'), tex: txt('helpAngleEx1Tex', { dotG: tn(r.dotG) }) },
            { text: txt('helpAngleEx2'), tex: txt('helpAngleEx2Tex', { lu: tn(r.lu), lv: tn(r.lv) }) },
            { tex: txt('helpAngleEx3Tex', { dotG: tn(r.dotG), lu: tn(r.lu), lv: tn(r.lv), dotG2: tn(r.dotG / (r.lu * r.lv)), angle: tn(r.angle) }) },
          ];
        } else if (p.mode === 'pp') {
          const r = M.anglePlanes(L, A, B);
          steps = [
            { text: txt('helpAngleEx4'), tex: txt('helpAngleEx4Tex', { dotG: tn(r.dotG) }) },
            { text: txt('helpAngleEx5'), tex: txt('helpAngleEx5Tex', { g1: tn(r.g1), g2: tn(r.g2) }) },
            { tex: txt('helpAngleEx6Tex', { dotG: tn(r.dotG / (r.g1 * r.g2)), angle: tn(r.angle) }) },
          ];
        } else {
          const r = M.angleDirectionPlane(L, A, B);
          steps = [
            { text: txt('helpAngleEx7'), tex: txt('helpAngleEx7Tex', { uh: r.uh }) },
            { text: txt('helpAngleEx8'), tex: txt('helpAngleEx8Tex', { lu: tn(r.lu), g: tn(r.g) }) },
            { tex: txt('helpAngleEx9Tex', { uh: r.uh, lu: tn(r.lu), g: tn(r.g), toNormal: tn(r.toNormal), toPlane: tn(r.toPlane) }) },
          ];
        }
        return { title: latticeName(ctx), intro, steps };
      },
    },
    related: ['calc-metric', 'direction', 'plane'],
  },

  /* ---------------------------------------------------------------- */
  {
    key: 'calc-bragg',
    title: txt('helpBraggTitle'),
    icon: 'bragg',
    explain: txt('helpBraggExplain'),
    formulas: [
      { tex: txt('helpBraggFormula1') },
      { tex: txt('helpBraggFormula2') },
    ],
    symbols: [
      [txt('helpBraggSym1'), txt('helpBraggSym1Text')],
      [txt('helpBraggSym2'), txt('helpBraggSym2Text')],
      [txt('helpBraggSym3'), txt('helpBraggSym3Text')],
      [txt('helpBraggSym4'), txt('helpBraggSym4Text')],
    ],
    now: (ctx, item) => {
      const p = pickPlane(ctx, item), tt2 = M.braggTwoTheta(ctx.lattice.dSpacing(p.hkl), ctx.lambda);
      return txt('helpBraggNow', { hkl: idx(p.hkl, 'plane'), lambda: ctx.lambda, angle: tt2 == null ? txt('helpBraggNoReflection') : `$2\\theta = ${tn(tt2)}${DEG}$` });
    },
    more: {
      steps: [
        { text: txt('helpBraggStep1') },
        { text: txt('helpBraggStep2') },
        { text: txt('helpBraggStep3'), tex: txt('helpBraggStep3Tex') },
        { text: txt('helpBraggStep4'), tex: txt('helpBraggStep4Tex') },
        { text: txt('helpBraggStep5'), tex: txt('helpBraggStep5Tex') },
        { text: txt('helpBraggStep6'), tex: txt('helpBraggStep6Tex') },
        { text: txt('helpBraggStep7'), tex: txt('helpBraggStep7Tex') },
      ],
      diagram: braggDiagram,
      highlight: (ctx, item) => spacingPair(ctx, pickPlane(ctx, item).hkl),
      example(ctx, item) {
        const p = pickPlane(ctx, item), hkl = p.hkl, d = ctx.lattice.dSpacing(hkl), lam = ctx.lambda;
        const s = lam / (2 * d), tt2 = M.braggTwoTheta(d, lam), sf = M.structureFactor(ctx.basis, hkl);
        const steps = [
          { text: txt('helpBraggEx1'), tex: txt('helpBraggEx1Tex', { hkl: tIdxBare(hkl), d: tn(d) }) },
          { text: txt('helpBraggEx2', { lam }), tex: txt('helpBraggEx2Tex', { lam: tn(lam, 5), d: tn(d), s: tn(s) }) },
        ];
        if (tt2 == null) steps.push({ text: txt('helpBraggEx3') });
        else steps.push({ tex: txt('helpBraggEx4Tex', { tt2: tn(tt2 / 2), tt22: tn(tt2) }) });
        if (sf.absent) steps.push({ text: txt('helpBraggEx5', { centring: centringOf(ctx), hkl: idx(hkl, 'plane') }) });
        return { ...planeExample(ctx, p), steps };
      },
    },
    related: ['calc-dspacing', 'plane-family'],
  },
];
