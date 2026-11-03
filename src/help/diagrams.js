/* =====================================================================
   Small explanatory pictures for the SEE MORE panel: SVG (or HTML)
   strings, no DOM. Colours come from classes in src/styles/help.css, so
   every picture follows light / dark mode.
   ===================================================================== */
import { BRAVAIS, defaultSetting, defaultParams, latticeBasis } from '../data/bravais.js';
import { SYSTEMS, SYSTEM_ORDER, CENTRING_INFO } from '../data/systems.js';
import { BRAVAIS_2D, SYSTEMS_2D, SYSTEM_ORDER_2D, basis2D } from '../data/bravais2d.js';
import { latticeThumbnail, flatThumbnail } from '../render/thumbnail.js';
import { Lattice2D } from '../math/lattice2d.js';
import { txt } from '../text.js';

const f = x => (+x).toFixed(1);
export const svg = (w, h, body, label) =>
  `<svg class="hd" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}"><defs>
    <marker id="hd-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="hd-head"/></marker>
    <marker id="hd-arrow-hl" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="hd-head-hl"/></marker>
  </defs>${body}</svg>`;
export const line = (a, b, cls = 'hd-line', extra = '') => `<line class="${cls}" x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}"${extra}/>`;
export const text = (p, s, cls = 'hd-text', anchor = 'middle') => `<text class="${cls}" x="${f(p[0])}" y="${f(p[1])}" text-anchor="${anchor}">${s}</text>`;
export const circle = (p, r, cls) => `<circle class="${cls}" cx="${f(p[0])}" cy="${f(p[1])}" r="${f(r)}"/>`;
export const it = s => `<tspan class="hd-it">${s}</tspan>`;
const add = (p, q, s = 1) => [p[0] + s * q[0], p[1] + s * q[1]];

/** Arc of radius r around c from angle t0 to t1 (radians, screen coordinates: y down). */
function arc(c, r, t0, t1, cls = 'hd-arc') {
  const p0 = [c[0] + r * Math.cos(t0), c[1] + r * Math.sin(t0)], p1 = [c[0] + r * Math.cos(t1), c[1] + r * Math.sin(t1)];
  const sweep = t1 > t0 ? 1 : 0, large = Math.abs(t1 - t0) > Math.PI ? 1 : 0;
  return `<path class="${cls}" d="M${f(p0[0])},${f(p0[1])} A${f(r)},${f(r)} 0 ${large} ${sweep} ${f(p1[0])},${f(p1[1])}"/>`;
}

/* ---------- Bragg's law: the path difference 2d sin θ ---------- */
export function braggDiagram() {
  const W = 340, H = 214, th = 28 * Math.PI / 180, d = 62;
  const y1 = 78, y2 = y1 + d, P1 = [168, y1], P2 = [168, y2];
  const u = [Math.cos(th), Math.sin(th)], v = [Math.cos(th), -Math.sin(th)];
  const A = add(P2, u, -d * Math.sin(th)), C = add(P2, v, d * Math.sin(th));
  let body = '';
  for (const y of [y1, y2]) {
    body += line([14, y], [W - 46, y], 'hd-plane');
    for (let x = 28; x < W - 46; x += 40) body += circle([x, y], 4.2, 'hd-atom');
  }
  // incoming and reflected rays
  body += line(add(P1, u, -150), P1, 'hd-ray', ' marker-end="url(#hd-arrow)"') + line(P1, add(P1, v, 150), 'hd-ray', ' marker-end="url(#hd-arrow)"');
  body += line(add(P2, u, -210), P2, 'hd-ray', '') + line(P2, add(P2, v, 210), 'hd-ray', ' marker-end="url(#hd-arrow)"');
  // wavefronts: equal phase up to A and from C on
  body += line(P1, A, 'hd-dash') + line(P1, C, 'hd-dash');
  // the extra path of the lower ray
  body += line(A, P2, 'hd-hl') + line(P2, C, 'hd-hl');
  body += text([P2[0] - 44, y2 + 30], `${it('d')} sin ${it('θ')}`, 'hd-text hd-hl-text');
  body += text([P2[0] + 44, y2 + 30], `${it('d')} sin ${it('θ')}`, 'hd-text hd-hl-text');
  body += text(add(A, [-8, -6]), 'A', 'hd-small', 'end') + text(add(P2, [0, 18]), 'B', 'hd-small') + text(add(C, [8, -6]), 'C', 'hd-small', 'start');
  // θ at the upper reflection point, on both sides
  body += arc(P1, 30, Math.PI, Math.PI + th) + arc(P1, 30, -th, 0);
  body += text(add(P1, [-46, -5]), it('θ')) + text(add(P1, [46, -5]), it('θ'));
  // spacing d
  const xd = W - 26;
  body += line([xd, y1 + 3], [xd, y2 - 3], 'hd-dim', ' marker-start="url(#hd-arrow)" marker-end="url(#hd-arrow)"');
  body += text([xd + 12, (y1 + y2) / 2 + 5], it('d'), 'hd-text', 'middle');
  body += text([W / 2, H - 10], txt('diagBraggPath') + it('d') + ' sin ' + it('θ'), 'hd-caption');
  return svg(W, H, body, txt('diagBraggCaption'));
}

/* ---------- hexagonal axes a1, a2, a3 in the basal plane ---------- */
export function hexAxesDiagram() {
  const W = 250, H = 226, O = [125, 116], r = 84;
  const pt = deg => [O[0] + r * Math.cos(deg * Math.PI / 180), O[1] - r * Math.sin(deg * Math.PI / 180)];
  const hex = [0, 60, 120, 180, 240, 300].map(pt);
  let body = `<polygon class="hd-hex" points="${hex.map(p => `${f(p[0])},${f(p[1])}`).join(' ')}"/>`;
  for (const p of hex) body += circle(p, 4.5, 'hd-atom');
  body += circle(O, 4.5, 'hd-atom');
  const axes = [[0, 'a<tspan class="hd-sub" dy="4">1</tspan>', 'hd-ax-a'], [120, 'a<tspan class="hd-sub" dy="4">2</tspan>', 'hd-ax-b'], [240, 'a<tspan class="hd-sub" dy="4">3</tspan>', 'hd-ax-a3']];
  for (const [deg, label, cls] of axes) {
    const tip = pt(deg), lab = [O[0] + (r + 22) * Math.cos(deg * Math.PI / 180), O[1] - (r + 22) * Math.sin(deg * Math.PI / 180) + 5];
    body += `<line class="hd-axis ${cls}" x1="${O[0]}" y1="${O[1]}" x2="${f(tip[0])}" y2="${f(tip[1])}"/>`;
    body += `<text class="hd-axis-label ${cls}" x="${f(lab[0])}" y="${f(lab[1])}" text-anchor="middle">${label}</text>`;
  }
  body += arc(O, 26, -2 * Math.PI / 3, 0) + text([O[0] + 30, O[1] - 30], '120°', 'hd-small', 'start');
  body += circle(O, 10, 'hd-c-out') + circle(O, 2.4, 'hd-c-dot');
  body += text([W - 6, H - 6], txt('diagHexC', { c: it('c') }), 'hd-small', 'end');
  return svg(W, H, body, txt('diagHexCaption'));
}

/* ---------- cubic F octahedral hole on a cube face ---------- */
export function octahedralDiagram() {
  const W = 260, H = 262, s = 180, x0 = 40, y0 = 30, R = Math.SQRT2 * s / 4, r = s / 2 - R;
  const C = [[x0, y0], [x0 + s, y0], [x0 + s, y0 + s], [x0, y0 + s]];
  let body = `<clipPath id="hd-face"><rect x="${x0}" y="${y0}" width="${s}" height="${s}"/></clipPath>`;
  body += `<g clip-path="url(#hd-face)">${C.map(p => circle(p, R, 'hd-ball-a')).join('')}</g>`;
  body += circle([x0 + s / 2, y0 + s / 2], R, 'hd-ball-a');
  body += `<rect class="hd-cell" x="${x0}" y="${y0}" width="${s}" height="${s}"/>`;
  for (const m of [[x0 + s / 2, y0], [x0 + s, y0 + s / 2], [x0 + s / 2, y0 + s], [x0, y0 + s / 2]]) body += circle(m, r, 'hd-hole');
  // face diagonal: 4R
  body += line([x0, y0], [x0 + s, y0 + s], 'hd-dash');
  const lab = [x0 + s * 0.27, y0 + s * 0.27 - 8];
  body += `<text class="hd-text" x="${f(lab[0])}" y="${f(lab[1])}" text-anchor="middle" transform="rotate(45 ${f(lab[0])} ${f(lab[1])})">√2 ${it('a')} = 4${it('R')}</text>`;
  // along the bottom edge: R + 2r + R = a
  const yb = y0 + s + 18;
  body += line([x0, yb], [x0 + s, yb], 'hd-dim', ' marker-start="url(#hd-arrow)" marker-end="url(#hd-arrow)"');
  body += text([x0 + s / 2, yb + 18], `${it('a')} = 2${it('R')} + 2${it('r')}`, 'hd-text');
  body += text([x0 + R / 2, y0 + s - 8], it('R'), 'hd-small') + text([x0 + s / 2, y0 + s - r - 6], it('r'), 'hd-small hd-hl-text');
  return svg(W, H, body, txt('diagOctCaption'));
}

/**
 * A flat section through a cubic cell (lengths in units of a): host spheres of
 * radius R cut by the section, the hole r, the line along which spheres touch
 * (dashed, labelled) and a dimension along one edge ('below' or 'left').
 */
function holeSection({ id, w, h, hosts, R, hole, r, diag, edge, title, label, rAt }) {
  const S = 180 / Math.max(w, h), W = Math.max(270, w * S + 92), x0 = (W - w * S) / 2, y0 = 34, H = h * S + y0 + 52;
  const P = ([x, y]) => [x0 + x * S, y0 + (h - y) * S];
  let body = `<clipPath id="hd-sec-${id}"><rect x="${f(x0)}" y="${f(y0)}" width="${f(w * S)}" height="${f(h * S)}"/></clipPath>`;
  body += text([W / 2, 16], title, 'hd-small');
  body += `<g clip-path="url(#hd-sec-${id})">${hosts.map(p => circle(P(p), R * S, 'hd-ball-a')).join('')}</g>`;
  body += `<rect class="hd-cell" x="${f(x0)}" y="${f(y0)}" width="${f(w * S)}" height="${f(h * S)}"/>`;
  body += circle(P(hole), Math.max(2.5, r * S), 'hd-hole');
  // the touching line, labelled along its length
  const A = P(diag.from), B = P(diag.to), ang = Math.atan2(B[1] - A[1], B[0] - A[0]) * 180 / Math.PI;
  body += line(A, B, 'hd-dash');
  const t = diag.at ?? 0.3, M0 = [A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1])];
  const nrm = [Math.sin(ang * Math.PI / 180), -Math.cos(ang * Math.PI / 180)], lab = add(M0, nrm, 9);
  body += `<text class="hd-text" x="${f(lab[0])}" y="${f(lab[1])}" text-anchor="middle" transform="rotate(${f(ang)} ${f(lab[0])} ${f(lab[1])})">${diag.label}</text>`;
  // the edge dimension
  const E0 = P(edge.from), E1 = P(edge.to);
  if (edge.side === 'left') {
    const xl = x0 - 20;
    body += line([xl, E0[1]], [xl, E1[1]], 'hd-dim', ' marker-start="url(#hd-arrow)" marker-end="url(#hd-arrow)"');
    const ym = (E0[1] + E1[1]) / 2;
    body += `<text class="hd-text" x="${f(xl - 8)}" y="${f(ym)}" text-anchor="middle" transform="rotate(-90 ${f(xl - 8)} ${f(ym)})">${edge.label}</text>`;
  } else {
    const yb = y0 + h * S + 18;
    body += line([E0[0], yb], [E1[0], yb], 'hd-dim', ' marker-start="url(#hd-arrow)" marker-end="url(#hd-arrow)"');
    body += text([(E0[0] + E1[0]) / 2, yb + 18], edge.label, 'hd-text');
  }
  body += text(P(rAt), it('R'), 'hd-small'); // inside one host, clear of the labelled lines
  body += text(add(P(hole), [0, -Math.max(2.5, r * S) - 5]), it('r'), 'hd-small hd-hl-text');
  return svg(W, H, body, label);
}

/** Cubic I, octahedral hole at an edge midpoint: the section through that edge and the body diagonal. */
export function bccOctahedralDiagram() {
  const q = Math.SQRT2, R = Math.sqrt(3) / 4;
  return holeSection({
    id: 'bcc-oct', w: 1, h: q, hosts: [[0, 0], [1, 0], [0, q], [1, q], [0.5, q / 2]], R, hole: [0.5, 0], r: 0.5 - R, rAt: [0.13, q - 0.14],
    diag: { from: [0, 0], to: [1, q], label: `√3 ${it('a')} = 4${it('R')}`, at: 0.72 },
    edge: { from: [0, 0], to: [1, 0], side: 'below', label: `${it('a')} = 2${it('R')} + 2${it('r')}` },
    title: txt('diagBccCut'),
    label: txt('diagBccCaption'),
  });
}

/** Cubic P, cubic hole at the body centre: the section through c and a face diagonal. */
export function cubicHoleDiagram() {
  const q = Math.SQRT2;
  return holeSection({
    id: 'sc-cub', w: q, h: 1, hosts: [[0, 0], [q, 0], [0, 1], [q, 1]], R: 0.5, hole: [q / 2, 0.5], r: (Math.sqrt(3) - 1) / 2, rAt: [0.14, 0.86],
    diag: { from: [0, 0], to: [q, 1], label: `√3 ${it('a')} = 2${it('R')} + 2${it('r')}`, at: 0.24 },
    edge: { from: [0, 0], to: [0, 1], side: 'left', label: `${it('a')} = 2${it('R')}` },
    title: txt('diagCubicCut'),
    label: txt('diagCubicCaption'),
  });
}

/* ---------- the plane nearest the origin and its distance d (cubic derivation) ---------- */
export function spacingDiagram() {
  const W = 260, H = 210, O = [44, 176], X = [214, 176], Y = [44, 52];
  const dx = X[0] - Y[0], dy = X[1] - Y[1], t = ((O[0] - Y[0]) * dx + (O[1] - Y[1]) * dy) / (dx * dx + dy * dy);
  const F = [Y[0] + t * dx, Y[1] + t * dy];
  let body = line(O, [240, 176], 'hd-axisline', ' marker-end="url(#hd-arrow)"') + line(O, [44, 22], 'hd-axisline', ' marker-end="url(#hd-arrow)"');
  body += text([246, 180], it('x'), 'hd-small', 'start') + text([44, 16], it('y'), 'hd-small');
  // the plane (edge-on) and the next one of the set
  body += line(add(Y, [-dx, -dy], 0.12), add(X, [dx, dy], 0.1), 'hd-plane-line');
  body += line(add(add(Y, [-dx, -dy], 0.12), [F[0] - O[0], F[1] - O[1]], 1), add(add(X, [dx, dy], 0.02), [F[0] - O[0], F[1] - O[1]], 1), 'hd-plane-line is-faint');
  body += line(O, F, 'hd-hl', ' marker-end="url(#hd-arrow-hl)"');
  body += text(add(add(O, F).map(x => x / 2), [-12, -6]), it('d'), 'hd-text hd-hl-text');
  body += circle(X, 4.5, 'hd-atom') + circle(Y, 4.5, 'hd-atom') + circle(O, 4.5, 'hd-atom');
  body += text([X[0], X[1] + 22], `${it('a')}/${it('h')}`, 'hd-text') + text([Y[0] - 10, Y[1] + 5], `${it('a')}/${it('k')}`, 'hd-text', 'end');
  body += text([O[0] - 10, O[1] + 18], 'O', 'hd-small');
  // right angle at F
  const n = [(F[0] - O[0]), (F[1] - O[1])], L = Math.hypot(...n), e = [n[0] / L, n[1] / L], g = [-e[1], e[0]];
  const q1 = add(F, e, -9), q2 = add(add(F, e, -9), g, 9), q3 = add(F, g, 9);
  body += `<polyline class="hd-thin" points="${f(q1[0])},${f(q1[1])} ${f(q2[0])},${f(q2[1])} ${f(q3[0])},${f(q3[1])}"/>`;
  body += text([150, 40], txt('diagSpacingLabel'), 'hd-small', 'middle');
  return svg(W, H, body, txt('diagSpacingCaption'));
}

/* ---------- angle between two vectors ---------- */
export function angleDiagram() {
  const W = 250, H = 170, O = [40, 140], t2 = -52 * Math.PI / 180;
  const A = [210, 140], B = [O[0] + 150 * Math.cos(t2), O[1] + 150 * Math.sin(t2)];
  let body = line(O, A, 'hd-vec-1', ' marker-end="url(#hd-arrow)"') + line(O, B, 'hd-vec-2', ' marker-end="url(#hd-arrow)"');
  body += arc(O, 42, t2, 0, 'hd-arc-hl') + text([O[0] + 56, O[1] - 18], it('θ'), 'hd-text hd-hl-text', 'start');
  body += text([A[0] - 4, A[1] + 22], `${it('r')}<tspan class="hd-sub" dy="4">1</tspan>`, 'hd-text') + text([B[0] + 14, B[1] + 4], `${it('r')}<tspan class="hd-sub" dy="4">2</tspan>`, 'hd-text', 'start');
  body += text([W / 2, 24], `${it('r')}₁·${it('r')}₂ = |${it('r')}₁| |${it('r')}₂| cos ${it('θ')}`, 'hd-caption');
  return svg(W, H, body, txt('diagAngleCaption'));
}

/* ---------- tables of lattices (HTML) ---------- */
const thumb3 = (b, setting = defaultSetting(b), size = 64) =>
  latticeThumbnail(defaultParams(b, setting), latticeBasis(b, setting), { size });

/** The seven crystal systems, each with a picture of its primitive cell and its rule. */
export function systemsGrid(ctx) {
  const cur = ctx && ctx.bravais.system;
  return `<div class="hd-grid">${SYSTEM_ORDER.map(sys => {
    const b = BRAVAIS.find(x => x.system === sys);
    return `<div class="hd-tile${sys === cur ? ' is-current' : ''}">${thumb3(b)}<b>${SYSTEMS[sys].label}</b><small>${SYSTEMS[sys].rule}</small></div>`;
  }).join('')}</div>`;
}

/** The centring types, each drawn in one lattice. */
export function centringGrid(ctx) {
  const show = [['cP', 'P'], ['cI', 'I'], ['cF', 'F'], ['oC', 'C'], ['hR', 'R']];
  const N = { P: 1, I: 2, F: 4, C: 2, R: 3 };
  const cur = ctx && (ctx.bravais.id === 'hR' ? 'R' : ctx.bravais.centring);
  return `<div class="hd-grid">${show.map(([id, c]) => {
    const b = BRAVAIS.find(x => x.id === id);
    const pic = id === 'hR' ? thumb3(b, 'hexagonal') : thumb3(b);
    return `<div class="hd-tile${c === cur ? ' is-current' : ''}">${pic}<b><span class="cbadge">${c}</span> ${CENTRING_INFO[c].name}</b><small>${txt(N[c] > 1 ? 'diagPointsPerCell' : 'diagPointPerCell', { count: N[c] })}${id === 'hR' ? ` ${txt('diagHexAxes')}` : ''}</small></div>`;
  }).join('')}</div>`;
}

/** Which of the 7 × 4 combinations are Bravais lattices, and why the others are not. */
export const BRAVAIS_TABLE = {
  cubic: { P: 'cP', C: txt('diagWhyCubicC'), I: 'cI', F: 'cF' },
  tetragonal: { P: 'tP', C: txt('diagWhyTetragonalC'), I: 'tI', F: txt('diagWhyTetragonalF') },
  orthorhombic: { P: 'oP', C: 'oC', I: 'oI', F: 'oF' },
  hexagonal: { P: 'hP', C: txt('diagWhyHexagonalC'), I: txt('diagWhyHexagonalIF'), F: txt('diagWhyHexagonalIF') },
  rhombohedral: { P: 'hR', C: txt('diagWhyRhombohedralC'), I: txt('diagWhyRhombohedralIF'), F: txt('diagWhyRhombohedralIF') },
  monoclinic: { P: 'mP', C: 'mC', I: txt('diagWhyMonoclinicI'), F: txt('diagWhyMonoclinicF') },
  triclinic: { P: 'aP', C: txt('diagWhyTriclinicC'), I: txt('diagWhyTriclinicIF'), F: txt('diagWhyTriclinicIF') },
};

export function bravaisTable(ctx) {
  const cur = ctx && ctx.bravais.id;
  const head = ['P', 'C', 'I', 'F'].map(c => `<th scope="col"><span class="cbadge">${c}</span></th>`).join('');
  const rows = SYSTEM_ORDER.map(sys => {
    const cells = ['P', 'C', 'I', 'F'].map(c => {
      const v = BRAVAIS_TABLE[sys][c];
      const b = BRAVAIS.find(x => x.id === v);
      if (b) return `<td class="bt-yes${b.id === cur ? ' is-current' : ''}" title="${b.name}">${thumb3(b, defaultSetting(b), 40)}<small>${b.id === 'hR' ? 'R' : c}</small></td>`;
      return `<td class="bt-no" title="${v}"><span aria-hidden="true">✕</span><span class="sr-only">${v}</span></td>`;
    }).join('');
    return `<tr><th scope="row">${SYSTEMS[sys].label}</th>${cells}</tr>`;
  }).join('');
  return `<div class="table-wrap"><table class="bt"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
    <p class="hd-note">${txt('diagBravaisNote')}</p>`;
}

/** The five 2D Bravais lattices. */
export function lattices2dGrid(fc) {
  const cur = fc && fc.bravais.id;
  return `<div class="hd-grid">${SYSTEM_ORDER_2D.flatMap(sys => BRAVAIS_2D.filter(b => b.system === sys)).map(b =>
    `<div class="hd-tile${b.id === cur ? ' is-current' : ''}">${flatThumbnail(new Lattice2D(b.params), basis2D(b), { size: 64 })}<b>${b.name}</b><small>${SYSTEMS_2D[b.system].rule}</small></div>`).join('')}</div>`;
}
