/* Miller and Miller–Bravais indices: parsing and conversion. */
import { gcdAll } from './linalg.js';
import { txt } from '../text.js';

const minus = n => (n < 0 ? `−${-n}` : `${n}`);
const list = v => v.map(minus).join(' ');

/** Accepts "1 -1 0", "1,-1,0", "[1-10]", "(111)", "2-1-10" or "1 −1 0" (Unicode minus). */
function parseIndices(text) {
  const s = String(text).replace(/[−–]/g, '-').replace(/[\[\]\(\)\{\}<>]/g, ' ').trim();
  if (!s) return { error: txt('msgIdxEmpty') };
  let tokens;
  if (/[\s,;]/.test(s)) {
    tokens = s.split(/[\s,;]+/).filter(Boolean);
  } else {
    if (s.replace(/-?\d/g, '') !== '') return { error: txt('msgIdxWhole') };
    tokens = s.match(/-?\d/g);
  }
  const values = tokens.map(Number);
  if (values.some(v => !Number.isInteger(v))) return { error: txt('msgIdxWhole') };
  if (values.every(v => v === 0)) return { error: txt('msgIdxNonZero') };
  return { values };
}

/** Divide a list of integers by their greatest common divisor. */
export function reduceIndices(v) {
  const g = gcdAll(v) || 1;
  return v.map(x => x / g + 0);
}

const fourNotAllowed = (kind, hexagonal) => (hexagonal
  ? txt('msgIdxFourBasic', { example: kind === 'dir' ? '1 0 0' : '1 0 0' })
  : txt('msgIdxFourNotHex', { example: kind === 'dir' ? '1 1 0' : '1 1 1' }));

/**
 * [uvw], or on hexagonal axes also the Miller–Bravais form [uvtw] → [u−t, v−t, w],
 * reduced to the smallest whole numbers. allowFour = false rejects four indices
 * with a friendly message (four-index typing is an Advanced-mode feature).
 */
export function parseDirection(text, hexagonal, { allowFour = true } = {}) {
  const p = parseIndices(text);
  if (p.error) return p;
  const v = p.values;
  if (v.length === 3) return { uvw: v, four: null };
  if (v.length === 4) {
    if (!hexagonal || !allowFour) return { error: fourNotAllowed('dir', hexagonal) };
    const [u, w1, t, w] = v;
    if (u + w1 + t !== 0) {
      const fixed = [u, w1, -(u + w1), w];
      return { error: txt('msgIdxDirFour', { u: minus(u), v: minus(w1), t: minus(-(u + w1)), fixed: list(fixed) }) };
    }
    return { uvw: reduceIndices([u - t, w1 - t, w]), four: v };
  }
  return { error: hexagonal && allowFour ? txt('msgIdxDirFourAllowed') : txt('msgIdxDir') };
}

/** (hkl), or on hexagonal axes also (hkil) with i = −(h + k). */
export function parsePlane(text, hexagonal, { allowFour = true } = {}) {
  const p = parseIndices(text);
  if (p.error) return p;
  const v = p.values;
  if (v.length === 3) return { hkl: v, four: null };
  if (v.length === 4) {
    if (!hexagonal || !allowFour) return { error: fourNotAllowed('plane', hexagonal) };
    const [h, k, i, l] = v;
    if (h + k + i !== 0) {
      const fixed = [h, k, -(h + k), l];
      return { error: txt('msgIdxPlaneFour', { h: minus(h), k: minus(k), i: minus(-(h + k)), fixed: list(fixed) }) };
    }
    return { hkl: [h, k, l], four: v };
  }
  return { error: hexagonal && allowFour ? txt('msgIdxPlaneFourAllowed') : txt('msgIdxPlane') };
}

/**
 * Three-index direction [uvw] → Miller–Bravais [UVTW] with
 * U = (2u − v)/3, V = (2v − u)/3, T = −(u + v)/3, W = w, cleared to the smallest integers.
 */
export function directionToFour([u, v, w]) {
  return reduceIndices([2 * u - v, 2 * v - u, -(u + v), 3 * w]);
}

/** Three-index plane (hkl) → Miller–Bravais (hkil) with i = −(h + k). */
export function planeToFour([h, k, l]) {
  return [h, k, -(h + k) + 0, l];
}
