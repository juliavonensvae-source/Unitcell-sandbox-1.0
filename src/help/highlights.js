/* =====================================================================
   3D highlights for the SEE MORE panel. Each returns
     { prims, caption, look? }   prims: CrystalView primitives (Cartesian Å)
                                 look:  a Cartesian direction to look along
   or null when nothing useful can be shown for the lattice on screen.
   Everything is drawn in the highlighted cell (ctx.unitRegion), from its
   origin corner. No DOM. The interstitial-site highlights are in highlights-sites.js.
   ===================================================================== */
import * as M from '../math/index.js';
import { sig, trim, fractionGlyph, fracText, idx } from '../ui/format.js';
import { isCubic } from './context.js';
import { txt } from '../text.js';

export const colourOf = ctx => ctx.theme.highlight;
export const label = (at, html, colour, cls = 'lbl-help') => ({ kind: 'label', at, html, colour, cls });
const cellCentreF = ctx => M.centroid(ctx.unitRegion.vertices);
const isInt = v => v.every(x => Math.abs(x - Math.round(x)) < 1e-6);

/** A Cartesian direction perpendicular to a line, chosen so a cell face or diagonal plane holding it is seen flat. */
function lookAcross(ctx, lineCart) {
  const L = ctx.lattice, dir = M.normalize(lineCart);
  let best = null, bestCos = -1;
  for (const e of L.vectors) {
    const c = Math.abs(M.dot(M.normalize(e), dir));
    if (c > 0.999) continue; // parallel to the line
    if (c > bestCos) { bestCos = c; best = e; }
  }
  return best ? M.normalize(M.cross(dir, best)) : null;
}

/**
 * The line along which neighbouring spheres touch, through the highlighted cell:
 * the edge (cubic P), body diagonal (cubic I) or face diagonal (cubic F).
 */
export function touchingLine(ctx) {
  const L = ctx.lattice, shell = M.neighbourShell(L, ctx.basis, 0);
  if (!shell.length) return null;
  const options = shell.map(n => {
    let m = 1;
    while (m < 6 && !isInt(M.scale(n.df, m))) m++;
    const end = M.scale(n.df, m);
    const inCell = end.every(x => x > -1e-6 && x < 1 + 1e-6);
    // prefer a line inside the cell, then the textbook one: [100], [110], [111] before [010], [011] …
    const order = (n.df[0] > 1e-9 ? 0 : 0.4) + (n.df[1] > 1e-9 ? 0 : 0.2) + (n.df[2] > 1e-9 ? 0.1 : 0);
    return { df: n.df, m, end, score: (inCell ? 0 : 10) + m + (n.df.some(x => x < -1e-9) ? 5 : 0) + order };
  }).sort((a, b) => a.score - b.score);
  const { df, m, end } = options[0];
  const O = ctx.cellOrigin, colour = colourOf(ctx), r = ctx.analysis.neighbours.dnn / 2;
  const from = L.toCartesian(O), to = L.toCartesian(M.add(O, end));
  const centres = Array.from({ length: m + 1 }, (_, k) => L.toCartesian(M.add(O, M.scale(df, k))));
  const len = M.norm(M.sub(to, from));
  const what = m === 1 && end.filter(x => Math.abs(x) > 1e-6).length === 1 ? txt('hlEdge')
    : end.filter(x => Math.abs(x) > 1e-6).length === 2 ? txt('hlFaceDiagonal') : txt('hlBodyDiagonal');
  let rel = `${2 * m}<i>r</i> = ${sig(len)} Å`;
  if (isCubic(ctx) && ctx.analysis.counts.total) {
    const k = Math.round(len * len / (ctx.params.a ** 2));
    rel = `${2 * m}<i>r</i> = ${k === 1 ? '' : `√${k} `}<i>a</i>`;
  }
  return {
    prims: [
      { kind: 'tubes', segments: [[from, to]], radius: 0.022 * ctx.L0, colour, opacity: 1 },
      { kind: 'spheres', centres, radius: r, colour, opacity: 0.32 },
      label(M.scale(M.add(from, to), 0.5), rel, colour),
    ],
    caption: txt('hlTouchCaption', { what, dir: idx(M.reduceIndices(end.map(Math.round)), 'dir'), count: m + 1, rel: rel.replace(/<\/?i>/g, '') }),
    look: lookAcross(ctx, M.sub(to, from)),
    relation: rel,
  };
}

/** The lattice vectors with their lengths, and the angles between them. */
export function latticeVectors(ctx) {
  const L = ctx.lattice, O = ctx.originCart || [0, 0, 0], colour = colourOf(ctx);
  const names = ['a', 'b', 'c'], cols = [ctx.theme.axisA, ctx.theme.axisB, ctx.theme.axisC];
  const prims = L.vectors.map((v, i) => ({
    kind: 'arrow', from: O, to: M.add(O, v), colour: cols[i], size: 1.15,
    label: `<i>${names[i]}</i> = ${sig(M.norm(v))} Å`, labelCls: 'lbl-help',
  }));
  const shortest = Math.min(...L.vectors.map(M.norm));
  [['α', 1, 2], ['β', 0, 2], ['γ', 0, 1]].forEach(([sym, i, j], n) => {
    const deg = { α: ctx.params.alpha, β: ctx.params.beta, γ: ctx.params.gamma }[sym];
    prims.push({ kind: 'arc', centre: O, from: L.vectors[i], to: L.vectors[j], radius: (0.3 + 0.06 * n) * shortest, colour, opacity: 0.9, label: `${sym} = ${trim(deg, 2)}°` });
  });
  return { prims, caption: txt('hlAxesCaption') };
}

/** The highlighted cell filled in, with its volume. */
export function cellVolume(ctx) {
  const L = ctx.lattice, R = ctx.unitRegion, colour = colourOf(ctx);
  const V = ctx.isPrism ? 3 * L.volume : L.volume;
  return {
    prims: [
      ...R.faces.map(face => ({ kind: 'polygon', points: face.map(f => L.toCartesian(f)), colour, opacity: 0.16 })),
      label(L.toCartesian(cellCentreF(ctx)), `<i>V</i> = ${sig(V)} Å³`, colour),
    ],
    caption: ctx.isPrism ? txt('hlVolumePrism') : txt('hlVolumeCell'),
  };
}

const SHARE_COLOURS = ['#F59E0B', '#14B8A6', '#E2559B', '#3E9BF0', '#9B6CFF'];

/** Every lattice point of the highlighted cell, coloured and labelled by the share that belongs to the cell. */
export function pointShares(ctx) {
  const L = ctx.lattice, images = M.sitesInRegion(ctx.basis, ctx.unitRegion);
  const shares = [...new Set(images.map(s => Math.round(1e6 * M.shareOf(s.f, ctx.unitRegion)) / 1e6))].sort((a, b) => a - b);
  const halo = Math.max(1.5 * ctx.pointRadius, 0.09 * ctx.L0);
  const prims = [];
  shares.forEach((sh, n) => {
    const pts = images.filter(s => Math.abs(M.shareOf(s.f, ctx.unitRegion) - sh) < 1e-6).map(s => L.toCartesian(s.f));
    const colour = SHARE_COLOURS[n % SHARE_COLOURS.length];
    prims.push({ kind: 'spheres', centres: pts, radius: halo, colour, opacity: 0.55 });
    for (const p of pts) prims.push(label(p, fractionGlyph(sh), colour, 'lbl-frac'));
  });
  return { prims, caption: txt('hlSharesCaption') };
}

/** The centring points of the cell and the centring vectors t that reach them. */
export function centringPoints(ctx) {
  const L = ctx.lattice, O = ctx.cellOrigin, colour = colourOf(ctx);
  const extra = ctx.basis.filter(s => s.f.some(x => Math.abs(x) > 1e-6));
  if (!extra.length) return { prims: [label(L.toCartesian(M.add(O, [0.5, 0.5, 0.5])), txt('hlCornersOnly'), colour)], caption: txt('hlPrimitiveCaption') };
  const from = L.toCartesian(O), r = Math.max(1.4 * ctx.pointRadius, 0.08 * ctx.L0);
  const prims = [{ kind: 'spheres', centres: extra.map(s => L.toCartesian(M.add(O, s.f))), radius: r, colour, opacity: 0.85 }];
  for (const s of extra) {
    prims.push({ kind: 'arrow', from, to: L.toCartesian(M.add(O, s.f)), colour, size: 0.6, opacity: 0.9 });
    prims.push(label(L.toCartesian(M.add(O, M.scale(s.f, 0.55))), `(${s.f.map(x => fractionGlyph(x) === '1' ? '1' : x === 0 ? '0' : fractionGlyph(x)).join(', ')})`, colour));
  }
  return { prims, caption: txt('hlCentringCaption') };
}

/** A direction as an arrow from the origin, with its path u·a → v·b → w·c. */
export function directionArrow(ctx, uvw) {
  const L = ctx.lattice, O = ctx.origin, colour = colourOf(ctx);
  const from = L.toCartesian(O), to = L.toCartesian(M.add(O, uvw));
  const path = M.componentPath(uvw, M.AXES_3);
  const cols = [ctx.theme.axisA, ctx.theme.axisB, ctx.theme.axisC];
  return {
    prims: [
      { kind: 'arrow', from, to, colour, size: 1.1, label: idx(uvw, 'dir'), labelCls: 'lbl-help' },
      ...path.map(s => ({ kind: 'tubes', segments: [[L.toCartesian(M.add(O, s.from)), L.toCartesian(M.add(O, s.to))]], radius: 0.012 * ctx.L0, colour: cols[s.axis], opacity: 0.9 })),
    ],
    caption: txt('hlDirectionCaption', { dir: idx(uvw, 'dir') }),
  };
}

/** The plane of a set nearest the origin, with the points where it cuts the axes. */
export function planeIntercepts(ctx, hkl) {
  const L = ctx.lattice, O = ctx.origin, colour = colourOf(ctx);
  const region = ctx.unitRegion;
  const level = M.representativeLevelFrom(hkl, region, O);
  const poly = M.planePolygonIn(hkl, level, region);
  const prims = [];
  if (poly) prims.push({ kind: 'polygon', points: poly.map(f => L.toCartesian(f)), colour, opacity: 0.35 });
  const n = level - M.dot(hkl, O);
  const names = ['a', 'b', 'c'];
  hkl.forEach((h, i) => {
    if (h === 0) return;
    const f = [...O];
    f[i] += n / h;
    prims.push({ kind: 'spheres', centres: [L.toCartesian(f)], radius: 0.06 * ctx.L0, colour, opacity: 1 });
    const r = M.ratio(n, h);
    prims.push(label(L.toCartesian(f), `${r.p === r.q ? '' : fracText(r)}<i>${names[i]}</i>`, colour));
  });
  return { prims, caption: txt('hlPlaneCaption', { plane: idx(hkl, 'plane') }) };
}

/** Two neighbouring planes of the set and the perpendicular distance between them. */
export function spacingPair(ctx, hkl) {
  const L = ctx.lattice, region = ctx.unitRegion, colour = colourOf(ctx);
  const { min, max } = M.levelRange(hkl, region);
  const levels = [];
  for (let n = Math.ceil(min - 1e-9); n <= Math.floor(max + 1e-9); n++) {
    const poly = M.planePolygonIn(hkl, n, region);
    if (poly) levels.push({ n, poly });
  }
  let pair = null;
  for (let i = 0; i + 1 < levels.length; i++) if (levels[i + 1].n === levels[i].n + 1) { pair = [levels[i], levels[i + 1]]; if (i > 0) break; }
  if (!pair) return null;
  const d = L.dSpacing(hkl), nrm = L.planeNormal(hkl);
  const P = pair.map(l => l.poly.map(f => L.toCartesian(f)));
  const from = M.centroid(P[0]);
  const prims = [
    { kind: 'polygon', points: P[0], colour, opacity: 0.35 },
    { kind: 'polygon', points: P[1], colour, opacity: 0.35 },
    { kind: 'dimension', from, to: M.add(from, M.scale(nrm, d)), colour, opacity: 1, label: `<i>d</i> = ${sig(d)} Å`, labelCls: 'lbl-help' },
  ];
  // looking along a direction that lies in the planes shows them edge-on, with d at its true length
  const edge = L.toCartesian(M.inPlaneDirection(L, hkl));
  return { prims, caption: txt('hlSpacingCaption', { plane: idx(hkl, 'plane') }), look: M.normalize(edge) };
}

/** Every plane of a set that holds lattice points, inside the highlighted cell (dashed: extra planes of centred lattices). */
export function familyPlanes(ctx, hkl) {
  const L = ctx.lattice, colour = colourOf(ctx);
  const layers = M.latticePlaneLayers(hkl, ctx.basis, ctx.unitRegion).filter(l => l.poly);
  if (!layers.length) return null;
  return {
    prims: layers.map(l => ({ kind: 'polygon', points: l.poly.map(f => L.toCartesian(f)), colour, opacity: l.formula ? 0.32 : 0.16, dashed: !l.formula })),
    caption: txt('hlFamilyCaption', { plane: idx(hkl, 'plane') }),
    look: M.normalize(L.toCartesian(M.inPlaneDirection(L, hkl))),
  };
}

/** The nearest neighbours of the lattice point at the origin. */
export function neighbourBonds(ctx) {
  const L = ctx.lattice, O = ctx.cellOrigin, colour = colourOf(ctx);
  const shell = M.neighbourShell(L, ctx.basis, 0);
  const c = L.toCartesian(O), ends = shell.map(n => L.toCartesian(M.add(O, n.df)));
  const r = Math.max(ctx.pointRadius, 0.07 * ctx.L0);
  return {
    prims: [
      { kind: 'tubes', segments: ends.map(e => [c, e]), radius: 0.016 * ctx.L0, colour, opacity: 1 },
      { kind: 'spheres', centres: ends, radius: r * 1.05, colour, opacity: 0.8 },
      { kind: 'spheres', centres: [c], radius: r * 1.35, colour, opacity: 1 },
      label(M.add(c, [0, 0, 2.4 * r]), `CN = ${shell.length}`, colour),
      label(M.scale(M.add(c, ends[0]), 0.5), `<i>d</i><sub>nn</sub> = ${sig(shell[0].d)} Å`, colour),
    ],
    caption: txt('hlNeighboursCaption', { count: shell.length }),
  };
}

/** Planes through the centre of the cell (for angles and intersections). */
const planeThroughCentre = (ctx, hkl, colour, opacity = 0.3) => {
  const L = ctx.lattice, C = cellCentreF(ctx), poly = M.planePolygonIn(hkl, M.dot(hkl, C), ctx.unitRegion);
  return poly ? { kind: 'polygon', points: poly.map(f => L.toCartesian(f)), colour, opacity } : null;
};

/** The two objects of an angle and the angle between them. */
export function angleObjects(ctx, pick) {
  const L = ctx.lattice, colour = colourOf(ctx), C = L.toCartesian(cellCentreF(ctx));
  const vec = (ix, plane) => (plane ? M.scale(L.planeNormal(ix), M.norm(L.vectors[0]) * 0.8) : L.toCartesian(ix));
  const planeA = pick.mode === 'pp', planeB = pick.mode !== 'dd';
  const prims = [];
  if (planeA) prims.push(planeThroughCentre(ctx, pick.A, ctx.theme.axisA));
  if (planeB) prims.push(planeThroughCentre(ctx, pick.B, ctx.theme.axisB));
  const u = vec(pick.A, planeA), v = vec(pick.B, planeB);
  const O = pick.mode === 'dd' ? (ctx.originCart || [0, 0, 0]) : C;
  prims.push({ kind: 'arrow', from: O, to: M.add(O, u), colour: ctx.theme.axisA, size: 0.9, label: idx(pick.A, planeA ? 'plane' : 'dir') + (planeA ? ` ${txt('hlNormal')}` : ''), labelCls: 'lbl-help' });
  prims.push({ kind: 'arrow', from: O, to: M.add(O, v), colour: ctx.theme.axisB, size: 0.9, label: idx(pick.B, planeB ? 'plane' : 'dir') + (planeB ? ` ${txt('hlNormal')}` : ''), labelCls: 'lbl-help' });
  const deg = M.acosDeg(M.dot(u, v) / (M.norm(u) * M.norm(v)));
  prims.push({ kind: 'arc', centre: O, from: u, to: v, radius: 0.32 * Math.min(M.norm(u), M.norm(v)), colour, opacity: 0.9, label: `${sig(deg)}°` });
  return { prims: prims.filter(Boolean), caption: pick.mode === 'dd' ? txt('hlAngleDDCaption') : txt('hlAnglePPCaption') };
}

/** Two planes and the line where they meet (the zone axis). */
export function zoneLine(ctx, h1, h2) {
  const L = ctx.lattice, colour = colourOf(ctx), dir = M.zoneAxis(h1, h2).uvw;
  const prims = [planeThroughCentre(ctx, h1, ctx.theme.axisA), planeThroughCentre(ctx, h2, ctx.theme.axisB)].filter(Boolean);
  if (dir) {
    const seg = M.clipLineToRegion(cellCentreF(ctx), dir, ctx.unitRegion);
    if (seg) prims.push({ kind: 'tubes', segments: [seg.map(f => L.toCartesian(f))], radius: 0.026 * ctx.L0, colour, opacity: 1 }, label(L.toCartesian(seg[1]), idx(dir, 'dir'), colour));
  }
  return { prims, caption: txt('hlZoneCaption') };
}
