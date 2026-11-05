/* =====================================================================
   Challenge mode: reading and marking typed answers.

   Indices may be typed in any of the usual ways: "1 -1 0", "1,-1,0",
   "(1-10)", "[1 −1 0]", "2-1-10", or copied with bars "1̄10". Without spaces
   or commas every digit is one index ("1-10" → 1, −1, 0); with them a
   number may have two digits ("1 10 0").

   Numbers: "2.34", "2,34", "2.34 Å" or "2.34 A".
   ===================================================================== */

const BRACKETS = /[()[\]{}<>⟨⟩〈〉]/g;

/** Typed indices → { values } or { error: 'empty' | 'format' }. */
export function parseIndexText(text) {
  let s = String(text ?? '')
    .replace(/[−–—]/g, '-')
    .replace(/(\d)[̄̅]/g, '-$1') // a digit with a bar over it is negative
    .replace(BRACKETS, ' ')
    .trim();
  if (!s) return { error: 'empty' };
  const glued = t => {
    const parts = t.match(/[+-]?\d/g);
    return parts && parts.join('') === t ? parts.map(Number) : null;
  };
  let values;
  if (/[\s,;]/.test(s)) {
    values = [];
    for (const t of s.split(/[\s,;]+/).filter(Boolean)) {
      if (/^[+-]?\d+$/.test(t)) values.push(Number(t));
      else {
        const g = glued(t);
        if (!g) return { error: 'format' };
        values.push(...g);
      }
    }
  } else {
    values = glued(s);
    if (!values) return { error: 'format' };
  }
  return { values: values.map(v => v + 0) };
}

const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const neg = v => v.map(x => -x + 0);

/** The whole number k with v = k·w, or null (w must not be all zeros). */
function multipleOf(v, w) {
  let k = null;
  for (let i = 0; i < w.length; i++) {
    if (w[i] === 0) { if (v[i] !== 0) return null; continue; }
    const r = v[i] / w[i];
    if (!Number.isInteger(r) || (k != null && r !== k)) return null;
    k = r;
  }
  return k;
}

/**
 * Marks typed indices against spec { values, negativeOk }.
 * → { ok, hint } with hint null, 'count' (wrong number of indices),
 *   'reduce' (right, but not the smallest whole numbers) or 'reversed' (the opposite sign).
 */
export function checkIndices(values, spec) {
  const want = spec.values;
  if (values.length !== want.length) return { ok: false, hint: 'count' };
  if (same(values, want) || (spec.negativeOk && same(values, neg(want)))) return { ok: true, hint: null };
  if (values.every(x => x === 0)) return { ok: false, hint: null };
  const k = multipleOf(values, want);
  if (k != null && (k > 1 || (spec.negativeOk && k < -1))) return { ok: false, hint: 'reduce' };
  if (k === -1) return { ok: false, hint: 'reversed' };
  if (k != null && k < -1) return { ok: false, hint: 'reduce' };
  return { ok: false, hint: null };
}

/** A typed number → { value } or { error: 'empty' | 'format' }. */
export function parseNumberText(text) {
  const s = String(text ?? '')
    .replace(/[−–—]/g, '-')
    .replace(/\s*(å|Å|a|A|angstroms?|ångström?s?)\s*$/i, '')
    .replace(/\s+/g, '')
    .replace(',', '.');
  if (!s) return { error: 'empty' };
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return { error: 'format' };
  return { value: Number(s) };
}

/** Marks a typed number against spec { value, tol } (tol relative, 0 = must be exact). */
export function checkNumber(x, spec) {
  const ok = spec.tol ? Math.abs(x - spec.value) <= spec.tol * Math.abs(spec.value) + 1e-12 : Math.abs(x - spec.value) < 1e-9;
  return { ok, hint: null };
}

/**
 * Marks any typed answer against its spec:
 *   { kind: 'indices', values, negativeOk } or { kind: 'number', value, tol }.
 * → { status: 'blank' | 'right' | 'wrong', hint }
 */
export function markTyped(text, spec) {
  if (!String(text ?? '').trim()) return { status: 'blank', hint: null };
  if (spec.kind === 'indices') {
    const p = parseIndexText(text);
    if (p.error) return { status: 'wrong', hint: 'format' };
    const r = checkIndices(p.values, spec);
    return { status: r.ok ? 'right' : 'wrong', hint: r.hint };
  }
  const p = parseNumberText(text);
  if (p.error) return { status: 'wrong', hint: 'format' };
  const r = checkNumber(p.value, spec);
  return { status: r.ok ? 'right' : 'wrong', hint: r.hint };
}

/**
 * The answer of a hand-written [fixed] question with no wrong options, as a spec:
 * "(1 1 0)" → indices (kind 'plane'), "[1 1 0]" → indices ('dir'), "14" or "2.34 Å" → a number.
 * → { spec, bracket } or null when the answer can't be read.
 */
export function fixedAnswerSpec(answer, negativeOk = false) {
  const s = String(answer).trim();
  const bracket = { '(': 'plane', '[': 'dir', '{': 'family', '<': 'dirFamily', '⟨': 'dirFamily' }[s[0]] || null;
  if (!bracket) {
    const n = parseNumberText(s);
    if (!n.error) {
      const decimals = (/[.,](\d+)/.exec(s) || [, ''])[1].length;
      return { spec: { kind: 'number', value: n.value, tol: decimals ? 0.01 : 0 }, bracket: null };
    }
  }
  const p = parseIndexText(s);
  if (p.error || p.values.length < 2) return null;
  return { spec: { kind: 'indices', values: p.values, negativeOk }, bracket: bracket || 'dir' };
}
