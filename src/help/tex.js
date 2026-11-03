/* =====================================================================
   TeX for the help system and the cards: source helpers (plain strings;
   numbers use the same rounding as the rest of the interface,
   src/ui/format.js) and KaTeX rendering for every formula in the app.
   ===================================================================== */
import katex from 'katex';
import { sig, trim } from '../ui/format.js';

/** A number with n significant figures. */
export const tn = (x, n = 4) => (Number.isFinite(x) ? sig(x, n) : '?');

/** A very large or small number in scientific form: 2.19\times10^{25}. */
export function tSci(x, n = 3) {
  if (!(x > 0) || !Number.isFinite(x)) return '?';
  const e = Math.floor(Math.log10(x)), m = +(x / 10 ** e).toPrecision(n);
  return e === 0 ? `${m}` : String.raw`${m}\times10^{${e}}`;
}

/** A number with at most d decimals, trailing zeros trimmed. */
export const tt = (x, d = 4) => (Number.isFinite(+x) ? trim(x, d) : '?');

/** Ångström unit after a number. */
export const ANG = String.raw`\,\text{Å}`;
export const ANG2 = String.raw`\,\text{Å}^2`;
export const ANG3 = String.raw`\,\text{Å}^3`;
export const DEG = String.raw`^\circ`;

const BR = { dir: ['[', ']'], plane: ['(', ')'], family: [String.raw`\{`, String.raw`\}`], dirFamily: [String.raw`\langle `, String.raw`\rangle`] };

/** Miller indices with bars over negative numbers: [1 −1 0] → [1\overline{1}0]. */
export function tIdx(values, kind = 'dir') {
  const [o, c] = BR[kind];
  const sep = values.length === 4 || values.some(v => Math.abs(v) >= 10) ? String.raw`\,` : '';
  return `${o}${values.map(v => (v < 0 ? String.raw`\overline{${-v}}` : `${v}`)).join(sep)}${c}`;
}

/** Indices for a subscript: 111, 1\overline{1}0 */
export const tIdxBare = v => tIdx(v, 'dir').slice(1, -1);

/** Indices as plain text for titles: [1̄10] with combining overlines. */
export function tIdxPlain(v, kind) {
  const [o, c] = kind === 'plane' ? ['(', ')'] : ['[', ']'];
  const sep = v.length === 4 || v.some(x => Math.abs(x) >= 10) ? ' ' : '';
  return `${o}${v.map(x => (x < 0 ? [...String(-x)].map(ch => `${ch}̅`).join('') : String(x))).join(sep)}${c}`;
}

/** A plain integer in a formula: negative numbers in brackets, e.g. (−1). */
export const tInt = v => (v < 0 ? `(${v})` : `${v}`);

/** Matrix of numbers: n significant figures, trailing zeros dropped (16, 0.0625, −8). */
export const tMat = (rows, n = 4) =>
  String.raw`\begin{pmatrix}${rows.map(r => r.map(x => (Math.abs(x) < 1e-10 ? '0' : tt(+x.toPrecision(n), 8))).join(' & ')).join(String.raw` \\ `)}\end{pmatrix}`;

/** Column vector of (already formatted) entries. */
export const tCol = entries => String.raw`\begin{pmatrix}${entries.join(String.raw` \\ `)}\end{pmatrix}`;

/** Row of numbers in brackets: (1, 0.5, 0). */
export const tVec = (v, n = 4) => `(${v.map(x => tn(x, n)).join(String.raw`,\ `)})`;

/** A fraction { p, q } (null → ∞) as TeX. */
export function tFrac(r) {
  if (r == null) return String.raw`\infty`;
  const sign = r.p < 0 ? '-' : '', p = Math.abs(r.p);
  return r.q === 1 ? `${sign}${p}` : String.raw`${sign}\tfrac{${p}}{${r.q}}`;
}

/** Common fractions of fractional coordinates: 0.5 → ½ etc. */
export function tCoord(x) {
  for (const q of [1, 2, 3, 4, 6, 8]) {
    const p = Math.round(x * q);
    if (Math.abs(p / q - x) < 1e-6) return tFrac({ p, q });
  }
  return tn(x, 3);
}

export const tPoint = f => `(${f.map(tCoord).join(',\\ ')})`;

/* ---------- KaTeX rendering (results are cached, so each formula is typeset
   once; the stylesheet and its fonts are imported in src/main.js) ---------- */

const cache = new Map();

/** TeX → HTML (inline). With { display: true } a centred block formula. */
export function tex(src, { display = false } = {}) {
  const key = (display ? 'D' : 'I') + src;
  let html = cache.get(key);
  if (html == null) {
    html = katex.renderToString(src, { displayMode: display, throwOnError: false, strict: 'ignore', output: 'htmlAndMathml' });
    if (cache.size > 3000) cache.clear();
    cache.set(key, html);
  }
  return html;
}

/**
 * A block formula in display style that may wrap onto the next line after an
 * "=", "⇒" or "+" when its box is too narrow (KaTeX only breaks inline maths,
 * so this is inline maths with \displaystyle in a centred block).
 */
export const texWrap = src => `<span class="tex-wrap">${tex(`\\displaystyle ${src}`)}</span>`;

/** Throws when a formula has a TeX error (used by the tests). */
export function checkTex(src) {
  katex.renderToString(src, { displayMode: true, throwOnError: true, strict: 'error' });
  return true;
}
