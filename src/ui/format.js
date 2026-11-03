/* Number and index formatting for the interface. */

/** n significant figures, without exponent notation for the magnitudes used here. */
export function sig(x, n = 4) {
  if (x == null || !Number.isFinite(x)) return '—';
  if (Math.abs(x) < 1e-10) return '0';
  const p = n - 1 - Math.floor(Math.log10(Math.abs(x)));
  const v = Math.round(x * 10 ** p) / 10 ** p;
  return p > 0 ? v.toFixed(p) : String(v);
}

/** Fixed decimals, trailing zeros trimmed: 4.000 → "4", 3.615 → "3.615". */
export const trim = (x, d = 4) => String(+(+x).toFixed(d));

/** (x, y, z) with true minus signs, 3 decimals at most. */
export const pointText = f => `(${f.map(x => trim(x, 3).replace('-', '−')).join(', ')})`;

const GLYPH = [[0.25, '¼'], [0.5, '½'], [0.75, '¾'], [1 / 3, '⅓'], [2 / 3, '⅔']];
/** 0.5 → "½", 1.25 → "1¼", −0.5 → "−½" */
export function coordText(x) {
  const sign = x < -1e-9 ? '−' : '', ax = Math.abs(x), whole = Math.floor(ax + 1e-9), frac = ax - whole;
  if (frac < 1e-6) return `${sign}${whole}`;
  const g = GLYPH.find(([v]) => Math.abs(v - frac) < 1e-6);
  return `${sign}${whole || ''}${g ? g[1] : trim(frac, 3)}`;
}
export const posText = f => `(${f.map(coordText).join(', ')})`;

const BRACKETS = { dir: ['[', ']'], plane: ['(', ')'], family: ['{', '}'], dirFamily: ['⟨', '⟩'] };

/** Miller indices as HTML with bars over negative numbers: idx([1,-1,0], 'dir') → [1̄10] */
export function idx(values, kind = 'dir') {
  const [o, c] = BRACKETS[kind];
  // thin spaces between numbers for four indices or two-digit values: [2 1̄ 1̄ 0]
  const sep = values.length === 4 || values.some(v => Math.abs(v) >= 10) ? ' ' : '';
  return `<span class="idx">${o}${values.map(v => (v < 0 ? `<span class="ob">${-v}</span>` : `${v}`)).join(sep)}${c}</span>`;
}

/** "d" with the indices as a subscript, bars over negatives: d₁₁̄₀ */
export function dSym(values) {
  const sep = values.some(v => Math.abs(v) >= 10) ? ' ' : '';
  return `<i>d</i><sub class="dsub">${values.map(v => (v < 0 ? `<span class="ob">${-v}</span>` : `${v}`)).join(sep)}</sub>`;
}

/** A fraction { p, q } as text: ½, ⅓, ⅔, 3/2, −1, ∞ (null). */
export function fracText(r) {
  if (r == null) return '∞';
  const sign = r.p < 0 ? '−' : '', p = Math.abs(r.p);
  if (r.q === 1) return `${sign}${p}`;
  const glyph = { '1/2': '½', '1/3': '⅓', '2/3': '⅔', '1/4': '¼', '3/4': '¾', '1/6': '⅙', '5/6': '⅚' }[`${p}/${r.q}`];
  return `${sign}${glyph || `${p}/${r.q}`}`;
}

const GLYPHS = [[1 / 8, '⅛'], [1 / 6, '⅙'], [1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [1, '1']];
/** 0.125 → "⅛", 0.5 → "½", 1 → "1" */
export function fractionGlyph(x) {
  const hit = GLYPHS.find(([v]) => Math.abs(v - x) < 1e-6);
  return hit ? hit[1] : trim(x, 3);
}

/** { groups: [{ share, count }], total } → "8 × ⅛ + 6 × ½ = 4" */
export function countFormula({ groups, total }) {
  return `${groups.map(g => `${g.count} × ${fractionGlyph(g.share)}`).join(' + ')} = ${trim(total, 3)}`;
}

export const SYMBOL = { a: 'a', b: 'b', c: 'c', alpha: 'α', beta: 'β', gamma: 'γ' };
export const UNIT = { a: 'Å', b: 'Å', c: 'Å', alpha: '°', beta: '°', gamma: '°' };
