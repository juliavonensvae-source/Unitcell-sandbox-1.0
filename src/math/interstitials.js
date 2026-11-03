/* =====================================================================
   Interstitial sites (the holes between touching lattice spheres) and
   the atom-fit check. Pure mathematics, no DOM.

   Covered: the three cubic lattices.
     cubic P  cubic site at the body centre (8 neighbours)
     cubic I  octahedral at face centres and edge midpoints (6),
              tetrahedral at (½, ¼, 0)-type positions (4)
     cubic F  octahedral at the body centre and edge midpoints (6),
              tetrahedral at (¼, ¼, ¼)-type positions (4)

   Every position of a kind is generated from one representative by the
   48 symmetry operations of the cube (permutations and sign changes of
   x, y, z) plus the centring translations of the lattice, so nothing is
   typed in by hand. Counting per cell uses the same sharing rule as the
   lattice points (shareOf in cells.js).
   ===================================================================== */
import { add, sub, scale, dot, cross, norm, centroid, sortAround, PERMS } from './linalg.js';
import { wrap01 } from './basis.js';
import { sitesInRegion, pointCount, boxRegion } from './cells.js';
import { txt } from '../text.js';

/** The kinds of site, with the polyhedron their neighbours form. */
export const SITE_KINDS = {
  oct: { key: 'oct', name: txt('siteOctName'), adjective: txt('siteOctAdj'), poly: txt('polyOctahedron'), short: 'oct' },
  tet: { key: 'tet', name: txt('siteTetName'), adjective: txt('siteTetAdj'), poly: txt('polyTetrahedron'), short: 'tet' },
  cub: { key: 'cub', name: txt('siteCubName'), adjective: txt('siteCubAdj'), poly: txt('polyCube'), short: 'cub' },
};

const R3 = Math.sqrt(3);

/**
 * The sites of each cubic lattice: representative position, number of nearest
 * hosts (cn), the textbook critical radius ratio and where the sites are.
 */
const INTERSTITIALS = {
  cP: [
    { kind: 'cub', rep: [0.5, 0.5, 0.5], cn: 8, ideal: R3 - 1, where: txt('siteWhereCP') },
  ],
  cI: [
    { kind: 'oct', rep: [0.5, 0.5, 0], cn: 6, ideal: 2 / R3 - 1, where: txt('siteWhereCIOct') },
    { kind: 'tet', rep: [0.5, 0.25, 0], cn: 4, ideal: Math.sqrt(5 / 3) - 1, where: txt('siteWhereCITet') },
  ],
  cF: [
    { kind: 'oct', rep: [0.5, 0.5, 0.5], cn: 6, ideal: Math.SQRT2 - 1, where: txt('siteWhereCFOct') },
    { kind: 'tet', rep: [0.25, 0.25, 0.25], cn: 4, ideal: Math.sqrt(1.5) - 1, where: txt('siteWhereCFTet') },
  ],
};

/** The site list of a lattice, or null when interstitial sites are not covered for it (yet). */
export const interstitialsFor = latticeId => INTERSTITIALS[latticeId] || null;

/** One kind of site of a lattice, or null. */
export const siteSpec = (latticeId, kind) => (INTERSTITIALS[latticeId] || []).find(s => s.kind === kind) || null;

const key = f => f.map(x => x.toFixed(5)).join(',');

/**
 * Every position of a site kind in one cell, wrapped into [0, 1):
 * the representative under the 48 cube operations and the centring translations
 * (the lattice basis). → [{ el: kind, f }] (a basis for sitesInRegion / pointCount).
 */
function siteBasis(rep, basis, el = 'X') {
  const out = [], seen = new Set();
  for (const p of PERMS) {
    for (let s = 0; s < 8; s++) {
      const g = [0, 1, 2].map(i => (s & (1 << i) ? -1 : 1) * rep[p[i]]);
      for (const t of basis) {
        const f = add(g, t.f).map(wrap01);
        const k = key(f);
        if (!seen.has(k)) { seen.add(k); out.push({ el, f }); }
      }
    }
  }
  return out.sort((a, b) => key(a.f).localeCompare(key(b.f)));
}

/** Is f (any cell) a position of this site basis? */
export function isSiteOf(f, sBasis) {
  const k = key(f.map(wrap01));
  return sBasis.some(s => key(s.f) === k);
}

/** Every image of the sites in a region (on its faces, edges and corners too): [{ f, basisIndex, inOriginal }]. */
export const siteImages = (sBasis, region) => sitesInRegion(sBasis, region);

/**
 * Sites per cell, counted the way lattice points are: a site on a face is shared
 * by 2 cells, on an edge by 4, on a corner by 8. → { groups: [{ share, count }], total }
 */
const siteCount = (sBasis, region = boxRegion([1, 1, 1])) => pointCount(sBasis, region);

/**
 * Host lattice points around a position f, nearest first: [{ f, d }].
 * Returns the n nearest, plus any others closer than `within` (Å).
 */
export function hostsAround(L, basis, f, { n = 0, within = 0 } = {}) {
  const found = [];
  const c = f.map(Math.floor);
  for (const s of basis) {
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (let k = -2; k <= 2; k++) {
      const g = [s.f[0] + c[0] + i, s.f[1] + c[1] + j, s.f[2] + c[2] + k];
      const d = L.distance(f, g);
      if (d > 1e-9) found.push({ f: g, d });
    }
  }
  found.sort((a, b) => a.d - b.d);
  return found.filter((h, i) => i < n || h.d < within - 1e-9);
}

/**
 * How big a hole is, with touching host spheres of radius R:
 * d = distance from the centre of the hole to the nearest hosts, r_max = d − R.
 */
function holeSize(L, basis, f, R) {
  const d = hostsAround(L, basis, f, { n: 1 })[0].d;
  return { d, rMax: d - R, ratio: (d - R) / R };
}

/**
 * Place a sphere of radius r at f between hosts of radius R.
 * Every host it overlaps must move straight outward by δ = r + R − d.
 * → { R, r, d, rMax, ratio, critical, fits, room, hosts: [{ f, d, overlap }],
 *     shells: [{ d, count, move }] (hosts grouped by distance), maxMove }
 */
export function fitAtom(L, basis, f, r, R, cn) {
  const hosts = hostsAround(L, basis, f, { n: cn, within: r + R });
  const d = hosts[0].d, rMax = d - R;
  const list = hosts.map(h => ({ ...h, overlap: r + R - h.d }));
  const shells = [];
  for (const h of list) {
    const last = shells[shells.length - 1];
    if (last && Math.abs(h.d - last.d) < 1e-6) last.count++;
    else shells.push({ d: h.d, count: 1, move: Math.max(0, h.overlap) });
  }
  const fits = r <= rMax + 1e-9;
  return {
    R, r, d, rMax, ratio: r / R, critical: rMax / R, fits, room: rMax - r,
    hosts: list, shells, maxMove: Math.max(0, ...list.map(h => h.overlap)),
  };
}

/**
 * Every kind of site of the lattice in a scene (ctx from SceneModel.recompute:
 * bravais, basis, lattice, analysis), with touching hosts of radius R = d_nn / 2:
 *   [{ kind, rep, cn, ideal, where, sBasis, count, N, perPoint, R, d, rMax, ratio }]
 * or null when the lattice is not covered. Cached on ctx (rebuilt with it).
 */
export function sceneSites(ctx) {
  if (ctx._sites !== undefined) return ctx._sites;
  const list = INTERSTITIALS[ctx.bravais.id];
  if (!list) { ctx._sites = null; return null; }
  const R = ctx.analysis.neighbours.dnn / 2;
  const N = pointCount(ctx.basis, boxRegion([1, 1, 1])).total;
  ctx._sites = list.map(s => {
    const sBasis = siteBasis(s.rep, ctx.basis, s.kind);
    const count = siteCount(sBasis);
    return { ...s, sBasis, count, N, perPoint: count.total / N, R, ...holeSize(ctx.lattice, ctx.basis, s.rep, R) };
  });
  return ctx._sites;
}

/** Where a position lies in its cell (f relative to the cell origin): 'body centre', 'face centre', 'edge midpoint', … */
export function sitePlace(f) {
  const onB = f.filter(x => Math.abs(x) < 1e-6 || Math.abs(x - 1) < 1e-6).length;
  const halves = f.filter(x => Math.abs(x - 0.5) < 1e-6).length;
  if (onB === 0) return halves === 3 ? txt('placeBodyCentre') : txt('placeInside');
  if (onB === 1) return halves === 2 ? txt('placeFaceCentre') : txt('placeOnFace');
  if (onB === 2) return halves === 1 ? txt('placeEdgeMidpoint') : txt('placeOnEdge');
  return txt('placeCorner');
}

/**
 * Faces of the convex polyhedron with these vertices (Cartesian, 4–8 points):
 * [[p, …]] each ordered around its centre. Coplanar vertices share one face, so a
 * cube gives 6 squares, an octahedron 8 triangles.
 */
export function polyhedronFaces(points) {
  const n = points.length, faces = [], seen = new Set();
  const size = Math.max(...points.map(p => norm(sub(p, points[0]))));
  const eps = 1e-6 * Math.max(1, size);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
    let nv = cross(sub(points[j], points[i]), sub(points[k], points[i]));
    const len = norm(nv);
    if (len < eps * eps) continue;
    nv = scale(nv, 1 / len);
    let dd = dot(nv, points[i]);
    const s = points.map(p => dot(nv, p) - dd);
    if (s.every(x => x <= eps)) { /* outward already */ } else if (s.every(x => x >= -eps)) { nv = scale(nv, -1); dd = -dd; } else continue;
    const on = points.filter(p => Math.abs(dot(nv, p) - dd) <= eps);
    const id = on.map(p => points.indexOf(p)).sort((a, b) => a - b).join(',');
    if (seen.has(id)) continue;
    seen.add(id);
    const c = centroid(on);
    faces.push(sortAround(on, c, nv, sub(on[0], c)));
  }
  return faces;
}

/** First hit of a ray (origin o, direction dir) on a sphere, as the distance along the ray, or null. */
export function raySphere(o, dir, c, r) {
  const dl = norm(dir), u = scale(dir, 1 / dl), oc = sub(o, c);
  const b = dot(oc, u), q = dot(oc, oc) - r * r, disc = b * b - q;
  if (disc < 0) return null;
  const s = Math.sqrt(disc), t0 = -b - s, t1 = -b + s;
  if (t0 >= 0) return t0;
  return t1 >= 0 ? t1 : null;
}

/** The nearest of these spheres [{ c, r, data }] that the ray hits → { t, data }, or null. */
export function nearestHit(ray, spheres) {
  let best = null;
  for (const s of spheres) {
    const t = raySphere(ray.origin, ray.dir, s.c, s.r);
    if (t != null && (!best || t < best.t)) best = { t, data: s.data };
  }
  return best;
}

/**
 * The circle where two overlapping spheres meet: { centre, normal, radius } (Cartesian),
 * or null when they do not cut each other.
 */
export function sphereIntersection(c1, r1, c2, r2) {
  const dv = sub(c2, c1), d = norm(dv);
  if (d < 1e-12 || d >= r1 + r2 || d <= Math.abs(r1 - r2)) return null;
  const x = (d * d + r1 * r1 - r2 * r2) / (2 * d), u = scale(dv, 1 / d);
  return { centre: add(c1, scale(u, x)), normal: u, radius: Math.sqrt(Math.max(0, r1 * r1 - x * x)) };
}

/** Points on a circle (centre, unit normal, radius), closed: n + 1 points. */
export function circlePoints({ centre, normal, radius }, n = 48) {
  const a = Math.abs(normal[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = cross(normal, a), l1 = norm(e1), u = scale(e1, 1 / l1), v = cross(normal, u);
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = (2 * Math.PI * i) / n;
    out.push(add(centre, add(scale(u, radius * Math.cos(t)), scale(v, radius * Math.sin(t)))));
  }
  return out;
}
