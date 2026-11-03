/* =====================================================================
   Pictures for the Defects help topics, and the live graph of the
   vacancy concentration (also on its card). SVG strings, no DOM; the
   atoms are moved by the same fields as the 3D view (src/math), drawn
   flat (a square lattice), with the movement exaggerated where noted.
   Colours come from classes in src/styles/help.css.
   ===================================================================== */
import * as M from '../math/index.js';
import { svg, line, text, circle, it } from './diagrams.js';
import { txt } from '../text.js';

const f1 = x => (+x).toFixed(1);
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
/** 10⁻⁵ */
const pow10 = n => `10${String(n).split('').map(c => SUP[c]).join('')}`;
/** 2.74 × 10⁻⁴ as HTML (or plain text with { plain: true }). */
export function sci(x, digits = 3, { plain = false } = {}) {
  if (!(x > 0)) return '0';
  const e = Math.floor(Math.log10(x)), m = x / 10 ** e;
  const mant = (+m.toPrecision(digits)).toString();
  if (e === 0) return mant;
  return plain ? `${mant} × ${pow10(e)}` : `${mant} × 10<sup>${String(e).replace('-', '−')}</sup>`;
}

/* ---------- the vacancy concentration ---------- */
const T_MIN = 200, T_MAX = 2000;

/**
 * N_v/N against T (log scale, 10⁻²⁰ to 1) or, with mode 'arrhenius', ln(N_v/N) against 1/T,
 * a straight line of slope −Q_v/k. The dot is the temperature chosen.
 */
export function vacancyGraph({ T, Q, mode = 'T' }) {
  const W = 320, H = 196, l = 50, r = 14, t = 14, b = 36, pw = W - l - r, ph = H - t - b;
  const arr = mode === 'arrhenius';
  // x: T (K) or 1000/T; y: log10(N_v/N) or ln(N_v/N)
  const xr = arr ? [0.5, 5] : [T_MIN, T_MAX], yr = arr ? [-46, 0] : [-20, 0];
  const X = v => l + ((v - xr[0]) / (xr[1] - xr[0])) * pw, Y = v => t + ((yr[1] - v) / (yr[1] - yr[0])) * ph;
  const yOf = TT => (arr ? -Q / (M.K_EV * TT) : -Q / (M.K_EV * TT * Math.LN10));
  const xOf = TT => (arr ? 1000 / TT : TT);
  let body = '';
  // grid and tick labels
  const yTicks = arr ? [0, -10, -20, -30, -40] : [0, -5, -10, -15, -20], xTicks = arr ? [1, 2, 3, 4, 5] : [500, 1000, 1500, 2000];
  for (const v of yTicks) body += line([l, Y(v)], [l + pw, Y(v)], 'vc-grid') + text([l - 6, Y(v) + 4], arr ? String(v).replace('-', '−') : pow10(v), 'vc-tick', 'end');
  for (const v of xTicks) body += line([X(v), t], [X(v), t + ph], 'vc-grid') + text([X(v), t + ph + 15], String(v), 'vc-tick');
  body += line([l, t + ph], [l + pw, t + ph], 'vc-axis') + line([l, t], [l, t + ph], 'vc-axis');
  body += text([l + pw, H - 4], arr ? txt('vcAxis1000T') : txt('vcAxisT'), 'vc-axis-title', 'end');
  body += text([l + 4, t + 11], arr ? txt('vcAxisLn') : txt('vcAxisFraction'), 'vc-axis-title', 'start');
  // the curve, cut where it leaves the plot
  const pts = [];
  for (let TT = T_MIN; TT <= T_MAX; TT += 10) {
    const y = yOf(TT);
    if (y >= yr[0] && xOf(TT) >= xr[0] && xOf(TT) <= xr[1]) pts.push(`${f1(X(xOf(TT)))},${f1(Y(y))}`);
  }
  if (pts.length > 1) body += `<polyline class="vc-line" points="${pts.join(' ')}"/>`;
  // hover: what the curve says at each temperature (browser tooltip)
  for (let TT = T_MIN; TT < T_MAX; TT += 50) {
    const x0 = X(xOf(TT)), x1 = X(xOf(TT + 50));
    body += `<rect class="vc-hit" x="${f1(Math.min(x0, x1))}" y="${t}" width="${f1(Math.abs(x1 - x0))}" height="${ph}"><title>${TT + 25} K: Nv/N = ${sci(M.vacancyFraction(TT + 25, Q), 2, { plain: true })}</title></rect>`;
  }
  // the chosen temperature
  const y = yOf(T), x = X(xOf(T)), inside = y >= yr[0];
  const py = inside ? Y(y) : t + ph;
  body += line([x, t + ph], [x, py], 'vc-guide') + line([l, py], [x, py], 'vc-guide');
  body += circle([x, py], inside ? 5 : 3.5, 'vc-dot');
  const label = inside ? sci(M.vacancyFraction(T, Q), 2, { plain: true }) : txt('vcBelow', { p: pow10(-20) });
  const right = x < l + pw * 0.6;
  body += text([x + (right ? 9 : -9), Math.max(t + 24, py - 9)], label, 'vc-value', right ? 'start' : 'end');
  if (arr) body += text([l + pw - 4, t + ph - 8], txt('vcSlope', { s: Math.round(Q / M.K_EV).toLocaleString('en-GB') }), 'vc-tick', 'end');
  return svg(W, H, body, txt(arr ? 'vcGraphArrhenius' : 'vcGraphT'));
}

/* ---------- point defects in a square lattice ---------- */
const S = 34; // px between atoms
const grid = (nx, ny) => { const out = []; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) out.push([i, j]); return out; };

/**
 * A 7 × 5 square layer with one point defect in the middle, its neighbours moved (exaggerated)
 * and arrows showing which way. kind: vacancy | self-interstitial | substitutional | interstitial | frenkel.
 */
export function pointDefectDiagram(kind) {
  const nx = 7, ny = 5, ox = 50, oy = 26 + (ny - 1) * S, R = 0.3 * S;
  const P = ([x, y]) => [ox + x * S, oy - y * S];
  const centre = [3, 2], hole = [3.5, 2.5], jumpFrom = [2, 2];
  const spec = {
    vacancy: { remove: [centre], relax: [{ c: centre, r1: 1, u1: -0.1 }] },
    substitutional: { atom: { at: centre, r: 1.3 * R, cls: 'hd-imp' }, remove: [centre], relax: [{ c: centre, r1: 1, u1: 0.12 }] },
    'self-interstitial': { atom: { at: hole, r: R, cls: 'hd-atom-self' }, relax: [{ c: hole, r1: Math.SQRT1_2, u1: 0.14 }] },
    interstitial: { atom: { at: hole, r: 0.55 * R, cls: 'hd-imp' }, relax: [{ c: hole, r1: Math.SQRT1_2, u1: 0.06 }] },
    frenkel: { atom: { at: hole, r: R, cls: 'hd-atom-self' }, remove: [jumpFrom], relax: [{ c: jumpFrom, r1: 1, u1: -0.08 }, { c: hole, r1: Math.SQRT1_2, u1: 0.12 }] },
  }[kind];
  const gone = new Set((spec.remove || []).map(p => p.join()));
  let body = '', arrows = '';
  for (const g of grid(nx, ny)) {
    if (gone.has(g.join())) continue;
    let u = [0, 0, 0];
    for (const x of spec.relax) u = M.add(u, M.pointDisplacement([...g, 0], [...x.c, 0], x.r1, x.u1));
    const at = [g[0] + u[0], g[1] + u[1]], moved = Math.hypot(u[0], u[1]);
    body += circle(P(g), 2.2, 'hd-ghost') + circle(P(at), R, 'hd-atom');
    if (moved > 0.03) {
      // in the gap in front of the atom, pointing the way it moved
      const d = [u[0] / moved, -u[1] / moved], p = P(at), from = [p[0] + d[0] * (R + 1), p[1] + d[1] * (R + 1)], to = [p[0] + d[0] * (R + 10), p[1] + d[1] * (R + 10)];
      arrows += line(from, to, 'hd-move', ' marker-end="url(#hd-arrow-hl)"');
    }
  }
  for (const g of spec.remove || []) body += circle(P(g), R, 'hd-vac');
  if (spec.atom) body += circle(P(spec.atom.at), spec.atom.r, spec.atom.cls);
  if (kind === 'frenkel') body += line(P([2.3, 2.15]), P([3.25, 2.4]), 'hd-ray', ' marker-end="url(#hd-arrow)"');
  const caption = { vacancy: txt('diagVacancy'), substitutional: txt('diagSubstitutional'), 'self-interstitial': txt('diagSelf'), interstitial: txt('diagInterstitial'), frenkel: txt('diagFrenkel') }[kind];
  const W = 2 * ox + (nx - 1) * S;
  return svg(W, oy + 40, `${body}${arrows}${text([W / 2, oy + 32], caption, 'hd-caption')}`, caption);
}

/* ---------- dislocations ---------- */

/** The atoms of an nx × ny square layer moved by one dislocation (b = 1, units of the spacing): [{ f, pos }]. */
function layer(nx, ny, d) {
  const shift = d ? M.dislocationShift(d, 1) : () => [0, 0, 0];
  return grid(nx, ny).map(g => { const f = [...g, 0]; return { f, pos: M.add(f, shift(f)) }; });
}

/** An edge dislocation: the extra half-plane (highlighted) ends at the line ⊥; squeezed above the slip plane, stretched below. */
export function edgeDiagram() {
  const nx = 9, ny = 7, ox = 34, oy = 30 + (ny - 1) * S, core = [4.5, 2.5];
  const P = ([x, y]) => [ox + x * S, oy - y * S];
  const atoms = layer(nx, ny, { kind: 'edge', line: 2, at: core, b: 1, nu: M.NU });
  // the extra column: the atom above the slip plane nearest the line, and the ones above it
  const row = atoms.filter(a => a.f[1] === 3).sort((p, q) => Math.abs(p.pos[0] - core[0]) - Math.abs(q.pos[0] - core[0]))[0].f[0];
  let body = line(P([-0.4, core[1]]), P([nx - 0.6, core[1]]), 'hd-dash');
  for (const a of atoms) body += circle(P(a.pos), 0.4 * S, a.f[0] === row && a.f[1] > core[1] ? 'hd-atom-hl' : 'hd-atom');
  const c = P(core);
  body += `<path class="hd-perp" d="M${f1(c[0] - 11)},${f1(c[1] + 5)} H${f1(c[0] + 11)} M${f1(c[0])},${f1(c[1] + 5)} V${f1(c[1] - 14)}"/>`;
  body += text([P([row, 6])[0], P([row, 6])[1] - 20], txt('diagHalfPlane'), 'hd-small hd-hl-text');
  body += text([P([nx - 0.6, core[1]])[0], c[1] - 6], txt('diagSlipPlane'), 'hd-small', 'end');
  body += text([(ox + P([nx - 1, 0])[0]) / 2, oy + 32], txt('diagEdgeCaption'), 'hd-caption');
  return svg(2 * ox + (nx - 1) * S, oy + 40, body, txt('diagEdgeCaption'));
}

/** A screw dislocation seen along its line: each atom shaded by how far it moved along the line — once round, the plane has risen by b. */
export function screwDiagram() {
  const nx = 8, ny = 8, ox = 34, oy = 26 + (ny - 1) * S, core = [3.5, 3.5];
  const P = ([x, y]) => [ox + x * S, oy - y * S];
  let body = '';
  for (const g of grid(nx, ny)) {
    const h = M.screwField(g[0] - core[0], g[1] - core[1], 1) + 0.5; // 0 … 1 going round
    body += `<circle class="hd-atom-h" cx="${f1(P(g)[0])}" cy="${f1(P(g)[1])}" r="${f1(0.4 * S)}" style="--h:${Math.round(18 + 72 * h)}%"/>`;
  }
  body += line(P([-0.4, core[1]]), P(core), 'hd-dash');
  const c = P(core);
  body += `<path class="hd-ray" d="M${f1(c[0] + 26)},${f1(c[1])} A26,26 0 1 0 ${f1(c[0] + 18.4)},${f1(c[1] + 18.4)}" marker-end="url(#hd-arrow)"/>`;
  body += circle(c, 4, 'hd-c-dot');
  body += text([P([0, core[1]])[0] - 4, c[1] - 8], txt('diagScrewStep'), 'hd-small', 'start');
  body += text([(ox + P([nx - 1, 0])[0]) / 2, oy + 32], txt('diagScrewCaption'), 'hd-caption');
  return svg(2 * ox + (nx - 1) * S, oy + 40, body, txt('diagScrewCaption'));
}

/** The Burgers circuit: around the edge dislocation it fails to close (S → F = b); in a perfect crystal the same steps close. */
export function burgersDiagram() {
  const n = 6, gap = 2.2, ox = 28, oy = 30 + (n - 1) * 30, s = 30, core = [2.5, 2.5];
  const P = ([x, y], dx = 0) => [ox + (x + dx) * s, oy - y * s];
  const steps = M.circuitSteps(4);
  let body = '';
  const panel = (atoms, dx, label) => {
    for (const a of atoms) body += circle(P(a.pos, dx), 0.36 * s, 'hd-atom is-faint');
    const start = atoms.findIndex(a => a.f[0] === 1 && a.f[1] === 1);
    const w = M.walkCircuit(atoms, start, M.FRAMES[2], steps, 1);
    const pts = w.path.map(i => P(atoms[i].pos, dx));
    body += `<polyline class="hd-circuit" points="${pts.map(p => p.map(f1).join(',')).join(' ')}"/>`;
    const S0 = pts[0], F = pts[pts.length - 1], open = Math.hypot(F[0] - S0[0], F[1] - S0[1]) > 3;
    body += text([S0[0] - 8, S0[1] + 18], 'S', 'hd-text');
    if (open) {
      body += text([F[0] + 8, F[1] + 18], 'F', 'hd-text');
      body += line(S0, F, 'hd-hl', ' marker-end="url(#hd-arrow-hl)"') + text([(S0[0] + F[0]) / 2, S0[1] + 32], it('b'), 'hd-text hd-hl-text');
    } else body += text([S0[0] + 16, S0[1] + 18], '= F', 'hd-text');
    body += text([P([(n - 1) / 2, 0], dx)[0], oy + 44], label, 'hd-caption');
  };
  panel(layer(n, n, { kind: 'edge', line: 2, at: core, b: 1, nu: M.NU }), 0, txt('diagBurgersReal'));
  const c = P(core);
  body += `<path class="hd-perp" d="M${f1(c[0] - 9)},${f1(c[1] + 4)} H${f1(c[0] + 9)} M${f1(c[0])},${f1(c[1] + 4)} V${f1(c[1] - 12)}"/>`;
  panel(layer(n, n, null), n - 1 + gap, txt('diagBurgersPerfect'));
  return svg(2 * ox + (2 * n - 2 + gap) * s, oy + 52, body, txt('diagBurgersCaption'));
}

/** Glide: the line enters, crosses and leaves; afterwards the top half has slipped by b and each side has a step. */
export function glideDiagram() {
  const nx = 6, ny = 5, s = 17, gapX = 2.4, ox = 18, oy = 22 + (ny - 1) * s;
  const P = ([x, y], dx) => [ox + (x + dx) * s, oy - y * s];
  let body = '';
  [-1, 2.5, 7].forEach((x, k) => {
    const dx = k * (nx - 1 + gapX), y = 1.5;
    const shift = x < -0.5 ? () => [0, 0, 0] : x > nx - 0.5 ? p => [(p[1] > y ? 0.5 : -0.5), 0, 0] : M.dislocationShift({ kind: 'edge', line: 2, at: [x, y], b: 1, nu: M.NU }, 1);
    for (const g of grid(nx, ny)) { const f = [...g, 0], u = shift(f); body += circle(P([g[0] + u[0], g[1] + u[1]], dx), 0.4 * s, 'hd-atom'); }
    if (x > -0.5 && x < nx - 0.5) { const c = P([x, y], dx); body += `<path class="hd-perp" d="M${f1(c[0] - 7)},${f1(c[1] + 3)} H${f1(c[0] + 7)} M${f1(c[0])},${f1(c[1] + 3)} V${f1(c[1] - 9)}"/>`; }
    body += text([P([(nx - 1) / 2, 0], dx)[0], oy + 22], [txt('diagGlide1'), txt('diagGlide2'), txt('diagGlide3')][k], 'hd-small');
  });
  const W = 2 * ox + (3 * (nx - 1) + 2 * gapX) * s;
  return svg(W, oy + 30, body, txt('diagGlideCaption'));
}
