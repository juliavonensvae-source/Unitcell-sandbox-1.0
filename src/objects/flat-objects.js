/* =====================================================================
   2D objects (dim: '2d'): directions [uv], vectors between two points and
   lines (hk), drawn by FlatView. Coordinates are fractional (units of a
   and b); every length uses the 2D metric G (γ included), never plain
   Pythagoras: |r|² = u²a² + v²b² + 2uv·ab·cos γ.
   They read ctx.plane2d (the 2D lattice, always available).
   ===================================================================== */
import { registerType } from './registry.js';
import { registerCommand } from './commands.js';
import * as M from '../math/index.js';
import { parseIndices2D, parsePoint2D, lineIntercepts2D, clipLine2D } from '../math/lattice2d.js';
import { idx, sig, trim, dSym, fracText, pointText } from '../ui/format.js';
import { esc } from '../ui/dom.js';
import { facts, formulaTex, note, toggle } from '../ui/controls.js';
import { tn, tt } from '../help/tex.js';
import { indexedType } from './indexed.js';
import { txt } from '../text.js';

/** "1a + 2b", "0.5a − b", "−2b" */
export function components2D([x, y]) {
  const terms = [];
  [[x, 'a'], [y, 'b']].forEach(([n, ax]) => {
    if (Math.abs(n) < 1e-9) return;
    terms.push({ neg: n < 0, text: `${trim(Math.abs(n), 3)}${ax}` });
  });
  if (!terms.length) return '0';
  return terms.map((t, i) => (i === 0 ? (t.neg ? '−' : '') : t.neg ? ' − ' : ' + ') + t.text).join('');
}

/** The same with italic axis letters for HTML. */
const componentsHTML = v => components2D(v).replace(/([ab])/g, '<i>$1</i>');

/** |r| with the 2D metric, plus the formula (TeX) with the numbers. */
function lengthInfo(L, [u, v]) {
  const { a, b, gamma } = L.params, n = x => tt(x, 3), p = x => (x < 0 ? `(${n(x)})` : n(x));
  return {
    value: L.length([u, v]),
    formula: txt('formulaLength2D', { uVal: p(u), aVal: n(a), vVal: p(v), bVal: n(b), gammaVal: tt(gamma, 2) }),
  };
}

const parseDir = text => {
  const p = parseIndices2D(text, 'dir');
  return p.error ? p : { uv: p.values };
};
const parseLine = text => {
  const p = parseIndices2D(text, 'line');
  return p.error ? p : { hk: p.values };
};

const HINT_2D = () => txt('indexHint2D');

/* ---------- direction [uv] ---------- */
indexedType({
  type: 'direction2d',
  dim: '2d',
  prefix: 'd',
  title: txt('directionTitle'),
  icon: 'arrow',
  help: 'direction2d',
  appearance: true,
  key: 'uv',
  brackets: '[]',
  placeholder: '1 2',
  parse: parseDir,
  label: uv => idx(uv, 'dir'),
  hint: HINT_2D,
  menu: [{
    key: 'direction2d', category: 'directions', order: 10, title: txt('direction2DMenu'),
    desc: txt('direction2DDesc'), input: 'direction', presets: ['1 0', '1 1', '1 2'], command: 'd1 = [1 2]',
  }],
  summary: (item, ctx) => `<i>r</i> = ${componentsHTML(item.parsed.uv)} · |<i>r</i>| = ${sig(ctx.plane2d.lattice.length(item.parsed.uv))} Å`,
  settings(item, ctx) {
    const L = ctx.plane2d.lattice, len = lengthInfo(L, item.parsed.uv);
    return facts([
      [txt('directionVector'), `<i>r</i> = ${componentsHTML(item.parsed.uv)}`],
      [txt('directionLength'), `<b>${sig(len.value)} Å</b>`],
    ]) + formulaTex(txt('formulaLengthResult', { formula: len.formula, value: tn(len.value) }));
  },
  primitives(item, ctx) {
    const colour = ctx.colour(item), opacity = ctx.opacity(item), O = ctx.plane2d.origin, uv = item.parsed.uv;
    const to = [O[0] + uv[0], O[1] + uv[1]];
    return [
      { kind: 'arrow', from: O, to, colour, opacity, width: 3.5 },
      { kind: 'label', at: to, html: ctx.label(item), colour, dx: 0, dy: -18 },
    ];
  },
});

/* ---------- line (hk) ---------- */
/** Corner of the cell that puts line n = 1 in it: 1 along a negative index, 0 along a positive one, else the chosen corner. */
const corner2D = (hk, corner) => hk.map((x, i) => (x < 0 ? 1 : x > 0 ? 0 : corner[i]));

/** Lines of the (hk) set that hold lattice points, clipped to the n × n block. */
function familySegments(hk, ctx) {
  const fc = ctx.plane2d, n = fc.n;
  const basis3 = fc.basis.map(([x, y]) => ({ f: [x, y, 0] }));
  const { eq, step: [p, q] } = M.latticePlanes([hk[0], hk[1], 0], basis3);
  const e2 = [eq[0], eq[1]];
  const vals = [[0, 0], [n, 0], [0, n], [n, n]].map(c => e2[0] * c[0] + e2[1] * c[1]);
  const out = [];
  for (let k = Math.ceil(Math.min(...vals) - 1e-9); k <= Math.floor(Math.max(...vals) + 1e-9); k++) {
    const seg = clipLine2D(e2, k, [0, 0], [n, n]);
    if (seg && Math.hypot(seg[1][0] - seg[0][0], seg[1][1] - seg[0][1]) > 1e-6) out.push({ seg, formula: (k * p) % q === 0 });
  }
  return { segments: out, eq: e2, extra: q > 1 };
}

/** The line n = 1 seen from its best corner of the highlighted cell, with its intercepts. */
function lineModel(item, ctx) {
  const fc = ctx.plane2d, hk = item.parsed.hk, O = corner2D(hk, fc.corner), o = fc.cellOrigin, S = [o[0] + O[0], o[1] + O[1]];
  const ic = lineIntercepts2D(hk, 1);
  const pa = ic.a == null ? null : [S[0] + ic.a, S[1]], pb = ic.b == null ? null : [S[0], S[1] + ic.b];
  const level = 1 + hk[0] * S[0] + hk[1] * S[1];
  const lo = [...o], hi = [o[0] + 1, o[1] + 1];
  for (const pt of [pa, pb].filter(Boolean)) for (let i = 0; i < 2; i++) { lo[i] = Math.min(lo[i], pt[i]); hi[i] = Math.max(hi[i], pt[i]); }
  return { hk, O, moved: O.some((x, i) => x !== fc.corner[i]), ic, pa, pb, seg: clipLine2D(hk, level, lo, hi) };
}

const icText = (r, ax) => (r == null ? txt('interceptsParallel', { axis: ax }) : `${fracText(M.ratio(Math.round(r * 6), 6)).replace(/^1$/, '').replace(/^−1$/, '−')}<i>${ax}</i>`);

indexedType({
  type: 'line2d',
  dim: '2d',
  prefix: 'l',
  title: txt('lineTitle'),
  icon: 'plane',
  help: 'line2d',
  appearance: true,
  key: 'hk',
  brackets: '()',
  placeholder: '1 2',
  parse: parseLine,
  label: hk => idx(hk, 'plane'),
  hint: HINT_2D,
  family: true,
  menu: [
    {
      key: 'line2d', category: 'lines', order: 10, title: txt('lineMenu'), input: 'plane', presets: ['1 0', '1 1', '1 2'], command: 'l1 = (1 2)',
      desc: txt('lineDesc'),
    },
    {
      key: 'line2d-family', category: 'lines', order: 20, title: txt('lineFamilyMenu'), input: 'plane', presets: ['1 0', '1 1', '1 2'], init: { family: true },
      desc: txt('lineFamilyDesc'), command: 'Family((1 2))',
    },
  ],
  summary(item, ctx) {
    const m = lineModel(item, ctx);
    return `${txt('lineCuts', { a: icText(m.ic.a, 'a'), b: icText(m.ic.b, 'b') })} · ${dSym(m.hk)} = ${sig(ctx.plane2d.lattice.dSpacing(m.hk))} Å`;
  },
  settings(item, ctx) {
    const m = lineModel(item, ctx), L = ctx.plane2d.lattice, fam = familySegments(m.hk, ctx);
    let out = toggle('family', item.family, txt('lineFamily'), { hint: txt('lineFamilyHint') });
    out += facts([
      [txt('lineCutsA'), m.ic.a == null ? txt('interceptsParallel', { axis: 'a' }) : `<i>a</i>/${m.hk[0]} = ${icText(m.ic.a, 'a')}`],
      [txt('lineCutsB'), m.ic.b == null ? txt('interceptsParallel', { axis: 'b' }) : `<i>b</i>/${m.hk[1]} = ${icText(m.ic.b, 'b')}`],
      [txt('lineSpacing'), `${dSym(m.hk)} = <b>${sig(L.dSpacing(m.hk))} Å</b>`],
      fam.extra ? [txt('lineWithPoints'), txt('lineWithPointsValue', { lines: idx(fam.eq, 'plane'), d: sig(L.dSpacing(fam.eq)) })] : null,
    ]);
    out += formulaTex(txt('formulaD2D', { hk: m.hk.map(x => (x < 0 ? `\overline{${-x}}` : x)).join('') }));
    if (m.moved) out += note(txt('lineMovedNote', { corner: m.O.join(', ') }));
    if (fam.extra) out += note(txt('lineExtraNote'));
    return out;
  },
  primitives(item, ctx) {
    const colour = ctx.colour(item), opacity = ctx.opacity(item), prims = [];
    const m = lineModel(item, ctx);
    if (item.family) {
      for (const { seg, formula: f } of familySegments(m.hk, ctx).segments) prims.push({ kind: 'line', from: seg[0], to: seg[1], colour, opacity, width: 2.5, dashed: !f });
    } else if (m.seg) {
      prims.push({ kind: 'line', from: m.seg[0], to: m.seg[1], colour, opacity, width: 3.5 });
    }
    // intercepts of line n = 1
    for (const [pt, r, ax, dx, dy] of [[m.pa, m.ic.a, 'a', 0, 18], [m.pb, m.ic.b, 'b', -26, 0]]) {
      if (!pt) continue;
      prims.push({ kind: 'dot', at: pt, colour, r: 5.5 });
      prims.push({ kind: 'label', at: pt, html: icText(r, ax), colour, cls: 'lbl-icpt', dx, dy });
    }
    const o = ctx.plane2d.origin, mid = m.seg ? [(m.seg[0][0] + m.seg[1][0]) / 2, (m.seg[0][1] + m.seg[1][1]) / 2] : [o[0] + 0.5, o[1] + 0.5];
    const par = m.ic.a == null ? ' · ∥ <i>a</i>' : m.ic.b == null ? ' · ∥ <i>b</i>' : '';
    prims.push({ kind: 'label', at: mid, html: `${ctx.label(item)}${par}`, colour, dx: 16, dy: -14 });
    return prims;
  },
});

/* ---------- vector between two points ---------- */
const round3 = v => v.map(x => Math.round(x * 1000) / 1000 + 0);

export function vectorModel(item, ctx) {
  const d = [item.to[0] - item.from[0], item.to[1] - item.from[1]];
  return { d, comps: components2D(d), length: ctx.plane2d.lattice.length(d) };
}

registerType({
  type: 'vector2d',
  dim: '2d',
  prefix: 'v',
  title: txt('vectorTitle'),
  icon: 'arrow',
  help: 'vector2d',
  appearance: true,
  menu: [{
    key: 'vector2d', category: 'vectors', order: 10, title: txt('vectorMenu'), input: 'vector', command: 'v1 = Vector((0, 0), (1, 2))',
    desc: txt('vectorDesc'),
  }],
  create: ({ from = [0, 0], to = [1, 1], snap = true }) => ({ from: round3(from), to: round3(to), snap }),
  definition: item => `${item.name} = Vector(${pointText(item.from)}, ${pointText(item.to)})`,
  autoLabel: (item, ctx) => vectorModel(item, ctx).comps.replace(/([ab])/g, '<i>$1</i>'),
  summary(item, ctx) {
    const m = vectorModel(item, ctx);
    return `${pointText(item.from)} → ${pointText(item.to)} · |<i>v</i>| = ${sig(m.length)} Å`;
  },
  settings(item, ctx) {
    const m = vectorModel(item, ctx), len = lengthInfo(ctx.plane2d.lattice, m.d);
    const xy = (end, i) => `<input class="input" type="number" step="0.25" data-field="${end}-${i}" value="${trim(item[end][i], 3)}" aria-label="${end} ${'xy'[i]}">`;
    return `<div class="field"><div class="field-label">${txt('vectorFromTo')}</div>
        <div class="vec-row"><span>(</span>${xy('from', 0)}<span>,</span>${xy('from', 1)}<span>)</span><b>→</b><span>(</span>${xy('to', 0)}<span>,</span>${xy('to', 1)}<span>)</span></div>
        <p class="field-hint">${txt('vectorDragHint')}</p></div>`
      + facts([
        [txt('vectorComponents'), `<i>v</i> = ${componentsHTML(m.d)}`],
        [txt('directionLength'), `<b>${sig(m.length)} Å</b>`],
      ])
      + formulaTex(txt('formulaLengthResultV', { formula: len.formula, value: tn(m.length) }))
      + note(txt('vectorLengthNote'))
      + toggle('snap', item.snap, txt('vectorSnap'), { hint: txt('vectorSnapHint') });
  },
  onField(item, name, value, ctx, ws, phase) {
    const m = name.match(/^(from|to)-([01])$/);
    if (m && phase === 'change') {
      const v = parseFloat(value);
      if (!Number.isFinite(v)) return;
      item[m[1]][+m[2]] = Math.round(v * 1000) / 1000;
      ws.itemChanged(item);
    } else if (name === 'snap') item.snap = value;
  },
  primitives(item, ctx) {
    const colour = ctx.colour(item), opacity = ctx.opacity(item), m = vectorModel(item, ctx);
    const mid = [(item.from[0] + item.to[0]) / 2, (item.from[1] + item.to[1]) / 2];
    return [
      { kind: 'arrow', from: item.from, to: item.to, colour, opacity, width: 3.5 },
      { kind: 'label', at: mid, html: `<span class="nm">${esc(item.name)}</span> ${componentsHTML(m.d)} · ${sig(m.length)} Å`, colour, dy: -16 },
      { kind: 'handle', at: item.from, colour, id: item.id, end: 'from' },
      { kind: 'handle', at: item.to, colour, id: item.id, end: 'to' },
    ];
  },
});

/** Vector((x0, y0), (x1, y1)) — points in units of a and b. */
function parseEnds(args) {
  const ends = args.map(parsePoint2D);
  const bad = ends.find(e => e.error);
  return bad ? { error: bad.error } : { from: ends[0].point, to: ends[1].point };
}

registerCommand({
  name: 'Vector',
  args: 2,
  raw: true,
  dims: ['2d'],
  group: txt('cmdGroup2D'),
  type: 'vector2d',
  usage: 'Vector((0, 0), (1, 2))',
  help: txt('cmdHelpVector'),
  example: () => 'Vector((0, 0), (1, 2))',
  run(args, ws, name) {
    const e = parseEnds(args);
    if (e.error) return e;
    const item = ws.addItem('vector2d', { ...e, name });
    return { ok: txt('msgCreated', { label: ws.labelHTML(item) }), item };
  },
  update(item, args, ws) {
    const e = parseEnds(args);
    if (e.error) return e;
    item.from = round3(e.from);
    item.to = round3(e.to);
    return { ok: txt('msgChanged', { label: ws.labelHTML(item) }), item };
  },
});
