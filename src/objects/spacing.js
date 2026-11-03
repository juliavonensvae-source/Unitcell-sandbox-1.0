/* =====================================================================
   Interplanar distance, drawn: the planes of a set that hold lattice
   points, two neighbours highlighted, and a dimension line between them
   labelled with the spacing. When the planes with points are closer than
   d_hkl from the formula (centred lattices) or further apart (indices with
   a common factor), a second, dashed-label line shows d_hkl itself.
   Linked to a plane object (item.src).
   ===================================================================== */
import * as M from '../math/index.js';
import { HELP } from '../help/content.js';
import { idx, sig, dSym } from '../ui/format.js';
import { facts, note, toggle, actionButton } from '../ui/controls.js';
import { spacingInfo, spacingExplanation, formulaLine } from './plane-info.js';
import { sourceOf, linkedType } from './linked.js';
import { txt } from '../text.js';

const area = pts => {
  let a = [0, 0, 0];
  for (let i = 1; i < pts.length - 1; i++) a = M.add(a, M.cross(M.sub(pts[i], pts[0]), M.sub(pts[i + 1], pts[0])));
  return M.norm(a) / 2;
};

/** The two neighbouring lattice planes to measure between: [lower, upper] layers, plus the layers drawn. */
function pickPair(hkl, ctx) {
  const L = ctx.lattice, [, q] = M.latticePlanes(hkl, ctx.basis).step;
  const tryRegion = region => {
    const layers = M.latticePlaneLayers(hkl, ctx.basis, region).map(l => ({ ...l, pts: l.poly.map(f => L.toCartesian(f)) }));
    const byK = new Map(layers.map(l => [l.k, l]));
    const ks = layers.map(l => l.k), mid = (Math.min(...ks) + Math.max(...ks)) / 2;
    let best = null, score = -Infinity;
    for (const l of layers) {
      const u = byK.get(l.k + 1);
      if (!u) continue;
      // prefer starting on a formula plane, near the middle, with large polygons
      const s = (l.k % q === 0 ? 100 : 0) - Math.abs(l.k + 0.5 - mid) * 3 + Math.min(area(l.pts), area(u.pts)) / (ctx.L0 * ctx.L0);
      if (s > score) { score = s; best = [l, u]; }
    }
    return best && { pair: best, layers };
  };
  const inCell = tryRegion(ctx.planeRegion);
  if (inCell) return { ...inCell, grown: false };
  // only one plane cuts the displayed cell: borrow its neighbour from a region grown just enough
  const own = M.latticePlaneLayers(hkl, ctx.basis, ctx.planeRegion).map(l => ({ ...l, pts: l.poly.map(f => L.toCartesian(f)) }));
  for (const factor of [1.25, 1.5, 1.8, 2.4]) {
    const grown = tryRegion(M.grownRegion(ctx.planeRegion, factor));
    if (!grown) continue;
    // keep the plane that lies in the cell exactly as it is drawn there
    const pair = grown.pair.map(l => own.find(o => o.k === l.k) || { ...l, outside: true });
    return { pair, layers: own, grown: true };
  }
  return null;
}

linkedType({
  type: 'spacing',
  kind: 'plane',
  command: 'Spacing',
  commandHelp: txt('cmdHelpSpacing'),
  pickerLabel: txt('spacingPicker'),
  hide: true,
  prefix: 'sp',
  title: txt('spacingTitle'),
  icon: 'spacing',
  help: 'spacing',
  appearance: true,
  defaultTransparency: 55,
  menu: [{
    key: 'spacing', category: 'planes', order: 20, title: txt('spacingMenu'), desc: HELP.spacing,
    input: 'plane', source: 'plane', presets: ['1 1 1', '1 1 0', '1 0 0'], command: 'Spacing(p1)',
  }],

  create: () => ({ focus: true }),

  summary(item, ctx) {
    const P = sourceOf(item, ctx, 'plane');
    if (!P) return txt('summaryChoosePlane');
    const info = spacingInfo(P.parsed.hkl, ctx);
    return info.same
      ? `${dSym(P.parsed.hkl)} = ${sig(info.dFormula)} Å`
      : txt('spacingSummary', { eq: dSym(info.eq), lattice: sig(info.dLattice), d: dSym(P.parsed.hkl), formula: sig(info.dFormula) });
  },

  settings(item, ctx) {
    const P = sourceOf(item, ctx, 'plane');
    if (!P) return '';
    const hkl = P.parsed.hkl, info = spacingInfo(hkl, ctx);
    let out = note(HELP.spacing);
    out += formulaLine(hkl, ctx);
    out += facts([
      [txt('spacingFromFormula', { d: dSym(hkl) }), `${sig(info.dFormula)} Å`],
      [txt('spacingHold'), info.same ? txt('spacingEveryOne') : txt('spacingPlanesOf', { planes: idx(info.eq, 'plane') })],
      [txt('spacingBetween'), `<b>${sig(info.dLattice)} Å</b>${info.same ? '' : ` = ${info.p === 1 ? `${dSym(hkl)}/${info.q}` : info.q === 1 ? `${info.p} × ${dSym(hkl)}` : `${info.p}/${info.q} × ${dSym(hkl)}`}`}`],
    ]);
    const why = spacingExplanation(hkl, ctx, info);
    if (why) out += note(txt('spacingWhy3D', { why, d: dSym(hkl) }));
    out += toggle('focus', item.focus, txt('spacingFocus'));
    const edge = M.inPlaneDirection(ctx.lattice, info.eq);
    return out + `<div class="btn-row">${actionButton('edge', txt('spacingEdgeOn', { direction: idx(edge, 'dir') }), 'layers')}${actionButton('normal', txt('planeLookNormal'), 'target')}</div>`;
  },

  onField(item, name, value, ctx, ws) {
    if (name === 'focus') { item.focus = value; ws.redraw(item); }
  },

  onAction(item, act, el, ctx, ws) {
    const P = sourceOf(item, ctx, 'plane');
    if (!P) return;
    const eq = M.latticePlanes(P.parsed.hkl, ctx.basis).eq;
    if (act === 'edge') ws.lookAlong(ctx.lattice.toCartesian(M.inPlaneDirection(ctx.lattice, eq)));
    if (act === 'normal') ws.lookAlong(ctx.lattice.planeNormal(eq));
  },

  primitives(item, ctx) {
    const P = sourceOf(item, ctx, 'plane');
    if (!P) return [];
    const L = ctx.lattice, hkl = P.parsed.hkl, info = spacingInfo(hkl, ctx);
    const picked = pickPair(hkl, ctx);
    if (!picked) return [];
    const colour = ctx.colour(item), opacity = ctx.opacity(item), prims = [];
    const [lo, hi] = picked.pair;
    const inPair = l => l.k === lo.k || l.k === hi.k;

    for (const l of picked.layers) {
      const faded = item.focus && !inPair(l);
      prims.push({ kind: 'polygon', points: l.pts, colour, opacity: faded ? 0.22 * opacity : opacity, dashed: !l.formula, outline: !faded || !l.formula });
    }
    // a neighbour that lies outside the displayed cell: drawn lighter, just around the cell
    for (const l of [lo, hi]) if (l.outside) prims.push({ kind: 'polygon', points: l.pts, colour, opacity: 0.6 * opacity, dashed: true });

    // dimension line straight along the normal, from the lower plane to the upper one
    const n = L.planeNormal(info.eq), d = info.dLattice;
    const c0 = M.centroid(lo.pts), c1 = M.centroid(hi.pts);
    const from = M.scale(M.add(c0, M.sub(c1, M.scale(n, d))), 0.5);
    const side = M.normalize(M.cross(n, Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
    const lift = M.scale(side, 0.2 * ctx.L0);
    prims.push({
      kind: 'dimension', from, to: M.add(from, M.scale(n, d)), colour, opacity: 1,
      label: `${dSym(info.eq)} = ${sig(d)} Å`, labelOffset: lift,
    });
    if (!info.same) {
      // d_hkl from the formula, beside it, measured from the same plane
      const start = M.add(from, M.scale(side, -0.32 * ctx.L0));
      prims.push({
        kind: 'dimension', from: start, to: M.add(start, M.scale(n, info.dFormula)), colour, opacity: 0.8, size: 0.8,
        label: txt('spacingLabelFormula', { d: dSym(hkl), value: sig(info.dFormula) }), labelOffset: M.scale(side, -0.22 * ctx.L0), labelCls: 'lbl-dim is-formula',
      });
      // the formula plane it ends on, when that one holds no lattice points or lies outside the cell
      const top = lo.level + 1;
      const isDrawn = picked.layers.some(l => Math.abs(l.level - top) < 1e-9);
      if (!isDrawn) {
        const poly = M.planePolygonIn(hkl, top, M.grownRegion(ctx.planeRegion, 1.4));
        if (poly) prims.push({ kind: 'polygon', points: poly.map(f => L.toCartesian(f)), colour, opacity: 0.8, fill: false, dashed: true });
      }
    }
    return prims;
  },
});
