/* =====================================================================
   Direction components: the path from the origin to the tip of [uvw],
   one axis at a time — u·a, then v·b, then w·c — with the coordinates of
   every corner of the path labelled. On hexagonal axes the path can use
   the four axes a1, a2, a3, c of [uvtw] instead. Linked to a direction
   object (item.src). Maths: componentPath in src/math/intercepts.js.
   ===================================================================== */
import * as M from '../math/index.js';
import { HELP } from '../help/content.js';
import { idx, pointText } from '../ui/format.js';
import { facts, formulaTex, note, toggle } from '../ui/controls.js';
import { sourceOf, linkedType } from './linked.js';
import { txt } from '../text.js';

const AXIS_HTML = { a: 'a', b: 'b', c: 'c', a1: 'a<sub>1</sub>', a2: 'a<sub>2</sub>', a3: 'a<sub>3</sub>' };

/** n·axis as HTML: "a", "−2c", "3a<sub>1</sub>" */
const term = (n, key) => `${n === 1 ? '' : n === -1 ? '−' : String(n).replace('-', '−')}<i>${AXIS_HTML[key]}</i>`;

const AXIS_TEX = { a: '\\mathbf a', b: '\\mathbf b', c: '\\mathbf c', a1: '\\mathbf a_1', a2: '\\mathbf a_2', a3: '\\mathbf a_3' };
/** [[2, 'a1'], [-1, 'a2']] → "2\mathbf a_1 - \mathbf a_2" (zero terms left out). */
const texSum = terms => terms.filter(([n]) => n).map(([n, k], i) => {
  const mag = Math.abs(n) === 1 ? '' : Math.abs(n);
  return `${n < 0 ? '-' : i ? '+' : ''}${mag}${AXIS_TEX[k]}`;
}).join(' ') || '0';

export function componentModel(item, ctx) {
  const D = sourceOf(item, ctx, 'direction');
  if (!D) return null;
  const uvw = D.parsed.uvw;
  const four = item.four && ctx.hexAxes;
  const th = ctx.theme;
  const colourOf = { a: th.axisA, b: th.axisB, c: th.axisC, a1: th.axisA, a2: th.axisB, a3: th.axisA3 };
  const keys = four ? ['a1', 'a2', 'a3', 'c'] : ctx.isPrism ? ['a1', 'a2', 'c'] : ['a', 'b', 'c'];
  const comps = four ? M.directionToFour(uvw) : uvw;
  const path = M.componentPath(comps, four ? M.AXES_4 : M.AXES_3).map(s => ({ ...s, key: keys[s.axis], colour: colourOf[keys[s.axis]] }));
  const end = path.length ? path[path.length - 1].to : [0, 0, 0];
  // the four-index vector can be a multiple of [uvw]: same direction, longer
  const scale = Math.round(M.norm(end) / M.norm(uvw));
  return { D, uvw, four, keys, comps, path, end, scale };
}

linkedType({
  type: 'components',
  kind: 'direction',
  command: 'Components',
  commandHelp: txt('cmdHelpComponents'),
  commandGroup: txt('catDirections'),
  pickerLabel: txt('componentsPicker'),
  prefix: 'path',
  title: txt('componentsTitle'),
  icon: 'arrow',
  help: 'direction-components',
  appearance: true,
  menu: [{
    key: 'components', category: 'directions', order: 20, title: txt('componentsMenu'), desc: HELP['direction-components'],
    input: 'direction', source: 'direction', presets: ['1 1 1', '2 1 0', '1 1 -2'], command: 'Components(d1)',
  }],

  create: () => ({ byAxis: true, four: false }),

  summary(item, ctx) {
    const m = componentModel(item, ctx);
    if (!m) return txt('summaryChooseDirection');
    return `${m.path.map(s => term(s.n, s.key)).join(' → ') || '—'} → ${pointText(m.end)}`;
  },

  settings(item, ctx) {
    const m = componentModel(item, ctx);
    if (!m) return '';
    let out = note(txt('componentsNote'));
    out += formulaTex(m.four
      ? txt('componentsFormulaFour', { sum: texSum(m.path.map(s => [s.n, s.key])) })
      : txt('componentsFormula', { sum: texSum(m.uvw.map((n, i) => [n, 'abc'[i]])) }));
    out += facts(m.path.map((s, i) => [`${i + 1} · ${term(s.n, s.key)}`, `→ ${pointText(s.to)}`]));
    if (m.four && m.scale > 1) {
      out += note(txt('componentsFourNote', { four: idx(m.comps, 'dir'), end: pointText(m.end), scale: m.scale, uvw: idx(m.uvw, 'dir') }));
    }
    out += toggle('byAxis', item.byAxis, txt('componentsByAxis'), { hint: txt('componentsByAxisHint') });
    if (ctx.hexAxes) out += toggle('four', item.four, txt('componentsFour'), { hint: txt('componentsFourHint') });
    return out;
  },

  onField(item, name, value, ctx, ws) {
    if (name === 'byAxis') { item.byAxis = value; ws.redraw(item); }
    if (name === 'four') { item.four = value; ws.itemChanged(item); }
  },

  primitives(item, ctx) {
    const m = componentModel(item, ctx);
    if (!m) return [];
    const L = ctx.lattice, colour = ctx.colour(item), opacity = ctx.opacity(item), prims = [];
    const r = Math.max(0.5 * ctx.pointRadius, 0.045 * ctx.L0);
    const O = ctx.origin;
    m.path.forEach((s, i) => {
      // drawn from the origin; labels give the coordinates relative to it
      const from = L.toCartesian(M.add(O, s.from)), to = L.toCartesian(M.add(O, s.to)), c = item.byAxis ? s.colour : colour;
      prims.push({ kind: 'arrow', from, to, colour: c, opacity, size: 0.55 });
      prims.push({ kind: 'label', at: M.scale(M.add(from, to), 0.5), html: term(s.n, s.key), colour: c, cls: 'lbl-small' });
      const last = i === m.path.length - 1;
      prims.push({ kind: 'spheres', centres: [to], radius: r, colour, opacity });
      prims.push({ kind: 'label', at: to, html: last ? `<b>${pointText(s.to)}</b>` : pointText(s.to), colour, cls: 'lbl-icpt lbl-frac' });
    });
    return prims;
  },
});
