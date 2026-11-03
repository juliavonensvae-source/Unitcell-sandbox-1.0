/* Small SVG pictures of a unit cell (3D) or a 2D cell, used as previews in the pickers.
   Pure geometry → SVG string; colours come from CSS so they follow the theme. */
import { Lattice } from '../math/lattice.js';
import { boxEdges, boxRegion, sitesInRegion } from '../math/cells.js';
import { cross, dot, normalize, sub } from '../math/linalg.js';

const VIEW = normalize([2.3, 1.05, 1.0]); // viewing direction in the crystal frame (z = up)

/** Scales and centres points ([x, y, …]) into a size × size box with a pad on each side → ([x, y]) → [X, Y] (y down). */
function fitBox(pts, size, pad) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = (size * (1 - 2 * pad)) / Math.max(x1 - x0, y1 - y0);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return ([x, y]) => [size / 2 + (x - cx) * s, size / 2 - (y - cy) * s];
}

const svgThumb = (size, body) => `<svg class="thumb" viewBox="0 0 ${size} ${size}" aria-hidden="true" focusable="false">${body}</svg>`;
const isCorner = f => f.every(v => Math.abs(v) < 1e-6 || Math.abs(v - 1) < 1e-6);

/**
 * @param params lattice parameters
 * @param basis  lattice-point basis (fractional, in [0, 1))
 * @returns SVG markup: cell edges (hidden ones dashed) and lattice points;
 *          corner points get class "is-corner", centring points "is-centre".
 */
export function latticeThumbnail(params, basis, { size = 72, pad = 0.13 } = {}) {
  const L = new Lattice(params);
  const z = VIEW, x = normalize(cross([0, 0, 1], z)), y = cross(z, x);
  const centre = L.toCartesian([0.5, 0.5, 0.5]);
  const proj = f => { const p = sub(L.toCartesian(f), centre); return [dot(p, x), dot(p, y), dot(p, z)]; };

  const corners = [];
  for (const i of [0, 1]) for (const j of [0, 1]) for (const k of [0, 1]) corners.push(proj([i, j, k]));
  const fit = fitBox(corners, size, pad);
  const P = f => { const q = proj(f), [px, py] = fit(q); return { x: px, y: py, d: q[2] }; };
  const n = v => v.toFixed(2);

  // A face is visible when its outward normal points towards the viewer; an edge is drawn solid when one of its faces is.
  const faceVisible = (axis, at) => (at ? 1 : -1) * dot(L.reciprocal[axis], z) > 1e-9;
  const hidden = [], shown = [];
  for (const [a, b] of boxEdges([1, 1, 1])) {
    const A = P(a), B = P(b);
    const line = `<line x1="${n(A.x)}" y1="${n(A.y)}" x2="${n(B.x)}" y2="${n(B.y)}"/>`;
    ([0, 1, 2].some(ax => a[ax] === b[ax] && faceVisible(ax, a[ax])) ? shown : hidden).push(line);
  }

  const sites = sitesInRegion(basis, boxRegion()).map(st => ({ ...P(st.f), corner: isCorner(st.f) }));
  const ds = sites.map(p => p.d), dmin = Math.min(...ds), dmax = Math.max(...ds);
  sites.sort((a, b) => a.d - b.d);
  const dots = sites.map(p => {
    const depth = dmax > dmin ? (p.d - dmin) / (dmax - dmin) : 0.5;
    const r = size * (p.corner ? 0.05 : 0.062) * (0.8 + 0.4 * depth);
    return `<circle class="${p.corner ? 'is-corner' : 'is-centre'}" cx="${n(p.x)}" cy="${n(p.y)}" r="${n(r)}"/>`;
  }).join('');

  return svgThumb(size, `<g class="thumb-hidden">${hidden.join('')}</g><g class="thumb-edges">${shown.join('')}</g>`
    + `<g class="thumb-points">${dots}</g>`);
}

/** Small SVG picture of a 2D cell (lattice: Lattice2D, basis: [[x, y]]). */
export function flatThumbnail(lattice, basis, { size = 72, pad = 0.16 } = {}) {
  const f1 = v => (Math.round(v * 10) / 10).toString();
  const corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map(f => lattice.toCartesian(f));
  const P = fitBox(corners, size, pad);
  const pts = corners.map(P).map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ');
  const dots = [];
  for (const b of basis) for (const i of [0, 1]) for (const j of [0, 1]) {
    const f = [b[0] + i, b[1] + j];
    if (f[0] > 1 + 1e-6 || f[1] > 1 + 1e-6) continue;
    const corner = isCorner(f);
    const [x, y] = P(lattice.toCartesian(f));
    dots.push(`<circle class="${corner ? 'is-corner' : 'is-centre'}" cx="${f1(x)}" cy="${f1(y)}" r="${f1(size * (corner ? 0.055 : 0.065))}"/>`);
  }
  return svgThumb(size, `<g class="thumb-edges"><polygon points="${pts}" fill="none" stroke-linejoin="round"/></g><g class="thumb-points">${dots.join('')}</g>`);
}
