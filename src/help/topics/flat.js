/* =====================================================================
   Help topics for the 2D view: the five 2D Bravais lattices, directions
   [uv], lines (hk) and free vectors (they read ctx.plane2d), plus the
   input bar and Advanced mode.
   ===================================================================== */
import { tn, tt, ANG, ANG2, DEG } from '../tex.js';
import { lattices2dGrid } from '../diagrams.js';
import { idx } from '../../ui/format.js';
import { pickIndexed, cosd } from '../context.js';
import { txt } from '../../text.js';

const R = String.raw;

/** 2D lattice parameters as TeX. */
const params2d = fc => R`a = ${tn(fc.lattice.params.a)}${ANG},\quad b = ${tn(fc.lattice.params.b)}${ANG},\quad \gamma = ${tn(fc.lattice.params.gamma)}${DEG}`;

/** |r|² = u²a² + v²b² + 2uv ab cos γ with the numbers. */
function length2d(fc, [u, v], sym = "r") {
  const { a, b, gamma } = fc.lattice.params, c = cosd(gamma);
  const L2 = u * u * a * a + v * v * b * b + 2 * u * v * a * b * c;
  return {
    value: Math.sqrt(L2),
    tex: R`|\mathbf ${sym}|^2 = (${tt(u, 3)})^2(${tn(a)})^2 + (${tt(v, 3)})^2(${tn(b)})^2 + 2(${tt(u, 3)})(${tt(v, 3)})(${tn(a)})(${tn(b)})\cos${tn(gamma)}^\circ = ${tn(L2)}${ANG2}`,
  };
}

export default [
  {
    key: 'lattices-2d',
    title: txt('helpLattices2dTitle'),
    icon: 'cube',
    scope: txt('help2DView'),
    explain: txt('helpLattices2dExplain'),
    formulas: [
      { tex: txt('helpLattices2dFormula1') },
      { tex: txt('helpLattices2dFormula2') },
    ],
    symbols: [[txt('helpLattices2dSym1'), txt('helpLattices2dSym1Text')], [txt('helpLattices2dSym2'), txt('helpLattices2dSym2Text')], [txt('helpLattices2dSym3'), txt('helpLattices2dSym3Text')], [txt('helpLattices2dSym4'), txt('helpLattices2dSym4Text')]],
    now: ctx => txt('helpLattices2dNow', { name: ctx.plane2d.bravais.name, params2d: params2d(ctx.plane2d) }),
    more: {
      steps: [
        { text: txt('helpLattices2dStep1'), tex: txt('helpLattices2dStep1Tex') },
        { text: txt('helpLattices2dStep2'), tex: txt('helpLattices2dStep2Tex') },
        { text: txt('helpLattices2dStep3') },
        { text: txt('helpLattices2dStep4'), tex: txt('helpLattices2dStep4Tex') },
        { text: txt('helpLattices2dStep5') },
      ],
      diagram: ctx => lattices2dGrid(ctx.plane2d),
      example(ctx) {
        const fc = ctx.plane2d, { a, b, gamma } = fc.lattice.params;
        return {
          title: txt('status2DName', { name: fc.bravais.name }),
          steps: [
            { text: txt('helpLattices2dEx1'), tex: params2d(fc) },
            { text: txt('helpLattices2dEx2'), tex: txt('helpLattices2dEx2Tex', { a: tn(a), b: tn(b), gamma: tn(gamma), area: tn(fc.lattice.area) }) },
            { text: txt('helpLattices2dEx3'), tex: txt('helpLattices2dEx3Tex', { total: tt(fc.count.total) }) },
            { text: txt('helpLattices2dEx4'), tex: txt('helpLattices2dEx4Tex', { dnn: tn(fc.dnn) }) },
          ],
        };
      },
    },
    related: ['direction2d', 'line2d', 'vector2d'],
  },
  {
    key: 'direction2d',
    title: txt('helpDirection2dTitle'),
    icon: 'arrow',
    scope: txt('helpDirection2dScope'),
    explain: txt('helpDirection2dExplain'),
    formulas: [{ tex: txt('helpDirection2dFormula1') }],
    symbols: [[txt('helpDirection2dSym1'), txt('helpDirection2dSym1Text')], [txt('helpDirection2dSym2'), txt('helpDirection2dSym2Text')]],
    more: {
      steps: [
        { text: txt('helpDirection2dStep1'), tex: txt('helpDirection2dStep1Tex') },
        { text: txt('helpDirection2dStep2'), tex: txt('helpDirection2dStep2Tex') },
        { text: txt('helpDirection2dStep3') },
      ],
      example(ctx, item) {
        const p = pickIndexed(ctx, item, 'direction2d', 'uv', [1, 1]), len = length2d(ctx.plane2d, p.uv);
        return {
          title: txt('helpDirection2dExTitle', { uv: idx(p.uv, 'dir'), name: ctx.plane2d.bravais.name }),
          intro: p.name ? txt('helpUsingNamedOnly', { name: p.name }) : txt('helpDirection2dExIntroElse', { uv: idx(p.uv, 'dir') }),
          steps: [{ tex: len.tex }, { tex: txt('helpDirection2dEx2Tex', { value: tn(len.value) }) }],
        };
      },
    },
    related: ['lattices-2d', 'vector2d'],
  },
  {
    key: 'line2d',
    title: txt('helpLine2dTitle'),
    icon: 'plane',
    scope: txt('help2DView'),
    explain: txt('helpLine2dExplain'),
    formulas: [
      { tex: txt('helpLine2dFormula1') },
      { tex: txt('helpLine2dFormula2') },
    ],
    symbols: [[txt('helpLine2dSym1'), txt('helpLine2dSym1Text')], [txt('helpLine2dSym2'), txt('helpLine2dSym2Text')], [txt('helpLine2dSym3'), txt('helpLine2dSym3Text')]],
    more: {
      steps: [
        { text: txt('helpLine2dStep1'), tex: txt('helpLine2dStep1Tex') },
        { text: txt('helpLine2dStep2'), tex: txt('helpLine2dStep2Tex') },
        { text: txt('helpLine2dStep3'), tex: txt('helpLine2dStep3Tex') },
        { tex: txt('helpLine2dStep4Tex') },
        { text: txt('helpLine2dStep5') },
      ],
      example(ctx, item) {
        const p = pickIndexed(ctx, item, 'line2d', 'hk', [1, 1]), [h, k] = p.hk, { a, b, gamma } = ctx.plane2d.lattice.params;
        const s = Math.sin(gamma * Math.PI / 180), c = cosd(gamma);
        const inv = (h * h / (a * a) + k * k / (b * b) - 2 * h * k * c / (a * b)) / (s * s);
        return {
          title: txt('helpLine2dExTitle', { hk: idx(p.hk, 'plane'), name: ctx.plane2d.bravais.name }),
          intro: p.name ? txt('helpUsingNamedOnly', { name: p.name }) : txt('helpLine2dExIntroElse', { hk: idx(p.hk, 'plane') }),
          steps: [
            { text: txt('helpLine2dEx1'), tex: txt('helpLine2dEx1Tex', { h: h ? R`\frac{a}{h} = ${tn(a / h)}${ANG}` : R`a:\ \infty`, k: k ? R`\frac{b}{k} = ${tn(b / k)}${ANG}` : R`b:\ \infty` }) },
            { text: txt('helpLine2dEx2'), tex: txt('helpLine2dEx2Tex', { inv: tn(inv), value: tn(1 / Math.sqrt(inv)) }) },
          ],
        };
      },
    },
    related: ['lattices-2d', 'plane'],
  },
  {
    key: 'vector2d',
    title: txt('helpVector2dTitle'),
    icon: 'arrow',
    scope: txt('help2DView'),
    explain: txt('helpVector2dExplain'),
    formulas: [{ tex: txt('helpVector2dFormula1') }],
    symbols: [[txt('helpVector2dSym1'), txt('helpVector2dSym1Text')], [txt('helpVector2dSym2'), txt('helpVector2dSym2Text')]],
    more: {
      steps: [
        { text: txt('helpVector2dStep1'), tex: txt('helpVector2dStep1Tex') },
        { text: txt('helpVector2dStep2'), tex: txt('helpVector2dStep2Tex') },
        { text: txt('helpVector2dStep3'), tex: txt('helpVector2dStep3Tex') },
        { text: txt('helpVector2dStep4'), tex: txt('helpVector2dStep4Tex') },
      ],
      example(ctx, item) {
        const v = item && item.type === 'vector2d' ? item : (ctx.items || []).find(i => i.type === 'vector2d');
        const from = v ? v.from : [0, 0], to = v ? v.to : [1, 2], d = [to[0] - from[0], to[1] - from[1]];
        const len = length2d(ctx.plane2d, d, "v");
        return {
          title: txt('status2DName', { name: ctx.plane2d.bravais.name }),
          intro: v ? txt('helpUsingNamedOnly', { name: v.name }) : txt('helpVector2dExIntroElse'),
          steps: [
            { text: txt('helpVector2dEx1'), tex: txt('helpVector2dEx1Tex', { d: tt(d[0], 3), sign: d[1] < 0 ? '-' : '+', d2: tt(Math.abs(d[1]), 3) }) },
            { tex: len.tex },
            { tex: txt('helpVector2dEx3Tex', { value: tn(len.value) }) },
          ],
        };
      },
    },
    related: ['direction2d', 'lattices-2d'],
  },
  /* ---------- the app itself (no formulas) ---------- */
  {
    key: 'input-bar',
    title: txt('helpInputBarTitle'),
    icon: 'pencil',
    scope: txt('helpInputBarScope'),
    explain: txt('helpInputBarExplain'),
    related: ['direction', 'plane', 'calc-angle'],
  },
  {
    key: 'advanced',
    title: txt('topAdvancedLabel'),
    icon: 'layers',
    scope: txt('helpAdvancedScope'),
    explain: txt('helpAdvancedExplain'),
    related: ['lattice-params', 'calc-bragg', 'calc-metric'],
  },
];
