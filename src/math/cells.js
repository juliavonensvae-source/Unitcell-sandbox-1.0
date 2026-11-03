/* =====================================================================
   Displayed cells as convex regions in fractional coordinates.

   A region describes what is drawn: a block of n1 × n2 × n3 unit cells
   (boxRegion), a hexagonal prism of 3 primitive cells stacked n times
   along c (hexPrismRegion), or a honeycomb field of such prism columns
   (prismFieldRegion). Everything that depends on the outline of the
   displayed cell is computed from it: which lattice points are drawn,
   cell edges, where planes are clipped, the cut planes for "cut spheres
   at the cell boundary", and the counting rule (corner = ⅛, …).

   region = {
     kind: 'box' | 'prism',
     halfspaces: [{ h, d }]   h·f ≤ d for every point f inside
     vertices:   [f]          corners
     edges:      [[f, f]]     outer edges
     grid:       [[f, f]]     every cell boundary inside (for "show every cell boundary")
     first:      [[f, f]]     edges of the first cell (highlighted in a supercell)
     firstHalfspaces          the first cell, for fading points outside it
     faces:      [[f]]        outer faces as polygons (for filled volumes)
     tiling:     [t1, t2, t3] translations that tile space with copies of the region
     parts:      [region]  only for a field of prisms: it is not convex, so it is kept
                 as convex columns. halfspaces is then null; inRegion, sitesInRegion,
                 cellUnderRay and clipLineToRegion use the parts. Plane clipping
                 (planePolygonIn …) needs a convex region: use one column.
   }
   ===================================================================== */
import { EPS, dot, sub, add, scale } from './linalg.js';

/* ---------- region builders ---------- */

/** 12 edges of the parallelepiped [0,n1]×[0,n2]×[0,n3]. */
export function boxEdges([n1, n2, n3]) {
  const s = [];
  for (const y of [0, n2]) for (const z of [0, n3]) s.push([[0, y, z], [n1, y, z]]);
  for (const x of [0, n1]) for (const z of [0, n3]) s.push([[x, 0, z], [x, n2, z]]);
  for (const x of [0, n1]) for (const y of [0, n2]) s.push([[x, y, 0], [x, y, n3]]);
  return s;
}

/** Every cell boundary line in an n1×n2×n3 block. */
export function gridLines([n1, n2, n3]) {
  const s = [];
  for (let j = 0; j <= n2; j++) for (let k = 0; k <= n3; k++) s.push([[0, j, k], [n1, j, k]]);
  for (let i = 0; i <= n1; i++) for (let k = 0; k <= n3; k++) s.push([[i, 0, k], [i, n2, k]]);
  for (let i = 0; i <= n1; i++) for (let j = 0; j <= n2; j++) s.push([[i, j, 0], [i, j, n3]]);
  return s;
}

const boxHalfspaces = N => {
  const out = [];
  for (let i = 0; i < 3; i++) {
    const e = [0, 0, 0];
    e[i] = 1;
    out.push({ h: scale(e, -1), d: 0 }, { h: e, d: N[i] });
  }
  return out;
};

export function boxRegion(repeats = [1, 1, 1]) {
  const N = [...repeats];
  const vertices = [];
  for (const x of [0, N[0]]) for (const y of [0, N[1]]) for (const z of [0, N[2]]) vertices.push([x, y, z]);
  const [X, Y, Z] = N;
  const faces = [
    [[0, 0, 0], [0, Y, 0], [0, Y, Z], [0, 0, Z]], [[X, 0, 0], [X, Y, 0], [X, Y, Z], [X, 0, Z]],
    [[0, 0, 0], [X, 0, 0], [X, 0, Z], [0, 0, Z]], [[0, Y, 0], [X, Y, 0], [X, Y, Z], [0, Y, Z]],
    [[0, 0, 0], [X, 0, 0], [X, Y, 0], [0, Y, 0]], [[0, 0, Z], [X, 0, Z], [X, Y, Z], [0, Y, Z]],
  ];
  return {
    kind: 'box', repeats: N,
    halfspaces: boxHalfspaces(N),
    vertices, faces,
    edges: boxEdges(N),
    grid: gridLines(N),
    first: boxEdges([1, 1, 1]),
    firstHalfspaces: boxHalfspaces([1, 1, 1]),
    tiling: [[X, 0, 0], [0, Y, 0], [0, 0, Z]],
    cells: X * Y * Z,
  };
}

/** Hexagon around the origin in (a1, a2) fractions, anticlockwise: a1, a1+a2, a2, −a1, −a1−a2, −a2. */
const HEXAGON = [[1, 0], [1, 1], [0, 1], [-1, 0], [-1, -1], [0, -1]];
const hexHalfspaces = nc => [
  { h: [1, 0, 0], d: 1 }, { h: [-1, 0, 0], d: 1 },
  { h: [0, 1, 0], d: 1 }, { h: [0, -1, 0], d: 1 },
  { h: [1, -1, 0], d: 1 }, { h: [-1, 1, 0], d: 1 },
  { h: [0, 0, -1], d: 0 }, { h: [0, 0, 1], d: nc },
];

/**
 * Hexagonal prism of 3 primitive cells (centred on the origin), stacked nc
 * times along c. Its 12 corners and 2 face centres are lattice points.
 */
export function hexPrismRegion(nc = 1) {
  const ring = z => HEXAGON.map((p, i) => [[p[0], p[1], z], [HEXAGON[(i + 1) % 6][0], HEXAGON[(i + 1) % 6][1], z]]);
  const verticals = (z0, z1) => HEXAGON.map(p => [[p[0], p[1], z0], [p[0], p[1], z1]]);
  // spokes from the centre to a1, a2 and a3 split each layer into the 3 primitive cells
  const spokes = z => [[1, 0], [0, 1], [-1, -1]].map(p => [[0, 0, z], [p[0], p[1], z]]);
  const grid = [];
  for (let z = 0; z <= nc; z++) grid.push(...ring(z), ...spokes(z));
  grid.push(...verticals(0, nc), [[0, 0, 0], [0, 0, nc]]);
  const faces = [HEXAGON.map(p => [p[0], p[1], 0]), HEXAGON.map(p => [p[0], p[1], nc])];
  HEXAGON.forEach((p, i) => {
    const q = HEXAGON[(i + 1) % 6];
    faces.push([[p[0], p[1], 0], [q[0], q[1], 0], [q[0], q[1], nc], [p[0], p[1], nc]]);
  });
  return {
    kind: 'prism', repeats: [1, 1, nc],
    halfspaces: hexHalfspaces(nc),
    vertices: [...HEXAGON.map(p => [p[0], p[1], 0]), ...HEXAGON.map(p => [p[0], p[1], nc])],
    faces,
    edges: [...ring(0), ...ring(nc), ...verticals(0, nc)],
    grid,
    first: [...ring(0), ...ring(1), ...verticals(0, 1)],
    firstHalfspaces: hexHalfspaces(1),
    // honeycomb: neighbouring prisms are centred at 2a1 + a2 and −a1 + a2
    tiling: [[2, 1, 0], [-1, 1, 0], [0, 0, nc]],
    cells: 3 * nc,
  };
}

/* ---------- fields of hexagonal prisms ---------- */

/**
 * Steps between neighbouring prisms of a honeycomb field, in (a1, a2) fractions:
 * one step "along a1" is 2a1 + a2 and one "along a2" is −a1 + a2. Both are 30° from
 * a1 and a2, √3·a long, and 120° apart like a1 and a2; each joins two prisms that share a face.
 */
export const PRISM_STEPS = [[2, 1, 0], [-1, 1, 0]];

/** Origin (the centre of the bottom face) of prism (i, j, k) of a field, numbered from 1. */
export function prismOrigin([i, j, k]) {
  const [A, B] = PRISM_STEPS;
  return [(i - 1) * A[0] + (j - 1) * B[0], (i - 1) * A[1] + (j - 1) * B[1], k - 1];
}

const ptKey = p => p.map(x => (Math.round(x * 1e6) / 1e6 + 0).toFixed(6)).join(',');
const segKey = ([p, q]) => { const a = ptKey(p), b = ptKey(q); return a < b ? `${a}|${b}` : `${b}|${a}`; };
/** Segments without repeats (where two prisms meet, their shared edges are kept once). */
function uniqueSegments(list) {
  const seen = new Map();
  for (const seg of list) { const k = segKey(seg); if (!seen.has(k)) seen.set(k, seg); }
  return [...seen.values()];
}
const uniquePoints = list => [...new Map(list.map(p => [ptKey(p), p])).values()];

/**
 * A field of hexagonal prisms: n1 × n2 columns side by side in a honeycomb (steps
 * PRISM_STEPS), each n3 prisms high along c. Neighbouring prisms share faces, edges
 * and lattice points, and every edge and point is kept once. 1 × 1 × n is the plain
 * column of hexPrismRegion. The field is not convex (the outline zig-zags), so it is
 * stored as convex `parts`, one per column, each with `column: [i, j]`.
 */
export function prismFieldRegion([n1, n2, n3] = [1, 1, 1]) {
  if (n1 === 1 && n2 === 1) return hexPrismRegion(n3);
  const parts = [], centres = [];
  for (let i = 1; i <= n1; i++) for (let j = 1; j <= n2; j++) {
    const t = prismOrigin([i, j, 1]);
    const part = translateRegion(hexPrismRegion(n3), t);
    part.column = [i, j];
    parts.push(part);
    centres.push(t);
  }
  // in the basal plane: how many columns use each hexagon edge and each hexagon corner
  const edgeUse = new Map(), cornerUse = new Map();
  for (const c of centres) {
    HEXAGON.forEach((p, m) => {
      const q = HEXAGON[(m + 1) % 6];
      const A = [c[0] + p[0], c[1] + p[1], 0], B = [c[0] + q[0], c[1] + q[1], 0];
      const ek = segKey([A, B]);
      edgeUse.set(ek, { seg: [A, B], n: (edgeUse.has(ek) ? edgeUse.get(ek).n : 0) + 1 });
      const vk = ptKey(A);
      cornerUse.set(vk, { p: A, n: (cornerUse.has(vk) ? cornerUse.get(vk).n : 0) + 1 });
    });
  }
  const lift = (seg, z) => seg.map(p => [p[0], p[1], z]);
  const outline = [...edgeUse.values()].filter(e => e.n === 1).map(e => e.seg);
  // outer edges: the outline at the bottom and the top, and a vertical edge wherever fewer than 3 columns meet
  const edges = [
    ...outline.map(seg => lift(seg, 0)), ...outline.map(seg => lift(seg, n3)),
    ...[...cornerUse.values()].filter(v => v.n < 3).map(v => [[v.p[0], v.p[1], 0], [v.p[0], v.p[1], n3]]),
  ];
  const faces = [
    ...parts.flatMap(part => part.faces.slice(0, 2)), // bottom and top hexagon of each column
    ...outline.map(([A, B]) => [[A[0], A[1], 0], [B[0], B[1], 0], [B[0], B[1], n3], [A[0], A[1], n3]]),
  ];
  return {
    kind: 'prism', repeats: [n1, n2, n3], parts,
    halfspaces: null,
    vertices: uniquePoints(parts.flatMap(part => part.vertices)),
    faces,
    edges: uniqueSegments(edges),
    grid: uniqueSegments(parts.flatMap(part => part.grid)),
    first: parts[0].first,
    firstHalfspaces: parts[0].firstHalfspaces,
    tiling: null,
    cells: 3 * n1 * n2 * n3,
  };
}

/**
 * The box lo ≤ x ≤ hi (fractional), with only what plane clipping needs
 * (vertices and edges). Used to draw a plane out to its axis intercepts.
 */
export function boxBetween(lo, hi) {
  const vertices = [];
  for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) vertices.push([x, y, z]);
  const edges = boxEdges([hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]]).map(seg => seg.map(p => add(p, lo)));
  return { kind: 'box', vertices, edges };
}

/** A copy of a region grown by `factor` about its centre (vertices and edges only). */
export function grownRegion(region, factor) {
  const n = region.vertices.length;
  const c = [0, 1, 2].map(i => region.vertices.reduce((s, v) => s + v[i], 0) / n);
  const grow = p => add(c, scale(sub(p, c), factor));
  return { kind: region.kind, vertices: region.vertices.map(grow), edges: region.edges.map(([p, q]) => [grow(p), grow(q)]) };
}

/* ---------- the highlighted cell ---------- */

/** Origin of cell (i, j, k), numbered from 1: cell (1,1,1) starts at (0, 0, 0), cell (3,3,3) at (2, 2, 2). */
export const cellOrigin = cell => cell.map(i => i - 1);

/** The origin used by directions, planes, intercepts…: a corner ([0|1]³) of the chosen cell. */
export const originOf = (cell, corner = [0, 0, 0]) => add(cellOrigin(cell), corner);

/** Keep a cell number inside an n1 × n2 × n3 block. */
export const clampCell = (cell, repeats) => cell.map((i, k) => Math.min(Math.max(1, Math.round(i)), repeats[k]));

/** A copy of a region moved by t (fractional): every point, edge, face and half-space. */
export function translateRegion(region, t) {
  const mv = p => add(p, t);
  const seg = list => list && list.map(([p, q]) => [mv(p), mv(q)]);
  const hs = list => list && list.map(({ h, d }) => ({ h, d: d + dot(h, t) }));
  return {
    ...region,
    vertices: region.vertices.map(mv), edges: seg(region.edges), grid: seg(region.grid), first: seg(region.first),
    faces: region.faces && region.faces.map(f => f.map(mv)),
    halfspaces: hs(region.halfspaces), firstHalfspaces: hs(region.firstHalfspaces),
    parts: region.parts && region.parts.map(p => ({ ...translateRegion(p, t), column: p.column })),
  };
}

/**
 * The cell a ray (fractional origin f0, direction d) enters first, numbered from 1,
 * or null when it misses the block. Box: n1 × n2 × n3 cells; prism: stacked along c;
 * field of prisms: the column the ray enters first, then the prism in it.
 */
export function cellUnderRay(f0, d, region) {
  if (region.parts) {
    let best = null;
    for (const part of region.parts) {
      const hit = clipLineToRegion(f0, d, part);
      if (!hit) continue;
      const t0 = dot(sub(hit[0], f0), d), t1 = dot(sub(hit[1], f0), d);
      if (t1 < 0) continue; // behind the camera
      if (!best || t0 < best.t0) best = { t0, start: hit[0], part };
    }
    if (!best) return null;
    const p = add(best.start, scale(d, 1e-6 / Math.max(1e-12, Math.hypot(...d))));
    return [...best.part.column, Math.min(region.repeats[2], Math.max(1, Math.floor(p[2]) + 1))];
  }
  const hit = clipLineToRegion(f0, d, region);
  if (!hit) return null;
  const [start] = hit;
  if (dot(sub(start, f0), d) < 0) return null; // the block is behind the camera
  const p = add(start, scale(d, 1e-6 / Math.max(1e-12, Math.hypot(...d))));
  if (region.kind === 'prism') return [1, 1, Math.min(region.repeats[2], Math.floor(p[2]) + 1)];
  return clampCell(p.map(x => Math.floor(x) + 1), region.repeats);
}

/* ---------- points ---------- */

export const insideRegion = (f, halfspaces, eps = EPS) => halfspaces.every(({ h, d }) => dot(h, f) <= d + eps);

/** Inside (or on the boundary of) a region; a field of prisms counts every column. */
export const inRegion = (f, region, eps = EPS) => (region.parts
  ? region.parts.some(p => insideRegion(f, p.halfspaces, eps))
  : insideRegion(f, region.halfspaces, eps));

function bounds(region, margin = 0) {
  const lo = [0, 1, 2].map(i => Math.floor(Math.min(...region.vertices.map(v => v[i]))) - 1 - margin);
  const hi = [0, 1, 2].map(i => Math.ceil(Math.max(...region.vertices.map(v => v[i]))) + 1 + margin);
  return { lo, hi };
}

/** Lattice points inside (or on the boundary of) a region: [{ el, f, basisIndex, inOriginal }]. */
export function sitesInRegion(basis, region) {
  const { lo, hi } = bounds(region), out = [];
  basis.forEach((s, basisIndex) => {
    for (let i = lo[0]; i <= hi[0]; i++) for (let j = lo[1]; j <= hi[1]; j++) for (let k = lo[2]; k <= hi[2]; k++) {
      const f = [s.f[0] + i, s.f[1] + j, s.f[2] + k];
      if (!inRegion(f, region)) continue; // each lattice position once, also where prisms meet
      out.push({ el: s.el, f, basisIndex, inOriginal: insideRegion(f, region.firstHalfspaces) });
    }
  });
  return out;
}

/** Every lattice point within one cell of the region (for spheres that poke into it). */
export function sitesNearRegion(basis, region) {
  const { lo, hi } = bounds(region), out = [];
  for (const s of basis) {
    for (let i = lo[0]; i <= hi[0]; i++) for (let j = lo[1]; j <= hi[1]; j++) for (let k = lo[2]; k <= hi[2]; k++) {
      out.push([s.f[0] + i, s.f[1] + j, s.f[2] + k]);
    }
  }
  return out;
}

/**
 * Share of a lattice point that belongs to the region: 1 / (number of copies of
 * the region, in its own tiling, that contain the point). Corner of a box = ⅛,
 * edge ¼, face ½; corner of the hexagonal prism ⅙.
 */
export function shareOf(f, region) {
  const [t1, t2, t3] = region.tiling;
  let n = 0;
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (let k = -2; k <= 2; k++) {
    const t = [0, 1, 2].map(x => i * t1[x] + j * t2[x] + k * t3[x]);
    if (insideRegion(sub(f, t), region.halfspaces)) n++;
  }
  return 1 / n;
}

/** Group sites by their share: { groups: [{ share, count }] (smallest share first), total }. */
export function groupShares(sites, shareFn) {
  const groups = new Map();
  for (const s of sites) {
    const share = shareFn(s.f), key = share.toFixed(6);
    if (!groups.has(key)) groups.set(key, { share, count: 0 });
    groups.get(key).count++;
  }
  const list = [...groups.values()].sort((a, b) => a.share - b.share);
  return { groups: list, total: list.reduce((s, g) => s + g.share * g.count, 0) };
}

/** How the points of a region add up: { groups: [{ share, count }] (smallest share first), total }. */
export const pointCount = (basis, region) => groupShares(sitesInRegion(basis, region), f => shareOf(f, region));

/* ---------- lines in a region ---------- */

/**
 * Part of the line f0 + t·d that lies in the region, as [fStart, fEnd], or null.
 * For a field of prisms: from where it first enters a column to where it last leaves one.
 */
export function clipLineToRegion(f0, d, region) {
  if (region.parts) {
    const hits = region.parts.map(p => clipLineToRegion(f0, d, p)).filter(Boolean);
    if (!hits.length) return null;
    const t = q => dot(sub(q, f0), d);
    return [hits.reduce((a, h) => (t(h[0]) < t(a) ? h[0] : a), hits[0][0]), hits.reduce((a, h) => (t(h[1]) > t(a) ? h[1] : a), hits[0][1])];
  }
  let t0 = -Infinity, t1 = Infinity;
  for (const { h, d: lim } of region.halfspaces) {
    const a = dot(h, d), b = lim - dot(h, f0); // need a·t ≤ b
    if (Math.abs(a) < 1e-12) { if (b < -EPS) return null; continue; }
    if (a > 0) t1 = Math.min(t1, b / a); else t0 = Math.max(t0, b / a);
  }
  if (!(t1 - t0 > 1e-9)) return null;
  return [add(f0, scale(d, t0)), add(f0, scale(d, t1))];
}
