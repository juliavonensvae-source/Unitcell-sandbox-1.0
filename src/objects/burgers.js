/* =====================================================================
   Defects mode: the Burgers circuit (Burgers(edge1), names bc1 …).

   A right-handed circuit about the line of one dislocation, the same
   number of atom-to-atom steps each way (+g, +n, −g, −n), drawn step by
   step in the crystal (walkCircuit in src/math/dislocations.js) and,
   beside the block, in a perfect crystal. The perfect circuit closes; the
   real one does not when it goes round the line, and S → F is b (the
   SF/RH convention, which gives the same b as FS/RH).

   Fields: src (the dislocation's id), size (steps per side), shift [dg, dn]
   (moves the circuit, e.g. off the line, where it closes), step (how
   many steps are drawn), compare (the perfect crystal beside it).
   ===================================================================== */
import { registerType } from './registry.js';
import { registerCommand } from './commands.js';
import * as M from '../math/index.js';
import { sig, idx } from '../ui/format.js';
import { formulaTex, range, toggle, actionButton, helpButton, note } from '../ui/controls.js';
import { crystalOf, drawnPos, drawScale, restColour } from './crystal.js';
import { isDislocation, cubicP, stageOf } from './dislocations.js';
import { txt } from '../text.js';

const WORDS = () => [txt('bcRight'), txt('bcUp'), txt('bcLeft'), txt('bcDown')];

/** The dislocations a circuit can go round. */
const dislocations = ctx => ctx.ws.state.items.filter(isDislocation);

/**
 * Everything about a circuit: the walk in the crystal, the perfect circuit beside it and the closure.
 * → { D, frame, steps, walk, closure (units of a), start (fractional), layer, encloses, perfect: [Cartesian], offset } or { error }
 */
export function circuitOf(item, ctx) {
  const D = ctx.itemById(item.src);
  if (!isDislocation(D)) return { error: txt('bcNoDislocation') };
  if (!cubicP(ctx)) return { error: txt('dislCubicPShort') };
  const frame = M.FRAMES[D.line], [g, n, l] = frame, N = item.size, a = ctx.params.a, r = ctx.repeats;
  const start = [0, 0, 0];
  start[g] = Math.floor(D.at[0] - N / 2 + 0.5) + item.shift[0];
  start[n] = Math.floor(D.at[1] - N / 2 + 0.5) + item.shift[1];
  start[l] = Math.round(r[l] / 2);
  const C = crystalOf(ctx);
  const si = C.atoms.findIndex(t => t.kind === 'host' && M.norm(M.sub(t.f, start)) < 1e-6);
  if (si < 0 || start[g] + N > r[g] || start[n] + N > r[n] || start[g] < 0 || start[n] < 0) return { error: txt('bcOutside') };
  const steps = M.circuitSteps(N), walk = M.walkCircuit(C.atoms, si, frame, steps, a);
  const offset = [0, 0, 0];
  offset[g] = (r[g] + 2) * a;
  // the same steps in a perfect crystal, beside the block
  const perfect = [ctx.lattice.toCartesian(start)];
  for (const [dg, dn] of steps) { const p = perfect[perfect.length - 1].slice(); p[g] += dg * a; p[n] += dn * a; perfect.push(p); }
  const x = D.at[0] - start[g], y = D.at[1] - start[n];
  return {
    D, frame, steps, walk, start, layer: start[l], offset, perfect: perfect.map(p => M.add(p, offset)),
    closure: walk.out ? null : M.closureOf(C.atoms, walk.path),
    encloses: stageOf(D, ctx) === 'in' && x > 0 && x < N && y > 0 && y < N,
  };
}

/** "Step 6 of 16: 2 of 4 up". */
function stepText(item, K) {
  if (item.step === 0) return txt('bcStepStart');
  const N = item.size, k = item.step - 1, side = Math.floor(k / N);
  return txt('bcStep', { step: item.step, total: K.steps.length, k: (k % N) + 1, n: N, dir: WORDS()[side] });
}

/** The verdict once the circuit is complete. */
function verdict(item, ctx, K) {
  if (K.walk.out) return txt('bcRanOut');
  if (item.step < K.steps.length) return '';
  const c = K.closure, zero = c.every(v => Math.abs(v) < 1e-6);
  if (zero) return txt(K.encloses ? 'bcClosesAnyway' : 'bcCloses');
  const len = M.norm(c) * ctx.params.a;
  const kind = Math.abs(c[K.frame[2]]) > 1e-6 ? txt('bcIsScrew') : txt('bcIsEdge');
  return txt('bcFails', { b: `<i>a</i>${idx(c.map(v => Math.round(v)), 'dir')}`, len: sig(len), kind });
}

function live(item, ctx) {
  const K = circuitOf(item, ctx);
  if (K.error) return note(K.error);
  const end = verdict(item, ctx, K);
  return `<p class="pd-shell">${stepText(item, K)}</p>${end ? `<p class="bc-verdict">${end}</p>` : ''}`;
}

function settings(item, ctx) {
  const list = dislocations(ctx), total = 4 * item.size;
  const options = list.map(d => `<option value="${d.id}"${d.id === item.src ? ' selected' : ''}>${d.name} · ${d.type === 'edge' ? txt('dislEdgeTitle') : txt('dislScrewTitle')}</option>`).join('');
  return `<div class="field"><label class="field-label" for="bc-src-${item.id}">${txt('bcAround')}</label>
      <select class="input" id="bc-src-${item.id}" data-field="src">${options}</select></div>
    <div class="bc-steps" data-live>${live(item, ctx)}</div>
    <div class="btn-row">
      ${actionButton('back', txt('bcBack'), 'chevronLeft')}${actionButton('next', txt('bcNext'), 'chevronRight', 'btn-primary')}
      ${actionButton('play', txt('bcPlay'), 'play')}${actionButton(item.step >= total ? 'restart' : 'all', item.step >= total ? txt('bcRestart') : txt('bcAll'), 'reset')}
    </div>
    ${range('size', item.size, { min: 2, max: 6, step: 1, unit: '', label: txt('bcSize') })}
    <div class="field"><div class="field-label">${txt('bcMove')}</div>
      <div class="btn-row">${actionButton('shift-l', '←')}${actionButton('shift-r', '→')}${actionButton('shift-d', '↓')}${actionButton('shift-u', '↑')}${actionButton('shift-0', txt('bcCentre'))}</div>
      <p class="field-hint">${txt('bcMoveHint')}</p></div>
    ${toggle('compare', item.compare, txt('bcCompare'), { hint: txt('bcCompareHint') })}
    <div class="field"><div class="field-label"><span>${txt('bcRule')}${helpButton('burgers', { item: item.id })}</span></div>
      ${formulaTex(txt('formulaBurgers'))}<p class="field-hint">${txt('bcRuleHint')}</p></div>`;
}

/* ---------- drawing ---------- */
function primitives(item, ctx) {
  const K = circuitOf(item, ctx);
  if (K.error) return [];
  const C = crystalOf(ctx), colour = ctx.colour(item), hl = ctx.theme.highlight, L0 = ctx.L0, a = ctx.params.a;
  const k = Math.min(item.step, K.walk.done), pts = K.walk.path.slice(0, k + 1).map(i => drawnPos(C.atoms[i], ctx));
  const [g, n] = K.frame, rad = 0.035 * L0, dot = 0.22 * C.R * Math.max(0.6, drawScale(ctx));
  const up = (v, d = 0.42) => { const q = v.slice(); q[n] += d * a; return q; };
  const prims = [];
  const path = (list, opacity = 1) => {
    if (list.length > 1) prims.push({ kind: 'tubes', segments: list.slice(1).map((p, i) => [list[i], p]), radius: rad, colour, opacity });
    prims.push({ kind: 'spheres', centres: list, radius: dot, colour, opacity });
  };
  path(pts);
  prims.push({ kind: 'label', at: up(pts[0], -0.42), html: '<b>S</b>', colour, cls: 'lbl-defect' });
  const done = item.step >= K.steps.length && !K.walk.out;
  if (done) {
    const S = pts[0], F = pts[pts.length - 1], open = M.norm(M.sub(F, S)) > 0.05 * a;
    if (open) {
      prims.push({ kind: 'label', at: up(F), html: '<b>F</b>', colour, cls: 'lbl-defect' });
      prims.push({ kind: 'arrow', from: S, to: F, colour: hl, size: 0.5, label: '<b><i>b</i></b>', labelCls: 'lbl-dim', labelGap: 0.12 });
    } else prims.push({ kind: 'label', at: up(F), html: '<b>S = F</b>', colour, cls: 'lbl-defect' });
  }
  if (item.compare) prims.push(...perfectCopy(item, ctx, K, k, colour, done));
  // what each picture is
  const mid = M.add(ctx.lattice.toCartesian(K.start), [0, 0, 0].map((_, i) => (i === g ? 0.5 * item.size * a : i === n ? (item.size + 0.9) * a : 0)));
  prims.push({ kind: 'label', at: mid, html: txt('bcWithDislocation'), colour, cls: 'lbl-dim' });
  return prims;
}

/** The layer of a perfect crystal around the circuit, with the same steps: it closes. */
function perfectCopy(item, ctx, K, k, colour, done) {
  const C = crystalOf(ctx), [g, n, l] = K.frame, a = ctx.params.a, N = item.size, out = [];
  const atoms = [];
  for (let i = -1; i <= N + 1; i++) for (let j = -1; j <= N + 1; j++) {
    const f = [0, 0, 0];
    f[g] = K.start[g] + i; f[n] = K.start[n] + j; f[l] = K.layer;
    atoms.push(M.add(ctx.lattice.toCartesian(f), K.offset));
  }
  out.push({ kind: 'spheres', centres: atoms, radius: C.R * drawScale(ctx), colour: restColour(ctx), opacity: 1 });
  const pts = K.perfect.slice(0, k + 1), rad = 0.035 * ctx.L0, dot = 0.22 * C.R * Math.max(0.6, drawScale(ctx));
  if (pts.length > 1) out.push({ kind: 'tubes', segments: pts.slice(1).map((p, i) => [pts[i], p]), radius: rad, colour, opacity: 1 });
  out.push({ kind: 'spheres', centres: pts, radius: dot, colour, opacity: 1 });
  const down = p => { const q = p.slice(); q[n] -= 0.42 * a; return q; };
  out.push({ kind: 'label', at: down(pts[0]), html: done ? '<b>S = F</b>' : '<b>S</b>', colour, cls: 'lbl-defect' });
  const mid = M.add(K.perfect[0], [0, 0, 0].map((_, i) => (i === g ? 0.5 * N * a : i === n ? (N + 0.9) * a : 0)));
  out.push({ kind: 'label', at: mid, html: txt('bcPerfect'), colour, cls: 'lbl-dim' });
  return out;
}

registerType({
  type: 'burgers',
  mode: 'defects',
  prefix: 'bc',
  title: txt('bcTitle'),
  icon: 'circuit',
  help: 'burgers',
  appearance: true,
  menu: [{ key: 'burgers', category: 'line-defects', order: 30, title: txt('bcMenu'), desc: txt('bcDesc'), command: 'Burgers(edge1)', unavailable: ctx => (cubicP(ctx) ? null : txt('dislCubicPShort')) }],

  /** Goes round the newest dislocation; with none yet, an edge dislocation is added first. */
  prepare(init, model) {
    if (init.src != null) return;
    let D = dislocations(model.ctx).pop();
    if (!D) D = model.addItem('edge', {}, { quiet: true });
    init.src = D.id;
  },
  create: init => ({ src: init.src, size: init.size ?? 4, shift: [0, 0], step: 0, compare: true }),
  deps: item => [item.src],
  afterAdd: () => txt('bcAddNote'),
  autoLabel: () => txt('bcTitle'),
  definition: (item, ctx) => { const D = ctx.itemById(item.src); return `${item.name} = Burgers(${D ? D.name : '?'}${item.size !== 4 ? `, ${item.size}` : ''})`; },
  summary(item, ctx) {
    const K = circuitOf(item, ctx);
    if (K.error) return K.error;
    if (K.walk.out) return txt('bcRanOutShort');
    const c = K.closure;
    return c.every(v => Math.abs(v) < 1e-6) ? txt('bcSummaryCloses', { name: K.D.name }) : txt('bcSummaryFails', { name: K.D.name, b: `<i>a</i>${idx(c.map(v => Math.round(v)), 'dir')}` });
  },
  error: (item, ctx) => (isDislocation(ctx.itemById(item.src)) ? null : txt('bcNoDislocation')),
  settings,
  live,

  onField(item, name, value, ctx, ws) {
    if (name === 'src') { item.src = +value; item.step = 0; ws.redraw(item, { card: true }); return; }
    if (name === 'size') { item.size = value; item.step = Math.min(item.step, 4 * value); ws.redraw(item); return; }
    if (name === 'compare') { item.compare = value; ws.redraw(item); ws.frameView(); }
  },

  onAction(item, act, el, ctx, ws) {
    const total = 4 * item.size, shift = { 'shift-l': [-1, 0], 'shift-r': [1, 0], 'shift-d': [0, -1], 'shift-u': [0, 1] }[act];
    if (shift) item.shift = [item.shift[0] + shift[0], item.shift[1] + shift[1]];
    else if (act === 'shift-0') item.shift = [0, 0];
    else if (act === 'next') item.step = Math.min(total, item.step + 1);
    else if (act === 'back') item.step = Math.max(0, item.step - 1);
    else if (act === 'all') item.step = total;
    else if (act === 'restart') item.step = 0;
    else if (act === 'play' && ws.animate) {
      ws.animate(item, 260 * total, t => { item.step = Math.round(t * total); }, () => ws.redraw(item, { card: true }));
      return;
    } else return;
    ws.redraw(item, { card: act === 'all' || act === 'restart' || item.step === total || item.step === total - 1 });
  },

  primitives,
  circuit: circuitOf,
  /** The view also fits the perfect crystal beside the block. */
  frameExtra(item, ctx) {
    const K = circuitOf(item, ctx);
    if (!item.compare || K.error) return [];
    const [g, n] = K.frame, a = ctx.params.a;
    return [[-1, -1], [item.size + 1, item.size + 2]].map(([dg, dn]) => { const p = K.perfect[0].slice(); p[g] += dg * a; p[n] += dn * a; return p; });
  },
});

registerCommand({
  name: 'Burgers', mode: 'defects', raw: true, args: [0, 2], type: 'burgers', group: txt('catLineDefects'),
  usage: 'Burgers(edge1)', help: txt('bcDesc'), example: () => 'Burgers()',
  run(args, ws, name) {
    const p = parseBurgers(args, ws);
    if (p.error) return p;
    const item = ws.addItem('burgers', { name, ...p });
    return { ok: txt('msgCreated', { label: ws.labelHTML(item) }), item };
  },
  update(item, args, ws) {
    const p = parseBurgers(args, ws);
    if (p.error) return p;
    if (p.src != null) item.src = p.src;
    if (p.size) item.size = p.size;
    item.step = Math.min(item.step, 4 * item.size);
    return { ok: txt('msgChanged', { label: ws.labelHTML(item) }), item };
  },
});

/** Burgers(edge1, 4): the dislocation by name (optional) and the steps per side (2–6). */
function parseBurgers(args, ws) {
  if (!cubicP(ws.ctx)) return { error: txt('msgDislCubicP') };
  const out = {};
  for (const raw of args) {
    const a = String(raw).trim();
    if (!a) continue;
    if (/^\d+$/.test(a)) {
      if (+a < 2 || +a > 6) return { error: txt('msgBcSize') };
      out.size = +a;
      continue;
    }
    const D = ws.byName(a);
    if (!D) return { error: txt('msgBcMissing', { name: a }) };
    if (!isDislocation(D)) return { error: txt('msgBcNotDislocation', { name: a }) };
    out.src = D.id;
  }
  return out;
}
