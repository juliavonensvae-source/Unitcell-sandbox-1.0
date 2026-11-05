/* =====================================================================
   Defects mode: slip on a close-packed plane ('slip', names slip1 …).

   The densest planes of the lattice on screen and the close-packed
   directions in them (src/math/slip.js): {100}⟨100⟩ in cubic P,
   {110}⟨111⟩ in cubic I and {111}⟨110⟩ in cubic F. The two atomic layers
   either side of one slip plane are drawn as touching spheres, the rest
   of the block faint (or shown, or hidden), so the plane can be seen.
   Glide sends a straight dislocation (edge or screw) across the plane:
   behind its line the layer above has slipped by b over the layer below.
   In cubic F the dislocation can split into two Shockley partials with a
   ribbon of stacking fault between them.

   Fields: lattice (whose planes; another lattice starts again), plane,
   dir (indices into the lattice's planes and the
   directions in that plane), character ('edge' | 'screw'), partials and
   width (cubic F: split, and how far apart in units of |b|), t (0: not
   in the crystal yet, 1: it has crossed), rest ('show' | 'faint' |
   'hide'), size (of the layer atoms, % of touching), showPlane, dirs,
   path, shear (what is drawn).

   The atoms are the crystal's (objects/crystal.js): this type moves them
   through its defect hook and draws the atoms of its two layers itself
   (drawsMarked); the Atoms object draws the rest.
   ===================================================================== */
import { registerType } from './registry.js';
import { registerCommand } from './commands.js';
import * as M from '../math/index.js';
import { findBravais } from '../data/bravais.js';
import { LAYER_COLOURS } from '../data/stacking.js';
import { sig, idx } from '../ui/format.js';
import { range, segmented, toggle, actionButton, helpButton, note, facts } from '../ui/controls.js';
import { crystalOf, drawnPos, blockPoints } from './crystal.js';
import { txt } from '../text.js';

/** The colours of the layer below the slip plane, the layer above and the stacking fault (as in Close packing: A, B, C). */
export const SLIP_COLOURS = { below: LAYER_COLOURS.A, above: LAYER_COLOURS.B, fault: LAYER_COLOURS.C };

const STRUCTURE = { cP: 'slipSC', cI: 'slipBCC', cF: 'slipFCC' };
const hasSlip = ctx => !!M.SLIP_SYSTEMS[ctx.bravais.id];
const clampIndex = (i, list) => Math.max(0, Math.min(list.length - 1, i | 0));

/** "a/2[1̄10]": a lattice vector (units of a) as a fraction of a times its indices. */
export function vectorText(v) {
  const r = M.asIndices(v);
  if (!r) return '';
  return `<i>a</i>${r.den === 1 ? '' : `/${r.den}`}${idx(r.uvw, 'dir')}`;
}

/** A Cartesian direction of the cubic cell as whole indices, sign chosen with fewer minus signs: ξ → [1̄1̄2]. */
function directionIndices(v) {
  const small = Math.min(...v.filter(x => Math.abs(x) > 1e-9).map(Math.abs));
  for (let k = 1; k <= 6; k++) {
    const w = v.map(x => (x / small) * k);
    if (w.every(x => Math.abs(x - Math.round(x)) < 1e-6)) {
      const u = w.map(x => Math.round(x) + 0);
      return u.filter(x => x < 0).length > u.filter(x => x > 0).length ? u.map(x => -x + 0) : u;
    }
  }
  return v.map(x => +x.toFixed(2));
}

/**
 * Everything about the slip system of an item in the scene on screen, or null outside cubic P, I and F:
 * { id, planes, hkl, dirs, uvw, bF (fractional), b (Cartesian), blen, n, d, level, o, frame, poly, span, stage, x, w,
 *   partials: [b1F, b2F] | null, side(f), inLayers(f), upper (a lattice point just above the plane) }
 */
export function slipGeometry(item, ctx) {
  if (!hasSlip(ctx)) return null;
  const id = ctx.bravais.id, L = ctx.lattice;
  const planes = M.slipPlanes(id), hkl = planes[clampIndex(item.plane, planes)];
  const dirs = M.slipDirections(id, hkl), uvw = dirs[clampIndex(item.dir, dirs)];
  const bF = M.burgersOf(id, uvw), b = L.toCartesian(bF), blen = M.norm(b);
  const n = L.planeNormal(hkl), d = L.dSpacing(hkl);
  // the slip plane h·f = level lies halfway between two atomic layers (at whole levels), near the middle of the block
  const range0 = M.levelRange(hkl, ctx.region);
  const level = Math.floor((range0.min + range0.max) / 2) + 0.5;
  const verts = ctx.region.vertices.map(v => L.toCartesian(v));
  const centre = M.centroid(verts);
  const o = M.sub(centre, M.scale(n, M.dot(n, centre) - level * d));
  const frame = M.slipFrame(n, b, item.character);
  const pts = blockPoints(ctx);
  const X = pts.map(f => M.dot(M.sub(L.toCartesian(f), o), frame.m));
  const span = [Math.min(...X), Math.max(...X)];
  const side = f => Math.sign(M.dot(hkl, f) - level);
  const inLayers = f => Math.abs(Math.abs(M.dot(hkl, f) - level) - 0.5) < 1e-6;
  const upper = pts.find(f => Math.abs(M.dot(hkl, f) - level - 0.5) < 1e-6) || null;
  const partials = id === 'cF' && item.partials && upper ? M.shockleyPartials(bF, hkl, upper, M.isLatticePoint(ctx.basis)) : null;
  const w = partials ? item.width * blen : 0;
  const { stage, x } = M.slipStage(item.t, span, blen, w);
  const fpoly = M.planePolygonIn(hkl, level, ctx.region);
  return {
    id, planes, hkl, dirs, uvw, bF, b, blen, n, d, level, o, frame, span, stage, x, w, partials, side, inLayers, upper,
    poly: fpoly ? fpoly.map(f => L.toCartesian(f)) : null, verts,
  };
}

/** A point on the slip plane, X along m from the middle. */
const onPlane = (G, X) => M.add(G.o, M.scale(G.frame.m, X));

/** The dislocation lines: [{ x, b (Cartesian), bF, kind: 'perfect' | 'leading' | 'trailing' }]. */
function linesOf(G, ctx) {
  if (!G.partials) return [{ x: G.x, b: G.b, bF: G.bF, kind: 'perfect' }];
  const L = ctx.lattice, [b1, b2] = G.partials;
  return [
    { x: G.x + G.w / 2, b: L.toCartesian(b1), bF: b1, kind: 'leading' },
    { x: G.x - G.w / 2, b: L.toCartesian(b2), bF: b2, kind: 'trailing' },
  ];
}

/** The defect hook: how the atoms move, and which atoms are this object's (its two layers). */
function defect(item, ctx) {
  const G = slipGeometry(item, ctx);
  if (!G) return null;
  const mark = f => G.inLayers(f);
  if (G.stage === 'before') return { mark };
  if (G.stage === 'after') return { mark, shift: p => M.scale(G.b, M.dot(M.sub(p, G.o), G.n) > 0 ? 0.5 : -0.5) };
  const fields = linesOf(G, ctx).map(l => M.lineShift(G.frame, onPlane(G, l.x), l.b, { zeta: M.coreHalfWidth(G.d, l.b, G.frame.xi) }));
  return { mark, shift: p => fields.reduce((u, f) => M.add(u, f(p)), [0, 0, 0]) };
}

/* ---------- drawing ---------- */

/** The segment of the line at X across the block (Cartesian), sticking out by `out` at both ends so it shows between touching atoms; or null. */
function lineSegment(G, X, ctx, out = 0) {
  const L = ctx.lattice, seg = M.clipLineToRegion(L.toFractional(onPlane(G, X)), L.toFractional(G.frame.xi), ctx.region);
  if (!seg) return null;
  const [p, q] = seg.map(f => L.toCartesian(f));
  return [M.add(p, M.scale(G.frame.xi, -out)), M.add(q, M.scale(G.frame.xi, out))];
}

/** The part of the slip plane between X = lo and X = hi (Cartesian polygon), or []. */
function planeStrip(G, lo, hi) {
  if (!G.poly) return [];
  const m = G.frame.m, om = M.dot(G.o, m);
  const cut = M.clipConvex(G.poly, m, om + hi);
  return cut.length ? M.clipConvex(cut, M.scale(m, -1), -(om + lo)) : [];
}

/** How far the plane reaches from its middle along a unit vector u in it. */
const reach = (G, u) => (G.poly ? Math.max(0, ...G.poly.map(p => M.dot(M.sub(p, G.o), u))) : 0);

/** Arrow length in the rose of close-packed directions, in units of |b|. */
const ROSE = 1.4;

/** Where the rose of close-packed directions sits: in the slip plane, beside the block on the side the line comes in from. */
const roseCentre = G => M.add(G.o, M.scale(G.frame.m, -(reach(G, M.scale(G.frame.m, -1)) + (ROSE + 0.9) * G.blen)));

/** The τ arrows: above and below the block, along ±b, parallel to the slip plane. */
function shearArrows(G) {
  const hs = G.verts.map(p => M.dot(M.sub(p, G.o), G.n)), top = Math.max(...hs), bottom = Math.min(...hs);
  const bh = M.normalize(G.b), len = 2 * G.blen, pad = 0.9 * G.blen;
  const from = (h, s) => M.add(M.add(G.o, M.scale(G.n, h)), M.scale(bh, (-s * len) / 2));
  return [
    { from: from(top + pad, 1), to: M.add(from(top + pad, 1), M.scale(bh, len)) },
    { from: from(bottom - pad, -1), to: M.add(from(bottom - pad, -1), M.scale(bh, -len)) },
  ];
}

/**
 * A view of the slip plane at an angle: from above, 25° from edge-on, the plane tilted only towards or away
 * from the viewer (up on screen is the c axis). A level plane is seen along its line, so the glide runs across
 * the screen. → [camera direction, the crystal vector that points up when looking straight down]
 */
export function angledView(G) {
  const e = (25 * Math.PI) / 180, up = G.n[2] < -1e-9 ? M.scale(G.n, -1) : G.n;
  const level = M.sub(up, [0, 0, up[2]]);
  if (M.norm(level) < 1e-6) return [M.add(M.scale(up, Math.sin(e)), M.scale(G.frame.xi, Math.cos(e))), G.frame.m];
  const h = M.normalize(level), t = Math.acos(Math.min(1, up[2])) - (Math.PI / 2 - e);
  return [M.add([0, 0, Math.cos(t)], M.scale(h, Math.sin(t))), h];
}

/** The plane of the family that lies most nearly level (its normal closest to c): the clearest to look at first. */
function levelPlane(id) {
  const planes = M.slipPlanes(id), tilt = h => Math.abs(h[2]) / M.norm(h);
  return planes.reduce((best, h, i) => (tilt(h) > tilt(planes[best]) + 1e-9 ? i : best), 0);
}

/** The atom of the layer above whose path is drawn: the one nearest the middle of the plane. */
function pathAtom(G, ctx) {
  const L = ctx.lattice, above = M.add(G.o, M.scale(G.n, G.d / 2));
  let best = null, bestD = Infinity;
  for (const f of blockPoints(ctx)) {
    if (G.side(f) <= 0 || !G.inLayers(f)) continue;
    const dd = M.norm(M.sub(L.toCartesian(f), above));
    if (dd < bestD) { bestD = dd; best = f; }
  }
  return best;
}

function primitives(item, ctx) {
  const G = slipGeometry(item, ctx);
  if (!G) return [];
  const C = crystalOf(ctx), L = ctx.lattice, colour = ctx.colour(item), op = ctx.opacity(item), hl = ctx.theme.highlight;
  const prims = [];

  // the two layers either side of the slip plane, as touching spheres (by default)
  const below = [], above = [];
  for (const a of C.atoms) {
    if (a.mark !== item.id || !M.inSlice(a.f, ctx.slice)) continue;
    (G.side(a.f) > 0 ? above : below).push(drawnPos(a, ctx));
  }
  const r = C.R * item.size / 100;
  prims.push({ kind: 'spheres', centres: below, radius: r, colour: SLIP_COLOURS.below, opacity: op });
  prims.push({ kind: 'spheres', centres: above, radius: r, colour: SLIP_COLOURS.above, opacity: op });

  // the slip plane; the part the dislocation has swept is shaded deeper
  if (item.showPlane && G.poly && !ctx.slice) {
    prims.push({ kind: 'polygon', points: G.poly, colour, opacity: 0.08 * op, dashed: true });
    const lines = linesOf(G, ctx), back = Math.min(...lines.map(l => l.x)), front = Math.max(...lines.map(l => l.x));
    if (G.stage !== 'before') {
      const slipped = G.stage === 'after' ? G.poly : planeStrip(G, -1e9, back);
      if (slipped.length) prims.push({ kind: 'polygon', points: slipped, colour, opacity: 0.16 * op, outline: false });
    }
    if (G.stage === 'in' && G.partials) {
      const fault = planeStrip(G, back, front);
      if (fault.length) prims.push({ kind: 'polygon', points: fault, colour: SLIP_COLOURS.fault, opacity: 0.4 * op, outline: false });
    }
  }

  // the dislocation line (or the two partials) while it is in the crystal
  if (G.stage === 'in') {
    const symbol = item.character === 'edge' ? '⊥' : '↻';
    for (const l of linesOf(G, ctx)) {
      const seg = lineSegment(G, l.x, ctx, 1.5 * C.R);
      if (!seg) continue;
      const tag = l.kind === 'perfect' ? `<b>${symbol}</b> <span class="nm">${item.name}</span>`
        : `<b>${l.kind === 'leading' ? 'b₁' : 'b₂'}</b> <span class="nm">${vectorText(l.bF)}</span>`;
      prims.push({ kind: 'tubes', segments: [seg], radius: (l.kind === 'perfect' ? 0.034 : 0.026) * ctx.L0, colour, opacity: 1 });
      prims.push({ kind: 'label', at: M.add(seg[1], M.scale(G.frame.xi, 0.4 * G.blen)), html: tag, colour, cls: 'lbl-defect' });
    }
  }
  if (ctx.slice) return prims; // the 2D slice: the atoms and the line only

  // the path of one atom of the layer above: b straight, or b₁ then b₂ through the hollow. The arrow moves with the
  // layer below (the field moves the halves by ±b/2), so the atom slides from its tail to its head.
  const start = item.path ? pathAtom(G, ctx) : null;
  if (start) {
    const D = defect(item, ctx), at = L.toCartesian(start);
    const carried = D && D.shift ? D.shift(M.sub(at, M.scale(G.n, G.d))) : [0, 0, 0];
    const p0 = M.add(M.add(at, carried), M.scale(G.n, r * 1.08));
    if (G.partials) {
      const [b1, b2] = G.partials.map(v => L.toCartesian(v)), mid = M.add(p0, b1);
      prims.push({ kind: 'polygon', points: [p0, M.add(p0, G.b)], colour: hl, opacity: 0.9 * op, fill: false, dashed: true });
      prims.push({ kind: 'arrow', from: p0, to: mid, colour: hl, size: 0.4, label: '<b><i>b</i>₁</b>', labelCls: 'lbl-dim', labelGap: 0.08 });
      prims.push({ kind: 'arrow', from: mid, to: M.add(mid, b2), colour: hl, size: 0.4, label: '<b><i>b</i>₂</b>', labelCls: 'lbl-dim', labelGap: 0.08 });
    } else {
      prims.push({ kind: 'arrow', from: p0, to: M.add(p0, G.b), colour: hl, size: 0.45, label: '<b><i>b</i></b>', labelCls: 'lbl-dim', labelGap: 0.1 });
    }
  }

  // the close-packed directions in the plane, as a rose beside the block; b in the highlight colour (the card lists them all)
  if (item.dirs) {
    const c = roseCentre(G), chosen = G.uvw.join();
    prims.push({ kind: 'spheres', centres: [c], radius: 0.25 * r + 0.05 * G.blen, colour, opacity: op });
    for (const u of G.dirs) {
      const v = M.normalize(L.toCartesian(u)), isB = u.join() === chosen, col = isB ? hl : colour;
      for (const s of [1, -1]) {
        prims.push({ kind: 'arrow', from: c, to: M.add(c, M.scale(v, s * ROSE * G.blen)), colour: col, size: isB ? 0.4 : 0.3, opacity: op,
          ...(s > 0 && isB ? { label: `<b><i>b</i></b> ${idx(u, 'dir')}`, labelCls: 'lbl-dim', labelGap: 0.12 } : {}) });
      }
    }
    prims.push({ kind: 'label', at: M.add(c, M.scale(G.n, -1.2 * G.blen)), html: txt('slipRoseLabel', { plane: idx(G.hkl, 'plane') }), colour, cls: 'lbl-dim' });
  }

  // τ: the shear stress on the slip plane that drives the glide
  if (item.shear) {
    for (const s of shearArrows(G)) prims.push({ kind: 'arrow', ...s, colour: hl, size: 0.5, label: '<i>τ</i>', labelCls: 'lbl-dim' });
  }
  return prims;
}

/* ---------- the card ---------- */
const structureOf = G => txt(STRUCTURE[G.id]);
const lineText = G => idx(directionIndices(G.frame.xi), 'dir');

function where(item, ctx, G) {
  if (G.stage === 'before') return txt('slipBefore');
  if (G.stage === 'after') return txt('slipAfter', { b: sig(G.blen) });
  return txt(G.partials ? 'slipInPartials' : 'slipIn');
}

function live(item, ctx) {
  const G = slipGeometry(item, ctx);
  if (!G) return '';
  const r = ctx.analysis.neighbours.dnn / 2, P = M.planeFacts(ctx.lattice, ctx.basis, G.hkl, r);
  const sys = M.SLIP_SYSTEMS[G.id], nPlanes = G.planes.length, nDirs = G.dirs.length;
  const rows = [
    [`${txt('slipSystem')}${helpButton('slip-system', { item: item.id })}`, `<b>${idx(sys.plane, 'family')}${idx(sys.dir, 'dirFamily')}</b> · ${txt('slipSystemsCount', { count: nPlanes * nDirs, planes: nPlanes, dirs: nDirs })}`],
    [txt('slipPlaneSpacing'), `${idx(G.hkl, 'plane')}: <i>d</i> = ${sig(P.d)} Å`],
    [txt('slipInPlane'), txt('slipInPlaneValue', { n: P.inPlane, packing: P.packing.toFixed(3) })],
    [txt('slipBurgers'), `<b><i>b</i> = ${vectorText(G.bF)}</b> · ${sig(G.blen)} Å`],
    [txt('slipLine'), `${lineText(G)} · ${txt(item.character === 'edge' ? 'slipLineEdge' : 'slipLineScrew')}`],
  ];
  if (G.partials) {
    const [b1, b2] = G.partials;
    rows.push([`${txt('slipPartialsRow')}${helpButton('shockley', { item: item.id })}`, `${vectorText(b1)} + ${vectorText(b2)} · ${sig(M.norm(b1) * ctx.params.a)} Å`]);
  }
  return `<p class="pd-shell">${where(item, ctx, G)}</p>${facts(rows)}`;
}

function settings(item, ctx) {
  const G = slipGeometry(item, ctx);
  if (!G) {
    return `${note(txt('slipCubicOnly', { lattice: ctx.bravais.name }))}<div class="btn-row">${['cF', 'cI', 'cP'].map(id => actionButton(`lat-${id}`, findBravais(id).name, 'cube')).join('')}</div>`;
  }
  const seg = (name, list, kind, value) => segmented(name, list.map((v, i) => ({ value: String(i), label: idx(v, kind) })), String(value));
  return `<p class="ion-basis">${txt('slipIntro', { structure: structureOf(G) })}${helpButton('slip-system', { item: item.id })}</p>
    <div class="pd-live" data-live>${live(item, ctx)}</div>
    <div class="field"><div class="field-label">${txt('slipPlaneLabel', { count: G.planes.length })}</div>
      ${seg('plane', G.planes, 'plane', G.planes.indexOf(G.hkl))}</div>
    <div class="field"><div class="field-label">${txt('slipDirLabel', { count: G.dirs.length })}</div>
      ${seg('dir', G.dirs, 'dir', G.dirs.indexOf(G.uvw))}</div>
    <div class="field"><div class="field-label">${txt('slipCharacter')}</div>
      ${segmented('character', [{ value: 'edge', label: txt('slipEdge') }, { value: 'screw', label: txt('slipScrew') }], item.character)}</div>
    ${G.id === 'cF' ? toggle('partials', item.partials, `${txt('slipPartials')}${helpButton('shockley', { item: item.id })}`, { hint: txt('slipPartialsHint') }) : ''}
    ${G.partials ? `${range('width', item.width, { min: 1, max: 6, step: 0.5, unit: '', label: txt('slipWidth') })}<p class="field-hint">${txt('slipWidthHint')}</p>` : ''}
    ${range('t', Math.round(item.t * 100), { min: 0, max: 100, step: 1, label: txt('slipWhere') })}
    <div class="btn-row">${actionButton('glide', txt('slipGlide'), 'play', 'btn-primary')}${actionButton('start', txt('slipStart'), 'reset')}</div>
    <p class="field-hint">${txt(item.character === 'edge' ? 'slipGlideHintEdge' : 'slipGlideHintScrew')}${helpButton('glide')}</p>
    <div class="field"><div class="field-label">${txt('slipLook')}</div>
      <div class="btn-row">${actionButton('look-angle', txt('slipLookAngle'), 'target')}${actionButton('look-plane', txt('slipLookPlane'), 'target')}${actionButton('look-line', txt('slipLookLine'), 'target')}</div></div>
    <div class="field"><div class="field-label">${txt('slipRest')}</div>
      ${segmented('rest', [{ value: 'show', label: txt('slipRestShow') }, { value: 'faint', label: txt('slipRestFaint') }, { value: 'hide', label: txt('slipRestHide') }], item.rest)}</div>
    ${range('size', item.size, { min: 30, max: 100, step: 5, label: txt('slipSize') })}
    <p class="field-hint">${txt('slipSizeHint')}</p>
    ${toggle('showPlane', item.showPlane, txt('slipShowPlane'), { hint: txt('slipShowPlaneHint') })}
    ${toggle('dirs', item.dirs, txt('slipShowDirs'), { hint: txt('slipShowDirsHint') })}
    ${toggle('path', item.path, txt('slipShowPath'), { hint: txt(G.id === 'cF' ? 'slipShowPathHintFcc' : 'slipShowPathHint') })}
    ${toggle('shear', item.shear, txt('slipShowShear'), { hint: txt('slipShowShearHint') })}`;
}

/* ---------- the type ---------- */
const ENTRIES = [
  { key: 'slip-fcc', lattice: 'cF', title: 'slipMenuFcc', desc: 'slipMenuFccDesc', command: 'Slip(FCC)', order: 10 },
  { key: 'slip-bcc', lattice: 'cI', title: 'slipMenuBcc', desc: 'slipMenuBccDesc', command: 'Slip(BCC)', order: 20 },
  { key: 'slip-sc', lattice: 'cP', title: 'slipMenuSc', desc: 'slipMenuScDesc', command: 'Slip(SC)', order: 30 },
];

/** Switch to a cubic lattice first when asked for one (e.g. Slip(FCC) while cubic P is on screen). */
function showLattice(id, ws) {
  if (id && ws.ctx.bravais.id !== id) ws.applyLattice(id);
}

registerType({
  type: 'slip',
  mode: 'defects',
  prefix: 'slip',
  title: txt('slipTitle'),
  icon: 'layers',
  help: 'slip-system',
  appearance: true,
  expandOnAdd: true,
  drawsMarked: true,
  menu: ENTRIES.map(e => ({ key: e.key, category: 'slip', order: e.order, title: txt(e.title), desc: txt(e.desc), init: { lattice: e.lattice }, command: e.command, help: 'slip-system' })),

  prepare(init, ws) { showLattice(init.lattice, ws); },

  create: (init, ctx) => ({
    lattice: ctx.bravais.id, plane: hasSlip(ctx) ? levelPlane(ctx.bravais.id) : 0, dir: 0, character: init.character === 'screw' ? 'screw' : 'edge',
    partials: false, width: 3, t: 0, rest: 'faint', size: 70, showPlane: true, dirs: true, path: true, shear: false,
  }),

  /** Seen at an angle when it is added, so the two layers show as layers. */
  viewOnAdd(item, ctx) {
    const G = slipGeometry(item, ctx);
    return G ? angledView(G) : null;
  },

  /** The two layers are orange and blue: the other atoms go to one colour, so that "how far it moved" (orange) does not mix with them. */
  afterAdd(item, ctx, ws) {
    const G = slipGeometry(item, ctx);
    if (!G) return '';
    const added = txt('slipAddNote', { structure: structureOf(G), plane: idx(G.hkl, 'plane') });
    const A = ws.state.scene[0];
    if (!A || A.type !== 'atoms' || A.colourBy === 'none') return added;
    A.colourBy = 'none';
    return `${added} ${txt('slipAddNoteColour')}`;
  },

  /** Another cubic lattice: start again on its most level plane, with the dislocation not yet in the crystal. */
  refresh(item, ctx) {
    if (!hasSlip(ctx)) return;
    const id = ctx.bravais.id, planes = M.slipPlanes(id);
    if (item.lattice !== id) Object.assign(item, { lattice: id, plane: levelPlane(id), dir: 0, t: 0 });
    item.plane = clampIndex(item.plane, planes);
    item.dir = clampIndex(item.dir, M.slipDirections(id, planes[item.plane]));
  },

  defect,
  restOfCrystal: item => item.rest,
  autoLabel: () => txt('slipTitle'),
  definition: (item, ctx) => `${item.name} = Slip(${{ cF: 'FCC', cI: 'BCC', cP: 'SC' }[ctx.bravais.id] || ''})`,
  summary(item, ctx) {
    const G = slipGeometry(item, ctx);
    if (!G) return txt('slipCubicShort');
    return txt('slipSummary', { plane: idx(G.hkl, 'plane'), b: vectorText(G.bF), kind: txt(item.character === 'edge' ? 'slipEdge' : 'slipScrew').toLowerCase() });
  },
  settings,
  live,

  /** Seen across a cube axis, a slice shows the line end-on when it runs along that axis (cubic P). */
  sliceAxis(item, ctx) {
    const G = slipGeometry(item, ctx);
    if (!G) return null;
    const k = G.frame.xi.findIndex(v => Math.abs(Math.abs(v) - 1) < 1e-9);
    return k >= 0 ? k : null;
  },

  onField(item, name, value, ctx, ws) {
    if (name === 'plane') { item.plane = +value; item.dir = 0; ws.redraw(item, { card: true }); return; }
    if (name === 'dir') { item.dir = +value; ws.redraw(item, { card: true }); return; }
    if (name === 'character' || name === 'rest') { item[name] = value; ws.redraw(item, { card: true }); return; }
    if (name === 'partials') { item.partials = value; ws.redraw(item, { card: true }); return; }
    if (name === 'width') { item.width = value; ws.redraw(item); return; }
    if (name === 't') { item.t = value / 100; ws.redraw(item); return; }
    if (name === 'size') { item.size = value; ws.redraw(item); return; }
    if (['showPlane', 'dirs', 'path', 'shear'].includes(name)) { item[name] = value; ws.redraw(item); }
  },

  onAction(item, act, el, ctx, ws) {
    if (act.startsWith('lat-')) { ws.setLattice(act.slice(4)); return; }
    const G = slipGeometry(item, ctx);
    if (!G) return;
    if (act === 'look-plane') { ws.lookAlong(G.n, G.frame.m); return; }
    if (act === 'look-line') { ws.lookAlong(G.frame.xi, G.n); return; }
    if (act === 'look-angle') { ws.lookAlong(...angledView(G)); return; }
    if (act === 'start') { item.t = 0; ws.redraw(item, { card: true }); return; }
    if (act === 'glide' && ws.animate) {
      const steps = (G.span[1] - G.span[0] + G.w) / G.blen + 2;
      item.shear = true;
      ws.animate(item, Math.min(14000, Math.max(4000, 650 * steps)), t => { item.t = t; }, () => ws.redraw(item, { card: true }));
    }
  },

  primitives,

  /** The rose of directions and the τ arrows lie beside the block: fit them in view too. */
  frameExtra(item, ctx) {
    const G = slipGeometry(item, ctx);
    if (!G) return [];
    const out = [];
    if (item.dirs) {
      const c = roseCentre(G), r = (ROSE + 0.5) * G.blen;
      out.push(M.add(c, M.scale(G.frame.m, -r)), M.add(c, M.scale(G.frame.xi, -r)), M.add(c, M.scale(G.frame.xi, r)), M.add(c, M.scale(G.n, -1.5 * G.blen)));
    }
    if (item.shear) for (const s of shearArrows(G)) out.push(s.from, s.to);
    return out;
  },

  /** The legend on the canvas: the two layers (and the stacking fault). */
  legend(item, ctx) {
    const G = slipGeometry(item, ctx);
    if (!G) return null;
    const dot = (c, label) => `<span class="dot" style="--c:${c}"></span><b>${label}</b>`;
    const rows = [dot(SLIP_COLOURS.above, txt('slipLegendAbove')), dot(SLIP_COLOURS.below, txt('slipLegendBelow'))];
    if (G.partials && G.stage === 'in' && item.showPlane) rows.push(dot(SLIP_COLOURS.fault, txt('slipLegendFault')));
    return {
      title: `${idx(G.hkl, 'plane')} · ${structureOf(G)}`, help: 'slip-system', rows,
      foot: txt('slipLegendFoot', { b: vectorText(G.bF), len: sig(G.blen) }),
    };
  },
});

/* ---------------- input bar ---------------- */
const NAMES = { fcc: 'cF', cf: 'cF', f: 'cF', bcc: 'cI', ci: 'cI', i: 'cI', sc: 'cP', cp: 'cP', p: 'cP' };

/** Slip(), Slip(FCC), Slip(BCC), Slip(SC) → { lattice? } or { error }. */
export function parseSlip(arg) {
  const s = String(arg ?? '').trim().toLowerCase().replace(/[\s.-]/g, '');
  if (!s) return {};
  return NAMES[s] ? { lattice: NAMES[s] } : { error: txt('msgSlipUnknown', { name: String(arg).trim() }) };
}

registerCommand({
  name: 'Slip', mode: 'defects', raw: true, args: [0, 1], type: 'slip', group: txt('catSlip'),
  usage: 'Slip(FCC)', help: txt('cmdHelpSlip'), example: () => 'Slip(FCC)',
  run(args, ws, name) {
    const p = parseSlip(args[0]);
    if (p.error) return p;
    const item = ws.addItem('slip', { name, ...p });
    return { ok: txt('msgCreated', { label: ws.labelHTML(item) }), item };
  },
  update(item, args, ws) {
    const p = parseSlip(args[0]);
    if (p.error) return p;
    showLattice(p.lattice, ws);
    item.t = 0;
    return { ok: txt('msgChanged', { label: ws.labelHTML(item) }), item };
  },
});
