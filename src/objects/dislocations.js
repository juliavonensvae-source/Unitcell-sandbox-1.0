/* =====================================================================
   Defects mode: line defects. 'edge' (edge1) and 'screw' (screw1).

   Fields: line (the cube axis it runs along: 0, 1, 2), sense (±1: which
   side the extra half-plane is on, or right/left-handed), at = [x, y]
   (the line in units of a along the glide direction and the slip-plane
   normal; y is halfway between two atomic planes), mag (0–100 % of b),
   nu (Poisson's ratio). The displacement field is src/math/dislocations.js.
   Only in cubic P (b = a⟨100⟩, the shortest lattice vector there).

   The line can glide out of the block: before it enters (x ≤ −½) the
   crystal is perfect; once it has left (x ≥ n + ½) the half above the
   slip plane has slipped by b over the half below and a step shows on
   each side. Glide animates x right through.
   ===================================================================== */
import { registerType } from './registry.js';
import { registerCommand } from './commands.js';
import * as M from '../math/index.js';
import { findBravais } from '../data/bravais.js';
import { sig, trim, idx } from '../ui/format.js';
import { formulaTex, range, segmented, toggle, actionButton, helpButton, note, facts } from '../ui/controls.js';
import { crystalOf, drawnPos } from './crystal.js';
import { txt } from '../text.js';

const AXES = ['a', 'b', 'c'];
export const isDislocation = item => !!item && (item.type === 'edge' || item.type === 'screw');
export const cubicP = ctx => ctx.bravais.id === 'cP';

/** Where the line is: 'before' (not in the crystal yet), 'in', or 'after' (it has left: slipped by b). */
export function stageOf(item, ctx) {
  const n = ctx.repeats[M.FRAMES[item.line][0]];
  return item.at[0] <= -0.5 ? 'before' : item.at[0] >= n + 0.5 ? 'after' : 'in';
}

/** The signed Burgers vector length (Å) and its direction as indices, e.g. [1 0 0]. */
function burgersOf(item, ctx) {
  const [g, , l] = M.FRAMES[item.line], v = [0, 0, 0];
  v[item.type === 'edge' ? g : l] = item.sense;
  return { b: (item.sense * ctx.params.a * item.mag) / 100, dir: v };
}

/** The extra half-plane of an edge dislocation: the column on the extra side whose first atom sits nearest the line. */
function extraColumn(item, ctx, b) {
  const [g, n] = M.FRAMES[item.line], [x, y] = item.at, a = ctx.params.a, side = Math.sign(b) || 1;
  const row = y + 0.5 * side;
  let best = null;
  for (let i = Math.floor(x) - 1; i <= Math.ceil(x) + 1; i++) {
    const p = i + M.edgeField((i - x) * a, (row - y) * a, b, item.nu)[0] / a;
    if (!best || Math.abs(p - x) < Math.abs(best.p - x)) best = { i, p };
  }
  return f => Math.abs(f[g] - best.i) < 1e-6 && (f[n] - y) * side > 0;
}

const TYPES = {
  edge: { prefix: 'edge', title: txt('dislEdgeTitle'), menu: txt('dislEdgeMenu'), desc: txt('dislEdgeDesc'), icon: 'edge', help: 'edge-dislocation', command: 'Edge', order: 10 },
  screw: { prefix: 'screw', title: txt('dislScrewTitle'), menu: txt('dislScrewMenu'), desc: txt('dislScrewDesc'), icon: 'screw', help: 'screw-dislocation', command: 'Screw', order: 20 },
};

/** The middle of the block: the line between two atomic planes. */
function middleOf(line, repeats) {
  const [g, n] = M.FRAMES[line];
  return [repeats[g] / 2, Math.min(Math.floor(repeats[n] / 2) + 0.5, repeats[n] - 0.5)];
}

function defect(item, ctx) {
  if (!cubicP(ctx)) return null;
  const stage = stageOf(item, ctx), a = ctx.params.a, { b } = burgersOf(item, ctx), [g, n, l] = M.FRAMES[item.line];
  if (stage === 'before' || !b) return null;
  if (stage === 'after') {
    const k = item.type === 'edge' ? g : l, y = item.at[1] * a;
    return { shift: p => { const u = [0, 0, 0]; u[k] = (p[n] > y ? 0.5 : -0.5) * b; return u; } };
  }
  return {
    shift: M.dislocationShift({ kind: item.type, line: item.line, at: item.at, b, nu: item.nu }, a),
    mark: item.type === 'edge' && item.half ? extraColumn(item, ctx, b) : null,
  };
}

/* ---------- drawing ---------- */
function primitives(item, ctx) {
  if (!cubicP(ctx) || stageOf(item, ctx) !== 'in') return shearArrows(item, ctx);
  const a = ctx.params.a, L0 = ctx.L0, colour = ctx.colour(item), op = ctx.opacity(item), r = ctx.repeats;
  const [g, n, l] = M.FRAMES[item.line], { b } = burgersOf(item, ctx), [x, y] = item.at;
  const at = (gg, nn, ll) => { const p = [0, 0, 0]; p[g] = gg * a; p[n] = nn * a; p[l] = ll * a; return p; };
  const [e0, e1] = M.lineEnds(item, a, r);
  const symbol = item.type === 'edge' ? (item.sense > 0 ? '⊥' : '⊤') : '↻';
  const prims = [
    { kind: 'tubes', segments: [[e0, e1]], radius: 0.024 * L0, colour, opacity: 1 },
    { kind: 'label', at: M.add(e1, at(0, 0, 0.35)), html: `<b>${symbol}</b> <span class="nm">${item.name}</span>`, colour, cls: 'lbl-defect' },
  ];
  if (item.core) prims.push({ kind: 'tubes', segments: [[e0, e1]], radius: Math.abs(b) || 0.01, colour, opacity: 0.12 * op });
  if (item.slip) {
    prims.push({ kind: 'polygon', points: [at(0, y, 0), at(r[g], y, 0), at(r[g], y, r[l]), at(0, y, r[l])], colour, opacity: 0.07 * op, dashed: true });
  }
  if (item.type === 'edge' && item.half) prims.push(...halfPlane(item, ctx, colour, op));
  if (item.type === 'screw' && item.ramp !== 'off' && !ctx.slice) {
    const levels = item.ramp === 'all' ? [...Array(r[l]).keys()] : [Math.floor(r[l] / 2)];
    for (const z0 of levels) prims.push({ kind: 'surface', triangles: M.screwRamp({ ...item, b }, a, z0, [r[g], r[n]]), colour, opacity: 0.2 * op });
  }
  // the Burgers vector: under the block beneath the line (edge), or beside the line along it (screw)
  if (item.bArrow && b) {
    const dir = item.type === 'edge' ? at(Math.sign(b), 0, 0) : at(0, 0, Math.sign(b)), len = Math.abs(b);
    const base = item.type === 'edge' ? at(x - 0.5 * Math.sign(b), -0.8, r[l]) : at(x + 0.9, y, r[l] / 2 - 0.5 * Math.sign(b));
    prims.push({ kind: 'arrow', from: base, to: M.add(base, M.scale(dir, len / a)), colour: ctx.theme.highlight, size: 0.45, label: '<b><i>b</i></b>', labelCls: 'lbl-dim', labelGap: 0.1 });
  }
  return [...prims, ...shearArrows(item, ctx)];
}

/** The extra half-plane: a see-through ribbon from the line through the atoms of its column, along the whole line. */
function halfPlane(item, ctx, colour, op) {
  const C = crystalOf(ctx), [g, n, l] = M.FRAMES[item.line], a = ctx.params.a, r = ctx.repeats;
  const column = C.atoms.filter(t => t.mark === item.id && Math.abs(t.f[l]) < 1e-6).sort((p, q) => (p.f[n] - q.f[n]) * item.sense);
  if (!column.length) return [];
  const core = [0, 0, 0];
  core[g] = item.at[0] * a; core[n] = item.at[1] * a;
  const pts = [core, ...column.map(t => drawnPos(t, ctx))];
  const along = p => { const q = p.slice(); q[l] = r[l] * a; return q; };
  return pts.slice(1).map((p, i) => ({ kind: 'polygon', points: [pts[i], p, along(p), along(pts[i])], colour, opacity: 0.16 * op, outline: false }));
}

/** τ: the shear stress that drives the glide, on the top and bottom faces (while gliding, or when turned on). */
function shearArrows(item, ctx) {
  if (!item.shear || !cubicP(ctx)) return [];
  const a = ctx.params.a, r = ctx.repeats, [g, n, l] = M.FRAMES[item.line], s = Math.sign(burgersOf(item, ctx).b) || 1;
  const at = (gg, nn) => { const p = [0, 0, 0]; p[g] = gg * a; p[n] = nn * a; p[l] = (r[l] / 2) * a; return p; };
  const step = [0, 0, 0], len = Math.min(2, r[g] / 2);
  step[g] = s * len * a;
  // the top face is pushed along b, the bottom face the other way
  const top = at(r[g] / 2 - (s * len) / 2, r[n] + 0.7), bottom = at(r[g] / 2 + (s * len) / 2, -0.7);
  const arrow = (from, dir) => ({ kind: 'arrow', from, to: M.add(from, M.scale(step, dir)), colour: ctx.theme.highlight, size: 0.5, label: '<i>τ</i>', labelCls: 'lbl-dim' });
  return [arrow(top, 1), arrow(bottom, -1)];
}

/* ---------- the card ---------- */
function where(item, ctx) {
  const stage = stageOf(item, ctx);
  if (stage === 'before') return txt('dislBefore');
  if (stage === 'after') return txt(item.type === 'edge' ? 'dislAfterEdge' : 'dislAfterScrew', { b: sig(Math.abs(burgersOf(item, ctx).b)) });
  return txt('dislIn');
}

function live(item, ctx) {
  const { b, dir } = burgersOf(item, ctx), line = [0, 0, 0];
  line[item.line] = 1;
  return `<p class="pd-shell">${where(item, ctx)}</p>${facts([
    [`${txt('dislBurgers')}${helpButton('burgers', { item: item.id })}`, `<b><i>b</i> = ${item.mag === 100 ? '' : `${trim(item.mag / 100, 2)} · `}<i>a</i>${idx(dir, 'dir')}</b>`],
    [txt('dislBLength'), `${sig(Math.abs(b))} Å`],
    [txt('dislLine'), idx(line, 'dir')],
    [txt('dislAngle'), item.type === 'edge' ? txt('dislPerpendicular') : txt('dislParallel')],
  ])}`;
}

function settings(item, ctx) {
  if (!cubicP(ctx)) {
    return `${note(txt('dislCubicPOnly', { lattice: ctx.bravais.name }))}<div class="btn-row">${actionButton('lat-cP', findBravais('cP').name, 'cube')}</div>`;
  }
  const [g, n] = M.FRAMES[item.line], r = ctx.repeats, edge = item.type === 'edge';
  return `<div class="pd-live" data-live>${live(item, ctx)}</div>
    <div class="field"><div class="field-label">${txt('dislLineAlong')}</div>
      ${segmented('line', AXES.map((x, i) => ({ value: String(i), label: x })), String(item.line))}</div>
    <div class="field"><div class="field-label">${txt(edge ? 'dislHalfSide' : 'dislHand')}</div>
      ${segmented('sense', edge ? [{ value: '1', label: txt('dislAbove') }, { value: '-1', label: txt('dislBelow') }] : [{ value: '1', label: txt('dislRight') }, { value: '-1', label: txt('dislLeft') }], String(item.sense))}</div>
    ${range('x', item.at[0], { min: -1, max: r[g] + 1, step: 0.05, unit: '', label: txt('dislPosition', { axis: AXES[g] }) })}
    ${range('y', item.at[1], { min: 0.5, max: Math.max(0.5, r[n] - 0.5), step: 1, unit: '', label: txt('dislPlane', { axis: AXES[n] }) })}
    <div class="btn-row">${actionButton('glide', txt('dislGlide'), 'play', 'btn-primary')}${actionButton('middle', txt('dislMiddle'), 'reset')}</div>
    <p class="field-hint">${txt(edge ? 'dislGlideHintEdge' : 'dislGlideHintScrew')}</p>
    ${range('mag', item.mag, { min: 0, max: 100, step: 5, label: txt('dislMag') })}
    <p class="field-hint">${txt('dislMagHint')}</p>
    <div class="adv-only">${range('nu', Math.round(item.nu * 100), { min: 0, max: 50, step: 5, unit: '', label: txt('dislNu') })}<p class="field-hint">${txt('dislNuHint', { nu: trim(item.nu, 2) })}</p></div>
    ${edge ? toggle('half', item.half, txt('dislShowHalf'), { hint: txt('dislShowHalfHint') }) : toggle('rampAll', item.ramp === 'all', txt('dislRampAll'), { hint: txt('dislRampAllHint') })}
    ${toggle('slip', item.slip, txt('dislShowSlip'))}
    ${toggle('core', item.core, txt('dislShowCore'), { hint: txt('dislShowCoreHint') })}
    ${toggle('bArrow', item.bArrow, txt('dislShowB'))}
    ${toggle('shear', item.shear, txt('dislShowShear'), { hint: txt('dislShowShearHint') })}
    <div class="field"><div class="field-label"><span>${txt('dislField')}${helpButton(TYPES[item.type].help, { item: item.id })}</span></div>
      ${edge ? `${formulaTex(txt('formulaEdgeUx'))}${formulaTex(txt('formulaEdgeUy'))}` : formulaTex(txt('formulaScrew'))}
      <p class="field-hint">${txt('dislFieldHint')}</p></div>`;
}

/* ---------- the types ---------- */
for (const [type, T] of Object.entries(TYPES)) {
  registerType({
    type,
    mode: 'defects',
    prefix: T.prefix,
    title: T.title,
    icon: T.icon,
    help: T.help,
    appearance: true,
    menu: [{ key: type, category: 'line-defects', order: T.order, title: T.menu, desc: T.desc, command: `${T.command}()`, unavailable: ctx => (cubicP(ctx) ? null : txt('dislCubicPShort')) }],

    create(init, ctx) {
      const line = init.line ?? 2;
      return {
        line, sense: init.sense ?? 1, at: middleOf(line, ctx.repeats), mag: 100, nu: M.NU,
        half: true, slip: true, core: true, bArrow: true, shear: false, ramp: 'one',
      };
    },
    /** Edge dislocations colour the atoms by strain (squeezed above, stretched below) when they still show how far they moved. */
    afterAdd(item, ctx, ws) {
      const A = ws.state.scene[0];
      if (type !== 'edge' || A.colourBy !== 'moved') return '';
      A.colourBy = 'strain';
      return txt('dislAddNoteStrain');
    },
    /** A smaller block: keep the line inside, between two atomic planes. */
    refresh(item, ctx) {
      const [g, n] = M.FRAMES[item.line], r = ctx.repeats;
      item.at = [Math.max(-1, Math.min(r[g] + 1, item.at[0])), Math.min(Math.max(0.5, item.at[1]), Math.max(0.5, r[n] - 0.5))];
    },
    defect,
    autoLabel: () => T.title,
    definition: item => `${item.name} = ${T.command}(${item.sense < 0 ? '-' : ''}${AXES[item.line]})`,
    summary(item, ctx) {
      if (!cubicP(ctx)) return txt('dislCubicPShort');
      const { dir } = burgersOf(item, ctx), line = [0, 0, 0];
      line[item.line] = 1;
      return txt('dislSummary', { b: `<i>a</i>${idx(dir, 'dir')}`, line: idx(line, 'dir') });
    },
    settings,
    live,

    onField(item, name, value, ctx, ws) {
      if (name === 'x') { item.at = [value, item.at[1]]; ws.redraw(item); return; }
      if (name === 'y') { item.at = [item.at[0], value]; ws.redraw(item); return; }
      if (name === 'mag') { item.mag = value; ws.redraw(item); return; }
      if (name === 'nu') { item.nu = value / 100; ws.redraw(item); return; }
      if (name === 'line') { item.line = +value; item.at = middleOf(item.line, ctx.repeats); ws.redraw(item, { card: true }); return; }
      if (name === 'sense') { item.sense = +value; ws.redraw(item, { card: true }); return; }
      if (name === 'rampAll') { item.ramp = value ? 'all' : 'one'; ws.redraw(item); return; }
      if (['half', 'slip', 'core', 'bArrow', 'shear'].includes(name)) { item[name] = value; ws.redraw(item); }
    },

    onAction(item, act, el, ctx, ws) {
      if (act === 'lat-cP') { ws.setLattice('cP'); return; }
      if (act === 'middle') { item.at = middleOf(item.line, ctx.repeats); ws.redraw(item, { card: true }); return; }
      if (act === 'glide' && ws.animate) {
        const n = ctx.repeats[M.FRAMES[item.line][0]], y = item.at[1];
        item.shear = true;
        ws.animate(item, 900 * (n + 2), t => { item.at = [-1 + (n + 2) * t, y]; }, () => ws.redraw(item, { card: true }));
      }
    },

    primitives,
    framePad: (item, ctx) => (item.shear ? 1.2 * ctx.params.a : 0),
  });

  registerCommand({
    name: T.command, mode: 'defects', raw: true, args: [0, 1], type, group: txt('catLineDefects'),
    usage: `${T.command}(c)`, help: T.desc, example: () => `${T.command}()`,
    run(args, ws, name) {
      if (!cubicP(ws.ctx)) return { error: txt('msgDislCubicP') };
      const p = parseLine(args[0]);
      if (p.error) return p;
      const item = ws.addItem(type, { name, ...p });
      return { ok: txt('msgCreated', { label: ws.labelHTML(item) }), item };
    },
    update(item, args, ws) {
      const p = parseLine(args[0]);
      if (p.error) return p;
      if (p.line != null && p.line !== item.line) { item.line = p.line; item.at = middleOf(p.line, ws.ctx.repeats); }
      if (p.sense) item.sense = p.sense;
      return { ok: txt('msgChanged', { label: ws.labelHTML(item) }), item };
    },
  });
}

/** "c", "-a", "+b" → { line, sense }; nothing → {} (along c, sense +). */
function parseLine(arg) {
  const s = String(arg ?? '').trim();
  if (!s) return {};
  const m = s.match(/^([+-−])?\s*([abc])$/i);
  if (!m) return { error: txt('msgDislAxis', { arg: s }) };
  return { line: AXES.indexOf(m[2].toLowerCase()), sense: m[1] === '-' || m[1] === '−' ? -1 : 1 };
}
