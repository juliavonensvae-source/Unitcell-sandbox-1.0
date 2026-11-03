/* Direction [uvw]: an arrow from the origin to u·a + v·b + w·c.

   A direction is either typed ([1 1 0]) or worked out from two planes
   (item.source = { kind: 'intersection', p1, p2 }): the line where the planes
   meet, [uvw] = h₁ × h₂. A worked-out direction stays linked to its planes
   and is recalculated whenever they change. */
import { registerCommand } from './commands.js';
import * as M from '../math/index.js';
import { HELP } from '../help/content.js';
import { idx, sig } from '../ui/format.js';
import { esc } from '../ui/dom.js';
import { facts, formulaTex, note, actionButton } from '../ui/controls.js';
import { tIdx, tInt } from '../help/tex.js';
import { indexedType, hexHint, indexRows } from './indexed.js';
import { validItems, itemOptions, nameOf, invalidIndices } from './linked.js';
import { txt } from '../text.js';

const R = String.raw;

/** "a + b − 2c" for [1 1 -2] */
export function vectorSum(uvw) {
  const terms = [];
  uvw.forEach((n, i) => {
    if (!n) return;
    const axis = 'abc'[i], mag = Math.abs(n) === 1 ? '' : Math.abs(n);
    terms.push({ sign: n < 0 ? '−' : '+', text: `${mag}<i>${axis}</i>` });
  });
  return terms.map((t, i) => (i === 0 ? (t.sign === '−' ? '−' : '') : ` ${t.sign} `) + t.text).join('');
}

/** Index label; on hexagonal axes both notations: [100] = [21̄1̄0]. */
export function directionIndices(uvw, hexAxes) {
  return hexAxes ? `${idx(uvw, 'dir')} = ${idx(M.directionToFour(uvw), 'dir')}` : idx(uvw, 'dir');
}

const parse = (text, ctx, typing) => M.parseDirection(text, ctx.hexAxes, { allowFour: !typing || ctx.advanced });
const nm = it => `<span class="nm">${esc(it.name)}</span>`;
const minus = n => (n < 0 ? `(−${-n})` : `${n}`);

/** Recalculate a worked-out direction from its two planes. */
function fromPlanes(item, ctx) {
  const P1 = ctx.itemById(item.source.p1), P2 = ctx.itemById(item.source.p2);
  if (!P1 || !P2 || P1.type !== 'plane' || P2.type !== 'plane' || P1 === P2) return { error: txt('msgChooseTwoPlanes') };
  if (P1.parsed.error || P2.parsed.error) return { error: txt('msgPlaneInvalid', { name: (P1.parsed.error ? P1 : P2).name }) };
  const z = M.zoneAxis(P1.parsed.hkl, P2.parsed.hkl);
  if (z.parallel) return { error: txt('msgPlanesParallel') };
  return { uvw: z.uvw, four: null, raw: z.raw };
}

/** Where the two planes (as drawn in the cell) cross, as a fractional segment, or null. */
function crossingSegment(item, ctx) {
  const P1 = ctx.itemById(item.source.p1), P2 = ctx.itemById(item.source.p2);
  const h1 = P1.parsed.hkl, h2 = P2.parsed.hkl, R = ctx.unitRegion, O = ctx.origin;
  const line = M.intersectionLine(h1, M.representativeLevelFrom(h1, R, O), h2, M.representativeLevelFrom(h2, R, O));
  return line && M.clipLineToRegion(line.f0, line.d, R);
}

indexedType({
  type: 'direction',
  prefix: 'd',
  title: txt('directionTitle'),
  icon: 'arrow',
  help: item => (item && item.source ? 'intersection' : 'direction'),
  appearance: true,
  key: 'uvw',
  brackets: '[]',
  placeholder: '1 1 0',
  parse,
  label: (uvw, ctx) => directionIndices(uvw, ctx.hexAxes),
  hint: ctx => hexHint(ctx, '[]', 'uvtw', '1 1 0'),
  typed: item => !item.source,
  menu: [
    {
      key: 'direction', category: 'directions', order: 10,
      title: txt('directionMenu'), desc: HELP.direction,
      input: 'direction', presets: ['1 0 0', '1 1 0', '1 1 1'], command: 'd1 = [1 1 0]',
    },
    {
      key: 'intersection', category: 'calculations', order: 55,
      title: txt('intersectionMenu'),
      desc: txt('intersectionDesc'),
      init: { source: 'auto' }, command: 'Intersection(p1, p2)',
    },
  ],

  create(init, ctx) {
    if (init.source) {
      let source = init.source;
      if (source === 'auto') {
        const last = validItems(ctx, 'plane').slice(-2);
        source = { kind: 'intersection', p1: last[0] ? last[0].id : null, p2: last[1] ? last[1].id : null };
      }
      const item = { text: '', source };
      item.parsed = fromPlanes(item, ctx);
      return item;
    }
    return { text: init.text, parsed: parse(init.text, ctx, true) };
  },
  refresh: (item, ctx) => { item.parsed = item.source ? fromPlanes(item, ctx) : parse(item.text, ctx, false); },
  definition: (item, ctx) => (item.source
    ? `${item.name} = Intersection(${nameOf(ctx, item.source.p1)}, ${nameOf(ctx, item.source.p2)})`
    : `${item.name} = [${item.text}]`),
  deps: item => (item.source ? [item.source.p1, item.source.p2].filter(id => id != null) : []),

  summary(item, ctx) {
    const len = `|<i>r</i>| = ${sig(ctx.lattice.length(item.parsed.uvw))} Å`;
    if (!item.source) return len;
    return `${nm(ctx.itemById(item.source.p1))} ∩ ${nm(ctx.itemById(item.source.p2))} · ${len}`;
  },

  settings(item, ctx) {
    if (item.source) return intersectionSettings(item, ctx);
    return resultFacts(item.parsed.uvw, ctx) + `<div class="btn-row">${actionButton('lookdown', txt('directionLook'), 'target')}</div>`;
  },

  onField(item, name, value, ctx, ws) {
    if ((name === 'p1' || name === 'p2') && item.source) {
      item.source[name] = value ? +value : null;
      ws.itemChanged(item);
    }
  },

  onAction(item, act, el, ctx, ws) {
    if (act === 'lookdown' && !item.parsed.error) ws.lookAlong(ctx.lattice.toCartesian(item.parsed.uvw));
    if (act === 'quick-planes' && item.source) {
      const A = ws.addItem('plane', { text: '1 1 1' }, { quiet: true });
      const B = ws.addItem('plane', { text: '1 -1 0' }, { quiet: true });
      item.source.p1 = A.id;
      item.source.p2 = B.id;
      ws.itemChanged(item);
    }
  },

  primitives(item, ctx) {
    const L = ctx.lattice, colour = ctx.colour(item), opacity = ctx.opacity(item);
    // from the origin (a corner of the highlighted cell) to origin + [uvw]
    const O = ctx.origin;
    const prims = [{ kind: 'arrow', from: L.toCartesian(O), to: L.toCartesian(M.add(O, item.parsed.uvw)), colour, opacity, label: ctx.label(item) }];
    if (item.source) {
      // the line where the two planes cross inside the cell, dashed
      const seg = crossingSegment(item, ctx);
      if (seg) {
        const [p, q] = seg.map(f => L.toCartesian(f)), n = 14, dashes = [];
        for (let i = 0; i < n; i += 2) {
          const at = t => p.map((x, k) => x + (q[k] - x) * t);
          dashes.push([at(i / n), at((i + 1) / n)]);
        }
        prims.push({ kind: 'tubes', segments: dashes, radius: 0.02 * ctx.L0, colour, opacity });
      }
    }
    return prims;
  },
});

function resultFacts(uvw, ctx) {
  return facts([
    [txt('directionVector'), `<i>r</i> = ${vectorSum(uvw)}`],
    [txt('directionLength'), `|<i>r</i>| = √(uᵀGu) = ${sig(ctx.lattice.length(uvw))} Å`],
    ...indexRows(ctx, uvw, M.directionToFour(uvw), 'dir'),
  ]);
}

function intersectionSettings(item, ctx) {
  const planes = validItems(ctx, 'plane');
  const options = sel => itemOptions(planes, sel, ctx, 'plane');
  let out = note(txt('intersectionNote'))
    + `<div class="pair-pick">
      <select class="input" data-field="p1" aria-label="${txt('intersectionFirst')}">${options(item.source.p1)}</select>
      <span class="pair-sym">∩</span>
      <select class="input" data-field="p2" aria-label="${txt('intersectionSecond')}">${options(item.source.p2)}</select></div>`;
  if (planes.length < 2) out += note(txt('intersectionAddTwo')) + `<div class="btn-row">${actionButton('quick-planes', txt('intersectionQuick'), 'plus')}</div>`;
  out += formulaTex(txt('intersectionFormula'));
  if (item.parsed.error) return `${out}<p class="field-error">${esc(item.parsed.error)}</p>`;
  const [h1, k1, l1] = ctx.itemById(item.source.p1).parsed.hkl, [h2, k2, l2] = ctx.itemById(item.source.p2).parsed.hkl;
  const raw = item.parsed.raw;
  out += formulaTex(txt('intersectionWorked', { h1, k1, l1, h2, k2, l2, k1b: tInt(k1), l2b: tInt(l2), l1b: tInt(l1), k2b: tInt(k2), result: raw.join(',\\ '), uvw: tIdx(item.parsed.uvw) }));
  out += resultFacts(item.parsed.uvw, ctx);
  out += note(crossingSegment(item, ctx)
    ? txt('intersectionDrawn')
    : txt('intersectionNotDrawn'));
  return out + `<div class="btn-row">${actionButton('lookdown', txt('directionLook'), 'target')}</div>`;
}

registerCommand({
  name: 'Intersection',
  args: 2,
  group: txt('catCalculations'),
  type: 'direction',
  update(item, [A, B], ws) {
    for (const it of [A, B]) if (it.type !== 'plane' || it.parsed.error) return { error: txt('msgIntersectionNeeds') };
    if (A === B) return { error: txt('msgPickTwoPlanes') };
    item.source = { kind: 'intersection', p1: A.id, p2: B.id };
    item.text = '';
    return { ok: txt('msgChanged', { label: ws.labelHTML(item) }), item };
  },
  usage: 'Intersection(p1, p2)',
  help: txt('cmdHelpIntersection'),
  example: (dirs, planes) => (planes.length >= 2 ? `Intersection(${planes[0].name}, ${planes[1].name})` : 'Intersection(p1, p2)'),
  run([A, B], ws, name) {
    for (const it of [A, B]) {
      if (it.type !== 'plane') return { error: txt('msgIntersectionNotPlane', { name: it.name, what: it.type === 'direction' ? txt('wordADirection') : txt('wordACalculation') }) };
      if (it.parsed.error) return invalidIndices(it);
    }
    if (A === B) return { error: txt('msgPickTwoPlanesEg', { name: A.name }) };
    if (M.zoneAxis(A.parsed.hkl, B.parsed.hkl).parallel) return { error: txt('msgParallelNames', { a: A.name, b: B.name }) };
    const item = ws.addItem('direction', { source: { kind: 'intersection', p1: A.id, p2: B.id }, name });
    return { ok: txt('msgCreatedMeet', { label: ws.labelHTML(item), a: esc(A.name), b: esc(B.name) }), item };
  },
});
