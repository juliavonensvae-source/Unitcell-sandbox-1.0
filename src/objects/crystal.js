/* =====================================================================
   Defects mode: the crystal itself.

   crystalOf(ctx) builds the block of atoms with every visible defect in
   it (buildCrystal in src/math/defects.js) and keeps it on ctx until a
   defect changes. A defect type describes itself with the hook
   defect(item, ctx) → { remove, atoms, relax, shift, mark } (see
   buildCrystal); dislocations and point defects add up.

   'atoms' is the scene object that draws the host atoms (it takes the
   place of the lattice points): size, colour by how far each atom moved
   or by how much its bonds stretched, exaggerated relaxation, and the
   perfect positions. Defect atoms are drawn by their own objects.
   ===================================================================== */
import { registerType, getType } from './registry.js';
import * as M from '../math/index.js';
import { sig, trim } from '../ui/format.js';
import { toggle, segmented, range, note, helpButton } from '../ui/controls.js';
import { txt } from '../text.js';

/** The lattice points of the block (fractional), cached on ctx. */
export const blockPoints = ctx => ctx._points || (ctx._points = M.sitesInRegion(ctx.basis, ctx.region).map(s => s.f));

/**
 * The crystal of the scene on screen. It is cached on ctx and rebuilt when a
 * visible defect changes (the key is the defects' own data), so nothing has to
 * remember to throw it away. The item list is the live one: a deleted defect is
 * gone at once, even before the next recompute.
 */
export function crystalOf(ctx) {
  const list = ctx.ws.state.items.filter(it => it.visible && getType(it.type).defect);
  const cacheKey = JSON.stringify(list);
  if (ctx._crystal && ctx._crystalKey === cacheKey) return ctx._crystal;
  const L = ctx.lattice, dnn = ctx.analysis.neighbours.dnn, R = dnn / 2;
  const hosts = blockPoints(ctx).map(f => ({ f, p: L.toCartesian(f) }));
  // a bond reaches halfway to the second neighbours (√2 d_nn in cubic P and F, 1.15 d_nn in cubic I)
  const second = M.hostsAround(L, ctx.basis, ctx.basis[0].f, { n: 30 }).find(h => h.d > 1.01 * dnn);
  const defects = [];
  for (const it of list) {
    const d = getType(it.type).defect(it, ctx);
    if (d) defects.push({ id: it.id, ...d });
  }
  ctx._crystal = { ...M.buildCrystal({ hosts, defects, R, dnn, reach: second ? (dnn + second.d) / 2 : 1.2 * dnn }), R, dnn, hosts };
  ctx._crystalKey = cacheKey;
  return ctx._crystal;
}

/** Drawn size of the atoms: 1 = touching spheres. */
export const drawScale = ctx => ctx.pointRadius / (ctx.analysis.neighbours.dnn / 2);

/** How much the relaxation round point defects is exaggerated in the drawing. */
const exaggeration = ctx => ctx.ws.state.scene[0].exaggerate || 1;

/** Where an atom (or vacancy) is drawn: its perfect position, the dislocations' displacement and the (exaggerated) relaxation. */
export const drawnPos = (a, ctx) => (a.ur ? M.add(a.ref, M.add(a.ud, M.scale(a.ur, exaggeration(ctx)))) : a.pos);

/* ---------- colour ramps ---------- */
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const hex = c => `#${c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
/** Colour along stops [c0, c1, …] at t ∈ [0, 1]. */
function ramp(stops, t) {
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), u = x - i;
  const a = rgb(stops[i]), b = rgb(stops[i + 1]);
  return hex(a.map((v, k) => v + (b[k] - v) * u));
}
/** How far it moved: one hue, pale (still) to deep (moved most). */
const movedColour = (theme, t) => ramp([theme.movedLow, theme.movedMid, theme.movedHigh], t);
/** Strain: blue (squeezed) ← grey → red (stretched), t ∈ [−1, 1]. */
const strainColour = (theme, t) => ramp([theme.squeeze, theme.strainMid, theme.stretch], (t + 1) / 2);

/** The colour of an atom that has not moved and whose bonds are unchanged (e.g. the perfect crystal beside a Burgers circuit). */
export function restColour(ctx) {
  const A = ctx.ws.state.scene[0], mode = colourMode(A, crystalOf(ctx));
  return mode === 'moved' ? movedColour(ctx.theme, 0) : mode === 'strain' ? strainColour(ctx.theme, 0) : ctx.colour(A);
}

/**
 * What the atom colours show: 'moved', 'strain' or null (one colour). Before anything has moved the
 * crystal keeps its one colour; strain stays grey when nothing is strained (e.g. after a dislocation left).
 */
function colourMode(item, C) {
  if (item.colourBy === 'moved' && C.maxMoved > 1e-6) return 'moved';
  if (item.colourBy === 'strain') return 'strain';
  return null;
}
const share = (x, max) => (max > 1e-9 ? x / max : 0);

/** "a gradient from … to …" for the legend. */
const scaleBar = (stops, left, right) => `<span class="scale-bar" style="--g:linear-gradient(90deg, ${stops.join(', ')})"></span>
  <span class="scale-ends"><span>${left}</span><span>${right}</span></span>`;

registerType({
  type: 'atoms',
  mode: 'defects',
  title: txt('atomsTitle'),
  icon: 'spheres',
  help: 'relaxation',
  fixed: true,
  appearance: true,
  themeColour: true,
  autoLabel: () => txt('atomsTitle'),

  summary(item, ctx) {
    const C = crystalOf(ctx), n = C.atoms.filter(a => a.kind === 'host').length;
    const moved = C.maxMoved > 1e-6 ? ` · ${txt('atomsMovedUpTo', { d: sig(C.maxMoved, 2) })}` : ` · ${txt('atomsPerfect')}`;
    return `${txt(n === 1 ? 'atomsCountOne' : 'atomsCount', { count: n })}${moved}`;
  },

  settings(item, ctx) {
    const C = crystalOf(ctx);
    const by = item.colourBy, R = C.R;
    return `${note(txt('atomsNote', { r: sig(R) }))}
      ${range('size', item.size.spheres, { min: 20, max: 100, step: 5, label: txt('atomsSize') })}
      <div class="field"><div class="field-label"><span>${txt('atomsColourBy')}${helpButton('relaxation')}</span></div>
        ${segmented('colourBy', [{ value: 'none', label: txt('atomsColourNone') }, { value: 'moved', label: txt('atomsColourMoved') }, { value: 'strain', label: txt('atomsColourStrain') }], by)}
        <p class="field-hint">${by === 'moved' ? txt('atomsColourMovedHint') : by === 'strain' ? txt('atomsColourStrainHint') : txt('atomsColourNoneHint')}</p></div>
      ${range('exaggerate', item.exaggerate, { min: 1, max: 10, step: 1, unit: '×', label: txt('atomsExaggerate') })}
      <p class="field-hint">${txt('atomsExaggerateHint')}</p>
      ${toggle('ghosts', item.ghosts, txt('atomsGhosts'), { hint: txt('atomsGhostsHint') })}`;
  },

  onField(item, field, value, ctx, ws) {
    if (field === 'size') { item.size.spheres = value; ws.sceneObjectChanged(item); }
    else if (field === 'colourBy') { item.colourBy = value; ws.sceneObjectChanged(item, { card: true }); }
    else if (field === 'exaggerate' || field === 'ghosts') { item[field] = value; ws.sceneObjectChanged(item); }
  },

  primitives(item, ctx) {
    if (!item.visible) return [];
    const C = crystalOf(ctx), theme = ctx.theme, mode = colourMode(item, C);
    const hosts = C.atoms.filter(a => a.kind === 'host' && M.inSlice(a.f, ctx.slice));
    const base = ctx.colour(item), marks = new Map();
    const colourOf = a => {
      if (a.mark != null) {
        if (!marks.has(a.mark)) { const owner = ctx.itemById(a.mark); marks.set(a.mark, owner ? ctx.colour(owner) : base); }
        return marks.get(a.mark);
      }
      if (mode === 'moved') return movedColour(theme, share(a.moved, C.maxMoved));
      if (mode === 'strain') return strainColour(theme, share(a.strain, C.maxStrain));
      return base;
    };
    const prims = [{
      kind: 'spheres', centres: hosts.map(a => drawnPos(a, ctx)), radius: C.R * drawScale(ctx),
      colour: base, colours: hosts.map(colourOf), opacity: ctx.opacity(item),
    }];
    if (item.ghosts) {
      const moved = hosts.filter(a => a.moved > 1e-3 * C.R);
      if (moved.length) prims.push({ kind: 'spheres', centres: moved.map(a => a.ref), radius: 0.14 * C.R, colour: theme.cell, opacity: 0.55 });
    }
    return prims;
  },

  /** The colour scale on the canvas while atoms are coloured by movement or strain. */
  legend(item, ctx) {
    const C = crystalOf(ctx), mode = colourMode(item, C), t = ctx.theme;
    if (!mode || !item.visible || (mode === 'strain' && C.maxStrain < 1e-6)) return null;
    if (mode === 'moved') {
      return {
        title: txt('atomsLegendMoved'), help: 'relaxation',
        rows: [scaleBar([t.movedLow, t.movedMid, t.movedHigh], '0 Å', `${sig(C.maxMoved, 2)} Å`)],
        foot: item.exaggerate > 1 ? txt('atomsLegendExaggerated', { k: trim(item.exaggerate) }) : '',
      };
    }
    const pct = `${sig(100 * C.maxStrain, 2)} %`;
    return {
      title: txt('atomsLegendStrain'), help: 'relaxation',
      rows: [scaleBar([t.squeeze, t.strainMid, t.stretch], `−${pct}`, `+${pct}`)],
      foot: txt('atomsLegendStrainFoot'),
    };
  },
});
