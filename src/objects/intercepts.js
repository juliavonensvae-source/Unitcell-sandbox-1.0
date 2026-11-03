/* =====================================================================
   Plane intercepts: where plane n of the (hkl) set cuts the axes, measured
   from an origin O at a cell corner, and the textbook steps back to (hkl):
     intercepts → reciprocals → clear fractions → (hkl).
   The origin can move to another corner so planes with zero or negative
   indices sit inside the cell ('auto' picks that corner). In the hexagonal
   prism the origin is the centre of the bottom face and there are four
   axes a1, a2, a3, c with (hkil). Linked to a plane object (item.src).
   Maths: src/math/intercepts.js.
   ===================================================================== */
import * as M from '../math/index.js';
import { HELP } from '../help/content.js';
import { idx, fracText } from '../ui/format.js';
import { note, toggle } from '../ui/controls.js';
import { sourceOf, linkedType } from './linked.js';
import { txt } from '../text.js';

const AXIS_HTML = { a: 'a', b: 'b', c: 'c', a1: 'a<sub>1</sub>', a2: 'a<sub>2</sub>', a3: 'a<sub>3</sub>' };

/** Everything needed to draw and explain the intercepts, or null without a valid plane. */
export function interceptModel(item, ctx) {
  const P = sourceOf(item, ctx, 'plane');
  if (!P) return null;
  const hkl = P.parsed.hkl, n = item.level;
  const prism = ctx.isPrism, fourAxes = prism || ctx.hexAxes;
  const indices = fourAxes ? M.planeToFour(hkl) : hkl;
  const axisVecs = fourAxes ? M.AXES_4 : M.AXES_3;
  const keys = fourAxes ? ['a1', 'a2', 'a3', 'c'] : ['a', 'b', 'c'];
  // the highlighted cell's chosen corner, or (auto) the corner of that cell that brings plane n = 1 inside it
  const base = ctx.cellOrigin;
  const auto = !prism && item.autoCorner !== false;
  const origin = prism ? ctx.origin : auto ? M.add(base, M.autoOrigin(hkl)) : ctx.origin;
  // which axes are drawn: all four in the prism, a1 a2 c on the primitive hexagonal cell
  const drawn = keys.map((k, i) => (fourAxes && !prism ? i !== 2 : true));
  const th = ctx.theme;
  const COLOUR = { a: th.axisA, b: th.axisB, c: th.axisC, a1: th.axisA, a2: th.axisB, a3: th.axisA3 };
  const axes = keys.map((key, i) => {
    const h = indices[i];
    const t = h === 0 ? null : n / h; // in units of this axis
    return { key, html: AXIS_HTML[key], colour: COLOUR[key], vec: axisVecs[i], h, t, at: t == null ? null : M.add(origin, M.scale(axisVecs[i], t)), drawn: drawn[i] };
  });
  return { P, hkl, n, indices, axes, origin, base, auto, prism, fourAxes, steps: M.interceptSteps(indices, n), level: n + M.dot(hkl, origin) };
}

/** The plane through the intercepts, clipped to a box that holds both the cell and the intercepts. */
function planePoints(m, ctx) {
  let region;
  if (m.prism) {
    const reach = Math.max(1, ...m.axes.filter(a => a.t != null).map(a => Math.abs(a.t)));
    region = reach > 1.0001 ? M.grownRegion(ctx.unitRegion, reach) : ctx.unitRegion;
  } else {
    const lo = [...m.base], hi = m.base.map(x => x + 1);
    for (const a of m.axes) if (a.at && a.drawn) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], a.at[i]); hi[i] = Math.max(hi[i], a.at[i]); }
    region = M.boxBetween(lo, hi);
  }
  return M.planePolygonIn(m.hkl, m.level, region);
}

const axisHead = a => `<th class="num" style="color:${a.colour}"><i>${a.html}</i></th>`;
const coef = (r, html) => {
  if (r == null) return '∞';
  const t = fracText(r);
  return `${t === '1' ? '' : t === '−1' ? '−' : t}<i>${html}</i>`;
};

function stepsTable(m) {
  const s = m.steps, cols = m.axes;
  const row = (label, cells) => `<tr><th scope="row">${label}</th>${cells.map(c => `<td class="num">${c}</td>`).join('')}</tr>`;
  const factor = s.factor === 1 ? txt('interceptsWhole') : `× ${s.factor}`;
  return `<div class="table-wrap"><table class="mini-table steps-table">
    <thead><tr><th></th>${cols.map(axisHead).join('')}</tr></thead>
    <tbody>
      ${row(txt('interceptsStep1'), s.intercepts.map(fracText))}
      ${row(txt('interceptsStep2'), s.reciprocals.map(fracText))}
      ${row(txt('interceptsStep3', { factor }), s.cleared.map(x => fracText(M.ratio(x, 1))))}
    </tbody></table></div>`;
}

linkedType({
  type: 'intercepts',
  kind: 'plane',
  command: 'Intercepts',
  commandHelp: txt('cmdHelpIntercepts'),
  pickerLabel: txt('interceptsPicker'),
  hide: true,
  prefix: 'ic',
  title: txt('interceptsTitle'),
  icon: 'intercept',
  help: 'intercepts',
  appearance: true,
  defaultTransparency: 55,
  menu: [{
    key: 'intercepts', category: 'intercepts', order: 10, title: txt('interceptsMenu'), desc: HELP.intercepts,
    input: 'plane', source: 'plane', presets: ['1 1 1', '1 2 0', '1 -1 0'], command: 'Intercepts(p1)',
  }],

  create: () => ({ autoCorner: true, level: 1 }),

  summary(item, ctx) {
    const m = interceptModel(item, ctx);
    if (!m) return txt('summaryChoosePlane');
    return m.axes.map(a => `${coef(a.t == null ? null : M.ratio(m.n, a.h), a.html)}`).join(', ');
  },

  settings(item, ctx) {
    const m = interceptModel(item, ctx);
    if (!m) return '';
    let out = note(m.fourAxes
      ? txt('interceptsNoteFour')
      : txt('interceptsNote'));
    out += stepsTable(m);
    const same = m.steps.cleared.join() === m.indices.join();
    out += `<p class="steps-result">${txt('interceptsStep4', { indices: idx(m.steps.cleared, 'plane') })}${m.fourAxes ? ` = ${idx([m.steps.cleared[0], m.steps.cleared[1], m.steps.cleared[3]], 'plane')}` : ''}</p>`;
    if (!same) {
      out += note(txt('interceptsSameSet', { n: m.n, indices: idx(m.indices, 'plane'), cleared: idx(m.steps.cleared, 'plane') }));
    }
    // plane number and origin
    out += `<div class="field-pair">
      <div class="field"><label class="field-label" for="lvl-${item.id}">${txt('interceptsLevel')}</label>
        <select class="input" id="lvl-${item.id}" data-field="level">${[1, 2, 3, 4].map(k => `<option value="${k}"${k === m.n ? ' selected' : ''}>n = ${k}${k === 1 ? ` ${txt('interceptsNearest')}` : ''}</option>`).join('')}</select></div>
    </div>`;
    const origin = m.origin.join(', ');
    const where = ctx.cell ? txt('interceptsWhereCell', { origin, cell: ctx.cell.join(',') }) : `O = (${origin})`;
    if (m.prism) {
      out += note(txt('interceptsPrismOrigin', { where: ctx.cell ? txt('interceptsWherePrism', { origin, cell: ctx.cell.join(',') }) : where }));
    } else {
      out += toggle('autoCorner', m.auto, txt('interceptsAuto'), {
        hint: m.auto
          ? txt('interceptsAutoHint', { where })
          : txt('interceptsManualHint', { where }),
      });
      out += note(txt('interceptsOriginNote'));
      if (!m.auto && m.axes.some(a => a.at && a.at.some((x, i) => x < m.base[i] - 1e-9 || x > m.base[i] + 1 + 1e-9))) {
        out += note(txt('interceptsOutside'));
      }
    }
    if (m.fourAxes && !m.prism) out += note(txt('interceptsPrismHint'));
    return out;
  },

  onField(item, name, value, ctx, ws) {
    if (name === 'level') { item.level = +value || 1; ws.itemChanged(item); }
    if (name === 'autoCorner') { item.autoCorner = value; ws.itemChanged(item); }
  },

  primitives(item, ctx) {
    const m = interceptModel(item, ctx);
    if (!m) return [];
    const L = ctx.lattice, colour = ctx.colour(item), opacity = ctx.opacity(item), prims = [];
    const O = L.toCartesian(m.origin);
    const poly = planePoints(m, ctx);
    if (poly) prims.push({ kind: 'polygon', points: poly.map(f => L.toCartesian(f)), colour, opacity });

    // the origin
    const r = Math.max(0.6 * ctx.pointRadius, 0.06 * ctx.L0);
    prims.push({ kind: 'spheres', centres: [O], radius: r * 0.9, colour: '#2B2F3A', opacity: 1 });
    prims.push({ kind: 'label', at: M.add(O, [0, 0, -0.16 * ctx.L0]), html: '<i>O</i>', colour: '#2B2F3A', cls: 'lbl-origin' });

    for (const a of m.axes) {
      if (!a.drawn) continue;
      // the axis through O, long enough to reach the cell's far side and the intercept
      const along = a.vec, axisIndex = a.vec.findIndex(x => x !== 0);
      const rel = m.origin[axisIndex] - m.base[axisIndex];
      const reachCell = m.prism ? 1 : 1 - rel;
      const back = m.prism ? 0 : -rel;
      const tMin = Math.min(0, back, a.t ?? 0), tMax = Math.max(reachCell, a.t ?? 0, 0.35) + 0.25;
      prims.push({
        kind: 'arrow', from: L.toCartesian(M.add(m.origin, M.scale(along, tMin))), to: L.toCartesian(M.add(m.origin, M.scale(along, tMax))),
        colour: a.colour, opacity: 0.9, size: 0.45, label: `<i>${a.html}</i>`, labelCls: 'lbl-axis', labelGap: 0.07,
      });
      if (a.at) {
        const p = L.toCartesian(a.at);
        prims.push({ kind: 'spheres', centres: [p], radius: r, colour, opacity: 1 });
        prims.push({ kind: 'label', at: p, html: coef(M.ratio(m.n, a.h), a.html), colour, cls: 'lbl-icpt lbl-frac' });
      } else {
        const end = L.toCartesian(M.add(m.origin, M.scale(along, tMax)));
        prims.push({ kind: 'label', at: M.add(end, [0, 0, -0.14 * ctx.L0]), html: txt('interceptsParallel', { axis: a.html }), colour: a.colour, cls: 'lbl-par' });
      }
    }
    return prims;
  },
});

