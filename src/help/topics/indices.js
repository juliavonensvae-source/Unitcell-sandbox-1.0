/* =====================================================================
   Help topics: Miller indices of directions and planes, plane families,
   intercepts, direction components, Miller–Bravais notation and the
   direction where two planes meet.
   ===================================================================== */
import * as M from '../../math/index.js';
import { tn, tIdx, tIdxPlain, tVec, tFrac, tInt, tPoint, ANG } from '../tex.js';
import { isCubic, latticeName, pickPlane, pickDirection, pickTwoPlanes, sourceNote, planeExample, planeNow } from '../context.js';
import { hexAxesDiagram } from '../diagrams.js';
import { directionArrow, planeIntercepts, zoneLine, familyPlanes } from '../highlights.js';
import { idx } from '../../ui/format.js';
import { txt } from '../../text.js';

const R = String.raw;

/** |r|² = uᵀGu written out with the numbers. */
function lengthSteps(L, uvw) {
  const G = L.G, [u, v, w] = uvw;
  const terms = [[u * u, G[0][0]], [v * v, G[1][1]], [w * w, G[2][2]], [2 * u * v, G[0][1]], [2 * u * w, G[0][2]], [2 * v * w, G[1][2]]]
    .filter(([k, g]) => Math.abs(k) > 1e-12 && Math.abs(g) > 1e-12);
  const sum = terms.length ? terms.map(([k, g]) => `${tInt(k)}\\times${tInt(+tn(g))}`).join(' + ') : '0';
  return R`|\mathbf r|^2 = \mathbf u^\mathsf T G\,\mathbf u = ${sum} = ${tn(L.length(uvw) ** 2)}\,\text{Å}^2`;
}

export default [
  /* ---------------------------------------------------------------- */
  {
    key: 'direction',
    title: txt('directionMenu'),
    icon: 'arrow',
    scope: txt('helpDirectionScope'),
    explain: txt('helpDirectionExplain'),
    formulas: [
      { tag: txt('allLattices'), tex: txt('helpDirectionFormula1') },
      { tag: txt('cubicOnly'), tex: txt('helpDirectionFormula2') },
    ],
    symbols: [
      [txt('helpDirectionSym1'), txt('helpDirectionSym1Text')],
      [txt('helpDirectionSym2'), txt('helpDirectionSym2Text')],
      [txt('helpDirectionSym3'), txt('helpDirectionSym3Text')],
      [txt('helpDirectionSym4'), txt('helpDirectionSym4Text')],
    ],
    now: (ctx, item) => {
      const p = pickDirection(ctx, item);
      return txt('helpDirectionNow', { name: p.name ? `<b>${p.name}</b> ` : '', uvw: idx(p.uvw, 'dir'), length: tn(ctx.lattice.length(p.uvw)) });
    },
    more: {
      steps: [
        { text: txt('helpDirectionStep1'), tex: txt('helpDirectionStep1Tex') },
        { text: txt('helpDirectionStep2'), tex: txt('helpDirectionStep2Tex') },
        { text: txt('helpDirectionStep3'), tex: txt('helpDirectionStep3Tex') },
        { text: txt('helpDirectionStep4'), tex: txt('helpDirectionStep4Tex') },
        { text: txt('helpDirectionStep5'), tex: txt('helpDirectionStep5Tex') },
        { text: txt('helpDirectionStep6'), tex: txt('helpDirectionStep6Tex') },
      ],
      highlight: (ctx, item) => directionArrow(ctx, pickDirection(ctx, item).uvw),
      example(ctx, item) {
        const p = pickDirection(ctx, item), L = ctx.lattice, uvw = p.uvw;
        const r = L.toCartesian(uvw);
        const steps = [
          { text: txt('helpDirectionEx1'), tex: txt('helpDirectionEx1Tex', { uvw: tInt(uvw[0]), uvw2: tInt(uvw[1]), uvw3: tInt(uvw[2]), r: tVec(r) }) },
          { text: txt('helpDirectionEx2'), tex: lengthSteps(L, uvw) },
          { tex: txt('helpDirectionEx3Tex', { length: tn(L.length(uvw)) }) },
        ];
        if (isCubic(ctx)) steps.push({ text: txt('helpDirectionEx4'), tex: txt('helpDirectionEx4Tex', { a: tn(ctx.params.a), uvw: uvw[0] ** 2 + uvw[1] ** 2 + uvw[2] ** 2, length: tn(ctx.params.a * Math.hypot(...uvw)) }) });
        return { title: txt('helpDirectionExTitle', { uvw: tIdxPlain(uvw, 'dir'), lattice: latticeName(ctx) }), intro: sourceNote(p, 'direction', idx(uvw, 'dir')), steps };
      },
    },
    related: ['direction-components', 'calc-angle', 'miller-bravais'],
  },

  /* ---------------------------------------------------------------- */
  {
    key: 'plane',
    title: txt('helpPlaneTitle'),
    icon: 'plane',
    explain: txt('helpPlaneExplain'),
    formulas: [
      { tex: txt('helpPlaneFormula1') },
      { tag: txt('helpPlaneFormula2Tag'), tex: txt('helpPlaneFormula2') },
    ],
    symbols: [
      [txt('helpPlaneSym1'), txt('helpPlaneSym1Text')],
      [txt('helpPlaneSym2'), txt('helpPlaneSym2Text')],
      [txt('helpPlaneSym3'), txt('helpPlaneSym3Text')],
    ],
    now: planeNow,
    more: {
      steps: [
        { text: txt('helpPlaneStep1') },
        { text: txt('helpPlaneStep2'), tex: txt('helpPlaneStep2Tex') },
        { text: txt('helpPlaneStep3'), tex: txt('helpPlaneStep3Tex') },
        { text: txt('helpPlaneStep4'), tex: txt('helpPlaneStep4Tex') },
        { text: txt('helpPlaneStep5'), tex: txt('helpPlaneStep5Tex') },
        { text: txt('helpPlaneStep6'), tex: txt('helpPlaneStep6Tex') },
      ],
      highlight: (ctx, item) => planeIntercepts(ctx, pickPlane(ctx, item).hkl),
      example(ctx, item) {
        const p = pickPlane(ctx, item), hkl = p.hkl, L = ctx.lattice, s = M.interceptSteps(hkl, 1);
        const lens = ['a', 'b', 'c'], vals = [ctx.params.a, ctx.params.b, ctx.params.c];
        const steps = [
          { text: txt('helpPlaneEx1'), tex: hkl.map((h, i) => (h === 0 ? R`${lens[i]}:\ \infty` : R`${lens[i]}:\ ${tFrac(s.intercepts[i])} = ${tn(vals[i] / h)}${ANG}`)).join(R`,\quad `) },
          { text: txt('helpPlaneEx2'), tex: s.reciprocals.map(tFrac).join(R`,\ \ `) },
          { text: txt('helpPlaneEx3'), tex: tIdx(hkl, 'plane') },
          { text: txt('helpPlaneEx4'), tex: txt('helpPlaneEx4Tex', { dSpacing: tn(L.dSpacing(hkl)) }) },
        ];
        const ang = M.angleDirectionPlane(L, hkl, hkl).toNormal;
        steps.push(isCubic(ctx)
          ? { text: txt('helpPlaneEx5'), tex: txt('helpPlaneEx5Tex', { hkl: tIdx(hkl) }) }
          : { text: txt('helpPlaneEx6'), tex: txt('helpPlaneEx6Tex', { hkl: tIdx(hkl), hkl2: tIdx(hkl, 'plane'), ang: tn(ang) }) });
        return { ...planeExample(ctx, p), steps };
      },
    },
    related: ['intercepts', 'plane-family', 'calc-dspacing'],
  },

  /* ---------------------------------------------------------------- */
  {
    key: 'plane-family',
    title: txt('helpPlaneFamilyTitle'),
    icon: 'layers',
    explain: txt('helpPlaneFamilyExplain'),
    formulas: [
      { tex: txt('helpPlaneFamilyFormula1') },
      { tag: txt('helpPlaneFamilyFormula2Tag'), tex: txt('helpPlaneFamilyFormula2') },
    ],
    symbols: [
      [txt('helpPlaneFamilySym1'), txt('helpPlaneFamilySym1Text')],
      [txt('helpPlaneFamilySym2'), txt('helpPlaneFamilySym2Text')],
      [txt('helpPlaneFamilySym3'), txt('helpPlaneFamilySym3Text')],
      [txt('helpPlaneFamilySym4'), txt('helpPlaneFamilySym4Text')],
    ],
    more: {
      steps: [
        { text: txt('helpPlaneFamilyStep1'), tex: txt('helpPlaneFamilyStep1Tex') },
        { text: txt('helpPlaneFamilyStep2') },
        { text: txt('helpPlaneFamilyStep3'), tex: txt('helpPlaneFamilyStep3Tex') },
        { text: txt('helpPlaneFamilyStep4'), tex: txt('helpPlaneFamilyStep4Tex') },
        { text: txt('helpPlaneFamilyStep5'), tex: txt('helpPlaneFamilyStep5Tex') },
      ],
      highlight: (ctx, item) => familyPlanes(ctx, pickPlane(ctx, item).hkl),
      example(ctx, item) {
        const p = pickPlane(ctx, item), hkl = p.hkl, sp = M.planeSpacings(ctx.lattice, hkl, ctx.basis);
        const [pp, qq] = sp.step, n = M.familyLevelsIn(sp.eq, ctx.unitRegion).length;
        const steps = [
          { text: txt('helpPlaneFamilyEx1'), tex: ctx.basis.length > 1 ? ctx.basis.slice(1).map(s => R`\mathbf h\cdot${tPoint(s.f)} = ${tFrac(M.ratio(Math.round(6 * M.dot(hkl, s.f)), 6))}`).join(R`,\quad `) : txt('helpPlaneFamilyEx1TexElse') },
          { text: txt('helpPlaneFamilyEx2'), tex: txt('helpPlaneFamilyEx2Tex', { pp: qq === 1 ? pp : R`\tfrac{${pp}}{${qq}}` }) },
          { text: txt('helpPlaneFamilyEx3'), tex: txt('helpPlaneFamilyEx3Tex', { dFormula: tn(sp.dFormula), dLattice: tn(sp.dLattice) }) },
          { text: txt('helpPlaneFamilyEx4', { eq: idx(sp.eq, 'plane'), n }) },
        ];
        return { ...planeExample(ctx, p), steps };
      },
    },
    related: ['plane', 'spacing'],
  },

  /* ---------------------------------------------------------------- */
  {
    key: 'intercepts',
    title: txt('helpInterceptsTitle'),
    icon: 'intercept',
    explain: txt('helpInterceptsExplain'),
    formulas: [{ tex: txt('helpInterceptsFormula1') }],
    symbols: [
      [txt('helpInterceptsSym1'), txt('helpInterceptsSym1Text')],
      [txt('helpInterceptsSym2'), txt('helpInterceptsSym2Text')],
    ],
    more: {
      steps: [
        { text: txt('helpInterceptsStep1'), tex: txt('helpInterceptsStep1Tex') },
        { text: txt('helpInterceptsStep2'), tex: txt('helpInterceptsStep2Tex') },
        { text: txt('helpInterceptsStep3'), tex: txt('helpInterceptsStep3Tex') },
        { text: txt('helpInterceptsStep4'), tex: txt('helpInterceptsStep4Tex') },
        { text: txt('helpInterceptsStep5'), tex: txt('helpInterceptsStep5Tex') },
      ],
      highlight: (ctx, item) => planeIntercepts(ctx, pickPlane(ctx, item).hkl),
      example(ctx, item) {
        const p = pickPlane(ctx, item), hkl = p.hkl, s = M.interceptSteps(hkl, 1), O = M.autoOrigin(hkl);
        return {
          title: tIdxPlain(hkl, 'plane'),
          intro: sourceNote(p, 'plane', idx(hkl, 'plane')),
          steps: [
            { text: txt('helpInterceptsEx1'), tex: txt('helpInterceptsEx1Tex', { o: tPoint(O) }) },
            { text: txt('helpInterceptsEx2'), tex: s.intercepts.map(tFrac).join(R`,\quad `) },
            { text: txt('helpInterceptsEx3'), tex: s.reciprocals.map(tFrac).join(R`,\quad `) },
            { text: txt('helpInterceptsEx4'), tex: tIdx(s.indices, 'plane') },
          ],
        };
      },
    },
    related: ['plane', 'origin'],
  },

  /* ---------------------------------------------------------------- */
  {
    key: 'direction-components',
    title: txt('componentsTitle'),
    icon: 'arrow',
    explain: txt('helpDirectionComponentsExplain'),
    formulas: [
      { tex: txt('helpDirectionComponentsFormula1') },
      { tag: txt('helpDirectionComponentsFormula2Tag'), tex: txt('helpDirectionComponentsFormula2') },
    ],
    symbols: [[txt('helpDirectionComponentsSym1'), txt('helpDirectionComponentsSym1Text')], [txt('helpDirectionComponentsSym2'), txt('helpDirectionComponentsSym2Text')]],
    more: {
      steps: [
        { text: txt('helpDirectionComponentsStep1') },
        { text: txt('helpDirectionComponentsStep2'), tex: txt('helpDirectionComponentsStep2Tex') },
        { text: txt('helpDirectionComponentsStep3') },
        { text: txt('helpDirectionComponentsStep4'), tex: txt('helpDirectionComponentsStep4Tex') },
      ],
      highlight: (ctx, item) => directionArrow(ctx, pickDirection(ctx, item).uvw),
      example(ctx, item) {
        const p = pickDirection(ctx, item), uvw = p.uvw, O = ctx.origin;
        const path = M.componentPath(uvw, M.AXES_3);
        return {
          title: tIdxPlain(uvw, 'dir'),
          intro: sourceNote(p, 'direction', idx(uvw, 'dir')),
          steps: [
            { text: txt('helpDirectionComponentsEx1'), tex: txt('helpDirectionComponentsEx1Tex', { o: tPoint(O) }) },
            ...path.map(s => ({ text: txt('helpDirectionComponentsEx2', { n: s.n, axis: ['a', 'b', 'c'][s.axis] }), tex: txt('helpDirectionComponentsEx2Tex', { from: tPoint(M.add(O, s.from)), to: tPoint(M.add(O, s.to)) }) })),
          ],
        };
      },
    },
    related: ['direction', 'miller-bravais'],
  },

  /* ---------------------------------------------------------------- */
  {
    key: 'miller-bravais',
    title: txt('helpMillerBravaisTitle'),
    icon: 'axes',
    scope: txt('helpMillerBravaisScope'),
    explain: txt('helpMillerBravaisExplain'),
    formulas: [
      { tag: txt('helpMillerBravaisFormula1Tag'), tex: txt('helpMillerBravaisFormula1') },
      { tag: txt('helpMillerBravaisFormula2Tag'), tex: txt('helpMillerBravaisFormula2') },
    ],
    symbols: [
      [txt('helpMillerBravaisSym1'), txt('helpMillerBravaisSym1Text')],
      [txt('helpMillerBravaisSym2'), txt('helpMillerBravaisSym2Text')],
      [txt('helpMillerBravaisSym3'), txt('helpMillerBravaisSym3Text')],
    ],
    more: {
      steps: [
        { text: txt('helpMillerBravaisStep1'), tex: txt('helpMillerBravaisStep1Tex') },
        { text: txt('helpMillerBravaisStep2'), tex: txt('helpMillerBravaisStep2Tex') },
        { text: txt('helpMillerBravaisStep3'), tex: txt('helpMillerBravaisStep3Tex') },
        { text: txt('helpMillerBravaisStep4'), tex: txt('helpMillerBravaisStep4Tex') },
        { text: txt('helpMillerBravaisStep5'), tex: txt('helpMillerBravaisStep5Tex') },
        { text: txt('helpMillerBravaisStep6'), tex: txt('helpMillerBravaisStep6Tex') },
        { text: txt('helpMillerBravaisStep7') },
      ],
      diagram: hexAxesDiagram,
      example(ctx, item) {
        const d = pickDirection(ctx, item, [1, 0, 0]), pl = pickPlane(ctx, item, [1, 0, 0]);
        const [u, v, w] = d.uvw, four = M.directionToFour(d.uvw), [h, k, l] = pl.hkl;
        return {
          title: ctx.hexAxes ? latticeName(ctx) : txt('helpMillerBravaisExTitleElse'),
          intro: ctx.hexAxes ? '' : txt('helpMillerBravaisExIntroElse'),
          steps: [
            { text: txt('helpMillerBravaisEx1', { uvw: idx(d.uvw, 'dir') }), tex: txt('helpMillerBravaisEx1Tex', { u, v, value: 2 * u - v, value2: 2 * v - u, value3: -(u + v), w }) },
            { text: txt('helpMillerBravaisEx2'), tex: txt('helpMillerBravaisEx2Tex', { uvw: tIdx(d.uvw), four: tIdx(four) }) },
            { text: txt('helpMillerBravaisEx3', { hkl: idx(pl.hkl, 'plane') }), tex: txt('helpMillerBravaisEx3Tex', { h, k: tInt(k), i: -(h + k) + 0, hkl: tIdx(pl.hkl, 'plane'), planeToFour: tIdx(M.planeToFour(pl.hkl), 'plane') }) },
          ],
        };
      },
    },
    related: ['hex-prism', 'direction', 'plane'],
  },

  /* ---------------------------------------------------------------- */
  {
    key: 'intersection',
    title: txt('helpIntersectionTitle'),
    icon: 'arrow',
    explain: txt('helpIntersectionExplain'),
    formulas: [
      { tex: txt('helpIntersectionFormula1') },
      { tag: txt('helpIntersectionFormula2Tag'), tex: txt('helpIntersectionFormula2') },
    ],
    symbols: [[txt('helpIntersectionSym1'), txt('helpIntersectionSym1Text')], [txt('helpIntersectionSym2'), txt('helpIntersectionSym2Text')]],
    more: {
      steps: [
        { text: txt('helpIntersectionStep1') },
        { text: txt('helpIntersectionStep2'), tex: txt('helpIntersectionStep2Tex') },
        { text: txt('helpIntersectionStep3'), tex: txt('helpIntersectionStep3Tex') },
        { text: txt('helpIntersectionStep4'), tex: txt('helpIntersectionStep4Tex') },
        { text: txt('helpIntersectionStep5') },
      ],
      highlight: (ctx, item) => { const p = pickTwoPlanes(ctx, item); return zoneLine(ctx, p.h1, p.h2); },
      example(ctx, item) {
        const p = pickTwoPlanes(ctx, item), [h1, k1, l1] = p.h1, [h2, k2, l2] = p.h2;
        const raw = [k1 * l2 - l1 * k2, l1 * h2 - h1 * l2, h1 * k2 - k1 * h2];
        const g = M.gcdAll(raw);
        const intro = p.from === 'default'
          ? txt('helpUsingTwoPlanesExample', { a: idx(p.h1, 'plane'), b: idx(p.h2, 'plane') })
          : txt('helpUsingTwoPlanes', { nameA: p.names[0], a: idx(p.h1, 'plane'), nameB: p.names[1], b: idx(p.h2, 'plane') });
        if (!g) return { title: txt('helpIntersectionExTitle'), intro, steps: [{ text: txt('helpIntersectionEx1'), tex: txt('helpIntersectionEx1Tex') }] };
        const uvw = raw.map(x => x / g + 0);
        const steps = [
          { text: txt('helpIntersectionEx2'), tex: txt('helpIntersectionEx2Tex', { k1: tInt(k1), l2: tInt(l2), l1: tInt(l1), k2: tInt(k2), raw: raw[0], h2: tInt(h2), h1: tInt(h1), raw2: raw[1], raw3: raw[2] }) },
          { text: g > 1 ? txt('helpIntersectionEx3', { g }) : txt('helpIntersectionEx3Else'), tex: tIdx(uvw) },
          { text: txt('helpIntersectionEx4'), tex: txt('helpIntersectionEx4Tex', { uvw: uvw[0], h1: tInt(h1), uvw2: tInt(uvw[1]), k1: tInt(k1), uvw3: tInt(uvw[2]), l1: tInt(l1), h2: tInt(h2), k2: tInt(k2), l2: tInt(l2) }) },
        ];
        if (ctx.hexAxes) steps.push({ text: txt('helpIntersectionEx5'), tex: txt('helpIntersectionEx5Tex', { uvw: tIdx(uvw), directionToFour: tIdx(M.directionToFour(uvw)) }) });
        return { title: txt('helpIntersectionExTitle2', { h1: tIdxPlain(p.h1, 'plane'), h2: tIdxPlain(p.h2, 'plane') }), intro, steps };
      },
    },
    related: ['plane', 'direction', 'calc-angle'],
  },
];
