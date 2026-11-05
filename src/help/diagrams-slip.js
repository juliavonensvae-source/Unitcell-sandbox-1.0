/* =====================================================================
   Pictures for the help topics on close-packed planes and slip: the
   densest plane of cubic P, I and F seen straight on (touching atoms and
   the close-packed directions), and the two paths an atom above a
   close-packed layer can take (straight over an atom, or through the
   empty hollow: two Shockley partials). SVG strings, no DOM.
   ===================================================================== */
import { svg, line, text, circle, it } from './diagrams.js';
import { txt } from '../text.js';

const R = 11; // px: atom radius in the plane pictures
const PW = 120, PH = 112, GAP = 16, M0 = 8;

/**
 * The atoms of one plane, seen straight on, inside a PW × PH box at x0: a 2D lattice (e1, e2) with an extra point
 * `extra` per cell (or none), the middle atom at the box centre. A line runs along each row of touching atoms through
 * the middle atom: the close-packed directions.
 */
function planePanel(x0, { e1, e2, extra = null, dirs }, highlight) {
  const cx = x0 + PW / 2, cy = M0 + PH / 2, out = [];
  const fits = ([x, y]) => x - R >= x0 - 0.5 && x + R <= x0 + PW + 0.5 && y - R >= M0 - 0.5 && y + R <= M0 + PH + 0.5;
  /** How many steps d from the middle atom stay inside the box. */
  const steps = d => { let k = 0; while (fits([cx + (k + 1) * d[0], cy + (k + 1) * d[1]])) k++; return k; };
  for (let i = -6; i <= 6; i++) {
    for (let j = -6; j <= 6; j++) {
      for (const t of [[0, 0], ...(extra ? [extra] : [])]) {
        const p = [cx + (i + t[0]) * e1[0] + (j + t[1]) * e2[0], cy + (i + t[0]) * e1[1] + (j + t[1]) * e2[1]];
        if (fits(p)) out.push(p);
      }
    }
  }
  let body = highlight ? `<rect class="hd-panel-on" x="${x0 - 4}" y="${M0 - 4}" width="${PW + 8}" height="${PH + 8}"/>` : '';
  body += out.map(p => circle(p, R, 'hd-ball-a')).join('');
  for (const d of dirs) {
    const k = Math.min(steps(d), steps([-d[0], -d[1]]));
    body += line([cx - k * d[0], cy - k * d[1]], [cx + k * d[0], cy + k * d[1]], 'hd-hl-thin');
  }
  return body + circle([cx, cy], 3.5, 'hd-c-dot');
}

/** The densest plane of cubic P {100}, cubic I {110} and cubic F {111}, side by side; the lattice on screen is framed. */
export function slipPlanesDiagram(current = null) {
  const s = 2 * R, a = (4 * R) / Math.sqrt(3); // touching along the close-packed directions; a of cubic I in the {110} picture
  const panels = [
    { id: 'cP', title: txt('diagSlipSC'), sub: txt('diagSlipSCSub'), e1: [s, 0], e2: [0, s], dirs: [[s, 0], [0, s]] },
    { id: 'cI', title: txt('diagSlipBCC'), sub: txt('diagSlipBCCSub'), e1: [a, 0], e2: [0, a * Math.SQRT2], extra: [0.5, 0.5], dirs: [[a / 2, (a * Math.SQRT2) / 2], [-a / 2, (a * Math.SQRT2) / 2]] },
    { id: 'cF', title: txt('diagSlipFCC'), sub: txt('diagSlipFCCSub'), e1: [s, 0], e2: [s / 2, (s * Math.sqrt(3)) / 2], dirs: [[s, 0], [s / 2, (s * Math.sqrt(3)) / 2], [-s / 2, (s * Math.sqrt(3)) / 2]] },
  ];
  let body = '';
  panels.forEach((p, k) => {
    const x0 = M0 + k * (PW + GAP);
    body += planePanel(x0, p, p.id === current);
    body += text([x0 + PW / 2, M0 + PH + 20], p.title, 'hd-text');
    body += text([x0 + PW / 2, M0 + PH + 36], p.sub, 'hd-small');
  });
  const W = 2 * M0 + 3 * PW + 2 * GAP;
  return svg(W, M0 + PH + 46, body, txt('diagSlipCaption'));
}

/**
 * A close-packed layer A seen from above, with one atom B of the layer above. Straight to the next B hollow it would ride
 * over an A atom (b, dashed); the easy way is through the empty C hollow in two steps, b₁ then b₂.
 */
export function partialsDiagram() {
  const r = 32, s = 2 * r, W = 440, H = 262, top = H - 50;
  const a1 = [s, 0], a2 = [s / 2, (-s * Math.sqrt(3)) / 2], third = [(a1[0] + a2[0]) / 3, (a1[1] + a2[1]) / 3];
  // the path B → B' is centred in the picture
  const O = [W / 2 - s / 2 - third[0], 112 - third[1]];
  const at = (i, j) => [O[0] + i * a1[0] + j * a2[0], O[1] + i * a1[1] + j * a2[1]];
  let atoms = '';
  for (let i = -5; i <= 6; i++) {
    for (let j = -2; j <= 3; j++) {
      const p = at(i, j);
      if (p[0] > -r && p[0] < W + r && p[1] > -r && p[1] < top + r) atoms += circle(p, r, 'hd-ball-a');
    }
  }
  let body = `<clipPath id="hd-pd-clip"><rect x="0" y="0" width="${W}" height="${top}"/></clipPath><g clip-path="url(#hd-pd-clip)">${atoms}</g>`;
  const B = [O[0] + third[0], O[1] + third[1]], C = [B[0] + third[0], B[1] + third[1]], B2 = [B[0] + s, B[1]];
  const A = at(1, 0);
  body += text([A[0], A[1] + 27], 'A', 'hd-text');
  // the atom of the layer above, where it starts and where it ends
  body += circle(B2, 0.5 * r, 'hd-vac') + circle(B, 0.5 * r, 'hd-atom-b');
  body += text([B[0] - 0.5 * r - 6, B[1] + 5], 'B', 'hd-text', 'end') + text([B2[0] + 0.5 * r + 6, B2[1] + 5], 'B', 'hd-text', 'start');
  body += circle(C, 4.5, 'hd-c-dot') + text([C[0], C[1] - 12], 'C', 'hd-text');
  // the straight path, over the A atom between the two B hollows
  body += line([B[0], B[1] + 0.5 * r + 8], [B2[0], B2[1] + 0.5 * r + 8], 'hd-dash', ' marker-end="url(#hd-arrow)"');
  body += text([B2[0] + 8, B[1] + 0.5 * r + 13], it('b'), 'hd-text', 'start');
  // the zig-zag through C: two Shockley partials
  body += line(B, C, 'hd-hl-thin', ' marker-end="url(#hd-arrow-hl)"') + line(C, B2, 'hd-hl-thin', ' marker-end="url(#hd-arrow-hl)"');
  body += text([(B[0] + C[0]) / 2 - 8, (B[1] + C[1]) / 2 - 6], `${it('b')}₁`, 'hd-text hd-hl-text', 'end');
  body += text([(C[0] + B2[0]) / 2 + 8, (C[1] + B2[1]) / 2 - 6], `${it('b')}₂`, 'hd-text hd-hl-text', 'start');
  body += text([W / 2, H - 26], txt('diagPartials1'), 'hd-caption');
  body += text([W / 2, H - 9], txt('diagPartials2'), 'hd-caption');
  return svg(W, H, body, txt('diagPartialsCaption'));
}
